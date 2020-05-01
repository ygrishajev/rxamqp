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

  get destination() {
    return this.queue ? [this.queue] : [this.exchange, this.routingKey]
  }

  set replyTo(value) {
    this.options.replyTo = value
  }

  get payload() {
    return this.message
  }

  get requestId() {
    const headers = this.options.headers || {}
    const requestId = Object.keys(headers)
      .find(key => key.toLowerCase() === 'x-request-id')
    return headers[requestId]
  }

  constructor(payload) {
    Object.assign(this, payload)
    this.options = Object.assign({}, { correlationId: uuid() }, payload.options)
  }

  toArgs() {
    return [
      ...this.destination,
      toBuffer(this.message),
      this.options
    ]
  }
}

module.exports = { OutgoingMessage }
