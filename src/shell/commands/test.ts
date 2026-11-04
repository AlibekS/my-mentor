import type { CommandDef, CommandContext, CommandResult } from '../types';
import { abs } from '../cmdutil';

/** test / [ ] / [[ ]] — проверки файлов, строк и чисел */
function evalTest(a: string[], ctx: CommandContext): boolean | string {
  if (!a.length) return false;
  // || и && для [[ ]] и -o / -a
  for (const op of ['-o', '||']) {
    const i = a.lastIndexOf(op);
    if (i > 0) {
      const l = evalTest(a.slice(0, i), ctx);
      const r = evalTest(a.slice(i + 1), ctx);
      if (typeof l === 'string') return l;
      if (typeof r === 'string') return r;
      return l || r;
    }
  }
  for (const op of ['-a', '&&']) {
    const i = a.lastIndexOf(op);
    if (i > 0 && !(a.length === 2 && op === '-a')) {
      const l = evalTest(a.slice(0, i), ctx);
      const r = evalTest(a.slice(i + 1), ctx);
      if (typeof l === 'string') return l;
      if (typeof r === 'string') return r;
      return l && r;
    }
  }
  if (a[0] === '!') {
    const r = evalTest(a.slice(1), ctx);
    return typeof r === 'string' ? r : !r;
  }
  if (a.length === 1) return a[0] !== '';
  if (a.length === 2) {
    const [op, x] = a;
    const n = ctx.fs.lookup(abs(ctx, x));
    switch (op) {
      case '-z':
        return x === '';
      case '-n':
        return x !== '';
      case '-e':
        return !!n;
      case '-f':
        return !!n && n.type === 'file';
      case '-d':
        return !!n && n.type === 'dir';
      case '-s':
        return !!n && n.type === 'file' && ctx.fs.size(n) > 0;
      case '-r':
        return !!n && ctx.fs.can(n, ctx.user, 4);
      case '-w':
        return !!n && ctx.fs.can(n, ctx.user, 2);
      case '-x':
        return !!n && ctx.fs.can(n, ctx.user, 1);
    }
    return `test: ${op}: unary operator expected`;
  }
  if (a.length === 3) {
    const [x, op, y] = a;
    const num = (v: string) => {
      if (!/^-?\d+$/.test(v.trim())) throw new Error(`${v}: integer expression expected`);
      return parseInt(v, 10);
    };
    try {
      switch (op) {
        case '=':
        case '==':
          return y.includes('*') ? new RegExp('^' + y.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$').test(x) : x === y;
        case '!=':
          return x !== y;
        case '-eq':
          return num(x) === num(y);
        case '-ne':
          return num(x) !== num(y);
        case '-lt':
          return num(x) < num(y);
        case '-le':
          return num(x) <= num(y);
        case '-gt':
          return num(x) > num(y);
        case '-ge':
          return num(x) >= num(y);
        case '=~':
          return new RegExp(y).test(x);
        case '<':
          return x < y;
        case '>':
          return x > y;
      }
    } catch (e) {
      return `test: ${(e as Error).message}`;
    }
    return `test: ${op}: binary operator expected`;
  }
  return 'test: too many arguments';
}

const run = (name: string) => (args: string[], _s: string, ctx: CommandContext): CommandResult => {
  let a = args;
  if (name === '[' || name === '[[') {
    const close = name === '[' ? ']' : ']]';
    if (a[a.length - 1] !== close) return { stdout: '', stderr: `bash: ${name}: missing \`${close}'\n`, exitCode: 2 };
    a = a.slice(0, -1);
  }
  const r = evalTest(a, ctx);
  if (typeof r === 'string') return { stdout: '', stderr: `bash: ${r}\n`, exitCode: 2 };
  return { stdout: '', stderr: '', exitCode: r ? 0 : 1 };
};

const summary = 'проверки: [ -f файл ], [ -d каталог ], [ -z "$s" ], [ "$a" = "$b" ], [ $n -gt 5 ] (-eq -ne -lt -le -gt -ge), ! — отрицание';
export default [
  { name: 'test', summary, usage: 'test ВЫРАЖЕНИЕ', run: run('test') },
  { name: '[', summary, usage: '[ ВЫРАЖЕНИЕ ]', run: run('[') },
  { name: '[[', summary: 'расширенная проверка bash: [[ $s == *.log ]], [[ $a -gt 1 && $b -lt 5 ]]', usage: '[[ ВЫРАЖЕНИЕ ]]', run: run('[[') },
] satisfies CommandDef[];
