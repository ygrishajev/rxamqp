const { OutgoingMessage } = require('./outgoing-message')

module.exports = ctx => {
  const registry = new Map()

  const publish = (exchange, routingKey, message, clientOptions) => {
    const event = new OutgoingMessage({
      exchange,
      routingKey,
      message,
      options: Object.assign({}, ctx.pubOptions, clientOptions)
    })
    registry.set(event.id, event)

    return ctx.confirmChannel.publish(...event.toArgs())
      .then(() => {
        registry.delete(event.id)
        ctx.events.emit('event.published', event)

        return { ok: true }
      })
  }

  return {
    publish,
    get registry() { return registry }
  }
}
