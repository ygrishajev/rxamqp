const { v4: uuid } = require('uuid')
const { toBuffer } = require('./helpers')

class OutgoingMessage {
  get id() {
    return this.payload.options
      && this.payload.options.correlationId
  }

  get shortId() {
    return this.id.slice(0, 8)
  }

  get hasError() {
    return !!this.payload.message.error
  }

  get appId() {
    return this.payload.options.appId
  }

  get routingKey() {
    return this.payload.routingKey
  }

  set replyTo(value) {
    this.payload.options.replyTo = value
  }

  constructor(payload) {
    this.payload = payload
    this.payload.options = Object.assign({}, { correlationId: uuid() }, payload.options)
  }

  toArgs() {
    return [
      this.payload.exchange,
      this.payload.routingKey,
      toBuffer(this.payload.message),
      this.payload.options
    ]
  }
}

module.exports = { OutgoingMessage }
