import { fail, type CommandDef } from '../types';
import { parseArgs, lines, joinLines } from '../args';
import { readInputs } from '../cmdutil';

function ranges(spec: string): (n: number) => boolean {
  const parts = spec.split(',').map((p) => {
    const m = /^(\d*)-?(\d*)$/.exec(p)!;
    if (!p.includes('-')) return [parseInt(p, 10), parseInt(p, 10)];
    return [m[1] ? parseInt(m[1], 10) : 1, m[2] ? parseInt(m[2], 10) : Infinity];
  });
  return (n) => parts.some(([a, b]) => n >= a && n <= b);
}

const cmd: CommandDef = {
  name: 'cut',
  summary: 'вырезать поля/символы. -d разделитель, -f номера полей (1,3 или 2-4), -c позиции символов',
  usage: "cut -d' ' -f1 [файл]",
  run(args, stdin, ctx) {
    const a = parseArgs(args, ['d', 'f', 'c'], ['d', 'f', 'c', 's']);
    if (!a.values.f && !a.values.c) return fail("cut: you must specify a list of bytes, characters, or fields\nTry 'cut --help' for more information.");
    if (a.values.d !== undefined && a.values.d.length !== 1) return fail('cut: the delimiter must be a single character');
    const r = readInputs('cut', a.positional, stdin, ctx);
    const l = lines(r.inputs.map((i) => i.content).join(''));
    let out: string[];
    if (a.values.c) {
      const sel = ranges(a.values.c);
      out = l.map((s) => [...s].filter((_c, i) => sel(i + 1)).join(''));
    } else {
      const d = a.values.d ?? '\t';
      const sel = ranges(a.values.f!);
      out = l
        .filter((s) => !a.flags.has('s') || s.includes(d))
        .map((s) => (s.includes(d) ? s.split(d).filter((_x, i) => sel(i + 1)).join(d) : s));
    }
    return { stdout: joinLines(out), stderr: r.stderr, exitCode: r.failed ? 1 : 0 };
  },
};
export default cmd;
