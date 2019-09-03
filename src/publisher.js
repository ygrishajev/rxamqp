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

    const publishAwait = ctx.confirmChannel.publish(...event.toArgs())
      .then(() => {
        registry.delete(event.id)
        ctx.events.emit('event.published', event)

        return { ok: true }
      })

    registry.set(event.id, { event, publishAwait })

    return publishAwait
  }

  const sendToQueue = (queue, message, clientOptions) => {
    const event = new OutgoingMessage({
      queue,
      message,
      options: Object.assign({}, ctx.pubOptions, clientOptions)
    })

    const publishAwait = ctx.confirmChannel.sendToQueue(...event.toArgs())
      .then(() => {
        registry.delete(event.id)
        ctx.events.emit('event.published', event)

        return { ok: true }
      })

    registry.set(event.id, { event, publishAwait })

    return publishAwait
  }

  const shutdown = () => Promise
    .all(Array.from(registry.values())
      .map(item => item.publishAwait))

  return {
    publish,
    sendToQueue,
    shutdown
  }
}
