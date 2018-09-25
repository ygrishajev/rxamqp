const { IllegalOperationError } = require('amqplib')
const { BehaviorSubject } = require('rxjs/BehaviorSubject')
require('rxjs/add/operator/filter')

const { withDefault, toPromise, createMeta } = require('./helpers')

const promisifyChannelMethod = (rxChannel, method) => (...args) => toPromise(rxChannel)
  .then(channel => channel[method](...args))

const openChannel = (connectionStore, options) => {
  const store = new BehaviorSubject(null)

  connectionStore
    .filter(connection => connection)
    .subscribe(connection => startRxChannel(connection, store, options))

  Object.assign(store, {
    ack: promisifyChannelMethod(store, 'ack'),
    reject: promisifyChannelMethod(store, 'reject'),
    publish: promisifyChannelMethod(store, 'publish'),
    sendToQueue: promisifyChannelMethod(store, 'sendToQueue'),
    assertQueue: promisifyChannelMethod(store, 'assertQueue'),
    consume: promisifyChannelMethod(store, 'consume')
  })

  return store
}

function startRxChannel(connection, store, options) {
  const logger = withDefault(options.logger, console)
  const connectionId = connection.connectionId || options.connectionId
  const prefix = createMeta(connectionId ? `AMQP:${connectionId}` : 'AMQP')

  const log = message => logger && logger.log(`${prefix} ${message}`)

  const createChannel = options.confirmationMode ?
    connection.createConfirmChannel() :
    connection.createChannel()

  Promise.resolve(createChannel)
    .then(channel => {
      channel.on('error', error => (logger || console).log(`Channel error: ${error.message}`))

      channel.on('close', () => {
        log(`${options.confirmationMode ? 'Confirm ' : ''}Channel was closed`)
        store.next(null)
        connection.close()
          .catch(error => {
            if (!(error instanceof IllegalOperationError)) {
              throw error
            }
          })
      })

      log(`${options.confirmationMode ? 'Confirm ' : ''}Channel has been opened`)
      Object.assign(channel, { connectionId })
      store.next(channel)
    })
    .catch(error => {
      if (logger) {
        logger.warn(`${prefix} Failed to create channel: ${error.message}`)
      }
      connection.close()
    })

  return store
}

module.exports = openChannel
