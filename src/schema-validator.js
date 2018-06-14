const { Validator } = require('jsonschema')

const UUID_REG_EXP = /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i
Validator.prototype.customFormats.uuid = input => !input || UUID_REG_EXP.test(input)

const validator = new Validator()

const validate = (input, schema, options) => {
  const { errors } = validator.validate(input, schema, options)

  if (errors.length) {
    throw errors[0].message
  }

  return input
}

module.exports = validate
