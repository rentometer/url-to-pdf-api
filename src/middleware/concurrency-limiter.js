// Express middleware that caps the number of concurrent in-flight requests
// past it. Excess requests are queued until a slot frees up; once the queue
// itself is full, requests are rejected with 503.
//
// Why we need it: each Puppeteer render holds a Chrome page (~50–150MB RAM
// and a chunk of CPU). Without a cap, Express happily accepts more renders
// than the dyno can finish before Heroku's 30s H12, and the whole pipeline
// jams in a cascade of timeouts. See the printshop incident notes for the
// failure mode this exists to prevent.

function createConcurrencyLimiter(options) {
  const opts = options || {};
  const { maxConcurrent } = opts;
  const maxQueueSize = opts.maxQueueSize == null ? 50 : opts.maxQueueSize;

  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
    throw new Error('createConcurrencyLimiter requires maxConcurrent >= 1');
  }

  let active = 0;
  const queue = [];

  function dequeue() {
    if (queue.length === 0) return;
    const next = queue.shift();
    next();
  }

  return function concurrencyLimiter(req, res, next) {
    const run = () => {
      active += 1;
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        active -= 1;
        dequeue();
      };
      // Cover both the normal completion ('finish') and the client-disconnect
      // ('close' before 'finish') cases. `released` makes this idempotent.
      res.once('finish', release);
      res.once('close', release);
      next();
    };

    if (active < maxConcurrent) {
      run();
    } else if (queue.length < maxQueueSize) {
      queue.push(run);
    } else {
      res.status(503).send('Server overloaded — render queue full');
    }
  };
}

module.exports = createConcurrencyLimiter;
