import { fail, type CommandDef } from '../types';
import { parseArgs, invalidOption, lines, joinLines } from '../args';
import { readInputs } from '../cmdutil';
const cmd: CommandDef = {
  name: 'uniq',
  summary: 'убрать соседние повторы (обычно после sort). -c посчитать повторы, -d только повторяющиеся, -u только уникальные, -i без регистра',
  usage: 'uniq [-cdu] [файл]',
  run(args, stdin, ctx) {
    const a = parseArgs(args, [], ['c', 'd', 'u', 'i']);
    if (a.unknown.length) return fail(invalidOption('uniq', a.unknown[0]));
    const r = readInputs('uniq', a.positional.slice(0, 1), stdin, ctx);
    const l = lines(r.inputs[0]?.content ?? '');
    const groups: { line: string; n: number }[] = [];
    const eq = (x: string, y: string) => (a.flags.has('i') ? x.toLowerCase() === y.toLowerCase() : x === y);
    for (const x of l) {
      const g = groups[groups.length - 1];
      if (g && eq(g.line, x)) g.n++;
      else groups.push({ line: x, n: 1 });
    }
    let sel = groups;
    if (a.flags.has('d')) sel = sel.filter((g) => g.n > 1);
    if (a.flags.has('u')) sel = sel.filter((g) => g.n === 1);
    return {
      stdout: joinLines(sel.map((g) => (a.flags.has('c') ? `${String(g.n).padStart(7)} ${g.line}` : g.line))),
      stderr: r.stderr,
      exitCode: r.failed ? 1 : 0,
    };
  },
};
export default cmd;
