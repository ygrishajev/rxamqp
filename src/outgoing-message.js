const { v4: uuid } = require('uuid')
const { toBuffer } = require('./helpers')

class OutgoingMessage {
  get id() {
    return this.options.correlationId
  }

  get shortId() {
    return this.id.slice(0, 8)
  }

  get hasError() {
    return !!this.message.error
  }

  get appId() {
    return this.options.appId
  }

  set replyTo(value) {
    this.options.replyTo = value
  }

  constructor(payload) {
    Object.assign(this, payload)
    this.options = Object.assign({}, { correlationId: uuid() }, payload.options)
  }

  toArgs() {
    return [
      this.exchange,
      this.routingKey,
      toBuffer(this.message),
      this.options
    ]
  }
}

module.exports = { OutgoingMessage }
