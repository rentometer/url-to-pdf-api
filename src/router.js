const _ = require('lodash');
const Joi = require('joi');

// express-validation@1 calls the legacy static `Joi.validate(value, schema,
// opts, cb)` which joi >=16 removed. Re-expose it on top of `schema.validate`
// so we don't have to migrate to express-validation@4 (which has a different
// option shape — no `contextRequest`, no per-section allowUnknown flags).
if (typeof Joi.validate !== 'function') {
  Joi.validate = (value, schema, options, callback) => {
    const result = Joi.compile(schema).validate(value, options);
    if (typeof callback === 'function') {
      callback(result.error, result.value);
      return undefined;
    }
    return result;
  };
}

const validate = require('express-validation');
const express = require('express');
const render = require('./http/render-http');
const config = require('./config');
const logger = require('./util/logger')(__filename);
const createConcurrencyLimiter = require('./middleware/concurrency-limiter');
const { renderQuerySchema, renderBodySchema, sharedQuerySchema } = require('./util/validation');

function createRouter() {
  const router = express.Router();

  if (!_.isEmpty(config.API_TOKENS)) {
    logger.info('x-api-key authentication required');

    router.use('/*', (req, res, next) => {
      const userToken = req.headers['x-api-key'];
      if (!_.includes(config.API_TOKENS, userToken)) {
        const err = new Error('Invalid API token in x-api-key header.');
        err.status = 401;
        return next(err);
      }

      return next();
    });
  } else {
    logger.warn('Warning: no authentication required to use the API');
  }

  // Single shared limiter — both routes share the same in-flight budget.
  const renderLimiter = createConcurrencyLimiter({
    maxConcurrent: config.MAX_CONCURRENT_RENDERS,
    maxQueueSize: config.RENDER_QUEUE_MAX,
  });
  logger.info(`Render concurrency cap: ${config.MAX_CONCURRENT_RENDERS} active, ${config.RENDER_QUEUE_MAX} queued`);

  const getRenderSchema = {
    query: renderQuerySchema,
    options: {
      allowUnknownBody: false,
      allowUnknownQuery: false,
    },
  };
  router.get('/api/render', validate(getRenderSchema), renderLimiter, render.getRender);

  const postRenderSchema = {
    body: renderBodySchema,
    query: sharedQuerySchema,
    options: {
      allowUnknownBody: false,
      allowUnknownQuery: false,

      // Without this option, text body causes an error
      // https://github.com/AndrewKeig/express-validation/issues/36
      contextRequest: true,
    },
  };
  router.post('/api/render', validate(postRenderSchema), renderLimiter, render.postRender);

  router.get('/healthcheck', (req, res) => res.status(200).send('OK'));

  return router;
}

module.exports = createRouter;
