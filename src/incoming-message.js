class IncomingMessage {
  get id() {
    return this.properties.correlationId
  }

  get shortId() {
    return this.id && this.id.slice(0, 8)
  }

  get publisher() {
    return this.properties.appId
  }

  get hasError() {
    return this.payload && !!this.payload.error
  }

  get routingKey() {
    const DELIMITER = '.replyFor.'

    return this.fields.routingKey.includes(DELIMITER) ?
      this.fields.routingKey.split(DELIMITER)[0] :
      this.fields.routingKey
  }

  get replyTo() {
    return this.properties.replyTo
  }

  constructor(message) {
    Object.assign(this, message)
  }

  parse() {
    try {
      this.payload = this.payload || (this.content && JSON.parse(this.content.toString()))
    } catch (error) {
      this.payload = { error: `Invalid response: ${error.message}` }
    }

    return this.payload
  }
}

module.exports = { IncomingMessage }
