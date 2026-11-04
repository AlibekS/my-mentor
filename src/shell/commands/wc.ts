import { fail, type CommandDef } from '../types';
import { parseArgs, invalidOption } from '../args';
import { readInputs } from '../cmdutil';
const cmd: CommandDef = {
  name: 'wc',
  summary: 'посчитать строки (-l), слова (-w), байты (-c)',
  usage: 'wc [-lwc] [файл...]',
  run(args, stdin, ctx) {
    const a = parseArgs(args, [], ['l', 'w', 'c', 'm']);
    if (a.unknown.length) return fail(invalidOption('wc', a.unknown[0]));
    const r = readInputs('wc', a.positional, stdin, ctx);
    const sel = ['l', 'w', 'c'].filter((f) => a.flags.has(f) || (f === 'c' && a.flags.has('m')));
    const show = sel.length ? sel : ['l', 'w', 'c'];
    const rows: string[] = [];
    const tot = { l: 0, w: 0, c: 0 };
    for (const inp of r.inputs) {
      const v = {
        l: (inp.content.match(/\n/g) ?? []).length,
        w: inp.content.split(/\s+/).filter(Boolean).length,
        c: new TextEncoder().encode(inp.content).length,
      };
      tot.l += v.l;
      tot.w += v.w;
      tot.c += v.c;
      const nums = show.map((k) => v[k as 'l']);
      const pad = show.length === 1 && !a.positional.length ? 0 : 7;
      rows.push(nums.map((n) => String(n).padStart(pad)).join(' ').trimStart() + (a.positional.length ? ' ' + inp.name : ''));
    }
    if (r.inputs.length > 1) rows.push(show.map((k) => String(tot[k as 'l']).padStart(7)).join(' ').trimStart() + ' total');
    return { stdout: rows.join('\n') + '\n', stderr: r.stderr, exitCode: r.failed ? 1 : 0 };
  },
};
export default cmd;
