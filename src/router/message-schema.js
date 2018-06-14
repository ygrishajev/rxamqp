module.exports = {
  id: '/MessageProperties',
  properties: {
    appId: { type: 'string' },
    contentEncoding: { type: 'string', enum: ['UTF-8', 'utf-8'] },
    contentType: { type: 'string', enum: ['application/json'] },
    correlationId: { type: 'string', format: 'uuid' },
    replyTo: { type: 'string' }
  },
  required: ['appId', 'contentEncoding', 'contentType'],
  type: 'object'
}
