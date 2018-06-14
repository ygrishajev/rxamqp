const amqp = require('amqplib')
const { BehaviorSubject } = require('rxjs/BehaviorSubject')
require('rxjs/add/operator/first')
require('rxjs/add/operator/filter')

const { formatMeta } = require('./logging')
const { withDefault } = require('./helpers')

const connect = (url, options = {}) => startRxConnection(
  url,
  new BehaviorSubject(null),
  options
)

function startRxConnection(url, store, options) {
  const logger = withDefault(options.logger, console)
  const connectionId = options.connectionId || (options.url && options.url.vhost)
  const prefix = connectionId ? `AMQP:${connectionId}` : 'AMQP'

  const log = message => logger && logger.log(formatMeta(prefix, message))
  const reconnect = delay => {
    log(`Reconnecting in ${delay / 1000} seconds...`)
    setTimeout(() => startRxConnection(url, store, options), delay)
  }

  store.awaitingConnection = Promise.resolve(amqp.connect(url)) // eslint-disable-line
    .then(connection => {
      connection.on('error', error => (logger || console)
        .warn(formatMeta(prefix, `Connection error: ${error.message}`)))

      connection.on('close', () => {
        log('Connection was closed')
        store.next(null)
        reconnect(1000)
      })

      log('Connected')
      Object.assign(connection, { connectionId })
      store.next(connection)
    })
    .catch(error => {
      if (logger) {
        logger.warn(formatMeta(prefix, `Failed to connect: ${error.message}`))
      }
      reconnect(5000)
    })

  store.close = function cleanupAndClose() { // eslint-disable-line no-param-reassign
    return this
      .filter(connection => !!connection)
      .first()
      .toPromise()
      .then(connection => {
        connection.removeAllListeners()
        this.awaitingConnection = null
        this.next(null)

        return connection.close()
      })
      .then(() => this.complete())
  }

  return store
}

module.exports = connect
