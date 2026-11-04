import { fail, type CommandDef } from '../types';
import { parseArgs, invalidOption, lines, joinLines } from '../args';
import { abs, readInputs } from '../cmdutil';

function normalize(args: string[]) {
  // head -5 → head -n 5; --lines=5 → -n 5; --bytes → -c
  return args
    .map((x) => {
      if (/^-\d+$/.test(x)) return ['-n', x.slice(1)];
      const m = /^--(lines|bytes)(?:=(.*))?$/.exec(x);
      if (m) return m[2] !== undefined ? [m[1] === 'lines' ? '-n' : '-c', m[2]] : [m[1] === 'lines' ? '-n' : '-c'];
      if (x === '--follow' || x === '--follow=name') return ['-f'];
      if (x === '--quiet' || x === '--silent') return ['-q'];
      return [x];
    })
    .flat();
}

const head: CommandDef = {
  name: 'head',
  summary: 'первые строки файла (по умолчанию 10). -n N — сколько строк',
  usage: 'head [-n N] [файл...]',
  run(args, stdin, ctx) {
    const a = parseArgs(normalize(args), ['n', 'c'], ['n', 'c', 'q']);
    if (a.unknown.length) return fail(invalidOption('head', a.unknown[0]));
    const n = parseInt(a.values.n ?? '10', 10);
    if (Number.isNaN(n)) return fail(`head: invalid number of lines: '${a.values.n}'`);
    const r = readInputs('head', a.positional, stdin, ctx);
    let out = '';
    r.inputs.forEach((inp, i) => {
      if (r.inputs.length > 1) out += `${i ? '\n' : ''}==> ${inp.name} <==\n`;
      const l = lines(inp.content);
      out += joinLines(n >= 0 ? l.slice(0, n) : l.slice(0, n));
    });
    return { stdout: out, stderr: r.stderr, exitCode: r.failed ? 1 : 0 };
  },
};

const tail: CommandDef = {
  name: 'tail',
  summary: 'последние строки файла (по умолчанию 10). -n N, -f — следить за новыми строками (в эмуляторе — симуляция потока)',
  usage: 'tail [-n N] [-f] [файл...]',
  run(args, stdin, ctx) {
    const a = parseArgs(normalize(args), ['n', 'c'], ['n', 'c', 'f', 'F', 'q']);
    if (a.unknown.length) return fail(invalidOption('tail', a.unknown[0]));
    const raw = a.values.n ?? '10';
    const fromStart = raw.startsWith('+');
    // tail -n -5 = tail -n 5
    const n = Math.abs(parseInt(raw.replace('+', ''), 10));
    if (Number.isNaN(n)) return fail(`tail: invalid number of lines: '${raw}'`);
    const r = readInputs('tail', a.positional, stdin, ctx);
    let out = '';
    r.inputs.forEach((inp, i) => {
      if (r.inputs.length > 1) out += `${i ? '\n' : ''}==> ${inp.name} <==\n`;
      const l = lines(inp.content);
      out += joinLines(fromStart ? l.slice(n - 1) : n === 0 ? [] : l.slice(-n));
    });
    if (a.flags.has('f') || a.flags.has('F')) {
      for (const f of a.positional) {
        const stream = ctx.state.streams[abs(ctx, f)] ?? [];
        out += joinLines(stream);
        // строки «прилетели» — дописываем в файл, чтобы последующие команды их видели
        if (stream.length) {
          try {
            ctx.fs.write(abs(ctx, f), joinLines(stream), 'root', true);
          } catch {
            /* ignore */
          }
          ctx.state.streams[abs(ctx, f)] = [];
        }
      }
      out += '\x1b[2m[tail -f: симуляция потока завершена — в реальности команда ждёт новых строк, выход по Ctrl+C]\x1b[0m\n^C\n';
      return { stdout: out, stderr: r.stderr, exitCode: 130 };
    }
    return { stdout: out, stderr: r.stderr, exitCode: r.failed ? 1 : 0 };
  },
};
export default [head, tail];
