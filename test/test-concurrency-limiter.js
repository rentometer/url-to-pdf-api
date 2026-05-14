/* eslint-env mocha */
/* eslint-disable no-unused-expressions */

// These tests cover the concurrency limiter middleware that protects the
// dyno from accepting more concurrent renders than it can finish before
// Heroku's 30s H12 router timeout. The motivating incident: with no cap,
// Express accepted ~5+ concurrent Puppeteer renders, the dyno saturated,
// and `connect=10001ms` requests piled up at the queue, all eventually
// timing out as a single cascade.

const { expect } = require('chai');
const createConcurrencyLimiter = require('../src/middleware/concurrency-limiter');

// Minimal stub of Express's res emitter — we only need on/once/emit and a
// `.send()` that fires `finish`, plus a `.status(n)` chain for 503 path.
function fakeRes() {
  const handlers = { finish: [], close: [] };
  let statusCode = 200;
  return {
    on(evt, fn) { handlers[evt].push(fn); return this; },
    once(evt, fn) { handlers[evt].push(fn); return this; },
    emit(evt) { handlers[evt].forEach((fn) => fn()); },
    status(code) { statusCode = code; return this; },
    send() { this.emit('finish'); },
    end() { this.emit('finish'); },
    get statusCode() { return statusCode; },
  };
}

describe('concurrency limiter middleware', () => {
  it('runs up to maxConcurrent requests simultaneously without queuing', () => {
    const limiter = createConcurrencyLimiter({ maxConcurrent: 3 });

    let inflight = 0;
    let observedMax = 0;
    const responses = [];

    const recordInflight = () => {
      inflight += 1;
      observedMax = Math.max(observedMax, inflight);
    };
    [0, 1, 2].forEach(() => {
      const res = fakeRes();
      responses.push(res);
      limiter({}, res, recordInflight);
    });

    expect(inflight).to.equal(3);
    expect(observedMax).to.equal(3);
  });

  it('queues requests beyond maxConcurrent and runs them when slots free up', () => {
    const limiter = createConcurrencyLimiter({ maxConcurrent: 2, maxQueueSize: 10 });

    const order = [];
    const responses = [];
    const enqueue = (label) => {
      const res = fakeRes();
      responses.push(res);
      limiter({}, res, () => order.push(label));
    };

    enqueue('a');
    enqueue('b');
    enqueue('c');
    enqueue('d');

    expect(order).to.deep.equal(['a', 'b']);

    // Finish 'a' — c should run.
    responses[0].emit('finish');
    expect(order).to.deep.equal(['a', 'b', 'c']);

    // Finish 'b' — d should run.
    responses[1].emit('finish');
    expect(order).to.deep.equal(['a', 'b', 'c', 'd']);
  });

  function runRequests(limiter, count, calls, responses) {
    [...Array(count).keys()].forEach((i) => {
      const res = fakeRes();
      responses.push(res);
      limiter({}, res, () => calls.push(i));
    });
  }

  it('rejects with 503 when the queue is full', () => {
    const limiter = createConcurrencyLimiter({ maxConcurrent: 1, maxQueueSize: 1 });

    const calls = [];
    const responses = [];
    runRequests(limiter, 3, calls, responses);

    // request 0: runs immediately. request 1: queued. request 2: rejected.
    expect(calls).to.deep.equal([0]);
    expect(responses[2].statusCode).to.equal(503);
  });

  it('only releases a slot once even if both finish and close fire', () => {
    const limiter = createConcurrencyLimiter({ maxConcurrent: 1, maxQueueSize: 5 });

    const calls = [];
    const responses = [];
    runRequests(limiter, 3, calls, responses);

    expect(calls).to.deep.equal([0]);

    // Simulate both 'finish' and 'close' firing — common in Express when the
    // client disconnects right as the response completes.
    responses[0].emit('finish');
    responses[0].emit('close');

    // Only one slot should free up — request 1 runs, but request 2 stays queued.
    expect(calls).to.deep.equal([0, 1]);
  });
});
