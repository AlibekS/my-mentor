import { ok, type CommandDef } from '../types';
const cmd: CommandDef = {
  name: 'pwd',
  summary: 'показать текущий каталог (print working directory)',
  usage: 'pwd',
  run: (_a, _s, ctx) => ok(ctx.cwd + '\n'),
};
export default cmd;
