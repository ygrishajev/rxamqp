const { BehaviorSubject } = require('rxjs/BehaviorSubject')
require('rxjs/add/operator/filter')

const { formatMeta } = require('./logging')
const { withDefault } = require('./helpers')

const openChannel = (connectionStore, options) => {
  const store = new BehaviorSubject(null)

  connectionStore
    .filter(connection => connection)
    .subscribe(connection => startRxChannel(connection, store, options))

  return store
}

function startRxChannel(connection, store, options) {
  const logger = withDefault(options.logger, console)
  const connectionId = connection.connectionId || options.connectionId
  const prefix = connectionId ? `AMQP:${connectionId}` : 'AMQP'

  const log = message => logger && logger.log(formatMeta(prefix, message))

  Promise.resolve(connection.createChannel())
    .then(channel => {
      channel.on('error', error => (logger || console)
        .log(`Channel error: ${error.message}`))

      channel.on('close', () => {
        log('Channel was closed')
        store.next(null)
        connection.close()
      })

      log('Channel has been opened')
      Object.assign(channel, { connectionId })
      store.next(channel)
    })
    .catch(error => {
      if (logger) {
        logger.warn(formatMeta(prefix, `Failed to create channel: ${error.message}`))
      }
      connection.close()
    })

  return store
}

module.exports = openChannel
