const { v4: uuid } = require('uuid')
const extend = require('../src/incoming-message')

const id = uuid()
const REPLY_TO = 'replyTo'
const APP_ID = 'appId'
const ROUTING_KEY = 'some'
const PAYLOAD = { foo: 'bar' }
const ERROR_PAYLOAD = { error: 'error' }
const MESSAGE = {
  properties: {
    correlationId: id,
    appId: APP_ID,
    replyTo: REPLY_TO
  },
  fields: {
    routingKey: `${ROUTING_KEY}.replyFor.someOne`
  },
  content: Buffer.from(JSON.stringify(PAYLOAD))
}

describe('IncomingMessage', () => {
  test('creates IncomingMessage', () => {
    expect(extend(MESSAGE).constructor.name).toEqual('IncomingMessage')
  })

  test('has proper id', () => {
    expect(extend(MESSAGE).id).toEqual(id)
  })

  test('has proper shortId', () => {
    expect(extend(MESSAGE).shortId).toEqual(id.slice(0, 8))
  })

  test('has proper publisher', () => {
    expect(extend(MESSAGE).publisher).toEqual(APP_ID)
  })

  test('has proper routingKey', () => {
    expect(extend(MESSAGE).routingKey).toEqual(ROUTING_KEY)
  })

  test('has proper replyTo', () => {
    expect(extend(MESSAGE).replyTo).toEqual(REPLY_TO)
  })

  test('parses content', () => {
    const extended = extend(MESSAGE)
    extended.parse()

    expect(JSON.stringify(extended.payload)).toEqual(JSON.stringify(PAYLOAD))
  })

  test('creates errored payload if invalid content', () => {
    const message = Object.assign({}, MESSAGE, {
      content: `${MESSAGE.content}123`
    })
    const extended = extend(message)
    extended.parse()

    expect(extended.hasError).toBeTruthy()
  })

  test('creates message with error', () => {
    const message = Object.assign({}, MESSAGE, {
      content: Buffer.from(JSON.stringify(ERROR_PAYLOAD))
    })
    const extended = extend(message)
    extended.parse()

    expect(extended.hasError).toBeTruthy()
  })
})
