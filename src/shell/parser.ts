/**
 * Парсер командной строки: кавычки, экранирование, $VAR, пайпы, перенаправления,
 * операторы && || ;
 */
export interface Word {
  value: string;
  /** true — в слове есть незакавыченные * или ? (нужно раскрыть glob) */
  glob: boolean;
}

export type RedirectType = '>' | '>>' | '<' | '2>' | '2>>' | '2>&1' | '&>';

export interface Redirect {
  type: RedirectType;
  target: string;
}

export interface SimpleCommand {
  words: Word[];
  redirects: Redirect[];
}

export interface Pipeline {
  commands: SimpleCommand[];
}

export interface ListItem {
  pipeline: Pipeline;
  /** оператор ПЕРЕД этим конвейером */
  op: ';' | '&&' | '||' | null;
}

export class ParseError extends Error {}

export const EXIT_PLACEHOLDER = '\u0001?\u0001';

type Tok = { kind: 'word'; word: Word } | { kind: 'op'; op: string };

export interface ExpandOptions {
  /** выполнить команду для $(...) и `...` и вернуть её stdout */
  subst?: (cmd: string) => string;
  /** set -u: ошибка при обращении к неопределённой переменной */
  nounset?: boolean;
  /** позиционные параметры ($1…$N) — чтобы "$@" раскрывался в отдельные слова */
  positional?: string[];
}

/** Ошибка, которая прерывает скрипт (как set -u или ${VAR:?msg}) */
export class FatalExpansion extends ParseError {}

/** Шаблон bash (${VAR%pat}, ${VAR#pat}) → RegExp */
function patToRe(pat: string, greedy: boolean): string {
  let re = '';
  for (const c of pat) re += c === '*' ? (greedy ? '.*' : '.*?') : c === '?' ? '.' : c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  return re;
}

/** Найти конец $(( … )) с учётом вложенных скобок; i — позиция после «((» */
function matchArith(s: string, i: number): number {
  let depth = 0;
  for (let k = i; k < s.length; k++) {
    if (s[k] === '(') depth++;
    else if (s[k] === ')') {
      if (depth === 0 && s[k + 1] === ')') return k;
      depth--;
    }
  }
  return -1;
}

/** Brace expansion: {1..5}, {a,b,c}, file.{log,bak} */
export function braceExpand(word: string): string[] {
  const m = /^(.*?)\{([^{}]*)\}(.*)$/s.exec(word);
  if (!m) return [word];
  const [, pre, body, post] = m;
  let items: string[] | null = null;
  const range = /^(-?\d+)\.\.(-?\d+)(?:\.\.(-?\d+))?$/.exec(body);
  const chars = /^([a-zA-Z])\.\.([a-zA-Z])$/.exec(body);
  if (range) {
    const a = parseInt(range[1], 10);
    const b = parseInt(range[2], 10);
    const step = Math.abs(parseInt(range[3] ?? '1', 10)) || 1;
    const width = /^-?0\d/.test(range[1]) || /^-?0\d/.test(range[2]) ? Math.max(range[1].length, range[2].length) : 0;
    items = [];
    for (let x = a; a <= b ? x <= b : x >= b; x += a <= b ? step : -step) {
      items.push(width ? String(x).padStart(width, '0') : String(x));
      if (items.length > 10000) break;
    }
  } else if (chars) {
    const a = chars[1].charCodeAt(0);
    const b = chars[2].charCodeAt(0);
    items = [];
    for (let x = a; a <= b ? x <= b : x >= b; x += a <= b ? 1 : -1) items.push(String.fromCharCode(x));
  } else if (body.includes(',')) items = body.split(',');
  if (!items) return [word];
  return items.flatMap((it) => braceExpand(pre + it + post));
}

/** Найти закрывающую скобку для $( … ) с учётом вложенности и кавычек; i — позиция после "(" */
export function matchParen(s: string, i: number): number {
  let depth = 1;
  let q: string | null = null;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (q) {
      if (c === q) q = null;
      else if (c === '\\' && q === '"') k++;
      continue;
    }
    if (c === "'" || c === '"') q = c;
    else if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return k;
    }
  }
  return -1;
}

/** Целочисленная арифметика $(( … )) */
export function arith(expr: string, env: Record<string, string>): string {
  const src = expr.replace(/\$?([A-Za-z_][A-Za-z0-9_]*)/g, (_m, n) => String(parseInt(env[n] ?? '0', 10) || 0));
  if (!/^[\d\s+\-*/%()<>=!&|?:^~]*$/.test(src)) throw new ParseError(`${expr}: syntax error in expression`);
  try {
    const v = Function(`"use strict"; return (${src.replace(/\//g, '/') || 0});`)();
    if (typeof v === 'boolean') return v ? '1' : '0';
    return String(Math.trunc(Number(v)));
  } catch {
    throw new ParseError(`${expr}: syntax error in expression`);
  }
}

/**
 * (( … )) и let: присваивания и инкременты (i++, ++i, i+=2, i=i*2), выражения через запятую.
 * Возвращает значение последнего выражения.
 */
export function arithAssign(expr: string, env: Record<string, string>): number {
  let last = 0;
  for (const part of expr.split(',')) {
    const e = part.trim();
    if (!e) continue;
    let m: RegExpExecArray | null;
    if ((m = /^([A-Za-z_]\w*)\s*(\+\+|--)$/.exec(e))) {
      const v = parseInt(env[m[1]] ?? '0', 10) || 0;
      env[m[1]] = String(m[2] === '++' ? v + 1 : v - 1);
      last = v;
    } else if ((m = /^(\+\+|--)\s*([A-Za-z_]\w*)$/.exec(e))) {
      const v = (parseInt(env[m[2]] ?? '0', 10) || 0) + (m[1] === '++' ? 1 : -1);
      env[m[2]] = String(v);
      last = v;
    } else if ((m = /^([A-Za-z_]\w*)\s*([-+*/%]?)=(?!=)\s*(.+)$/.exec(e))) {
      const r = parseInt(arith(m[3], env), 10);
      const cur = parseInt(env[m[1]] ?? '0', 10) || 0;
      const v = m[2] === '+' ? cur + r : m[2] === '-' ? cur - r : m[2] === '*' ? cur * r : m[2] === '/' ? Math.trunc(cur / r) : m[2] === '%' ? cur % r : r;
      env[m[1]] = String(v);
      last = v;
    } else last = parseInt(arith(e, env), 10);
  }
  return last;
}

export function tokenize(line: string, env: Record<string, string>, opts: ExpandOptions = {}): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  let cur = '';
  let curGlob = false;
  let inWord = false;

  let curBrace = false;
  const pushWord = () => {
    if (inWord) {
      // {1..5}, {a,b} — только если фигурные скобки стояли без кавычек
      if (curBrace) for (const w of braceExpand(cur)) toks.push({ kind: 'word', word: { value: w, glob: curGlob } });
      else toks.push({ kind: 'word', word: { value: cur, glob: curGlob } });
    }
    cur = '';
    curGlob = false;
    curBrace = false;
    inWord = false;
  };

  const lookup = (name: string): string => {
    if (name in env) return env[name];
    if (opts.nounset && !/^\d+$/.test(name)) throw new ParseError(`${name}: unbound variable`);
    return '';
  };

  const expandVar = (): string => {
    // i указывает на символ после $
    if (line.startsWith('((', i)) {
      const end = matchArith(line, i + 2);
      if (end < 0) throw new ParseError('unexpected EOF while looking for matching `))\'');
      let expr = line.slice(i + 2, end);
      i = end + 2;
      // $(команда) и ${VAR} внутри арифметики
      expr = expr.replace(/\$\{([A-Za-z_]\w*)\}/g, (_m, n) => env[n] ?? '0');
      for (let k = expr.indexOf('$('); k >= 0; k = expr.indexOf('$(')) {
        const e2 = matchParen(expr, k + 2);
        if (e2 < 0) break;
        const out = opts.subst ? opts.subst(expr.slice(k + 2, e2)).trim() : '0';
        expr = expr.slice(0, k) + (out || '0') + expr.slice(e2 + 1);
      }
      return arith(expr, env);
    }
    if (line[i] === '(') {
      const end = matchParen(line, i + 1);
      if (end < 0) throw new ParseError("unexpected EOF while looking for matching `)'");
      const cmd = line.slice(i + 1, end);
      i = end + 1;
      return opts.subst ? opts.subst(cmd).replace(/\n+$/, '') : '';
    }
    if (line[i] === '{') {
      const end = line.indexOf('}', i);
      if (end < 0) throw new ParseError('bad substitution');
      const inner = line.slice(i + 1, end);
      i = end + 1;
      if (inner === '@' || inner === '*') return env['@'] ?? '';
      if (inner.startsWith('#') && inner.length > 1) return String((env[inner.slice(1)] ?? '').length);
      const m = /^([A-Za-z_][A-Za-z0-9_]*|\d+)(?:(:?[-=?+])(.*)|(##?|%%?)(.*)|(\/\/?)([^/]*)(?:\/(.*))?|:(-?\d+)(?::(\d+))?|(\^\^|,,))?$/s.exec(inner);
      if (!m) throw new ParseError(`\${${inner}}: bad substitution`);
      const name = m[1];
      const set = name in env;
      const val = env[name] ?? '';
      const expandWord = (w: string) => w.replace(/\$\{?([A-Za-z_]\w*|\d)\}?/g, (_x, n) => env[n] ?? '');
      if (m[2]) {
        const colon = m[2].startsWith(':');
        const empty = colon ? val === '' : !set;
        const arg = expandWord(m[3] ?? '');
        switch (m[2].slice(-1)) {
          case '-':
            return empty ? arg : val;
          case '=':
            if (empty) env[name] = arg;
            return empty ? arg : val;
          case '+':
            return empty ? '' : arg;
          case '?':
            if (empty) throw new FatalExpansion(`${name}: ${arg || 'parameter null or not set'}`);
            return val;
        }
      }
      if (m[4]) {
        const pat = m[5] ?? '';
        const greedy = m[4].length === 2;
        if (m[4][0] === '#') return val.replace(new RegExp('^' + patToRe(pat, greedy)), '');
        const re = new RegExp((greedy ? '' : '') + patToRe(pat, greedy) + '$');
        if (greedy) {
          // %% — самый длинный суффикс: ищем самое левое совпадение
          for (let k = 0; k <= val.length; k++) if (new RegExp('^' + patToRe(pat, true) + '$').test(val.slice(k))) return val.slice(0, k);
          return val;
        }
        for (let k = val.length; k >= 0; k--) if (new RegExp('^' + patToRe(pat, false) + '$').test(val.slice(k))) return val.slice(0, k);
        return val.replace(re, '');
      }
      if (m[6]) {
        const re = new RegExp(patToRe(m[7] ?? '', true), m[6].length === 2 ? 'g' : '');
        return val.replace(re, () => m[8] ?? '');
      }
      if (m[9] !== undefined) {
        const off = parseInt(m[9], 10);
        const start = off < 0 ? Math.max(0, val.length + off) : off;
        return m[10] !== undefined ? val.substr(start, parseInt(m[10], 10)) : val.slice(start);
      }
      if (m[11]) return m[11] === '^^' ? val.toUpperCase() : val.toLowerCase();
      return lookup(name);
    }
    if (/[0-9#@*]/.test(line[i] ?? '')) {
      const c = line[i++];
      if (c === '*') return env['@'] ?? '';
      return env[c] ?? (c === '#' ? '0' : '');
    }
    if (line[i] === '?') {
      i++;
      // подставляется в момент выполнения команды (см. Shell.runSimple)
      return EXIT_PLACEHOLDER;
    }
    const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(line.slice(i));
    if (!m) return '$';
    i += m[0].length;
    return lookup(m[0]);
  };

  while (i < line.length) {
    const c = line[i];
    if (c === ' ' || c === '\t') {
      pushWord();
      i++;
      continue;
    }
    if (c === '#' && !inWord) break;
    if (c === "'") {
      const end = line.indexOf("'", i + 1);
      if (end < 0) throw new ParseError("unexpected EOF while looking for matching `''");
      cur += line.slice(i + 1, end);
      inWord = true;
      i = end + 1;
      continue;
    }
    if (c === '"') {
      const inWord0 = inWord;
      inWord = true;
      i++;
      while (i < line.length && line[i] !== '"') {
        if (line[i] === '\\' && i + 1 < line.length && '"\\$`'.includes(line[i + 1])) {
          cur += line[i + 1];
          i += 2;
        } else if (line[i] === '$' && (line[i + 1] === '@' || line.startsWith('{@}', i + 1)) && opts.positional) {
          // "$@" — каждый параметр отдельным словом
          i += line[i + 1] === '@' ? 2 : 4;
          const ps = opts.positional;
          if (!ps.length) {
            if (!cur && line[i] === '"' && !inWord0) inWord = false;
            continue;
          }
          cur += ps[0];
          for (let k = 1; k < ps.length; k++) {
            toks.push({ kind: 'word', word: { value: cur, glob: false } });
            cur = ps[k];
          }
        } else if (line[i] === '$') {
          i++;
          cur += expandVar();
        } else if (line[i] === '`') {
          const end = line.indexOf('`', i + 1);
          if (end < 0) throw new ParseError('unexpected EOF while looking for matching ``\'');
          cur += opts.subst ? opts.subst(line.slice(i + 1, end)).replace(/\n+$/, '') : '';
          i = end + 1;
        } else {
          cur += line[i++];
        }
      }
      if (i >= line.length) throw new ParseError('unexpected EOF while looking for matching `"\'');
      i++;
      continue;
    }
    if (c === '`') {
      const end = line.indexOf('`', i + 1);
      if (end < 0) throw new ParseError('unexpected EOF while looking for matching ``\'');
      cur += opts.subst ? opts.subst(line.slice(i + 1, end)).replace(/\n+$/, '') : '';
      inWord = true;
      i = end + 1;
      continue;
    }
    if (c === '\\') {
      if (i + 1 < line.length) cur += line[i + 1];
      inWord = true;
      i += 2;
      continue;
    }
    if (c === '$') {
      i++;
      const v = expandVar();
      // без кавычек результат делится на слова по пробелам/переводам строк (IFS);
      // кроме значения присваивания: X=$(cmd), local name=$1, export A=$B — как в bash
      if (/[ \t\n]/.test(v) && !/^[A-Za-z_][A-Za-z0-9_]*=/.test(cur)) {
        const parts = v.split(/[ \t\n]+/);
        parts.forEach((p, k) => {
          if (k > 0) {
            if (inWord || cur) toks.push({ kind: 'word', word: { value: cur, glob: curGlob } });
            cur = '';
            curGlob = false;
            inWord = false;
          }
          if (p) {
            cur += p;
            inWord = true;
            if (/[*?[]/.test(p)) curGlob = true;
          }
        });
      } else {
        cur += v;
        // пустая подстановка без кавычек не создаёт слова (как в bash): ${X:+alt}, $EMPTY
        if (v !== '') inWord = true;
      }
      continue;
    }
    // операторы
    const rest = line.slice(i);
    const op = ['2>&1', '&>', '2>>', '>>', '&&', '||', '2>', '>', '<', '|', ';'].find((o) => rest.startsWith(o));
    if (op) {
      // "2>" считаем оператором только в начале слова
      if (op.startsWith('2') && inWord) {
        cur += c;
        i++;
        continue;
      }
      pushWord();
      toks.push({ kind: 'op', op });
      i += op.length;
      continue;
    }
    // ~ в начале слова → домашний каталог (как в bash; нужно и для glob: ~/tickets/*)
    if (c === '~' && !inWord && (i + 1 >= line.length || /[/\s;|&<>]/.test(line[i + 1])) && env.HOME) {
      cur += env.HOME;
      inWord = true;
      i++;
      continue;
    }
    if (c === '*' || c === '?' || c === '[') curGlob = true;
    if (c === '{') curBrace = true;
    cur += c;
    inWord = true;
    i++;
  }
  pushWord();
  return toks;
}

export function parse(line: string, env: Record<string, string> = {}, opts: ExpandOptions = {}): ListItem[] {
  const toks = tokenize(line, env, opts);
  const items: ListItem[] = [];
  let pipeline: Pipeline = { commands: [] };
  let cmd: SimpleCommand = { words: [], redirects: [] };
  let pendingOp: ListItem['op'] = null;

  const endCommand = () => {
    if (!cmd.words.length && !cmd.redirects.length) {
      throw new ParseError('syntax error near unexpected token');
    }
    pipeline.commands.push(cmd);
    cmd = { words: [], redirects: [] };
  };
  const endPipeline = () => {
    endCommand();
    items.push({ pipeline, op: pendingOp });
    pipeline = { commands: [] };
  };

  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.kind === 'word') {
      cmd.words.push(t.word);
      continue;
    }
    switch (t.op) {
      case '|':
        if (!cmd.words.length) throw new ParseError("syntax error near unexpected token `|'");
        endCommand();
        break;
      case '&&':
      case '||':
      case ';':
        if (!cmd.words.length) {
          if (t.op === ';' && !pipeline.commands.length && k === toks.length - 1) break;
          throw new ParseError(`syntax error near unexpected token \`${t.op}'`);
        }
        endPipeline();
        pendingOp = t.op as ListItem['op'];
        break;
      case '2>&1':
        cmd.redirects.push({ type: '2>&1', target: '' });
        break;
      default: {
        const next = toks[k + 1];
        if (!next || next.kind !== 'word') throw new ParseError('syntax error near unexpected token `newline\'');
        cmd.redirects.push({ type: t.op as RedirectType, target: next.word.value });
        k++;
      }
    }
  }
  if (cmd.words.length || cmd.redirects.length) endPipeline();
  else if (pipeline.commands.length) throw new ParseError('syntax error: unexpected end of file');
  else if (pendingOp && pendingOp !== ';') throw new ParseError('syntax error: unexpected end of file');
  return items;
}

/** Glob → RegExp (поддержка * ? [abc]) */
export function globToRegExp(glob: string): RegExp {
  let re = '^';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else if (c === '[') {
      const end = glob.indexOf(']', i);
      if (end > i) {
        re += '[' + glob.slice(i + 1, end).replace(/^!/, '^') + ']';
        i = end;
      } else re += '\\[';
    } else re += c.replace(/[.+^${}()|\\]/g, '\\$&');
  }
  return new RegExp(re + '$');
}

/**
 * Разбить строку на элементы списка по ; && || (вне кавычек и $( )), не раскрывая переменные —
 * каждый элемент раскрывается в момент выполнения, как в bash.
 */
export function splitList(line: string): { text: string; op: ListItem['op'] }[] {
  const out: { text: string; op: ListItem['op'] }[] = [];
  let cur = '';
  let op: ListItem['op'] = null;
  let q: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      cur += c;
      if (c === '\\' && q === '"' && i + 1 < line.length) cur += line[++i];
      else if (c === q) q = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      q = c;
      cur += c;
      continue;
    }
    if (c === '\\' && i + 1 < line.length) {
      cur += c + line[++i];
      continue;
    }
    // комментарий до конца строки: «ip r  # маршруты; шлюз» — «;» внутри комментария не разделяет команды
    if (c === '#' && (cur === '' || /\s$/.test(cur))) break;
    if (c === '$' && line[i + 1] === '(') {
      const end = matchParen(line, i + 2);
      if (end < 0) {
        cur += line.slice(i);
        break;
      }
      cur += line.slice(i, end + 1);
      i = end;
      continue;
    }
    const two = line.slice(i, i + 2);
    if (two === '&&' || two === '||' || (c === ';' && two !== ';;')) {
      out.push({ text: cur, op });
      op = c === ';' ? ';' : (two as '&&' | '||');
      cur = '';
      if (c !== ';') i++;
      continue;
    }
    cur += c;
  }
  if (cur.trim() || out.length === 0) out.push({ text: cur, op });
  return out.filter((x, idx) => x.text.trim() || idx === 0);
}
