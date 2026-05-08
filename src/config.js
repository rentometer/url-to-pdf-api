/* eslint-disable no-process-env */

// Env vars should be casted to correct types
const config = {
  PORT: Number(process.env.PORT) || 9000,
  NODE_ENV: process.env.NODE_ENV,
  LOG_LEVEL: process.env.LOG_LEVEL,
  ALLOW_HTTP: process.env.ALLOW_HTTP === 'true',
  DEBUG_MODE: process.env.DEBUG_MODE === 'true',
  DISABLE_HTML_INPUT: process.env.DISABLE_HTML_INPUT === 'true',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  BROWSER_WS_ENDPOINT: process.env.BROWSER_WS_ENDPOINT,
  BROWSER_EXECUTABLE_PATH: process.env.BROWSER_EXECUTABLE_PATH,
  // Default `waitUntil` for `page.goto`. We use `networkidle2` instead of
  // Puppeteer / upstream's `networkidle0` because the Rentometer pages we
  // render carry analytics/auth scripts that occasionally beacon long after
  // the page is visually complete; `networkidle0` blocks until there are
  // zero in-flight requests for 500ms, which never happens reliably for us.
  RENDER_WAIT_UNTIL: process.env.RENDER_WAIT_UNTIL || 'networkidle2',
  // Sit comfortably below Heroku's 30s H12 router timeout so a stuck render
  // can fail clean and respond with an error instead of taking the whole
  // request budget and leaving downstream callers to guess.
  RENDER_GOTO_TIMEOUT_MS: Number(process.env.RENDER_GOTO_TIMEOUT_MS) || 25000,
  // Cap concurrent in-flight renders. Beyond this, requests queue; beyond
  // RENDER_QUEUE_MAX, they 503 immediately (better than piling up at H12).
  MAX_CONCURRENT_RENDERS: Number(process.env.MAX_CONCURRENT_RENDERS) || 10,
  RENDER_QUEUE_MAX: Number(process.env.RENDER_QUEUE_MAX) || 50,
  API_TOKENS: [],
  ALLOW_URLS: [],
};

if (process.env.API_TOKENS) {
  config.API_TOKENS = process.env.API_TOKENS.split(',');
}

if (process.env.ALLOW_URLS) {
  config.ALLOW_URLS = process.env.ALLOW_URLS.split(',');
}

module.exports = config;
