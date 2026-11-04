import { fail, type CommandDef, type CommandContext } from '../types';
import { lines } from '../args';
import { abs, readInputs } from '../cmdutil';
import { FsErr, errText } from '../vfs';

/**
 * awk — небольшой, но настоящий интерпретатор (токенизатор → парсер → исполнение).
 * Поддерживает: шаблоны (выражения, /regex/, BEGIN/END, диапазоны a,b), print/printf (в т.ч. > "файл"),
 * if/else, while, do, for(;;), for (k in a), break/continue/next/nextfile/exit/return, delete,
 * функции пользователя, массивы (a[i,j]), $выражение, присваивание полям и NF, конкатенацию,
 * ~ !~, in, ?:, ++/--, ^, встроенные length/substr/index/split/sub/gsub/match/sprintf/tolower/toupper/
 * int/sqrt/exp/log/sin/cos/atan2/rand/srand/systime/strftime, переменные NR NF FNR FILENAME FS OFS ORS
 * SUBSEP RSTART RLENGTH, опции -F -v -f и присваивания var=value среди файлов.
 */

// ---------------- лексер ----------------
type TokType = 'num' | 'str' | 'ere' | 'name' | 'funcname' | 'builtin' | 'kw' | 'op' | 'nl' | 'eof';
interface Tok {
  t: TokType;
  v: string;
  n?: number;
}

const KEYWORDS = new Set(['BEGIN', 'END', 'function', 'func', 'getline', 'print', 'printf', 'if', 'else', 'while', 'for', 'do', 'break', 'continue', 'next', 'nextfile', 'exit', 'return', 'delete', 'in']);
const BUILTINS = new Set(['length', 'substr', 'index', 'split', 'sub', 'gsub', 'match', 'sprintf', 'tolower', 'toupper', 'int', 'sqrt', 'exp', 'log', 'sin', 'cos', 'atan2', 'rand', 'srand', 'systime', 'strftime', 'close', 'fflush', 'system']);
const OPS = ['**=', '^=', '+=', '-=', '*=', '/=', '%=', '==', '<=', '>=', '!=', '++', '--', '&&', '||', '>>', '!~', '**', '{', '}', '(', ')', '[', ']', ';', ',', '+', '-', '*', '/', '%', '^', '!', '>', '<', '|', '?', ':', '~', '$', '='];

class AwkError extends Error {}

function unescape(s: string): string {
  return s.replace(/\\(n|t|r|\\|"|\/|a|b|f|v|[0-7]{1,3}|.)/g, (_m, c: string) => {
    const map: Record<string, string> = { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', '/': '/', a: '\x07', b: '\b', f: '\f', v: '\v' };
    if (c in map) return map[c];
    if (/^[0-7]+$/.test(c)) return String.fromCharCode(parseInt(c, 8));
    return '\\' + c;
  });
}

function lex(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const divAllowed = () => {
    const p = toks[toks.length - 1];
    if (!p) return false;
    if (p.t === 'num' || p.t === 'str' || p.t === 'ere' || p.t === 'name') return true;
    if (p.t === 'builtin') return p.v === 'length';
    if (p.t === 'op') return p.v === ')' || p.v === ']' || p.v === '$' || p.v === '++' || p.v === '--';
    return false;
  };
  while (i < src.length) {
    const c = src[i];
    if (c === '\\' && src[i + 1] === '\n') {
      i += 2;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\r') {
      i++;
      continue;
    }
    if (c === '#') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '\n') {
      toks.push({ t: 'nl', v: '\n' });
      i++;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let s = '';
      while (j < src.length && src[j] !== '"') {
        if (src[j] === '\\' && j + 1 < src.length) {
          s += src[j] + src[j + 1];
          j += 2;
        } else s += src[j++];
      }
      if (j >= src.length) throw new AwkError('non-terminated string');
      toks.push({ t: 'str', v: unescape(s) });
      i = j + 1;
      continue;
    }
    if (c === '/' && !divAllowed()) {
      let j = i + 1;
      let s = '';
      let inBr = false;
      while (j < src.length && (src[j] !== '/' || inBr)) {
        if (src[j] === '\n') throw new AwkError('newline in regex');
        if (src[j] === '\\' && j + 1 < src.length) {
          s += src[j + 1] === '/' ? '/' : src[j] + src[j + 1];
          j += 2;
          continue;
        }
        if (src[j] === '[' && !inBr) {
          inBr = true;
          s += src[j++];
          if (src[j] === '^') s += src[j++];
          if (src[j] === ']') s += src[j++];
          continue;
        }
        if (src[j] === '[' && inBr && src[j + 1] === ':') {
          const e = src.indexOf(':]', j + 2);
          if (e > 0) {
            s += src.slice(j, e + 2);
            j = e + 2;
            continue;
          }
        }
        if (src[j] === ']' && inBr) inBr = false;
        s += src[j++];
      }
      if (j >= src.length) throw new AwkError('non-terminated regular expression');
      toks.push({ t: 'ere', v: s });
      i = j + 1;
      continue;
    }
    const num = /^(?:\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+(?:[eE][-+]?\d+)?)/.exec(src.slice(i));
    if (num) {
      toks.push({ t: 'num', v: num[0], n: parseFloat(num[0]) });
      i += num[0].length;
      continue;
    }
    const w = /^[A-Za-z_]\w*/.exec(src.slice(i));
    if (w) {
      const name = w[0];
      i += name.length;
      if (KEYWORDS.has(name)) toks.push({ t: 'kw', v: name === 'func' ? 'function' : name });
      else if (BUILTINS.has(name)) toks.push({ t: 'builtin', v: name });
      else toks.push({ t: src[i] === '(' ? 'funcname' : 'name', v: name });
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new AwkError(`unexpected character '${c}'`);
    toks.push({ t: 'op', v: op === '**' ? '^' : op === '**=' ? '^=' : op });
    i += op.length;
  }
  toks.push({ t: 'eof', v: '' });
  return toks;
}

// ---------------- AST ----------------
type Node =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'ere'; v: string }
  | { k: 'var'; name: string }
  | { k: 'idx'; name: string; subs: Node[] }
  | { k: 'field'; e: Node }
  | { k: 'assign'; op: string; target: Node; e: Node }
  | { k: 'cond'; c: Node; a: Node; b: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'and' | 'or'; a: Node; b: Node }
  | { k: 'match'; neg: boolean; a: Node; re: Node }
  | { k: 'in'; subs: Node[]; name: string }
  | { k: 'concat'; a: Node; b: Node }
  | { k: 'unary'; op: string; e: Node }
  | { k: 'incdec'; op: string; pre: boolean; target: Node }
  | { k: 'call'; name: string; args: Node[] }
  | { k: 'builtin'; name: string; args: Node[] }
  | { k: 'group'; e: Node };

type Stmt =
  | { k: 'expr'; e: Node }
  | { k: 'print'; args: Node[]; printf: boolean; redir?: { op: string; target: Node } }
  | { k: 'if'; c: Node; a: Stmt; b?: Stmt }
  | { k: 'while'; c: Node; body: Stmt }
  | { k: 'do'; body: Stmt; c: Node }
  | { k: 'for'; init?: Stmt; c?: Node; step?: Stmt; body: Stmt }
  | { k: 'forin'; v: string; arr: string; body: Stmt }
  | { k: 'block'; body: Stmt[] }
  | { k: 'simple'; what: 'next' | 'nextfile' | 'break' | 'continue' }
  | { k: 'exit' | 'return'; e?: Node }
  | { k: 'delete'; name: string; subs?: Node[] }
  | { k: 'getline' };

interface Rule {
  kind: 'BEGIN' | 'END' | 'main';
  pattern?: Node;
  pattern2?: Node;
  action?: Stmt[];
  inRange?: boolean;
}

interface Program {
  rules: Rule[];
  funcs: Record<string, { params: string[]; body: Stmt[] }>;
}

// ---------------- парсер ----------------
class Parser {
  private p = 0;
  /** внутри аргументов print: «>» — перенаправление, а не сравнение */
  private noGt = 0;
  private noIn = 0;
  constructor(private toks: Tok[]) {}

  private get cur() {
    return this.toks[this.p];
  }
  private is(t: TokType, v?: string) {
    const c = this.cur;
    return c.t === t && (v === undefined || c.v === v);
  }
  private isOp(v: string) {
    return this.is('op', v);
  }
  private next() {
    return this.toks[this.p++];
  }
  private expect(t: TokType, v?: string): Tok {
    if (!this.is(t, v)) throw new AwkError(`syntax error at source line: unexpected ${this.cur.t === 'eof' ? 'end of program' : `'${this.cur.v}'`}${v ? `, expected '${v}'` : ''}`);
    return this.next();
  }
  private nl() {
    while (this.is('nl')) this.p++;
  }
  private term() {
    // ; или перевод строки
    while (this.isOp(';') || this.is('nl')) this.p++;
  }

  program(): Program {
    const prog: Program = { rules: [], funcs: {} };
    this.term();
    while (!this.is('eof')) {
      if (this.is('kw', 'function')) {
        this.next();
        const name = this.next().v;
        this.expect('op', '(');
        const params: string[] = [];
        while (!this.isOp(')')) {
          params.push(this.expect('name').v);
          if (this.isOp(',')) {
            this.next();
            this.nl();
          }
        }
        this.next();
        this.nl();
        prog.funcs[name] = { params, body: this.blockBody() };
      } else if (this.is('kw', 'BEGIN') || this.is('kw', 'END')) {
        const kind = this.next().v as 'BEGIN' | 'END';
        this.nl();
        prog.rules.push({ kind, action: this.blockBody() });
      } else {
        let pattern: Node | undefined;
        let pattern2: Node | undefined;
        if (!this.isOp('{')) {
          pattern = this.expr();
          if (this.isOp(',')) {
            this.next();
            this.nl();
            pattern2 = this.expr();
          }
        }
        const action = this.isOp('{') ? this.blockBody() : undefined;
        prog.rules.push({ kind: 'main', pattern, pattern2, action });
      }
      this.term();
    }
    return prog;
  }

  private blockBody(): Stmt[] {
    this.expect('op', '{');
    const body: Stmt[] = [];
    this.term();
    while (!this.isOp('}')) {
      if (this.is('eof')) throw new AwkError('syntax error: unbalanced braces');
      body.push(this.stmt());
      this.term();
    }
    this.next();
    return body;
  }

  private simpleOrBlock(): Stmt {
    this.nl();
    if (this.isOp(';')) {
      this.next();
      return { k: 'block', body: [] };
    }
    return this.stmt();
  }

  private stmt(): Stmt {
    const c = this.cur;
    if (c.t === 'op' && c.v === '{') return { k: 'block', body: this.blockBody() };
    if (c.t === 'kw') {
      switch (c.v) {
        case 'if': {
          this.next();
          this.expect('op', '(');
          const cond = this.expr();
          this.expect('op', ')');
          const a = this.simpleOrBlock();
          // else может стоять после ; или перевода строки
          const save = this.p;
          this.term();
          if (this.is('kw', 'else')) {
            this.next();
            return { k: 'if', c: cond, a, b: this.simpleOrBlock() };
          }
          this.p = save;
          return { k: 'if', c: cond, a };
        }
        case 'while': {
          this.next();
          this.expect('op', '(');
          const cond = this.expr();
          this.expect('op', ')');
          if (this.isOp(';')) {
            this.next();
            return { k: 'while', c: cond, body: { k: 'block', body: [] } };
          }
          return { k: 'while', c: cond, body: this.simpleOrBlock() };
        }
        case 'do': {
          this.next();
          const body = this.simpleOrBlock();
          this.term();
          this.expect('kw', 'while');
          this.expect('op', '(');
          const cond = this.expr();
          this.expect('op', ')');
          return { k: 'do', body, c: cond };
        }
        case 'for': {
          this.next();
          this.expect('op', '(');
          // for (k in arr)
          if (this.is('name') && this.toks[this.p + 1].t === 'kw' && this.toks[this.p + 1].v === 'in' && this.toks[this.p + 2].t === 'name' && this.toks[this.p + 3].v === ')') {
            const v = this.next().v;
            this.next();
            const arr = this.next().v;
            this.next();
            return { k: 'forin', v, arr, body: this.simpleOrBlock() };
          }
          const init = this.isOp(';') ? undefined : this.simpleStmt();
          this.expect('op', ';');
          this.nl();
          const cond = this.isOp(';') ? undefined : this.expr();
          this.expect('op', ';');
          this.nl();
          const step = this.isOp(')') ? undefined : this.simpleStmt();
          this.expect('op', ')');
          return { k: 'for', init, c: cond, step, body: this.simpleOrBlock() };
        }
        case 'next':
        case 'nextfile':
        case 'break':
        case 'continue':
          this.next();
          return { k: 'simple', what: c.v as 'next' };
        case 'exit':
        case 'return': {
          this.next();
          const e = this.endOfSimple() ? undefined : this.expr();
          return { k: c.v as 'exit', e };
        }
        case 'delete': {
          this.next();
          const name = this.expect('name').v;
          if (this.isOp('[')) {
            this.next();
            const subs = this.exprList(']');
            return { k: 'delete', name, subs };
          }
          return { k: 'delete', name };
        }
        case 'getline':
          throw new AwkError('getline в тренажёре не поддерживается');
      }
    }
    return this.simpleStmt();
  }

  private endOfSimple() {
    return this.isOp(';') || this.isOp('}') || this.is('nl') || this.is('eof');
  }

  private simpleStmt(): Stmt {
    if (this.is('kw', 'print') || this.is('kw', 'printf')) {
      const printf = this.next().v === 'printf';
      let args: Node[] = [];
      this.noGt++;
      try {
        if (!this.endOfSimple() && !this.isOp('>') && !this.isOp('>>') && !this.isOp('|')) {
          // print (a, b) > "f" — скобки вокруг списка
          if (this.isOp('(')) {
            const save = this.p;
            this.next();
            this.noGt--;
            let list: Node[] | null = null;
            try {
              list = this.exprList(')');
            } catch {
              list = null;
            }
            this.noGt++;
            if (list && (this.endOfSimple() || this.isOp('>') || this.isOp('>>') || this.isOp('|'))) args = list;
            else {
              this.p = save;
              args = this.printList();
            }
          } else args = this.printList();
        }
      } finally {
        this.noGt--;
      }
      let redir: { op: string; target: Node } | undefined;
      if (this.isOp('>') || this.isOp('>>') || this.isOp('|')) {
        const op = this.next().v;
        redir = { op, target: this.concatExpr() };
      }
      return { k: 'print', args, printf, redir };
    }
    if (this.is('kw', 'delete') || this.is('kw', 'next') || this.is('kw', 'exit')) return this.stmt();
    return { k: 'expr', e: this.expr() };
  }

  private printList(): Node[] {
    const list = [this.expr()];
    while (this.isOp(',')) {
      this.next();
      this.nl();
      list.push(this.expr());
    }
    return list;
  }

  private exprList(close: string): Node[] {
    const list: Node[] = [];
    this.nl();
    if (this.isOp(close)) {
      this.next();
      return list;
    }
    list.push(this.expr());
    while (this.isOp(',')) {
      this.next();
      this.nl();
      list.push(this.expr());
    }
    this.nl();
    this.expect('op', close);
    return list;
  }

  expr(): Node {
    const left = this.ternary();
    const c = this.cur;
    if (c.t === 'op' && ['=', '+=', '-=', '*=', '/=', '%=', '^='].includes(c.v) && (left.k === 'var' || left.k === 'idx' || left.k === 'field')) {
      this.next();
      this.nl();
      return { k: 'assign', op: c.v, target: left, e: this.expr() };
    }
    return left;
  }

  private ternary(): Node {
    const c = this.or();
    if (this.isOp('?')) {
      this.next();
      this.nl();
      const a = this.expr();
      this.nl();
      this.expect('op', ':');
      this.nl();
      const b = this.expr();
      return { k: 'cond', c, a, b };
    }
    return c;
  }

  private or(): Node {
    let a = this.and();
    while (this.isOp('||')) {
      this.next();
      this.nl();
      a = { k: 'or', a, b: this.and() };
    }
    return a;
  }

  private and(): Node {
    let a = this.inExpr();
    while (this.isOp('&&')) {
      this.next();
      this.nl();
      a = { k: 'and', a, b: this.inExpr() };
    }
    return a;
  }

  private inExpr(): Node {
    let a = this.matchExpr();
    while (!this.noIn && this.is('kw', 'in')) {
      this.next();
      const name = this.expect('name').v;
      a = { k: 'in', subs: a.k === 'group' && (a as { e: Node }).e ? [a.e] : [a], name };
    }
    return a;
  }

  private matchExpr(): Node {
    let a = this.compare();
    while (this.isOp('~') || this.isOp('!~')) {
      const neg = this.next().v === '!~';
      a = { k: 'match', neg, a, re: this.compare() };
    }
    return a;
  }

  private compare(): Node {
    const a = this.concatExpr();
    const c = this.cur;
    if (c.t === 'op' && ['<', '<=', '==', '!=', '>=', '>'].includes(c.v) && !(c.v === '>' && this.noGt)) {
      this.next();
      return { k: 'bin', op: c.v, a, b: this.concatExpr() };
    }
    return a;
  }

  private startsConcat(): boolean {
    const c = this.cur;
    if (c.t === 'num' || c.t === 'str' || c.t === 'ere' || c.t === 'name' || c.t === 'funcname' || c.t === 'builtin') return true;
    if (c.t === 'op') return c.v === '$' || c.v === '(' || c.v === '!' || c.v === '-' && false;
    return false;
  }

  private concatExpr(): Node {
    let a = this.additive();
    while (this.startsConcat() && !this.is('kw', 'in')) {
      if (this.isOp('!')) break;
      a = { k: 'concat', a, b: this.additive() };
    }
    return a;
  }

  private additive(): Node {
    let a = this.mul();
    while (this.isOp('+') || this.isOp('-')) {
      const op = this.next().v;
      a = { k: 'bin', op, a, b: this.mul() };
    }
    return a;
  }

  private mul(): Node {
    let a = this.unary();
    while (this.isOp('*') || this.isOp('/') || this.isOp('%')) {
      const op = this.next().v;
      a = { k: 'bin', op, a, b: this.unary() };
    }
    return a;
  }

  private unary(): Node {
    if (this.isOp('!') || this.isOp('-') || this.isOp('+')) {
      const op = this.next().v;
      return { k: 'unary', op, e: this.unary() };
    }
    return this.pow();
  }

  private pow(): Node {
    const a = this.postfix();
    if (this.isOp('^')) {
      this.next();
      return { k: 'bin', op: '^', a, b: this.unary() };
    }
    return a;
  }

  private postfix(): Node {
    if (this.isOp('++') || this.isOp('--')) {
      const op = this.next().v;
      return { k: 'incdec', op, pre: true, target: this.postfix() };
    }
    const e = this.primary();
    if ((this.isOp('++') || this.isOp('--')) && (e.k === 'var' || e.k === 'idx' || e.k === 'field')) {
      const op = this.next().v;
      return { k: 'incdec', op, pre: false, target: e };
    }
    return e;
  }

  private primary(): Node {
    const c = this.cur;
    switch (c.t) {
      case 'num':
        this.next();
        return { k: 'num', v: c.n! };
      case 'str':
        this.next();
        return { k: 'str', v: c.v };
      case 'ere':
        this.next();
        return { k: 'ere', v: c.v };
      case 'funcname': {
        this.next();
        this.expect('op', '(');
        return { k: 'call', name: c.v, args: this.exprList(')') };
      }
      case 'builtin': {
        this.next();
        if (this.isOp('(')) {
          this.next();
          return { k: 'builtin', name: c.v, args: this.exprList(')') };
        }
        if (c.v === 'length') return { k: 'builtin', name: 'length', args: [] };
        throw new AwkError(`syntax error: ${c.v} requires arguments`);
      }
      case 'name': {
        this.next();
        if (this.isOp('[')) {
          this.next();
          return { k: 'idx', name: c.v, subs: this.exprList(']') };
        }
        return { k: 'var', name: c.v };
      }
      case 'op':
        if (c.v === '$') {
          this.next();
          return { k: 'field', e: this.fieldOperand() };
        }
        if (c.v === '(') {
          this.next();
          this.noGt++;
          const saveGt = this.noGt;
          this.noGt = 0;
          const e = this.expr();
          this.noGt = saveGt - 1;
          // (a, b) in arr
          if (this.isOp(',')) {
            const list = [e];
            while (this.isOp(',')) {
              this.next();
              list.push(this.expr());
            }
            this.expect('op', ')');
            this.expect('kw', 'in');
            return { k: 'in', subs: list, name: this.expect('name').v };
          }
          this.expect('op', ')');
          return { k: 'group', e };
        }
        if (c.v === '-' || c.v === '+' || c.v === '!') return this.unary();
        if (c.v === '++' || c.v === '--') return this.postfix();
    }
    throw new AwkError(`syntax error: unexpected ${c.t === 'eof' ? 'end of program' : `'${c.v}'`}`);
  }

  private fieldOperand(): Node {
    // $NF, $1, $(i+1), $i++ (инкремент относится к полю)
    if (this.isOp('++') || this.isOp('--') || this.isOp('-')) {
      return this.unary();
    }
    return this.primary();
  }
}

// ---------------- значения ----------------
type Val = number | string | undefined;
type Arr = Map<string, Val>;

const NUMRE = /^\s*[-+]?(?:\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+(?:[eE][-+]?\d+)?)\s*$/;
const looksNum = (v: Val) => typeof v === 'number' || (typeof v === 'string' && NUMRE.test(v));

function toNum(v: Val): number {
  if (typeof v === 'number') return v;
  if (!v) return 0;
  const m = /^\s*[-+]?(?:\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+(?:[eE][-+]?\d+)?)/.exec(v);
  return m ? parseFloat(m[0]) : 0;
}

function fmtG(n: number, prec = 6): string {
  if (!isFinite(n)) return n > 0 ? 'inf' : n < 0 ? '-inf' : 'nan';
  if (n === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(n)));
  if (exp < -4 || exp >= prec) {
    const [m, e] = n.toExponential(prec - 1).split('e');
    const mm = m.includes('.') ? m.replace(/\.?0+$/, '') : m;
    const ev = parseInt(e, 10);
    return `${mm}e${ev < 0 ? '-' : '+'}${String(Math.abs(ev)).padStart(2, '0')}`;
  }
  const s = n.toFixed(Math.max(0, prec - 1 - exp));
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

function toStr(v: Val, fmt = '%.6g'): string {
  if (v === undefined) return '';
  if (typeof v === 'string') return v;
  if (Number.isInteger(v) && Math.abs(v) < 1e16) return String(v);
  return sprintf(fmt, [v]);
}

function truthy(v: Val): boolean {
  if (v === undefined) return false;
  if (typeof v === 'number') return v !== 0;
  return looksNum(v) ? toNum(v) !== 0 : v !== '';
}

function compare(a: Val, b: Val): number {
  const numeric = (looksNum(a) || a === undefined) && (looksNum(b) || b === undefined);
  if (numeric) {
    const x = toNum(a);
    const y = toNum(b);
    return x < y ? -1 : x > y ? 1 : 0;
  }
  const x = toStr(a);
  const y = toStr(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

function sprintf(fmt: string, args: Val[]): string {
  let k = 0;
  const nextArg = () => args[k++];
  return fmt.replace(/%([-+ 0#]*)(\*|\d+)?(?:\.(\*|\d+))?([cdiouxXeEfFgGs%])/g, (_m, flags: string, width: string | undefined, prec: string | undefined, t: string) => {
    if (t === '%') return '%';
    const w = width === '*' ? toNum(nextArg()) : width ? parseInt(width, 10) : 0;
    const p = prec === '*' ? toNum(nextArg()) : prec !== undefined ? parseInt(prec, 10) : undefined;
    const v = nextArg();
    let s: string;
    switch (t) {
      case 'd':
      case 'i': {
        const n = Math.trunc(toNum(v));
        s = String(Math.abs(n));
        if (p !== undefined) s = s.padStart(p, '0');
        s = (n < 0 ? '-' : flags.includes('+') ? '+' : flags.includes(' ') ? ' ' : '') + s;
        break;
      }
      case 'o':
        s = Math.trunc(toNum(v)).toString(8);
        break;
      case 'u':
        s = String(Math.abs(Math.trunc(toNum(v))));
        break;
      case 'x':
      case 'X':
        s = Math.trunc(toNum(v)).toString(16);
        if (t === 'X') s = s.toUpperCase();
        break;
      case 'e':
      case 'E': {
        const n = toNum(v);
        const [m, e] = n.toExponential(p ?? 6).split('e');
        const ev = parseInt(e, 10);
        s = `${m}e${ev < 0 ? '-' : '+'}${String(Math.abs(ev)).padStart(2, '0')}`;
        if (t === 'E') s = s.toUpperCase();
        if (n >= 0 && flags.includes('+')) s = '+' + s;
        break;
      }
      case 'f':
      case 'F': {
        const n = toNum(v);
        s = n.toFixed(p ?? 6);
        if (n >= 0 && flags.includes('+')) s = '+' + s;
        break;
      }
      case 'g':
      case 'G':
        s = fmtG(toNum(v), p === 0 ? 1 : p ?? 6);
        if (t === 'G') s = s.toUpperCase();
        break;
      case 'c':
        s = typeof v === 'number' ? String.fromCharCode(v) : toStr(v).slice(0, 1);
        break;
      default:
        s = toStr(v);
        if (p !== undefined) s = s.slice(0, p);
    }
    if (s.length < w) {
      if (flags.includes('-')) s = s.padEnd(w);
      else if (flags.includes('0') && /[diouxXeEfFgG]/.test(t)) {
        const sign = /^[-+ ]/.test(s) ? s[0] : '';
        s = sign + s.slice(sign.length).padStart(w - sign.length, '0');
      } else s = s.padStart(w);
    }
    return s;
  });
}

/** ERE awk → RegExp JS */
const reCache = new Map<string, RegExp>();
function toRegExp(src: string, flags = ''): RegExp {
  const key = src + '\u0000' + flags;
  let re = reCache.get(key);
  if (!re) {
    const js = src
      .replace(/\[:alpha:\]/g, 'A-Za-z')
      .replace(/\[:digit:\]/g, '0-9')
      .replace(/\[:alnum:\]/g, 'A-Za-z0-9')
      .replace(/\[:upper:\]/g, 'A-Z')
      .replace(/\[:lower:\]/g, 'a-z')
      .replace(/\[:space:\]/g, ' \\t\\n\\r\\f\\v')
      .replace(/\[:blank:\]/g, ' \\t')
      .replace(/\[:punct:\]/g, '!-\\/:-@\\[-`{-~')
      .replace(/\[:xdigit:\]/g, '0-9A-Fa-f')
      // «[^]]» и «[]a]» — «]» сразу после «[» или «[^» в POSIX — обычный символ
      .replace(/\[(\^?)\]/g, '[$1\\]');
    try {
      re = new RegExp(js, flags);
    } catch {
      throw new AwkError(`invalid regular expression /${src}/`);
    }
    reCache.set(key, re);
  }
  return re;
}

// ---------------- интерпретатор ----------------
class NextSig {}
class NextFileSig {}
class BreakSig {}
class ContinueSig {}
class ExitSig {
  constructor(public code: number) {}
}
class ReturnSig {
  constructor(public v: Val) {}
}

const MAX_STEPS = 2_000_000;

class Interp {
  globals = new Map<string, Val | Arr>();
  frames: Map<string, Val | Arr>[] = [];
  out = '';
  record = '';
  fields: string[] | null = null;
  nf = 0;
  steps = 0;
  files = new Map<string, string>();
  constructor(
    private prog: Program,
    private ctx: CommandContext,
  ) {
    this.set('FS', ' ');
    this.set('OFS', ' ');
    this.set('ORS', '\n');
    this.set('SUBSEP', '\x1c');
    this.set('NR', 0);
    this.set('FNR', 0);
    this.set('RSTART', 0);
    this.set('RLENGTH', -1);
    this.set('FILENAME', '');
    this.set('CONVFMT', '%.6g');
    this.set('OFMT', '%.6g');
    const env = new Map<string, Val>();
    for (const [k, v] of Object.entries(ctx.env)) env.set(k, v);
    this.globals.set('ENVIRON', env);
  }

  private scope(name: string): Map<string, Val | Arr> {
    const f = this.frames[this.frames.length - 1];
    return f && f.has(name) ? f : this.globals;
  }
  get(name: string): Val {
    if (name === 'NF') return this.getNF();
    const v = this.scope(name).get(name);
    if (v instanceof Map) throw new AwkError(`can't use array ${name} in scalar context`);
    return v;
  }
  set(name: string, v: Val) {
    if (name === 'NF') return this.setNF(toNum(v));
    const s = this.scope(name);
    if (s.get(name) instanceof Map) throw new AwkError(`can't assign to ${name}; it's an array name.`);
    s.set(name, v);
  }
  arr(name: string): Arr {
    const s = this.scope(name);
    let a = s.get(name);
    if (a === undefined) {
      a = new Map();
      s.set(name, a);
    }
    if (!(a instanceof Map)) throw new AwkError(`can't use scalar ${name} as array`);
    return a;
  }

  // поля
  setRecord(r: string) {
    this.record = r;
    this.fields = null;
  }
  private split(): string[] {
    if (this.fields) return this.fields;
    this.fields = this.splitStr(this.record, toStr(this.get('FS')));
    this.nf = this.fields.length;
    return this.fields;
  }
  splitStr(s: string, fs: string): string[] {
    if (fs === ' ') return s.split(/[ \t\n]+/).filter(Boolean);
    if (s === '') return [];
    if (fs.length === 1 && fs !== '\\') return s.split(fs === '\t' ? '\t' : fs);
    return s.split(toRegExp(fs));
  }
  getNF() {
    this.split();
    return this.nf;
  }
  setNF(n: number) {
    const f = this.split();
    f.length = Math.max(0, Math.trunc(n));
    for (let i = 0; i < f.length; i++) if (f[i] === undefined) f[i] = '';
    this.nf = f.length;
    this.rebuild();
  }
  private rebuild() {
    this.record = this.split().join(toStr(this.get('OFS')));
  }
  getField(i: number): Val {
    if (i < 0) throw new AwkError(`trying to access out of range field ${i}`);
    if (i === 0) return this.record;
    return this.split()[i - 1] ?? '';
  }
  setField(i: number, v: Val) {
    if (i === 0) return this.setRecord(toStr(v));
    const f = this.split();
    while (f.length < i) f.push('');
    f[i - 1] = toStr(v);
    this.nf = f.length;
    this.rebuild();
  }

  // присваивание по ссылке
  private assignTo(t: Node, v: Val): Val {
    if (t.k === 'var') this.set(t.name, v);
    else if (t.k === 'idx') this.arr(t.name).set(this.subscript(t.subs), v);
    else if (t.k === 'field') this.setField(Math.trunc(toNum(this.eval(t.e))), v);
    else if (t.k === 'group') return this.assignTo(t.e, v);
    else throw new AwkError('assignment to non-lvalue');
    return v;
  }
  private subscript(subs: Node[]): string {
    return subs.map((s) => toStr(this.eval(s), toStr(this.get('CONVFMT')))).join(toStr(this.get('SUBSEP')));
  }
  private regexOf(n: Node): RegExp {
    if (n.k === 'ere') return toRegExp(n.v);
    return toRegExp(toStr(this.eval(n)));
  }

  eval(n: Node): Val {
    switch (n.k) {
      case 'num':
        return n.v;
      case 'str':
        return n.v;
      case 'ere':
        return toRegExp(n.v).test(this.record) ? 1 : 0;
      case 'group':
        return this.eval(n.e);
      case 'var':
        return this.get(n.name);
      case 'idx': {
        const a = this.arr(n.name);
        const k = this.subscript(n.subs);
        if (!a.has(k)) a.set(k, undefined);
        return a.get(k);
      }
      case 'field':
        return this.getField(Math.trunc(toNum(this.eval(n.e))));
      case 'assign': {
        if (n.op === '=') return this.assignTo(n.target, this.eval(n.e));
        const cur = toNum(this.eval(n.target));
        const r = toNum(this.eval(n.e));
        return this.assignTo(n.target, this.arith(n.op.slice(0, -1), cur, r));
      }
      case 'cond':
        return truthy(this.eval(n.c)) ? this.eval(n.a) : this.eval(n.b);
      case 'and':
        return truthy(this.eval(n.a)) && truthy(this.eval(n.b)) ? 1 : 0;
      case 'or':
        return truthy(this.eval(n.a)) || truthy(this.eval(n.b)) ? 1 : 0;
      case 'match': {
        const ok = this.regexOf(n.re).test(toStr(this.eval(n.a)));
        return ok !== n.neg ? 1 : 0;
      }
      case 'in':
        return this.arr(n.name).has(this.subscript(n.subs)) ? 1 : 0;
      case 'concat':
        return toStr(this.eval(n.a), toStr(this.get('CONVFMT'))) + toStr(this.eval(n.b), toStr(this.get('CONVFMT')));
      case 'unary': {
        const v = this.eval(n.e);
        if (n.op === '!') return truthy(v) ? 0 : 1;
        return n.op === '-' ? -toNum(v) : toNum(v);
      }
      case 'incdec': {
        const old = toNum(this.eval(n.target));
        const nv = n.op === '++' ? old + 1 : old - 1;
        this.assignTo(n.target, nv);
        return n.pre ? nv : old;
      }
      case 'bin': {
        if (['<', '<=', '==', '!=', '>=', '>'].includes(n.op)) {
          const c = compare(this.eval(n.a), this.eval(n.b));
          return ({ '<': c < 0, '<=': c <= 0, '==': c === 0, '!=': c !== 0, '>=': c >= 0, '>': c > 0 } as Record<string, boolean>)[n.op] ? 1 : 0;
        }
        return this.arith(n.op, toNum(this.eval(n.a)), toNum(this.eval(n.b)));
      }
      case 'call':
        return this.callUser(n.name, n.args);
      case 'builtin':
        return this.builtin(n.name, n.args);
    }
  }

  private arith(op: string, a: number, b: number): number {
    switch (op) {
      case '+':
        return a + b;
      case '-':
        return a - b;
      case '*':
        return a * b;
      case '/':
        if (b === 0) throw new AwkError('division by zero');
        return a / b;
      case '%':
        if (b === 0) throw new AwkError('division by zero in %');
        return a % b;
      case '^':
        return Math.pow(a, b);
    }
    throw new AwkError(`unknown operator ${op}`);
  }

  private builtin(name: string, args: Node[]): Val {
    const s = (i: number) => toStr(this.eval(args[i]));
    const num = (i: number) => toNum(this.eval(args[i]));
    switch (name) {
      case 'length': {
        if (!args.length) return this.record.length;
        const a = args[0];
        if (a.k === 'var') {
          const v = this.scope(a.name).get(a.name);
          if (v instanceof Map) return v.size;
        }
        return s(0).length;
      }
      case 'substr': {
        const str = s(0);
        let m = Math.round(num(1));
        let len = args.length > 2 ? Math.round(num(2)) : Infinity;
        if (m < 1) {
          len += m - 1;
          m = 1;
        }
        if (len <= 0) return '';
        return str.substr(m - 1, len === Infinity ? undefined : len);
      }
      case 'index':
        return s(0).indexOf(s(1)) + 1;
      case 'split': {
        if (args[1].k !== 'var') throw new AwkError('split: second argument must be an array name');
        const a = this.arr(args[1].name);
        a.clear();
        const str = s(0);
        const parts = args.length > 2 ? (args[2].k === 'ere' ? (str === '' ? [] : str.split(toRegExp(args[2].v))) : this.splitStr(str, s(2))) : this.splitStr(str, toStr(this.get('FS')));
        parts.forEach((p, i) => a.set(String(i + 1), p));
        return parts.length;
      }
      case 'sub':
      case 'gsub': {
        const re = this.regexOf(args[0]);
        const target: Node = args[2] ?? { k: 'field', e: { k: 'num', v: 0 } };
        const repl = s(1);
        const src = toStr(this.eval(target));
        let count = 0;
        const g = new RegExp(re.source, name === 'gsub' ? 'g' : '');
        const res = src.replace(g, (m) => {
          count++;
          return repl.replace(/\\\\&|\\&|&/g, (x) => (x === '&' ? m : x === '\\&' ? '&' : '\\&'));
        });
        if (count) this.assignTo(target, res);
        return count;
      }
      case 'match': {
        const m = this.regexOf(args[1]).exec(s(0));
        this.set('RSTART', m ? m.index + 1 : 0);
        this.set('RLENGTH', m ? m[0].length : -1);
        return m ? m.index + 1 : 0;
      }
      case 'sprintf':
        return sprintf(s(0), args.slice(1).map((a) => this.eval(a)));
      case 'tolower':
        return s(0).toLowerCase();
      case 'toupper':
        return s(0).toUpperCase();
      case 'int':
        return Math.trunc(num(0));
      case 'sqrt':
        return Math.sqrt(num(0));
      case 'exp':
        return Math.exp(num(0));
      case 'log':
        return Math.log(num(0));
      case 'sin':
        return Math.sin(num(0));
      case 'cos':
        return Math.cos(num(0));
      case 'atan2':
        return Math.atan2(num(0), num(1));
      case 'rand':
        return Math.random();
      case 'srand':
        return 0;
      case 'systime':
        return Math.floor(this.ctx.state.now.getTime() / 1000);
      case 'strftime':
        return this.ctx.state.now.toISOString().replace('T', ' ').slice(0, 19);
      case 'close':
      case 'fflush':
        return 0;
      case 'system':
        throw new AwkError('system() в тренажёре не поддерживается');
    }
    throw new AwkError(`unknown function ${name}`);
  }

  private callUser(name: string, args: Node[]): Val {
    const f = this.prog.funcs[name];
    if (!f) throw new AwkError(`calling undefined function ${name}`);
    if (this.frames.length > 200) throw new AwkError('function call nesting too deep');
    const frame = new Map<string, Val | Arr>();
    f.params.forEach((p, i) => {
      const a = args[i];
      if (!a) {
        frame.set(p, undefined);
        return;
      }
      // массивы передаются по ссылке
      if (a.k === 'var') {
        const v = this.scope(a.name).get(a.name);
        if (v instanceof Map) {
          frame.set(p, v);
          return;
        }
      }
      frame.set(p, this.eval(a));
    });
    this.frames.push(frame);
    try {
      this.execList(f.body);
      return undefined;
    } catch (e) {
      if (e instanceof ReturnSig) return e.v;
      throw e;
    } finally {
      this.frames.pop();
    }
  }

  private tick() {
    if (++this.steps > MAX_STEPS) throw new AwkError('программа выполняется слишком долго (бесконечный цикл?)');
  }

  execList(list: Stmt[]) {
    for (const s of list) this.exec(s);
  }

  exec(s: Stmt) {
    this.tick();
    switch (s.k) {
      case 'expr':
        this.eval(s.e);
        return;
      case 'block':
        this.execList(s.body);
        return;
      case 'print': {
        let text: string;
        if (s.printf) {
          if (!s.args.length) throw new AwkError('printf: no format');
          text = sprintf(toStr(this.eval(s.args[0])), s.args.slice(1).map((a) => this.eval(a)));
        } else {
          const ofmt = toStr(this.get('OFMT'));
          text = (s.args.length ? s.args.map((a) => toStr(this.eval(a), ofmt)).join(toStr(this.get('OFS'))) : this.record) + toStr(this.get('ORS'));
        }
        if (s.redir) this.redirect(s.redir.op, toStr(this.eval(s.redir.target)), text);
        else this.out += text;
        return;
      }
      case 'if':
        if (truthy(this.eval(s.c))) this.exec(s.a);
        else if (s.b) this.exec(s.b);
        return;
      case 'while':
        while (truthy(this.eval(s.c))) {
          this.tick();
          try {
            this.exec(s.body);
          } catch (e) {
            if (e instanceof BreakSig) break;
            if (!(e instanceof ContinueSig)) throw e;
          }
        }
        return;
      case 'do':
        do {
          this.tick();
          try {
            this.exec(s.body);
          } catch (e) {
            if (e instanceof BreakSig) break;
            if (!(e instanceof ContinueSig)) throw e;
          }
        } while (truthy(this.eval(s.c)));
        return;
      case 'for':
        if (s.init) this.exec(s.init);
        while (!s.c || truthy(this.eval(s.c))) {
          this.tick();
          try {
            this.exec(s.body);
          } catch (e) {
            if (e instanceof BreakSig) break;
            if (!(e instanceof ContinueSig)) throw e;
          }
          if (s.step) this.exec(s.step);
        }
        return;
      case 'forin': {
        const keys = [...this.arr(s.arr).keys()];
        // порядок ключей в awk не определён; для предсказуемости — числа по возрастанию, иначе по добавлению
        if (keys.every((k) => NUMRE.test(k))) keys.sort((a, b) => Number(a) - Number(b));
        for (const k of keys) {
          this.tick();
          this.set(s.v, k);
          try {
            this.exec(s.body);
          } catch (e) {
            if (e instanceof BreakSig) break;
            if (!(e instanceof ContinueSig)) throw e;
          }
        }
        return;
      }
      case 'simple':
        if (s.what === 'next') throw new NextSig();
        if (s.what === 'nextfile') throw new NextFileSig();
        if (s.what === 'break') throw new BreakSig();
        throw new ContinueSig();
      case 'exit':
        throw new ExitSig(s.e ? Math.trunc(toNum(this.eval(s.e))) : -1);
      case 'return':
        throw new ReturnSig(s.e ? this.eval(s.e) : undefined);
      case 'delete':
        if (s.subs) this.arr(s.name).delete(this.subscript(s.subs));
        else this.arr(s.name).clear();
        return;
      case 'getline':
        throw new AwkError('getline в тренажёре не поддерживается');
    }
  }

  private redirect(op: string, target: string, text: string) {
    if (op === '|') throw new AwkError(`print | "${target}" в тренажёре не поддерживается — используй пайп снаружи awk`);
    if (target === '/dev/stdout' || target === '-') {
      this.out += text;
      return;
    }
    if (target === '/dev/stderr') {
      this.err += text;
      return;
    }
    const path = abs(this.ctx, target);
    const prev = this.files.get(path);
    const data = prev !== undefined ? prev + text : op === '>>' ? text : text;
    try {
      this.ctx.fs.write(path, data, this.ctx.user, prev === undefined && op === '>>');
    } catch (e) {
      if (e instanceof FsErr) throw new AwkError(`can't redirect to ${target} (${errText[e.code]})`);
      throw e;
    }
    this.files.set(path, prev !== undefined ? data : op === '>>' ? (this.ctx.fs.lookup(path) as { content?: string })?.content ?? data : data);
  }
  err = '';
}

function parseProgram(src: string): Program {
  return new Parser(lex(src)).program();
}

const cmd: CommandDef = {
  name: 'awk',
  summary: "обработка полей: awk '{print $1}', awk -F: '{print $1}', awk '$9==500 {print $7}', awk '{s+=$10} END {print s}'",
  usage: "awk [-F разделитель] [-v var=val] 'программа' [файл...]",
  man: 'Каждая строка делится на поля $1…$NF (по пробелам или -F). Программа — набор «шаблон { действие }».\nПримеры:\n  awk \'{print $1}\' access.log\n  awk \'$9 >= 500 {print $7}\' access.log\n  awk \'{c[$9]++} END {for (s in c) print s, c[s]}\' access.log\n  awk -F\'"\' \'{print $2}\' access.log\n  awk \'{s+=$10} END {printf "%.1f MB\\n", s/1024/1024}\' access.log',
  run(args, stdin, ctx) {
    let fs: string | undefined;
    const assigns: [string, string][] = [];
    let progSrc: string | undefined;
    let i = 0;
    for (; i < args.length; i++) {
      const a = args[i];
      if (a === '--') {
        i++;
        break;
      }
      if (a === '-F') fs = args[++i];
      else if (a.startsWith('-F')) fs = a.slice(2);
      else if (a === '-v') {
        const kv = args[++i] ?? '';
        assigns.push([kv.slice(0, kv.indexOf('=')), kv.slice(kv.indexOf('=') + 1)]);
      } else if (a.startsWith('-v') && a.includes('=')) assigns.push([a.slice(2, a.indexOf('=')), a.slice(a.indexOf('=') + 1)]);
      else if (a === '-f') {
        const f = args[++i];
        try {
          progSrc = ctx.fs.read(abs(ctx, f ?? ''), ctx.user);
        } catch (e) {
          if (e instanceof FsErr) return fail(`awk: can't open file ${f}: ${errText[e.code]}`, 2);
          throw e;
        }
      } else if (a.startsWith('-') && a.length > 1) return fail(`awk: not an option: ${a}`, 2);
      else break;
    }
    if (progSrc === undefined) progSrc = args[i++];
    if (progSrc === undefined) return fail('usage: awk [-F fs][-v var=value] [prog | -f progfile][file ...]', 2);
    const operands = args.slice(i);

    let prog: Program;
    try {
      prog = parseProgram(progSrc);
    } catch (e) {
      return fail(`awk: ${(e as Error).message}\n awk: source line 1 context is >>> ${progSrc.split('\n')[0].slice(0, 60)} <<<`, 2);
    }
    const it = new Interp(prog, ctx);
    if (fs !== undefined) it.set('FS', fs === 't' ? '\t' : unescape(fs));
    for (const [k, v] of assigns) it.set(k, unescape(v));

    let exitCode = 0;
    let stderr = '';
    const begins = prog.rules.filter((r) => r.kind === 'BEGIN');
    const mains = prog.rules.filter((r) => r.kind === 'main');
    const ends = prog.rules.filter((r) => r.kind === 'END');
    const runEnd = () => {
      try {
        for (const r of ends) it.execList(r.action ?? []);
      } catch (e) {
        if (e instanceof ExitSig) {
          if (e.code >= 0) exitCode = e.code;
        } else throw e;
      }
    };
    try {
      let exited = false;
      try {
        for (const r of begins) it.execList(r.action ?? []);
      } catch (e) {
        if (!(e instanceof ExitSig)) throw e;
        if (e.code >= 0) exitCode = e.code;
        exited = true;
      }
      // только BEGIN — входные данные не читаются
      if (!exited && (mains.length || ends.length)) {
        const sources: { name: string; content: string }[] = [];
        const files = operands.filter((o) => !/^[A-Za-z_]\w*=/.test(o));
        if (!files.length) sources.push({ name: '', content: stdin });
        else {
          for (const o of operands) {
            if (/^[A-Za-z_]\w*=/.test(o)) {
              sources.push({ name: '\u0000' + o, content: '' });
              continue;
            }
            const r = readInputs('awk', [o], stdin, ctx);
            if (r.failed) {
              stderr += r.stderr.replace(/^awk: (.*?): /, "awk: can't open file $1\n source line number 1: ");
              exitCode = 2;
              continue;
            }
            sources.push({ name: o === '-' ? '' : o, content: r.inputs[0].content });
          }
        }
        outer: for (const src of sources) {
          if (src.name.startsWith('\u0000')) {
            const kv = src.name.slice(1);
            it.set(kv.slice(0, kv.indexOf('=')), unescape(kv.slice(kv.indexOf('=') + 1)));
            continue;
          }
          it.set('FILENAME', src.name);
          it.set('FNR', 0);
          for (const l of lines(src.content)) {
            it.setRecord(l);
            it.set('NR', toNum(it.get('NR')) + 1);
            it.set('FNR', toNum(it.get('FNR')) + 1);
            try {
              for (const r of mains) {
                let match: boolean;
                if (r.pattern2) {
                  if (!r.inRange) {
                    match = truthy(it.eval(r.pattern!));
                    if (match) r.inRange = !truthy(it.eval(r.pattern2));
                  } else {
                    match = true;
                    if (truthy(it.eval(r.pattern2))) r.inRange = false;
                  }
                } else match = !r.pattern || truthy(it.eval(r.pattern));
                if (match) {
                  if (r.action) it.execList(r.action);
                  else it.out += it.record + toStr(it.get('ORS'));
                }
              }
            } catch (e) {
              if (e instanceof NextSig) continue;
              if (e instanceof NextFileSig) continue outer;
              if (e instanceof ExitSig) {
                if (e.code >= 0) exitCode = e.code;
                break outer;
              }
              throw e;
            }
          }
        }
        runEnd();
      }
    } catch (e) {
      if (e instanceof BreakSig || e instanceof ContinueSig) return { stdout: it.out, stderr: 'awk: break/continue outside a loop\n', exitCode: 2 };
      if (e instanceof ReturnSig) return { stdout: it.out, stderr: 'awk: return outside a function\n', exitCode: 2 };
      return { stdout: it.out, stderr: stderr + `awk: ${(e as Error).message}\n`, exitCode: 2 };
    }
    return { stdout: it.out, stderr: stderr + it.err, exitCode };
  },
};
export default cmd;
