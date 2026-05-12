/* eslint-env mocha */
/* eslint-disable no-unused-expressions, global-require, no-process-env */

// These tests pin the default render options so we don't accidentally drift
// back to the upstream `networkidle0` default, which is what made our 30s
// Heroku H12 timeouts so frequent — see e57b5ae upstream and the Rentometer
// printshop incident report. We test through `getDefaultRenderOpts()` so we
// don't have to launch Puppeteer.

const { expect } = require('chai');

function loadFreshRenderCore() {
  delete require.cache[require.resolve('../src/core/render-core')];
  delete require.cache[require.resolve('../src/config')];
  return require('../src/core/render-core');
}

describe('render-core default options', () => {
  let savedEnv;

  beforeEach(() => {
    savedEnv = {
      RENDER_WAIT_UNTIL: process.env.RENDER_WAIT_UNTIL,
      RENDER_GOTO_TIMEOUT_MS: process.env.RENDER_GOTO_TIMEOUT_MS,
    };
    delete process.env.RENDER_WAIT_UNTIL;
    delete process.env.RENDER_GOTO_TIMEOUT_MS;
  });

  afterEach(() => {
    if (savedEnv.RENDER_WAIT_UNTIL === undefined) {
      delete process.env.RENDER_WAIT_UNTIL;
    } else {
      process.env.RENDER_WAIT_UNTIL = savedEnv.RENDER_WAIT_UNTIL;
    }
    if (savedEnv.RENDER_GOTO_TIMEOUT_MS === undefined) {
      delete process.env.RENDER_GOTO_TIMEOUT_MS;
    } else {
      process.env.RENDER_GOTO_TIMEOUT_MS = savedEnv.RENDER_GOTO_TIMEOUT_MS;
    }
  });

  it('uses networkidle2 as the default goto.waitUntil', () => {
    const renderCore = loadFreshRenderCore();
    const opts = renderCore.getDefaultRenderOpts();
    expect(opts.goto.waitUntil).to.equal('networkidle2');
  });

  it('sets a goto.timeout strictly below the Heroku H12 30s router timeout', () => {
    const renderCore = loadFreshRenderCore();
    const opts = renderCore.getDefaultRenderOpts();
    expect(opts.goto.timeout).to.be.a('number');
    expect(opts.goto.timeout).to.be.below(30000);
  });

  it('respects RENDER_WAIT_UNTIL env override', () => {
    process.env.RENDER_WAIT_UNTIL = 'load';
    const renderCore = loadFreshRenderCore();
    const opts = renderCore.getDefaultRenderOpts();
    expect(opts.goto.waitUntil).to.equal('load');
  });

  it('respects RENDER_GOTO_TIMEOUT_MS env override', () => {
    process.env.RENDER_GOTO_TIMEOUT_MS = '12345';
    const renderCore = loadFreshRenderCore();
    const opts = renderCore.getDefaultRenderOpts();
    expect(opts.goto.timeout).to.equal(12345);
  });
});
