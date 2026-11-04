import type { CommandDef } from '../types';
import { readInputs } from '../cmdutil';
import { lines, joinLines } from '../args';
const run: CommandDef['run'] = (args, stdin, ctx) => {
  const files = args.filter((x) => !x.startsWith('-') && !x.startsWith('+'));
  const r = readInputs('less', files, stdin, ctx);
  const content = r.inputs.map((i) => i.content).join('');
  const l = lines(content);
  const shown = l.slice(0, 40);
  const tail = l.length > 40 ? `\x1b[7m(показаны первые 40 из ${l.length} строк; в настоящем less: пробел — дальше, /текст — поиск, q — выход)\x1b[0m\n` : '';
  return { stdout: joinLines(shown) + tail, stderr: r.stderr, exitCode: r.failed ? 1 : 0 };
};
const less: CommandDef = { name: 'less', summary: 'постраничный просмотр (в эмуляторе — первые 40 строк). В реальности: / — поиск, G — в конец, q — выход', usage: 'less файл', run };
const more: CommandDef = { name: 'more', summary: 'постраничный просмотр (упрощённо)', usage: 'more файл', run };
export default [less, more];
