const createClient = require('../src')

const EXCHANGE = 'amq.topic'
const ROUTING_KEY = 'foo.bar'
const MESSAGE = { foo: 'bar' }
const ERROR = { message: 'bad one' }

let client
const use = (...middlewares) => client.use({
  exchange: EXCHANGE,
  routingKey: ROUTING_KEY
}, ...middlewares)

beforeEach(() => { client = createClient({ logger: false }) })
afterEach(() => client.shutdown())

describe('Client', () => {
  test('#publish message payload is properly delivered subscriber', () => {
    expect.assertions(1)

    return new Promise(resolve => {
      use((msg, ctx) => {
        ctx.ack()
        resolve(msg)
      })
        .listen()

      client.events.on('requestQueue.configured', () => client.publish(EXCHANGE, ROUTING_KEY, MESSAGE))
    })
      .then(message => expect(message).toMatchObject(MESSAGE))
  })

  test('#request receives a proper success response from subscriber', () => {
    expect.assertions(1)

    use((msg, ctx) => ctx.respond(MESSAGE))
      .listen()

    return client.request(EXCHANGE, ROUTING_KEY, {})
      .then(message => expect(message).toMatchObject({ data: MESSAGE }))
  })

  test('#request throws a proper rejection error from subscriber', () => {
    expect.assertions(1)

    use((msg, ctx) => ctx.rejectAndRespond(ERROR))
      .listen()

    return client.request(EXCHANGE, ROUTING_KEY, {})
      .catch(error => expect(error).toMatchObject({ error: ERROR }))
  })

  test('#request receives a proper success response from subscriber\'s secondary middleware', () => {
    expect.assertions(1)

    use(
      (msg, ctx, next) => next(),
      (msg, ctx) => ctx.respond(MESSAGE)
    )
      .listen()

    return client.request(EXCHANGE, ROUTING_KEY, {})
      .then(message => expect(message).toMatchObject({ data: MESSAGE }))
  })

  test('#request receives a proper success response from subscriber\'s global middleware', () => {
    expect.assertions(1)

    use((msg, ctx, next) => next())
      .use((msg, ctx) => ctx.respond(MESSAGE))
      .listen()

    return client.request(EXCHANGE, ROUTING_KEY, {})
      .then(message => expect(message).toMatchObject({ data: MESSAGE }))
  })

  test('#request throws a proper error from subscriber\'s sync global error handler', () => {
    expect.assertions(1)

    use(() => { throw new Error(ERROR.message) })
      // eslint-disable-next-line no-unused-vars
      .use((error, msg, ctx, next) => ctx.rejectAndRespond({ message: error.message }))
      .listen()

    return client.request(EXCHANGE, ROUTING_KEY, {})
      .catch(error => expect(error).toMatchObject({ error: ERROR }))
  })

  test('#request throws a proper error from subscriber\'s async global error handler', () => {
    use((msg, ctx, next) => setTimeout(() => next(new Error(ERROR.message)), 0))
      // eslint-disable-next-line no-unused-vars
      .use((error, msg, ctx, next) => ctx.rejectAndRespond({ message: error.message }))
      .listen()

    return client.request(EXCHANGE, ROUTING_KEY, {})
      .catch(error => expect(error).toMatchObject({ error: ERROR }))
  })
})
