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
  if (!/^[\d\s+\-*/%()<>=!&|]*$/.test(src)) throw new ParseError(`${expr}: syntax error in expression`);
  try {
    const v = Function(`"use strict"; return (${src.replace(/\//g, '/') || 0});`)();
    if (typeof v === 'boolean') return v ? '1' : '0';
    return String(Math.trunc(Number(v)));
  } catch {
    throw new ParseError(`${expr}: syntax error in expression`);
  }
}

export function tokenize(line: string, env: Record<string, string>, opts: ExpandOptions = {}): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  let cur = '';
  let curGlob = false;
  let inWord = false;

  const pushWord = () => {
    if (inWord) toks.push({ kind: 'word', word: { value: cur, glob: curGlob } });
    cur = '';
    curGlob = false;
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
      const end = line.indexOf('))', i + 2);
      if (end < 0) throw new ParseError('unexpected EOF while looking for matching `))\'');
      const expr = line.slice(i + 2, end);
      i = end + 2;
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
      // ${VAR:-default} и ${#VAR}
      const def = /^([A-Za-z_][A-Za-z0-9_]*|\d+):-(.*)$/.exec(inner);
      if (def) return env[def[1]] || def[2];
      if (inner.startsWith('#')) return String((env[inner.slice(1)] ?? '').length);
      return lookup(inner);
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
      inWord = true;
      i++;
      while (i < line.length && line[i] !== '"') {
        if (line[i] === '\\' && i + 1 < line.length && '"\\$`'.includes(line[i + 1])) {
          cur += line[i + 1];
          i += 2;
        } else if (line[i] === '$') {
          i++;
          cur += expandVar();
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
      cur += expandVar();
      inWord = true;
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
    if (c === '*' || c === '?' || c === '[') curGlob = true;
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
