'use strict';
function valid(value, schema, document) {
  if (schema.$ref) return valid(value, document.components.schemas[schema.$ref.split('/').pop()], document);
  if (Object.hasOwn(schema, 'const') && value !== schema.const) return false;
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.anyOf) return schema.anyOf.some(s => valid(value, s, document));
  if (Array.isArray(schema.type)) return schema.type.some(type => valid(value, { ...schema, type }, document));
  if (schema.type === 'null') return value === null;
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value) || (schema.required || []).some(k => !Object.hasOwn(value, k))) return false;
    if (schema.additionalProperties === false && Object.keys(value).some(k => !Object.hasOwn(schema.properties || {}, k))) return false;
    return Object.entries(schema.properties || {}).every(([k, s]) => !Object.hasOwn(value, k) || valid(value[k], s, document));
  }
  if (schema.type === 'array') return Array.isArray(value) && value.length >= (schema.minItems || 0) && value.length <= (schema.maxItems ?? Infinity) && value.every(v => valid(v, schema.items, document));
  if (schema.type === 'integer') return Number.isSafeInteger(value) && value >= (schema.minimum ?? -Infinity) && value <= (schema.maximum ?? Infinity);
  if (schema.type === 'string') return typeof value === 'string' && [...value].length >= (schema.minLength || 0) && [...value].length <= (schema.maxLength ?? Infinity) && (!schema.pattern || new RegExp(schema.pattern).test(value));
  if (schema.type === 'boolean') return typeof value === 'boolean';
  return true;
}
module.exports = { valid };
