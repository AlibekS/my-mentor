/**
 * Мини-интерпретатор bash-скриптов: if/elif/else/fi, for/while/until … do … done,
 * функции name() { … }, перенаправление `done < file` и `cmd | while read …`.
 * Простые команды выполняет Shell (execLine) — здесь только структура.
 */
import { ParseError, matchParen } from './parser';

export type Node =
  | { t: 'cmd'; line: string }
  | { t: 'if'; branches: { cond: Node[]; body: Node[] }[]; else?: Node[] }
  | { t: 'for'; v: string; list: string; body: Node[] }
  | { t: 'while'; until: boolean; cond: Node[]; body: Node[]; input?: string; pipeFrom?: string }
  | { t: 'func'; name: string; body: Node[] };

const KEYWORDS = /^(if|then|elif|else|fi|for|while|until|do|done|function)\b|^\w+\s*\(\)|^[{}]$/;

/** Есть ли в строке конструкции, которые нужно выполнять интерпретатором скриптов */
export function isCompound(line: string): boolean {
  return splitStatements(line).some((s) => KEYWORDS.test(s) || /\|\s*while\s/.test(s));
}

/** Разбить текст на операторы по переводам строк и ; (вне кавычек, $( ), комментариев) */
export function splitStatements(text: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q: string | null = null;
  const push = () => {
    const s = cur.trim();
    if (s) out.push(s);
    cur = '';
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      cur += c;
      if (c === '\\' && q === '"' && i + 1 < text.length) cur += text[++i];
      else if (c === q) q = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      q = c;
      cur += c;
      continue;
    }
    if (c === '\\' && text[i + 1] === '\n') {
      i++;
      continue;
    }
    if (c === '$' && text[i + 1] === '(') {
      const end = matchParen(text, i + 2);
      if (end < 0) throw new ParseError("unexpected EOF while looking for matching `)'");
      cur += text.slice(i, end + 1);
      i = end;
      continue;
    }
    if (c === '#' && (cur === '' || /\s$/.test(cur))) {
      while (i < text.length && text[i] !== '\n') i++;
      push();
      continue;
    }
    if (c === '\n') {
      push();
      continue;
    }
    if (c === ';' && text[i + 1] !== ';') {
      push();
      continue;
    }
    if (c === '&' && text[i + 1] !== '&' && text[i + 1] !== '>' && text[i - 1] !== '&' && text[i - 1] !== '>' && text[i - 1] !== '<' && text[i - 1] !== '|') {
      // фоновый запуск & — в тренажёре выполняем синхронно
      push();
      continue;
    }
    cur += c;
  }
  if (q) throw new ParseError(`unexpected EOF while looking for matching \`${q}'`);
  push();
  // "then cmd", "do cmd", "else cmd", "{ cmd" — ключевое слово отдельно, команда отдельно
  const res: string[] = [];
  for (const s of out) {
    const m = /^(then|do|else|\{)\s+(.+)$/.exec(s);
    const f = /^((?:function\s+)?[A-Za-z_][\w-]*\s*\(\)\s*\{)\s+(.+)$/.exec(s);
    if (m) res.push(m[1], m[2]);
    else if (f) res.push(f[1], f[2]);
    else res.push(s);
  }
  return res;
}

const first = (s: string) => s.split(/\s+/)[0];

export function parseScript(text: string): Node[] {
  const st = splitStatements(text);
  let i = 0;

  const block = (terms: string[]): Node[] => {
    const nodes: Node[] = [];
    while (i < st.length) {
      const s = st[i];
      const w = first(s);
      if (terms.includes(w) || terms.includes(s)) return nodes;
      nodes.push(statement());
    }
    if (terms.length) throw new ParseError(`syntax error: unexpected end of file (ожидалось ${terms.join('/')})`);
    return nodes;
  };

  const expect = (w: string) => {
    if (first(st[i] ?? '') !== w) throw new ParseError(`syntax error near unexpected token \`${st[i] ?? 'EOF'}' (ожидалось ${w})`);
  };

  const statement = (): Node => {
    const s = st[i];
    const w = first(s);
    if (w === 'if') {
      const branches: { cond: Node[]; body: Node[] }[] = [];
      let condSrc = s.slice(2).trim();
      i++;
      for (;;) {
        const cond: Node[] = condSrc ? [{ t: 'cmd', line: condSrc }] : [];
        cond.push(...block(['then']));
        expect('then');
        i++;
        const body = block(['elif', 'else', 'fi']);
        branches.push({ cond, body });
        const k = first(st[i]);
        if (k === 'elif') {
          condSrc = st[i].slice(4).trim();
          i++;
          continue;
        }
        let els: Node[] | undefined;
        if (k === 'else') {
          i++;
          els = block(['fi']);
        }
        expect('fi');
        i++;
        return { t: 'if', branches, else: els };
      }
    }
    if (w === 'for') {
      const m = /^for\s+([A-Za-z_]\w*)(?:\s+in\s+(.*))?$/.exec(s);
      if (!m) throw new ParseError(`syntax error near \`${s}'`);
      i++;
      expect('do');
      i++;
      const body = block(['done']);
      expect('done');
      i++;
      return { t: 'for', v: m[1], list: m[2] ?? '"$@"', body };
    }
    const pipeWhile = /^(.*?)\|\s*(while|until)\s+(.*)$/.exec(s);
    if (w === 'while' || w === 'until' || (pipeWhile && !/^(if|for)\b/.test(s))) {
      const until = pipeWhile ? pipeWhile[2] === 'until' : w === 'until';
      const condSrc = pipeWhile ? pipeWhile[3] : s.slice(w.length).trim();
      i++;
      const cond: Node[] = condSrc ? [{ t: 'cmd', line: condSrc }] : [];
      cond.push(...block(['do']));
      expect('do');
      i++;
      const body = block(['done']);
      expect('done');
      const red = /^done\s*<\s*(\S+|"[^"]*")/.exec(st[i]);
      i++;
      return { t: 'while', until, cond, body, input: red?.[1], pipeFrom: pipeWhile?.[1].trim() };
    }
    const fn = /^(?:function\s+)?([A-Za-z_][\w-]*)\s*(?:\(\))?\s*\{?$/.exec(s);
    if (fn && (/\(\)/.test(s) || w === 'function')) {
      i++;
      if (!s.endsWith('{')) {
        if (st[i] !== '{') throw new ParseError(`syntax error near \`${s}'`);
        i++;
      }
      const body = block(['}']);
      i++;
      return { t: 'func', name: fn[1], body };
    }
    if (['then', 'do', 'done', 'fi', 'else', 'elif', '}'].includes(w)) throw new ParseError(`syntax error near unexpected token \`${w}'`);
    i++;
    return { t: 'cmd', line: s };
  };

  return block([]);
}
