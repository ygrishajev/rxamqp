const amqp = require('amqplib')
const { BehaviorSubject } = require('rxjs/BehaviorSubject')
require('rxjs/add/operator/first')
require('rxjs/add/operator/filter')

const {
  withDefault,
  createMeta,
  toVhost
} = require('./helpers')

const connect = (url, options = {}) => startRxConnection(
  url,
  new BehaviorSubject(null),
  options
)

function startRxConnection(url, store, options, reconnectCount = 1) {
  let isClosed = false
  const logger = withDefault(options.logger, console)
  const connectionId = options.connectionId || toVhost(url)
  const prefix = createMeta(connectionId ? `AMQP:${connectionId}` : 'AMQP')

  const log = message => logger && logger.log(`${prefix} ${message}`)

  let reconnectTimeout = options.reconnectTimeout || 5000

  const reconnect = () => {
    if (isClosed) { return }
    if (typeof reconnectTimeout === 'function') {
      reconnectTimeout = reconnectTimeout(reconnectCount)
    }

    log(`Reconnecting in ${reconnectTimeout / 1000} seconds...`)
    setTimeout(() => startRxConnection(
      url,
      store,
      options,
      reconnectCount + 1
    ), reconnectTimeout)
  }

  store.awaitingConnection = Promise.resolve(amqp.connect(url)) // eslint-disable-line
    .then(connection => {
      connection.on('error', error => (logger || console)
        .warn(`${prefix} Connection error: ${error.message}`))

      connection.on('close', () => {
        log('Connection was closed')
        if (!isClosed) {
          store.next(null)
          reconnect()
        }
      })

      log('Connected')
      Object.assign(connection, { connectionId })
      store.next(connection)
    })
    .catch(error => {
      if (logger) {
        logger.warn(`${prefix} Failed to connect: ${error.message}`)
      }
      reconnect()
    })

  store.close = function cleanupAndClose() { // eslint-disable-line no-param-reassign
    return this
      .first()
      .toPromise()
      .then(connection => {
        isClosed = true
        this.awaitingConnection = null
        store.next(null)

        if (connection) {
          connection.removeAllListeners()
          return connection.close()
        }

        return null
      })
      .then(() => {
        log('Connection was closed')
        return this.complete()
      })
  }

  return store
}

module.exports = connect
