const connect = require('../src/connection')
const { BehaviorSubject } = require('rxjs/BehaviorSubject')
const { Subject } = require('rxjs/Subject')
const { ChannelModel } = require('amqplib/lib/channel_model')
require('rxjs/add/operator/skip')
require('rxjs/add/operator/partition')
require('rxjs/add/operator/last')

const { tickReconnection } = require('./helpers')

const getConnection = () => connect('amqp://localhost:5672', { logger: false })

describe('rxConnection', () => {
  test('is an instance of BehaviourSubject', () => {
    const rxConnection = getConnection()
    expect(rxConnection).toBeInstanceOf(BehaviorSubject)

    return rxConnection.close()
  })

  test('emits amqplib ChannelModel on connect', () => {
    const rxConnection = getConnection()
    expect.assertions(1)

    return rxConnection
      .filter(connection => !!connection)
      .first()
      .toPromise()
      .then(connection => {
        expect(connection).toBeInstanceOf(ChannelModel)

        return rxConnection.close()
      })
  })

  test('emits null on connection close', () => {
    const rxConnection = getConnection()
    expect.assertions(1)

    const watchDisconnected = new Subject()
    tickReconnection({ rxConnection, watcher: watchDisconnected, tickOnConnected: false })

    return watchDisconnected
      .first()
      .toPromise()
      .then(connection => expect(connection).toBeNull())
      .then(() => rxConnection.close())
  })

  test('emits amqplib ChannelModel on reconnect', () => {
    const rxConnection = getConnection()
    expect.assertions(1)

    const watchConnected = new Subject()
    tickReconnection({ rxConnection, watcher: watchConnected, tickOnConnected: true })

    return watchConnected
      .first()
      .toPromise()
      .then(connection => expect(connection).toBeInstanceOf(ChannelModel))
      .then(() => rxConnection.close())
  })

  test('#close closes connection and cleans up', () => {
    const rxConnection = getConnection()
    expect.assertions(3)

    return rxConnection.close()
      .then(() => {
        expect(rxConnection.getValue()).toBeNull()
        expect(rxConnection.awaitingConnection).toBeNull()
        expect(rxConnection.isStopped).toBeTruthy()
      })
  })
})
