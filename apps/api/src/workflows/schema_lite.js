// Minimal JSON-Schema subset validator for capability input/output schemas (no new dependency; apps/api
// is installed in isolation on Railway). Supported: type (object|string|integer|number|boolean|array),
// required, properties, additionalProperties:false, enum, minLength, maxLength, pattern, minimum, maximum,
// items, maxItems. Anything else in a schema is rejected at registry load, so an unsupported keyword can
// never be silently ignored.

const KEYWORDS = new Set(['type', 'required', 'properties', 'additionalProperties', 'enum', 'minLength', 'maxLength',
  'pattern', 'minimum', 'maximum', 'items', 'maxItems', 'description', 'title', 'default']);

export function assertSupportedSchema(schema, at = '$') {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) throw new Error(`${at}: schema must be an object`);
  for (const k of Object.keys(schema)) if (!KEYWORDS.has(k)) throw new Error(`${at}: unsupported schema keyword "${k}"`);
  if (schema.properties) for (const [k, v] of Object.entries(schema.properties)) assertSupportedSchema(v, `${at}.${k}`);
  if (schema.items) assertSupportedSchema(schema.items, `${at}[]`);
  return true;
}

function typeOk(type, v) {
  switch (type) {
    case 'object': return v !== null && typeof v === 'object' && !Array.isArray(v);
    case 'array': return Array.isArray(v);
    case 'string': return typeof v === 'string';
    case 'integer': return Number.isSafeInteger(v);
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'boolean': return typeof v === 'boolean';
    default: return false;
  }
}

/** Returns a list of { path, message }; empty = valid. */
export function validate(schema, value, path = '$') {
  const errs = [];
  if (schema.type && !typeOk(schema.type, value)) return [{ path, message: `must be ${schema.type}` }];
  if (schema.enum && !schema.enum.includes(value)) errs.push({ path, message: `must be one of ${schema.enum.join(', ')}` });
  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) errs.push({ path, message: `must be at least ${schema.minLength} characters` });
    if (schema.maxLength != null && value.length > schema.maxLength) errs.push({ path, message: `must be at most ${schema.maxLength} characters` });
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errs.push({ path, message: 'has an invalid format' });
  }
  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) errs.push({ path, message: `must be ≥ ${schema.minimum}` });
    if (schema.maximum != null && value > schema.maximum) errs.push({ path, message: `must be ≤ ${schema.maximum}` });
  }
  if (Array.isArray(value)) {
    if (schema.maxItems != null && value.length > schema.maxItems) errs.push({ path, message: `must have at most ${schema.maxItems} items` });
    if (schema.items) value.forEach((v, i) => errs.push(...validate(schema.items, v, `${path}[${i}]`)));
  }
  if (schema.type === 'object' && value && typeof value === 'object') {
    for (const k of schema.required || []) if (!(k in value)) errs.push({ path: `${path}.${k}`, message: 'is required' });
    const props = schema.properties || {};
    for (const [k, v] of Object.entries(value)) {
      if (props[k]) errs.push(...validate(props[k], v, `${path}.${k}`));
      else if (schema.additionalProperties === false) errs.push({ path: `${path}.${k}`, message: 'is not allowed' });
    }
  }
  return errs;
}

/** The first missing required field (for AWAITING_INPUT questions), or null. */
export function firstMissing(schema, value) {
  for (const k of schema?.required || []) if (value == null || !(k in value)) return k;
  return null;
}
