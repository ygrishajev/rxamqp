const {
  yellow,
  red,
  blue,
  grey
} = require('chalk')

const formatId = message => `{${yellow(message.properties.correlationId.slice(0, 8))}}`

const formatEvent = routingKey => `Event '${blue(routingKey)}' published`

const formatOutgoingRequest = (correlationId, routingKey, appId) => [
  `{${yellow(correlationId.slice(0, 8))}}`,
  `Request '${blue(routingKey)}'`,
  `sent by '${blue(appId)}'`
].join(' ')

const formatIncomingRequest = message => [
  `${formatId(message)}`,
  `Received request '${yellow(message.fields.routingKey)}'`,
  `from '${yellow(message.properties.appId)}'`
].join(' ')

const formatIncomingEvent = message => [
  `Received event '${yellow(message.fields.routingKey)}'`,
  `published by '${yellow(message.properties.appId)}'`
].join(' ')

const formatIncomingMessage = message => (message.properties.correlationId ?
  formatIncomingRequest(message) :
  formatIncomingEvent(message))

const formatOutgoingError = (message, error) => [
  `${formatId(message)}`,
  `Error '${red(error.toString())}'`,
  `sent to '${red(message.properties.replyTo)}'`,
  `as response to '${red(message.properties.appId)}'`
].join(' ')

const formatSubscriptionError = (message, error) => [
  `Error '${red(error.toString())}'`,
  `on event '${yellow(message.fields.routingKey)}'`,
  `emitted by '${yellow(message.properties.appId)}'`
].join(' ')

const formatOutgoingResponse = (message, error) => (error ?
  formatOutgoingError(message, error) :
  [
    `${formatId(message)}`,
    `Response for '${blue(message.properties.appId)}'`,
    `sent to '${blue(message.properties.replyTo)}'`
  ].join(' '))

const formatIncomingError = (message, error) => [
  `${formatId(message)}`,
  `Error '${red(error.toString())}'`,
  `received from '${red(message.properties.appId)}'`
].join(' ')

const formatIncomingResponse = (message, error) => (error ?
  formatIncomingError(message, error) :
  [
    `${formatId(message)}`,
    `Received response '${yellow(message.fields.routingKey)}'`,
    `from '${yellow(message.properties.appId)}'`
  ].join(' '))

const formatMeta = (source, message) => {
  const time = new Date().toTimeString().split(' ')[0]

  return `[${grey(time)}] [${source}] ${message}`
}

const formatDebugId = message => `${[
  'Debugging info:',
  (message.properties.correlationId && `request id: ${formatId(message)},`),
  `routingKey: '${yellow(message.fields.routingKey)}',`,
  `sender '${yellow(message.properties.appId)}'`
]
  .filter(part => !!part)
  .join(' ')}`

module.exports = {
  formatEvent,
  formatOutgoingRequest,
  formatIncomingRequest,
  formatIncomingEvent,
  formatIncomingMessage,
  formatOutgoingError,
  formatSubscriptionError,
  formatOutgoingResponse,
  formatIncomingError,
  formatIncomingResponse,
  formatMeta,
  formatDebugId
}
