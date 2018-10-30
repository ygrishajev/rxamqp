const connect = require('../src/connection')
const { BehaviorSubject } = require('rxjs/BehaviorSubject')
const { ChannelModel } = require('amqplib/lib/channel_model')
require('rxjs/add/operator/skip')
require('rxjs/add/operator/take')
require('rxjs/add/operator/partition')
require('rxjs/add/operator/last')

const createConnection = () => connect('amqp://localhost:5672', { logger: false })

describe('rxConnection', () => {
  test('is an instance of BehaviourSubject', () => {
    const rxConnection = createConnection()
    expect(rxConnection).toBeInstanceOf(BehaviorSubject)

    return rxConnection.close()
  })

  test('emits ChannelModel on connect', () => {
    const rxConnection = createConnection()
    expect.assertions(1)

    return rxConnection
      .filter(value => !!value)
      .first()
      .toPromise()
      .then(connection => expect(connection).toBeInstanceOf(ChannelModel))
      .then(() => rxConnection.close())
  })

  test('emits null on connection close', () => {
    const rxConnection = createConnection()
    expect.assertions(1)

    const connected = rxConnection.skip(1)

    connected.first().subscribe(connection => connection.close())

    return connected
      .skip(1)
      .first()
      .toPromise()
      .then(value => expect(value).toBeNull())
      .then(() => rxConnection.close())
  })

  test('emits ChannelModel on reconnect', () => {
    const rxConnection = createConnection()
    expect.assertions(1)

    const connected = rxConnection.skip(1)

    connected.first().subscribe(connection => connection.close())

    return connected
      .skip(2)
      .first()
      .toPromise()
      .then(connection => expect(connection).toBeInstanceOf(ChannelModel))
      .then(() => rxConnection.close())
  })

  test('#close closes connection and cleans up', () => {
    const rxConnection = createConnection()
    expect.assertions(3)

    return rxConnection.close()
      .then(() => {
        expect(rxConnection.getValue()).toBeNull()
        expect(rxConnection.awaitingConnection).toBeNull()
        expect(rxConnection.isStopped).toBeTruthy()
      })
  })
})
