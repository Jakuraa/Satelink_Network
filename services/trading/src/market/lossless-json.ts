/**
 * Lossless JSON parsing: every JSON number is returned as its exact source
 * text (a decimal string), never as a JS float. Strings, booleans, null,
 * arrays and objects parse as usual.
 *
 * Needed because the API runtime is Node 20 (no JSON.parse source-text access)
 * and provider prices arrive as JSON numbers (e.g. `"close": 181.2`).
 */

export type LosslessJson = string | boolean | null | LosslessJson[] | { [k: string]: LosslessJson };

/** Marker wrapper so callers can tell a JSON number from a JSON string. */
export class JsonNumber {
  constructor(readonly text: string) {}
  toString(): string {
    return this.text;
  }
}

export type LosslessValue = JsonNumber | string | boolean | null | LosslessValue[] | { [k: string]: LosslessValue };

export class LosslessJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LosslessJsonError';
  }
}

const NUM_RE = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const MAX_DEPTH = 64;

export function parseLosslessJson(text: string): LosslessValue {
  let i = 0;
  const ws = () => {
    while (i < text.length) {
      const c = text.charCodeAt(i);
      if (c === 0x20 || c === 0x0a || c === 0x0d || c === 0x09) i++;
      else break;
    }
  };
  const fail = (msg: string): never => {
    throw new LosslessJsonError(`${msg} at offset ${i}`);
  };
  const str = (): string => {
    // Find the closing quote, honouring escapes, then defer to JSON.parse for unescaping.
    const start = i;
    i++;
    while (i < text.length) {
      const c = text[i];
      if (c === '\\') i += 2;
      else if (c === '"') {
        i++;
        return JSON.parse(text.slice(start, i)) as string;
      } else i++;
    }
    return fail('unterminated string');
  };
  const value = (depth: number): LosslessValue => {
    if (depth > MAX_DEPTH) fail('nesting too deep');
    ws();
    const c = text[i];
    if (c === '{') {
      i++;
      const obj: { [k: string]: LosslessValue } = Object.create(null) as { [k: string]: LosslessValue };
      ws();
      if (text[i] === '}') {
        i++;
        return obj;
      }
      for (;;) {
        ws();
        if (text[i] !== '"') fail('expected key');
        const k = str();
        ws();
        if (text[i] !== ':') fail('expected :');
        i++;
        obj[k] = value(depth + 1);
        ws();
        if (text[i] === ',') {
          i++;
          continue;
        }
        if (text[i] === '}') {
          i++;
          return obj;
        }
        fail('expected , or }');
      }
    }
    if (c === '[') {
      i++;
      const arr: LosslessValue[] = [];
      ws();
      if (text[i] === ']') {
        i++;
        return arr;
      }
      for (;;) {
        arr.push(value(depth + 1));
        ws();
        if (text[i] === ',') {
          i++;
          continue;
        }
        if (text[i] === ']') {
          i++;
          return arr;
        }
        fail('expected , or ]');
      }
    }
    if (c === '"') return str();
    if (text.startsWith('true', i)) {
      i += 4;
      return true;
    }
    if (text.startsWith('false', i)) {
      i += 5;
      return false;
    }
    if (text.startsWith('null', i)) {
      i += 4;
      return null;
    }
    NUM_RE.lastIndex = i;
    const m = NUM_RE.exec(text);
    if (m) {
      i += m[0].length;
      return new JsonNumber(m[0]);
    }
    return fail('unexpected token');
  };
  const out = value(0);
  ws();
  if (i !== text.length) fail('trailing data');
  return out;
}

/** Decimal text of a JSON number or numeric string; null otherwise. */
export function numericText(v: LosslessValue | undefined): string | null {
  if (v instanceof JsonNumber) return v.text;
  if (typeof v === 'string' && /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(v.trim())) return v.trim();
  return null;
}

export function isObject(v: LosslessValue | undefined): v is { [k: string]: LosslessValue } {
  return v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof JsonNumber);
}
