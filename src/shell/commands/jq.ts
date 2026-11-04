import { fail, type CommandDef } from '../types';
import { readInputs } from '../cmdutil';

/**
 * Упрощённый jq. Поддерживает:
 *   .  .a  .a.b  .a[0]  .a[]  .[]  .[2]  "|"  ,
 *   length  keys  add  select(.x == "y" and .n > 3)  map(F)  [F]
 *   {id, status}  {name: .user.name}  -r (сырые строки)  -c (компактно)
 */
type V = unknown;

class P {
  i = 0;
  constructor(public s: string) {}
  ws() {
    while (/\s/.test(this.s[this.i] ?? '')) this.i++;
  }
  peek(t: string) {
    this.ws();
    return this.s.startsWith(t, this.i);
  }
  eat(t: string) {
    if (!this.peek(t)) throw new Error(`jq: syntax error: ожидалось '${t}' на позиции ${this.i}`);
    this.i += t.length;
  }
}

type F = (v: V) => V[];

function parsePipe(p: P): F {
  let f = parseComma(p);
  while (p.peek('|')) {
    p.eat('|');
    const g = parseComma(p);
    const prev = f;
    f = (v) => prev(v).flatMap(g);
  }
  return f;
}

function parseComma(p: P): F {
  const fs = [parseOr(p)];
  while (p.peek(',') ) {
    p.eat(',');
    fs.push(parseOr(p));
  }
  return fs.length === 1 ? fs[0] : (v) => fs.flatMap((f) => f(v));
}

function parseOr(p: P): F {
  let f = parseAnd(p);
  while (p.peek('or ')) {
    p.eat('or');
    const g = parseAnd(p);
    const a = f;
    f = (v) => [truthy(a(v)[0]) || truthy(g(v)[0])];
  }
  return f;
}

function parseAnd(p: P): F {
  let f = parseCmp(p);
  while (p.peek('and ')) {
    p.eat('and');
    const g = parseCmp(p);
    const a = f;
    f = (v) => [truthy(a(v)[0]) && truthy(g(v)[0])];
  }
  return f;
}

const truthy = (v: V) => v !== false && v !== null && v !== undefined;

function parseCmp(p: P): F {
  const left = parsePostfix(p);
  p.ws();
  const m = /^(==|!=|>=|<=|>|<)/.exec(p.s.slice(p.i));
  if (!m) return left;
  p.i += m[0].length;
  const right = parsePostfix(p);
  return (v) => {
    const a = left(v)[0] as never;
    const b = right(v)[0] as never;
    switch (m[0]) {
      case '==':
        return [JSON.stringify(a) === JSON.stringify(b)];
      case '!=':
        return [JSON.stringify(a) !== JSON.stringify(b)];
      case '>':
        return [a > b];
      case '<':
        return [a < b];
      case '>=':
        return [a >= b];
      default:
        return [a <= b];
    }
  };
}

function parsePostfix(p: P): F {
  let f = parsePrimary(p);
  for (;;) {
    if (p.s[p.i] === '.' && /[A-Za-z_]/.test(p.s[p.i + 1] ?? '')) {
      const m = /^\.([A-Za-z_][\w]*)/.exec(p.s.slice(p.i))!;
      p.i += m[0].length;
      const prev = f;
      f = (v) => prev(v).map((x) => (x && typeof x === 'object' ? (x as Record<string, V>)[m[1]] ?? null : null));
      continue;
    }
    if (p.s[p.i] === '[') {
      p.i++;
      p.ws();
      if (p.s[p.i] === ']') {
        p.i++;
        const prev = f;
        f = (v) => prev(v).flatMap((x) => (Array.isArray(x) ? x : x && typeof x === 'object' ? Object.values(x) : []));
        continue;
      }
      const m = /^-?\d+/.exec(p.s.slice(p.i));
      if (!m) throw new Error('jq: в тренажёре поддерживаются индексы вида [0], [-1] и []');
      p.i += m[0].length;
      p.eat(']');
      const n = parseInt(m[0], 10);
      const prev = f;
      f = (v) => prev(v).map((x) => (Array.isArray(x) ? x[n < 0 ? x.length + n : n] ?? null : null));
      continue;
    }
    return f;
  }
}

function parsePrimary(p: P): F {
  p.ws();
  const rest = p.s.slice(p.i);
  if (rest.startsWith('.')) {
    p.i++;
    if (/^[A-Za-z_]/.test(p.s.slice(p.i))) {
      p.i--; // пусть postfix разберёт .name
      return (v) => [v];
    }
    return (v) => [v];
  }
  if (rest.startsWith('[')) {
    p.eat('[');
    if (p.peek(']')) {
      p.eat(']');
      return () => [[]];
    }
    const f = parsePipe(p);
    p.eat(']');
    return (v) => [f(v)];
  }
  if (rest.startsWith('(')) {
    p.eat('(');
    const f = parsePipe(p);
    p.eat(')');
    return f;
  }
  if (rest.startsWith('{')) {
    p.eat('{');
    const fields: [string, F][] = [];
    while (!p.peek('}')) {
      p.ws();
      const m = /^"?([A-Za-z_][\w]*)"?/.exec(p.s.slice(p.i));
      if (!m) throw new Error('jq: ожидалось имя поля в {…}');
      p.i += m[0].length;
      if (p.peek(':')) {
        p.eat(':');
        fields.push([m[1], parseOr(p)]);
      } else {
        const k = m[1];
        fields.push([k, (v) => [v && typeof v === 'object' ? (v as Record<string, V>)[k] ?? null : null]]);
      }
      if (p.peek(',')) p.eat(',');
    }
    p.eat('}');
    return (v) => [Object.fromEntries(fields.map(([k, f]) => [k, f(v)[0] ?? null]))];
  }
  if (rest.startsWith('"')) {
    const end = p.s.indexOf('"', p.i + 1);
    const str = p.s.slice(p.i + 1, end);
    p.i = end + 1;
    return () => [str];
  }
  const num = /^-?\d+(\.\d+)?/.exec(rest);
  if (num) {
    p.i += num[0].length;
    return () => [parseFloat(num[0])];
  }
  const word = /^[a-z_]+/.exec(rest);
  if (word) {
    p.i += word[0].length;
    switch (word[0]) {
      case 'true':
        return () => [true];
      case 'false':
        return () => [false];
      case 'null':
        return () => [null];
      case 'length':
        return (v) => [Array.isArray(v) || typeof v === 'string' ? (v as string).length : v && typeof v === 'object' ? Object.keys(v).length : 0];
      case 'keys':
        return (v) => [v && typeof v === 'object' ? Object.keys(v).sort() : []];
      case 'add':
        return (v) => [Array.isArray(v) ? v.reduce((a: any, b: any) => (a === null ? b : a + b), null) : null];
      case 'not':
        return (v) => [!truthy(v)];
      case 'select': {
        p.eat('(');
        const cond = parsePipe(p);
        p.eat(')');
        return (v) => (truthy(cond(v)[0]) ? [v] : []);
      }
      case 'map': {
        p.eat('(');
        const g = parsePipe(p);
        p.eat(')');
        return (v) => [Array.isArray(v) ? v.flatMap(g) : []];
      }
      case 'tostring':
        return (v) => [typeof v === 'string' ? v : JSON.stringify(v)];
    }
    throw new Error(`jq: ${word[0]}/0 is not defined (в тренажёре: length, keys, select, map, add, not, tostring)`);
  }
  throw new Error(`jq: syntax error near '${rest.slice(0, 10)}'`);
}

export function jqEval(filter: string, input: V): V[] {
  const p = new P(filter);
  const f = parsePipe(p);
  p.ws();
  if (p.i < p.s.length) throw new Error(`jq: syntax error near '${p.s.slice(p.i, p.i + 10)}'`);
  return f(input);
}

const cmd: CommandDef = {
  name: 'jq',
  summary: "разбор JSON: jq '.items[] | select(.status == \"failed\") | .id', -r — строки без кавычек, -c — компактно",
  usage: "jq [-r] [-c] 'фильтр' [файл]",
  run(args, stdin, ctx) {
    const LONG: Record<string, string> = { '--raw-output': '-r', '--compact-output': '-c', '--sort-keys': '-S', '--exit-status': '-e' };
    const norm = args.map((a) => LONG[a] ?? a);
    const flags = norm.filter((a) => /^-[rcSe]+$/.test(a)).join('');
    const pos = norm.filter((a) => !/^-[rcSe]+$/.test(a));
    const filter = pos.shift() ?? '.';
    const r = readInputs('jq', pos, stdin, ctx);
    if (r.failed) return { stdout: '', stderr: r.stderr, exitCode: 2 };
    const text = r.inputs.map((i) => i.content).join('').trim();
    if (!text) return { stdout: '', stderr: '', exitCode: 0 };
    // на входе может быть несколько JSON-документов подряд (вывод предыдущего jq)
    const docs: V[] = [];
    try {
      docs.push(JSON.parse(text));
    } catch {
      let k = 0;
      while (k < text.length) {
        while (k < text.length && /\s/.test(text[k])) k++;
        if (k >= text.length) break;
        let end = -1;
        let depth = 0;
        let inStr = false;
        const startCh = text[k];
        if (startCh === '{' || startCh === '[') {
          for (let j = k; j < text.length; j++) {
            const c = text[j];
            if (inStr) {
              if (c === '\\') j++;
              else if (c === '"') inStr = false;
              continue;
            }
            if (c === '"') inStr = true;
            else if (c === '{' || c === '[') depth++;
            else if (c === '}' || c === ']') {
              depth--;
              if (depth === 0) {
                end = j + 1;
                break;
              }
            }
          }
        } else {
          const m = /^("(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?|true|false|null)/.exec(text.slice(k));
          if (m) end = k + m[0].length;
        }
        if (end < 0) return fail(`jq: error (at <stdin>:1): Cannot parse input as JSON: ${text.slice(k, k + 40)}…`, 2);
        try {
          docs.push(JSON.parse(text.slice(k, end)));
        } catch {
          return fail(`jq: error (at <stdin>:1): Cannot parse input as JSON: ${text.slice(k, k + 40)}…`, 2);
        }
        k = end;
      }
    }
    let out: V[];
    try {
      out = docs.flatMap((d) => jqEval(filter, d));
    } catch (e) {
      return fail((e as Error).message, 3);
    }
    const fmt = (v: V) => (flags.includes('r') && typeof v === 'string' ? v : JSON.stringify(v, null, flags.includes('c') ? 0 : 2));
    return { stdout: out.map(fmt).join('\n') + (out.length ? '\n' : ''), stderr: '', exitCode: 0 };
  },
};
export default cmd;
