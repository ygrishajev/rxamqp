const connect = require('../src/connection')
const { BehaviorSubject } = require('rxjs/BehaviorSubject')
const { ChannelModel } = require('amqplib/lib/channel_model')
require('rxjs/add/operator/skip')
require('rxjs/add/operator/take')
require('rxjs/add/operator/partition')
require('rxjs/add/operator/last')

const config = require('./config')

let rxConnection

const DEFAULT_OPTIONS = { reconnectTimeout: 1 }

if (!config.logging) {
  DEFAULT_OPTIONS.logger = false
}

beforeEach(() => { rxConnection = connect(config.url, DEFAULT_OPTIONS) })
afterEach(() => rxConnection.close())

describe('rxConnection', () => {
  test('is an instance of BehaviourSubject', () => {
    expect(rxConnection).toBeInstanceOf(BehaviorSubject)
  })

  test('emits ChannelModel on connect', () => {
    expect.assertions(1)

    return rxConnection
      .filter(value => !!value)
      .first()
      .toPromise()
      .then(connection => expect(connection).toBeInstanceOf(ChannelModel))
  })

  it('emits null on connection close', () => {
    expect.assertions(1)

    const connected = rxConnection.skip(1)

    connected.first().subscribe(connection => connection.close())

    return connected
      .skip(1)
      .first()
      .toPromise()
      .then(value => expect(value).toBeNull())
  })

  test('emits ChannelModel on reconnect', () => {
    expect.assertions(1)

    const connected = rxConnection.skip(1)

    connected.first().subscribe(connection => connection.close())

    return connected
      .skip(2)
      .first()
      .toPromise()
      .then(connection => expect(connection).toBeInstanceOf(ChannelModel))
  })

  test('#close closes connection and cleans up', () => {
    expect.assertions(3)
    const connections = connect(config.amqpUri, DEFAULT_OPTIONS)

    return connections.close()
      .then(() => {
        expect(connections.getValue()).toBeNull()
        expect(connections.awaitingConnection).toBeNull()
        expect(connections.isStopped).toBeTruthy()
      })
  })
})
