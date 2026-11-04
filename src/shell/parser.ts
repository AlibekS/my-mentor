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

type Tok = { kind: 'word'; word: Word } | { kind: 'op'; op: string };

export function tokenize(line: string, env: Record<string, string>): Tok[] {
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

  const expandVar = (): string => {
    // i указывает на символ после $
    if (line[i] === '{') {
      const end = line.indexOf('}', i);
      if (end < 0) throw new ParseError('bad substitution');
      const name = line.slice(i + 1, end);
      i = end + 1;
      return env[name] ?? '';
    }
    if (line[i] === '?') {
      i++;
      return env['?'] ?? '0';
    }
    const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(line.slice(i));
    if (!m) return '$';
    i += m[0].length;
    return env[m[0]] ?? '';
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

export function parse(line: string, env: Record<string, string> = {}): ListItem[] {
  const toks = tokenize(line, env);
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
