import { fail, type CommandDef } from '../types';
import { parseArgs, lines, joinLines } from '../args';
import { abs, readInputs } from '../cmdutil';

const cmd: CommandDef = {
  name: 'sed',
  summary: "потоковый редактор: sed 's/old/new/g' файл, sed -n '5,10p', sed '/regex/d', -i — правка файла на месте, -E расширенные regex",
  usage: "sed [-n] [-i] [-E] 'скрипт' [файл...]",
  run(args, stdin, ctx) {
    const a = parseArgs(args, ['e'], ['n', 'i', 'E', 'r', 'e']);
    const script = a.values.e ?? a.positional.shift();
    if (!script) return fail('Usage: sed [OPTION]... {script-only-if-no-other-script} [input-file]...');
    const files = a.positional;
    const r = readInputs('sed', files, stdin, ctx);
    const cmds = script.split(/;\s*(?=[\d/$sdp])/).map((s) => s.trim());
    const ext = a.flags.has('E') || a.flags.has('r');
    const toRe = (p: string, flags = '') => new RegExp(ext ? p : p.replace(/\\\(/g, '(').replace(/\\\)/g, ')').replace(/\\\|/g, '|').replace(/\\\+/g, '+'), flags);
    type Op = { addr: ((l: string, n: number, last: boolean) => boolean) | null; op: string; arg?: { re: RegExp; repl: string; global: boolean; print: boolean } };
    const ops: Op[] = [];
    for (const c of cmds) {
      let rest = c;
      let addr: Op['addr'] = null;
      let m;
      if ((m = /^(\d+),(\d+|\$)/.exec(rest))) {
        const from = parseInt(m[1], 10);
        const to = m[2] === '$' ? Infinity : parseInt(m[2], 10);
        addr = (_l, n) => n >= from && n <= to;
        rest = rest.slice(m[0].length);
      } else if ((m = /^(\d+)/.exec(rest))) {
        const n0 = parseInt(m[1], 10);
        addr = (_l, n) => n === n0;
        rest = rest.slice(m[0].length);
      } else if (rest.startsWith('$')) {
        addr = (_l, _n, last) => last;
        rest = rest.slice(1);
      } else if ((m = /^\/((?:[^/\\]|\\.)*)\//.exec(rest))) {
        const re = toRe(m[1]);
        addr = (l) => re.test(l);
        rest = rest.slice(m[0].length);
      }
      rest = rest.trim();
      if (rest.startsWith('s')) {
        const d = rest[1];
        const parts: string[] = [];
        let cur = '';
        for (let i = 2; i < rest.length; i++) {
          if (rest[i] === '\\' && rest[i + 1] === d) {
            cur += d;
            i++;
          } else if (rest[i] === d) {
            parts.push(cur);
            cur = '';
          } else cur += rest[i];
        }
        parts.push(cur);
        if (parts.length < 3) return fail(`sed: -e expression #1, char ${rest.length}: unterminated \`s' command`);
        const flags = parts[2];
        ops.push({
          addr,
          op: 's',
          arg: {
            re: toRe(parts[0], (flags.includes('g') ? 'g' : '') + (flags.includes('i') || flags.includes('I') ? 'i' : '')),
            repl: parts[1].replace(/\\(\d)/g, '$$$1').replace(/&/g, '$$&'),
            global: flags.includes('g'),
            print: flags.includes('p'),
          },
        });
      } else if (rest === 'd' || rest === 'p' || rest === 'q') ops.push({ addr, op: rest });
      else return fail(`sed: -e expression #1, char 1: unknown command: \`${rest[0] ?? ''}'`);
    }
    const process = (content: string) => {
      const l = lines(content);
      const out: string[] = [];
      for (let i = 0; i < l.length; i++) {
        let line = l[i];
        let deleted = false;
        let quit = false;
        for (const o of ops) {
          if (o.addr && !o.addr(line, i + 1, i === l.length - 1)) continue;
          if (o.op === 'd') {
            deleted = true;
            break;
          }
          if (o.op === 'p') out.push(line);
          if (o.op === 'q') quit = true;
          if (o.op === 's' && o.arg) {
            const before = line;
            line = line.replace(o.arg.re, o.arg.repl);
            if (o.arg.print && before !== line) out.push(line);
          }
        }
        if (!deleted && !a.flags.has('n')) out.push(line);
        if (quit) break;
      }
      return joinLines(out);
    };
    if (a.flags.has('i')) {
      for (const f of files) {
        const content = ctx.fs.read(abs(ctx, f), ctx.user);
        ctx.fs.write(abs(ctx, f), process(content), ctx.user);
      }
      return { stdout: '', stderr: r.stderr, exitCode: r.failed ? 1 : 0 };
    }
    return { stdout: r.inputs.map((i) => process(i.content)).join(''), stderr: r.stderr, exitCode: r.failed ? 1 : 0 };
  },
};
export default cmd;
