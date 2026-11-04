import { fail, type CommandDef } from '../types';
import { parseArgs, invalidOption, lines, joinLines } from '../args';
import { readInputs } from '../cmdutil';
const cmd: CommandDef = {
  name: 'cat',
  summary: 'вывести содержимое файла(ов). -n нумеровать строки',
  usage: 'cat [-n] [файл...]',
  run(args, stdin, ctx) {
    const a = parseArgs(args, [], ['n', 'A', 'v']);
    if (a.unknown.length) return fail(invalidOption('cat', a.unknown[0]));
    const r = readInputs('cat', a.positional, stdin, ctx);
    let out = r.inputs.map((i) => i.content).join('');
    if (a.flags.has('n')) out = joinLines(lines(out).map((l, i) => `${String(i + 1).padStart(6)}\t${l}`));
    return { stdout: out, stderr: r.stderr, exitCode: r.failed ? 1 : 0 };
  },
};
export default cmd;
