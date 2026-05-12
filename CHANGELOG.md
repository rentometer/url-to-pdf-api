# CHANGELOG

* render controls for the printshop deployment:
  * default `goto.waitUntil` switched from `networkidle0` to `networkidle2` (override with `RENDER_WAIT_UNTIL`)
  * default `goto.timeout` is now 25000ms — sits below Heroku's 30s H12 router timeout so a stuck render fails clean (override with `RENDER_GOTO_TIMEOUT_MS`)
  * concurrency limiter middleware caps in-flight `/api/render` requests (`MAX_CONCURRENT_RENDERS`, default 10) and queues the rest up to `RENDER_QUEUE_MAX` (default 50). Past the queue cap the limiter responds 503 immediately rather than letting requests pile up at the H12.
* change the `:html` output to return `document.documentElement.innerHTML` instead of previously used `document.body.innerHTML`

## 1.0.0

* initial version
