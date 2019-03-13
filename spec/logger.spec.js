const { v4: uuid } = require('uuid')
const EventEmitter = require('events')
const chalk = require('chalk')

const toLogger = require('../src/logger')
const { OutgoingMessage } = require('../src/outgoing-message')
const { IncomingMessage } = require('../src/incoming-message')

chalk.enabled = false

const CONNECTION_ID = 'test'
const toCtx = logger => toLogger({
  connectionId: CONNECTION_ID,
  events: new EventEmitter(),
  logger
})

const shortUuidRegex = ')([0-9a-f]{8})('
const toRegex = body => new RegExp(`^\\[([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\\] (\\[AMQP:${CONNECTION_ID}\\] ${body})$`)

const REPLY_TO = 'replyTo'
const APP_ID = 'appId'
const ROUTING_KEY = 'routingKey'
const PAYLOAD = { foo: 'bar' }
const ERROR_PAYLOAD = { error: 'bad one' }

const outgoingMessage = new OutgoingMessage({
  exchange: 'exchange',
  routingKey: ROUTING_KEY,
  message: { foo: 'bar' },
  options: { appId: APP_ID }
})
const COMMON_INCOMING = {
  properties: {
    correlationId: uuid(),
    appId: APP_ID,
    replyTo: REPLY_TO
  },
  fields: {
    routingKey: `${ROUTING_KEY}.replyFor.someOne`
  }
}
const incomingMessage = new IncomingMessage(Object.assign(COMMON_INCOMING, {
  content: Buffer.from(JSON.stringify(PAYLOAD))
}))
incomingMessage.parse()
const incomingError = new IncomingMessage(Object.assign(COMMON_INCOMING, {
  content: Buffer.from(JSON.stringify(ERROR_PAYLOAD))
}))
incomingError.parse()

const emit = (event, message) => new Promise(resolve => {
  const log = value => resolve(value)
  const ctx = toCtx({ log })
  ctx.events.emit(event, message)
})

const parse = value => {
  const payloadStart = value.indexOf('|')

  return {
    head: value.slice(0, payloadStart - 1),
    body: value.slice(payloadStart + 1)
  }
}

describe('Logger', () => {
  test('logs \'event.published\'', () => {
    expect.assertions(2)

    return emit('event.published', outgoingMessage)
      .then(value => {
        const { head, body } = parse(value)

        expect(toRegex(`↑ EVENT<${shortUuidRegex}> published to '${ROUTING_KEY}'`).test(head)).toBeTruthy()
        expect(JSON.parse(body)).toMatchObject(outgoingMessage.message)
      })
  })

  test('logs \'event.received\'', () => {
    expect.assertions(2)

    return emit('event.received', incomingMessage)
      .then(value => {
        const { head, body } = parse(value)

        expect(toRegex(`↓ EVENT<${shortUuidRegex}> '${ROUTING_KEY}' received from '${APP_ID}'`).test(head)).toBeTruthy()
        expect(JSON.parse(body)).toMatchObject(incomingMessage.payload)
      })
  })

  test('logs \'event.ack\'', () => {
    expect.assertions(1)

    return emit('event.ack', incomingMessage)
      .then(value => {
        expect(toRegex(`✔ EVENT<${shortUuidRegex}> '${ROUTING_KEY}' received from '${APP_ID}' is acknowledged`).test(value)).toBeTruthy()
      })
  })

  test('logs \'event.nack\'', () => {
    expect.assertions(1)

    return emit('event.nack', incomingMessage)
      .then(value => {
        expect(toRegex(`✕ EVENT<${shortUuidRegex}> '${ROUTING_KEY}' received from '${APP_ID}' is rejected`).test(value)).toBeTruthy()
      })
  })

  test('logs \'request.sent\'', () => {
    expect.assertions(2)

    return emit('request.sent', outgoingMessage)
      .then(value => {
        const { head, body } = parse(value)

        expect(toRegex(`↑ REQUEST<${shortUuidRegex}> for '${ROUTING_KEY}' sent by '${APP_ID}'`).test(head)).toBeTruthy()
        expect(JSON.parse(body)).toMatchObject(outgoingMessage.message)
      })
  })

  test('logs \'request.received\'', () => {
    expect.assertions(2)

    return emit('request.received', incomingMessage)
      .then(value => {
        const { head, body } = parse(value)

        expect(toRegex(`↓ REQUEST<${shortUuidRegex}> for '${ROUTING_KEY}' received from '${APP_ID}'`).test(head)).toBeTruthy()
        expect(JSON.parse(body)).toMatchObject(incomingMessage.payload)
      })
  })

  test('logs \'response.success.sent\'', () => {
    expect.assertions(2)

    return emit('response.success.sent', { payload: { data: PAYLOAD }, message: incomingMessage })
      .then(value => {
        const { head, body } = parse(value)
        expect(toRegex(`↑ RESPONSE:SUCCESS<${shortUuidRegex}> is sent in reply to '${ROUTING_KEY}' from '${APP_ID}' via '${REPLY_TO}'`).test(head)).toBeTruthy()
        expect(JSON.parse(body)).toMatchObject({ data: outgoingMessage.message })
      })
  })

  test('logs \'response.error.sent\'', () => {
    expect.assertions(2)

    return emit('response.error.sent', { payload: ERROR_PAYLOAD, message: incomingMessage })
      .then(value => {
        const { head, body } = parse(value)

        expect(toRegex(`↑ RESPONSE:ERROR<${shortUuidRegex}> is sent in reply to '${ROUTING_KEY}' from '${APP_ID}' via '${REPLY_TO}'`).test(head)).toBeTruthy()
        expect(JSON.parse(body)).toMatchObject(ERROR_PAYLOAD)
      })
  })

  test('logs \'response.success.received\'', () => {
    expect.assertions(2)

    return emit('response.success.received', incomingMessage)
      .then(value => {
        const { head, body } = parse(value)

        expect(toRegex(`↓ RESPONSE:SUCCESS<${shortUuidRegex}> is received in reply to '${ROUTING_KEY}' from '${APP_ID}'`).test(head)).toBeTruthy()
        expect(JSON.parse(body)).toMatchObject(incomingMessage.payload)
      })
  })

  test('logs \'response.error.received\'', () => {
    expect.assertions(2)

    return emit('response.error.received', incomingError)
      .then(value => {
        const { head, body } = parse(value)

        expect(toRegex(`↓ RESPONSE:ERROR<${shortUuidRegex}> is received in reply to '${ROUTING_KEY}' from '${APP_ID}'`).test(head)).toBeTruthy()
        expect(JSON.parse(body)).toMatchObject(ERROR_PAYLOAD)
      })
  })

  test('logs \'queue.configured\'', () => {
    expect.assertions(1)

    return emit('queue.configured', REPLY_TO)
      .then(value => {
        expect(toRegex(`QUEUE ${REPLY_TO} is listening for replies`).test(value)).toBeTruthy()
      })
  })

  test('logs \'requestQueue.configured\'', () => {
    expect.assertions(1)

    return emit('requestQueue.configured', REPLY_TO)
      .then(value => {
        expect(toRegex(`QUEUE ${REPLY_TO} is listening for requests`).test(value)).toBeTruthy()
      })
  })
})
