// Minimal JSON-Schema subset validator. Promoted unchanged in behaviour from
// trading-agent/integration (apps/api/src/trading_agent/agent/schema.mjs, Stage 12). No dependency.
//
// Every structured output (model responses, tool inputs, tool outputs) is RE-VALIDATED here, even
// when a provider claims native structured output. Supported keywords: type, properties, required,
// additionalProperties (default false: unknown keys are rejected), enum, const, minLength, maxLength,
// pattern, minimum, maximum, items, minItems, maxItems, description. Anything else in a schema is a
// CONFIG error, so a schema can never silently mean less than it says.
import { AgentError } from './errors.js';

export type JsonType = 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'null';

export interface JsonSchema {
  readonly type?: JsonType | readonly JsonType[];
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
  readonly enum?: readonly unknown[];
  readonly const?: unknown;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly items?: JsonSchema;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly description?: string;
}

const KNOWN = new Set(['type', 'properties', 'required', 'additionalProperties', 'enum', 'const', 'minLength', 'maxLength',
  'pattern', 'minimum', 'maximum', 'items', 'minItems', 'maxItems', 'description']);
const TYPES = new Set<string>(['object', 'string', 'number', 'integer', 'boolean', 'array', 'null']);

/** Decimal string (no floats): reuse for prices/quantities in tool schemas. */
export const DECIMAL_STRING: JsonSchema = Object.freeze({ type: 'string', pattern: '^-?(0|[1-9][0-9]*)(\\.[0-9]+)?$', maxLength: 40 });

const asTypes = (t: JsonSchema['type']): readonly string[] => (t === undefined ? [] : typeof t === 'string' ? [t] : t);

export function assertSchema(schema: unknown, path = '$'): JsonSchema {
  if (!schema || typeof schema !== 'object') throw new AgentError('CONFIG', `schema at ${path} must be an object`);
  for (const k of Object.keys(schema)) if (!KNOWN.has(k)) throw new AgentError('CONFIG', `unsupported schema keyword "${k}" at ${path}`);
  const s = schema as JsonSchema;
  const types = asTypes(s.type);
  if (types.length === 0 && !s.enum && !('const' in s)) throw new AgentError('CONFIG', `schema at ${path} needs type, enum or const`);
  for (const t of types) if (!TYPES.has(t)) throw new AgentError('CONFIG', `unknown type ${t} at ${path}`);
  if (s.properties) for (const [k, sub] of Object.entries(s.properties)) assertSchema(sub, `${path}.${k}`);
  if (s.items) assertSchema(s.items, `${path}[]`);
  return s;
}

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

export function validate(schema: JsonSchema, value: unknown, path = '$', errors: string[] = []): { ok: boolean; errors: string[] } {
  const push = (m: string): void => { errors.push(`${path}: ${m}`); };
  if ('const' in schema && value !== schema.const) push(`must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) push(`must be one of ${JSON.stringify(schema.enum)}`);
  if (schema.type !== undefined) {
    const allowed = asTypes(schema.type);
    const t = typeOf(value);
    const ok = allowed.includes(t) || (t === 'integer' && allowed.includes('number'));
    if (!ok) { push(`expected ${allowed.join('|')}, got ${t}`); return { ok: false, errors }; }
  }
  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) push(`shorter than ${schema.minLength}`);
    if (schema.maxLength != null && value.length > schema.maxLength) push(`longer than ${schema.maxLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) push(`does not match ${schema.pattern}`);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) push('must be finite');
    if (schema.minimum != null && value < schema.minimum) push(`below ${schema.minimum}`);
    if (schema.maximum != null && value > schema.maximum) push(`above ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) push(`fewer than ${schema.minItems} items`);
    if (schema.maxItems != null && value.length > schema.maxItems) push(`more than ${schema.maxItems} items`);
    const items = schema.items;
    if (items) value.forEach((v, i) => { validate(items, v, `${path}[${i}]`, errors); });
  }
  if (typeOf(value) === 'object') {
    const props = schema.properties ?? {};
    const obj = value as Record<string, unknown>;
    for (const r of schema.required ?? []) if (!Object.prototype.hasOwnProperty.call(obj, r)) push(`missing required "${r}"`);
    for (const [k, v] of Object.entries(obj)) {
      const sub = props[k];
      if (sub) validate(sub, v, `${path}.${k}`, errors);
      else if (schema.additionalProperties !== true) push(`unexpected property "${k}"`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function assertValid<T = unknown>(schema: JsonSchema, value: unknown, what = 'value'): T {
  const r = validate(schema, value);
  if (!r.ok) throw new AgentError('SCHEMA_INVALID', `${what} failed schema validation: ${r.errors.slice(0, 5).join('; ')}`, { errors: r.errors });
  return value as T;
}
