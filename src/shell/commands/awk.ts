import { fail, type CommandDef } from '../types';
import { parseArgs, lines } from '../args';
import { readInputs } from '../cmdutil';

/**
 * Упрощённый awk: поддерживает
 *   '{print $1, $3}'  '$9 == 502 {print $7}'  '/regex/ {print}'  'NR>1'
 *   '{sum += $10} END {print sum}'  '{count[$1]++} END {for (k in count) print k, count[k]}'
 *   -F разделитель, -v var=val, NF, NR, $NF, printf, length(), toupper/tolower
 * Реализация: программа транслируется в JavaScript.
 */
type Rule = { pattern: string | null; action: string | null; kind: 'BEGIN' | 'END' | 'main' };

function splitRules(prog: string): Rule[] {
  const rules: Rule[] = [];
  let i = 0;
  const s = prog.trim();
  while (i < s.length) {
    while (i < s.length && /[\s;]/.test(s[i])) i++;
    if (i >= s.length) break;
    let pattern = '';
    while (i < s.length && s[i] !== '{') {
      if (s[i] === '/' ) {
        // regex literal
        const end = s.indexOf('/', i + 1);
        pattern += s.slice(i, end + 1);
        i = end + 1;
        continue;
      }
      if (s[i] === '"') {
        const end = s.indexOf('"', i + 1);
        pattern += s.slice(i, end + 1);
        i = end + 1;
        continue;
      }
      if (s[i] === '\n' && pattern.trim()) break;
      pattern += s[i++];
    }
    let action: string | null = null;
    if (s[i] === '{') {
      let depth = 0;
      const start = i;
      let inStr = false;
      for (; i < s.length; i++) {
        if (s[i] === '"' && s[i - 1] !== '\\') inStr = !inStr;
        if (inStr) continue;
        if (s[i] === '{') depth++;
        else if (s[i] === '}') {
          depth--;
          if (depth === 0) break;
        }
      }
      if (depth !== 0) throw new Error('syntax error: unbalanced braces');
      action = s.slice(start + 1, i);
      i++;
    }
    const p = pattern.trim();
    if (p === 'BEGIN') rules.push({ pattern: null, action, kind: 'BEGIN' });
    else if (p === 'END') rules.push({ pattern: null, action, kind: 'END' });
    else rules.push({ pattern: p || null, action, kind: 'main' });
  }
  return rules;
}

/** Транслировать выражение awk в JS */
function expr(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '"') {
      let j = i + 1;
      while (j < src.length && (src[j] !== '"' || src[j - 1] === '\\')) j++;
      out += src.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === '$') {
      // $N, $NF, $(expr)
      const m = /^\$(\d+|NF|\([^)]*\)|[A-Za-z_]\w*)/.exec(src.slice(i));
      if (m) {
        const inner = m[1].startsWith('(') ? expr(m[1].slice(1, -1)) : m[1] === 'NF' ? 'V.NF' : /^\d+$/.test(m[1]) ? m[1] : 'V.' + m[1];
        out += `F(${inner})`;
        i += m[0].length;
        continue;
      }
    }
    if (c === '/' ) {
      // regex literal если перед ним оператор/начало
      const prev = out.trimEnd().slice(-1);
      if (!prev || '(,!&|~=+-*'.includes(prev) || out.trimEnd().endsWith('~')) {
        const end = src.indexOf('/', i + 1);
        if (end > i) {
          const re = src.slice(i + 1, end);
          if (out.trimEnd().endsWith('!~') || out.trimEnd().endsWith('~')) {
            out += `/${re}/`;
          } else out += `(/${re}/.test(F(0)))`;
          i = end + 1;
          continue;
        }
      }
    }
    if (c === '~' || (c === '!' && src[i + 1] === '~')) {
      // a ~ /re/  → MATCH(a, /re/)
      const neg = c === '!';
      const left = out;
      // находим левый операнд — последнее «слово»
      const m = /(F\([^)]*\)|V\.\w+|"[^"]*"|\w+)\s*$/.exec(left);
      const leftOp = m ? m[1] : 'F(0)';
      out = m ? left.slice(0, left.length - m[0].length) : left;
      i += neg ? 2 : 1;
      while (src[i] === ' ') i++;
      let rightRe = '';
      if (src[i] === '/') {
        const end = src.indexOf('/', i + 1);
        rightRe = `/${src.slice(i + 1, end)}/`;
        i = end + 1;
      } else if (src[i] === '"') {
        const end = src.indexOf('"', i + 1);
        rightRe = `new RegExp(${src.slice(i, end + 1)})`;
        i = end + 1;
      }
      out += `${neg ? '!' : ''}${rightRe}.test(String(${leftOp}))`;
      continue;
    }
    const w = /^[A-Za-z_]\w*/.exec(src.slice(i));
    if (w) {
      const name = w[0];
      const fns: Record<string, string> = { length: 'LEN', toupper: 'UP', tolower: 'LOW', substr: 'SUBSTR', int: 'INT', index: 'IDX', split: 'SPLIT', sprintf: 'SPRINTF' };
      if (fns[name]) {
        out += fns[name];
        if (name === 'length' && src[i + name.length] !== '(') out += '(F(0))';
      } else if (['in', 'for', 'if', 'else', 'while', 'return'].includes(name)) out += name;
      else out += 'V.' + name;
      i += name.length;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function stmt(src: string): string {
  // разбиваем по ; и переводам строк на верхнем уровне (без учёта скобок внутри строк)
  const parts: string[] = [];
  let depthP = 0;
  let depthB = 0;
  let inStr = false;
  let cur = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '"' && src[i - 1] !== '\\') inStr = !inStr;
    if (!inStr) {
      if (c === '(') depthP++;
      if (c === ')') depthP--;
      if (c === '{') depthB++;
      if (c === '}') depthB--;
      if ((c === ';' || c === '\n') && depthP === 0 && depthB === 0) {
        parts.push(cur);
        cur = '';
        continue;
      }
    }
    cur += c;
  }
  parts.push(cur);
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      let m;
      if ((m = /^for\s*\(\s*(\w+)\s+in\s+(\w+)\s*\)\s*([\s\S]*)$/.exec(p))) {
        const body = m[3].replace(/^\{|\}$/g, '');
        return `for (const __k of Object.keys(V.${m[2]} ?? {})) { V.${m[1]} = __k; ${stmt(body)} }`;
      }
      if ((m = /^if\s*\(([\s\S]*?)\)\s*([\s\S]*)$/.exec(p))) {
        const body = m[2].replace(/^\{|\}$/g, '');
        return `if (${expr(m[1])}) { ${stmt(body)} }`;
      }
      if (p === 'next') return 'throw NEXT;';
      if (/^print(\s|$|\()/.test(p)) {
        const rest = p.slice(5).trim().replace(/^\((.*)\)$/, '$1');
        const redirect = /^(.*?)\s*>\s*"[^"]*"$/.exec(rest);
        const argsSrc = redirect ? redirect[1] : rest;
        if (!argsSrc) return 'OUT(F(0));';
        const args = splitTop(argsSrc, ',').map((x) => expr(x.trim()));
        // конкатенация через пробел: "a" $1 → "a"+$1
        return `OUT([${args.map(concat).join(',')}].join(V.OFS));`;
      }
      if (/^printf(\s|\()/.test(p)) {
        const rest = p.slice(6).trim().replace(/^\((.*)\)$/, '$1');
        const args = splitTop(rest, ',').map((x) => concat(expr(x.trim())));
        return `RAW(SPRINTF(${args.join(',')}));`;
      }
      return concat(expr(p)) + ';';
    })
    .join('\n');
}

/** Конкатенация строк в awk пишется через пробел: превращаем «a b» в «a + "" + b» */
function concat(js: string): string {
  // только для простых случаев: токены, разделённые пробелами, без операторов между ними
  const toks = splitTop(js, ' ').filter(Boolean);
  if (toks.length < 2) return js;
  const ops = /^(==|!=|<=|>=|<|>|\+|-|\*|\/|%|&&|\|\||=|\+=|-=|\*=|\/=|\+\+|--|\?|:|!)$/;
  const res: string[] = [];
  for (let i = 0; i < toks.length; i++) {
    res.push(toks[i]);
    if (i < toks.length - 1 && !ops.test(toks[i]) && !ops.test(toks[i + 1]) && !/[=<>!+\-*/%&|?:,(]$/.test(toks[i]) && !/^[=<>!+\-*/%&|?:,)]/.test(toks[i + 1])) {
      res.push('+""+');
    }
  }
  return res.join(' ');
}

function splitTop(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let inStr = false;
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"' && s[i - 1] !== '\\') inStr = !inStr;
    if (!inStr) {
      if (c === '(' || c === '[') depth++;
      if (c === ')' || c === ']') depth--;
      if (c === '/' && depth === 0 && sep === ' ') {
        // regex literal целиком
        const end = s.indexOf('/', i + 1);
        if (end > i && /test/.test(s.slice(end, end + 8))) {
          cur += s.slice(i, end + 1);
          i = end;
          continue;
        }
      }
      if (c === sep && depth === 0) {
        out.push(cur);
        cur = '';
        continue;
      }
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

function sprintf(fmt: string, ...args: unknown[]): string {
  let k = 0;
  return String(fmt).replace(/%(-?)(\d*)(?:\.(\d+))?([sdfi%])/g, (_m, left, width, prec, t) => {
    if (t === '%') return '%';
    const v = args[k++];
    let s: string;
    if (t === 'd' || t === 'i') s = String(Math.trunc(Number(v) || 0));
    else if (t === 'f') s = (Number(v) || 0).toFixed(prec ? parseInt(prec, 10) : 6);
    else s = String(v ?? '');
    const w = width ? parseInt(width, 10) : 0;
    return left ? s.padEnd(w) : s.padStart(w);
  });
}

const cmd: CommandDef = {
  name: 'awk',
  summary: "обработка полей: awk '{print $1}', awk -F: '{print $1}', awk '$9==500 {print $7}', awk '{s+=$10} END {print s}'",
  usage: "awk [-F разделитель] [-v var=val] 'программа' [файл...]",
  run(args, stdin, ctx) {
    const a = parseArgs(args, ['F', 'v'], ['F', 'v']);
    const prog = a.positional.shift();
    if (!prog) return fail("usage: awk [-F fs][-v var=value] [prog | -f progfile][file ...]", 2);
    const r = readInputs('awk', a.positional, stdin, ctx);
    let rules: Rule[];
    try {
      rules = splitRules(prog);
    } catch (e) {
      return fail(`awk: ${(e as Error).message}`, 2);
    }
    let out = '';
    const fsArg = a.values.F;
    const V: Record<string, any> = { NR: 0, NF: 0, OFS: ' ', FS: fsArg ?? ' ' };
    if (a.values.v) {
      const [k, v] = a.values.v.split('=');
      V[k] = isNaN(Number(v)) ? v : Number(v);
    }
    let fields: string[] = [];
    let line = '';
    const num = (x: string) => (x !== '' && !isNaN(Number(x)) ? Number(x) : x);
    const F = (n: number) => (n === 0 ? line : num(fields[n - 1] ?? ''));
    const helpers = {
      F,
      V,
      OUT: (s: unknown) => (out += String(s) + '\n'),
      RAW: (s: unknown) => (out += String(s).replace(/\\n/g, '\n').replace(/\\t/g, '\t')),
      LEN: (s: unknown) => (s && typeof s === 'object' ? Object.keys(s).length : String(s ?? '').length),
      UP: (s: unknown) => String(s).toUpperCase(),
      LOW: (s: unknown) => String(s).toLowerCase(),
      SUBSTR: (s: unknown, st: number, len?: number) => String(s).substr(st - 1, len),
      INT: (x: unknown) => Math.trunc(Number(x)),
      IDX: (s: unknown, t: unknown) => String(s).indexOf(String(t)) + 1,
      SPLIT: (s: unknown, arr: any, sep?: string) => {
        const parts = String(s).split(sep ?? /\s+/);
        Object.keys(arr).forEach((k) => delete arr[k]);
        parts.forEach((p, i) => (arr[i + 1] = p));
        return parts.length;
      },
      SPRINTF: sprintf,
      NEXT: {},
    };
    // переменные: используемые с [ — массивы (значение по умолчанию 0), остальные — 0
    const reserved = new Set(['BEGIN', 'END', 'NR', 'NF', 'FS', 'OFS', 'print', 'printf', 'for', 'in', 'if', 'else', 'while', 'next', 'length', 'toupper', 'tolower', 'substr', 'int', 'index', 'split', 'sprintf']);
    const progNoStr = prog.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/\/(?:[^/\\]|\\.)+\//g, '//');
    for (const m of progNoStr.matchAll(/(?<![$\w])([A-Za-z_]\w*)(\s*\[)?/g)) {
      const name = m[1];
      if (reserved.has(name) || name in V) continue;
      V[name] = m[2] ? new Proxy({} as Record<string, any>, { get: (o, k) => (k in o ? o[k as string] : typeof k === 'string' ? 0 : undefined) }) : 0;
    }
    // split(s, arr) — второй аргумент тоже массив
    for (const m of progNoStr.matchAll(/split\([^,]+,\s*([A-Za-z_]\w*)/g)) if (typeof V[m[1]] !== 'object') V[m[1]] = {};
    const proxyV = V;
    let compiled: { kind: Rule['kind']; test: (() => boolean) | null; act: () => void }[];
    try {
      compiled = rules.map((ru) => {
        const params = Object.keys(helpers);
        const values = params.map((p) => (p === 'V' ? proxyV : (helpers as any)[p]));
        const testFn = ru.pattern
          ? (new Function(...params, `return (${concat(expr(ru.pattern))});`) as (...x: unknown[]) => boolean)
          : null;
        const actFn = new Function(...params, ru.action === null ? 'OUT(F(0));' : stmt(ru.action)) as (...x: unknown[]) => void;
        return {
          kind: ru.kind,
          test: testFn ? () => !!testFn(...values) : null,
          act: () => actFn(...values),
        };
      });
    } catch (e) {
      return fail(`awk: syntax error in program: ${(e as Error).message}`, 2);
    }
    try {
      for (const c of compiled.filter((c) => c.kind === 'BEGIN')) c.act();
      const all = lines(r.inputs.map((i) => i.content).join(''));
      for (const l of all) {
        line = l;
        const sep = V.FS;
        fields = sep === ' ' ? l.trim().split(/\s+/).filter(Boolean) : l.split(sep.length === 1 ? sep : new RegExp(sep));
        V.NR++;
        V.NF = fields.length;
        try {
          for (const c of compiled.filter((c) => c.kind === 'main')) {
            if (!c.test || c.test()) c.act();
          }
        } catch (e) {
          if (e !== helpers.NEXT) throw e;
        }
      }
      for (const c of compiled.filter((c) => c.kind === 'END')) c.act();
    } catch (e) {
      return { stdout: out, stderr: `awk: runtime error: ${(e as Error).message}\n`, exitCode: 2 };
    }
    return { stdout: out, stderr: r.stderr, exitCode: r.failed ? 2 : 0 };
  },
};
export default cmd;
