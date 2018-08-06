const { Validator } = require('jsonschema')
const validateUUID = require('uuid-validate')

Validator.prototype.customFormats.uuid = input => validateUUID(input, 4)

const validator = new Validator()

module.exports = (input, schema) => new Promise((resolve, reject) => {
  const { errors } = validator.validate(input, schema)

  return errors && errors.length ?
    reject(new Error(errors.map(({ stack }) => stack))) :
    resolve(input)
})
