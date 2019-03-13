const {
  yellow,
  green,
  red,
  blue
} = require('chalk')

const { createMeta } = require('./helpers')

const format = (headParts, body) => `${headParts.join(' ')}${body ? ` | ${JSON.stringify(body)}` : ''}`

const getHandlerId = event => (event.handlerId && `by '${green(event.handlerId)}'`)

const shortId = message => (message.shortId ? `<${message.shortId}>` : '')

const formats = {
  'event.published': event => format([
    blue(`↑ EVENT${shortId(event)}`),
    'published to',
    `'${blue(event.routingKey || event.queue)}'`
  ], event.message),
  'event.received': event => format([
    blue(`↓ EVENT${shortId(event)}`),
    `'${blue(event.routingKey || event.queue)}'`,
    event.publisher ? `received from '${blue(event.publisher)}'` : 'is received',
    getHandlerId(event)
  ].filter(value => value), event.payload),
  'event.ack': event => format([
    green(`✔ EVENT${shortId(event)}`),
    `'${green(event.routingKey || event.queue)}'`,
    event.publisher ? `received from '${green(event.publisher)}'` : '',
    'is acknowledged',
    getHandlerId(event)
  ].filter(value => value)),
  'event.nack': event => format([
    red(`✕ EVENT${shortId(event)}`),
    `'${red(event.routingKey || event.queue)}'`,
    event.publisher ? `received from '${red(event.publisher)}'` : '',
    'is rejected',
    getHandlerId(event)
  ].filter(value => value)),
  'request.sent': request => format([
    blue(`↑ REQUEST${shortId(request)}`),
    `for '${blue(request.routingKey || request.queue)}'`,
    request.appId ? `sent by '${blue(request.appId)}'` : 'is sent'
  ], request.message),
  'request.received': request => format([
    blue(`↓ REQUEST${shortId(request)}`),
    `for '${blue(request.routingKey || request.queue)}'`,
    request.publisher ? `received from '${blue(request.publisher)}'` : 'is received'
  ], request.payload),
  'response.success.sent': ({ message, payload }) => format([
    green(`↑ RESPONSE:SUCCESS${shortId(message)}`),
    `is sent in reply to '${green(message.routingKey || message.queue)}'`,
    message.publisher ? `from '${green(message.publisher)}'` : '',
    `via '${green(message.replyTo)}'`
  ], payload),
  'response.error.sent': ({ message, payload }) => format([
    red(`↑ RESPONSE:ERROR${shortId(message)}`),
    `is sent in reply to '${red(message.routingKey || message.queue)}'`,
    message.publisher ? `from '${red(message.publisher)}'` : '',
    `via '${red(message.replyTo)}'`
  ], payload),
  'response.error.received': response => format([
    red(`↓ RESPONSE:ERROR${shortId(response)}`),
    `is received in reply to '${red(response.routingKey || response.queue)}'`,
    response.publisher ? `from '${red(response.publisher)}'` : ''
  ], response.payload),
  'response.success.received': response => format([
    green(`↓ RESPONSE:SUCCESS${shortId(response)}`),
    `is received in reply to '${green(response.routingKey || response.queue)}'`,
    response.publisher ? `from '${green(response.publisher)}'` : ''
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
