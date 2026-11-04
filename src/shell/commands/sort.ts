import { fail, type CommandDef } from '../types';
import { parseArgs, invalidOption, lines, joinLines } from '../args';
import { readInputs } from '../cmdutil';
const cmd: CommandDef = {
  name: 'sort',
  summary: 'сортировка строк. -n числовая, -r обратная, -u уникальные, -k N по полю N, -t разделитель, -h «человеческие» размеры',
  usage: 'sort [-nruh] [-k N] [-t символ] [файл...]',
  run(args, stdin, ctx) {
    const a = parseArgs(args, ['k', 't'], ['n', 'r', 'u', 'k', 't', 'h', 'f', 'V']);
    if (a.unknown.length) return fail(invalidOption('sort', a.unknown[0]), 2);
    const r = readInputs('sort', a.positional, stdin, ctx);
    let l = lines(r.inputs.map((i) => i.content).join(''));
    const kspec = a.values.k;
    const kFlags = kspec ? kspec.replace(/^[\d,.]+/, '') : '';
    const numeric = a.flags.has('n') || kFlags.includes('n');
    const human = a.flags.has('h') || kFlags.includes('h');
    const rev = a.flags.has('r') || kFlags.includes('r');
    const field = kspec ? parseInt(kspec, 10) : 0;
    const key = (s: string) => {
      if (!field) return s;
      const parts = a.values.t !== undefined ? s.split(a.values.t) : s.trim().split(/\s+/);
      return parts[field - 1] ?? '';
    };
    const hv = (s: string) => {
      const m = /^\s*([\d.]+)\s*([KMGT]?)/i.exec(s);
      if (!m) return 0;
      return parseFloat(m[1]) * 1024 ** ' KMGT'.indexOf((m[2] || ' ').toUpperCase());
    };
    const cmp = (x: string, y: string) => {
      const a1 = key(x);
      const b1 = key(y);
      if (human) return hv(a1) - hv(b1);
      if (numeric) return (parseFloat(a1) || 0) - (parseFloat(b1) || 0) || (x < y ? -1 : x > y ? 1 : 0);
      const fa = a.flags.has('f') ? a1.toLowerCase() : a1;
      const fb = a.flags.has('f') ? b1.toLowerCase() : b1;
      return fa < fb ? -1 : fa > fb ? 1 : 0;
    };
    l = [...l].sort(cmp);
    if (rev) l.reverse();
    if (a.flags.has('u')) l = l.filter((x, i) => i === 0 || cmp(x, l[i - 1]) !== 0);
    return { stdout: joinLines(l), stderr: r.stderr, exitCode: r.failed ? 2 : 0 };
  },
};
export default cmd;
