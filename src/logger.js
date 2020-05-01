const { createMeta } = require('./helpers')

// TODO: cover with units

const EVENTS = [
  'event.published',
  'event.received',
  'event.ack',
  'event.nack',
  'request.sent',
  'request.received',
  'response.success.sent',
  'response.error.sent',
  'response.error.received',
  'response.success.received',
  'queue.configured',
  'request.queue.configured',
  'request.queue.deleted'
]

const toLogger = (logger, prefix) => (message, data) => {
  logger.log(`${createMeta(prefix)} ${message}`)

  if (data) {
    logger.dir(data, { colors: true, depth: 10 })
  }
}

module.exports = ctx => {
  if (!ctx.logger) { return ctx }

  const log = toLogger(ctx.logger, ctx.connectionId ? `AMQP:${ctx.connectionId}` : 'AMQP')

  EVENTS.reduce((events, key) => events
    .on(key, event => log(formatMessage(key, event))), ctx.events)

  return ctx
}

function formatMessage(key, event) {
  const pretty = key.replace(/\./g, '_').toUpperCase()
  let log = [pretty]

  if (pretty.includes('QUEUE')) {
    log = log.concat([
      event && `queue=${event}`
    ])
  } else {
    const isOut = pretty.includes('_SENT')
    log = log.concat([
      event.id && `correlation_id=${event.id}`,
      event.requestId && `request_id=${event.requestId}`,
      event.appId && `app_id=${event.appId}`,
      !isOut && event.routingKey && `routing_key=${event.routingKey}`,
      isOut && event.replyTo && `replyTo=${event.replyTo}`,
      !isOut && event.payload && `payload=${JSON.stringify(event.payload)}`,
      isOut && event.response && `payload=${JSON.stringify(event.response)}`
    ])
  }

  return log
    .filter(value => !!value)
    .join(' ')
}
