const { v4: uuid } = require('uuid')
const { toBuffer } = require('./helpers')

module.exports = payload => {
  const id = uuid()
  const message = Object.assign({ id }, payload)
  message.options.correlationId = id

  Object.assign(message, {
    get shortId() {
      return id.slice(0, 8)
    },
    get hasError() {
      return !!payload.message.error
    },
    toArgs: () => [
      message.exchange,
      message.routingKey,
      toBuffer(message.message),
      message.options
    ]
  })

  return message
}
