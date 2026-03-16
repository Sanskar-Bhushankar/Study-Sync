const { BadRequestError } = require('./errors');

function requireFields(body, fields) {
  const missing = fields.filter((f) => body[f] == null || body[f] === '');
  if (missing.length) throw new BadRequestError(`Missing: ${missing.join(', ')}`);
}

function requireOneOf(body, fields) {
  const has = fields.some((f) => body[f] != null && body[f] !== '');
  if (!has) throw new BadRequestError(`At least one of ${fields.join(', ')} required`);
}

function emailFormat(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) throw new BadRequestError('Invalid email');
}

module.exports = { requireFields, requireOneOf, emailFormat };
