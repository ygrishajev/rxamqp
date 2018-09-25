const {
  yellow,
  green,
  red,
  blue
} = require('chalk')

const { createMeta } = require('./helpers')

const format = (headParts, body) => `${headParts.join(' ')}${body ? `\n${JSON.stringify(body, null, 2)}` : ''}`

const formats = {
  'event.published': event => format([
    blue(`↑ EVENT<${event.shortId}>`),
    'published to',
    `'${blue(event.routingKey)}'`
  ], event.message),
  'event.received': event => format([
    blue(`↓ EVENT<${event.shortId}>`),
    `'${blue(event.routingKey)}'`,
    'received from',
    blue(event.publisher)
  ], event.payload),
  'event.ack': event => format([
    green(`✔ EVENT<${event.shortId}>`),
    `'${green(event.routingKey)}'`,
    'received from',
    green(event.publisher),
    'is acknowledged'
  ]),
  'event.nack': event => format([
    red(`✕ EVENT<${event.shortId}>`),
    `'${red(event.routingKey)}'`,
    'received from',
    red(event.publisher),
    'is rejected'
  ]),
  'request.sent': request => format([
    blue(`↑ REQUEST<${request.shortId}>`),
    `for '${blue(request.routingKey)}'`,
    `sent by '${blue(request.options.appId)}'`
  ], request.message),
  'request.received': request => format([
    blue(`↓ REQUEST<${request.shortId}>`),
    `for '${blue(request.routingKey)}'`,
    `received from '${blue(request.publisher)}'`
  ], request.payload),
  'response.success.sent': ({ message, payload }) => format([
    green(`↑ RESPONSE:SUCCESS<${message.shortId}>`),
    `is sent in reply to '${green(message.routingKey)}'`,
    `from '${green(message.publisher)}'`,
    `via '${green(message.replyTo)}'`
  ], payload),
  'response.error.sent': ({ message, payload }) => format([
    red(`↑ RESPONSE:ERROR<${message.shortId}>`),
    `is sent in reply to '${red(message.routingKey)}'`,
    `from '${red(message.publisher)}'`,
    `via '${red(message.replyTo)}'`
  ], payload),
  'response.error.received': response => format([
    red(`↓ RESPONSE:ERROR<${response.shortId}>`),
    `is received in reply to '${red(response.routingKey)}'`,
    `from '${red(response.publisher)}'`
  ], response.payload),
  'response.success.received': response => format([
    green(`↓ RESPONSE:SUCCESS<${response.shortId}>`),
    `is received in reply to '${green(response.routingKey)}'`,
    `from '${green(response.publisher)}'`
  ], response.payload),
  'queue.configured': replyTo => `${yellow(`QUEUE ${replyTo}`)} is listening for ${yellow('replies')}`,
  'requestQueue.configured': replyTo => `${yellow(`QUEUE ${replyTo}`)} is listening for ${yellow('requests')}`
}

const toLogger = (logger, prefix) => (message, data) => {
  logger.log(`${createMeta(prefix)} ${message}`)

  if (data) {
    logger.dir(data, { colors: true, depth: 10 })
  }
}

module.exports = ctx => {
  if (!ctx.logger) { return ctx }

  const log = toLogger(ctx.logger, ctx.connectionId ? `AMQP:${ctx.connectionId}` : 'AMQP')

  Object
    .keys(formats)
    .reduce((events, key) => events.on(key, event => log(formats[key](event))), ctx.events)

  return ctx
}
