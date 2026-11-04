import { fail, ok, type CommandDef } from '../types';
import { abs } from '../cmdutil';
const cmd: CommandDef = {
  name: 'cd',
  summary: 'перейти в каталог (change directory). cd без аргументов — домой, cd - — назад',
  usage: 'cd [каталог]',
  run(args, _s, ctx) {
    if (args.length > 1) return fail('bash: cd: too many arguments');
    let target = args[0] ?? ctx.env.HOME;
    if (target === '-') target = ctx.env.OLDPWD ?? ctx.cwd;
    const p = abs(ctx, target);
    const n = ctx.fs.lookup(p);
    if (!n) return fail(`bash: cd: ${args[0]}: No such file or directory`);
    if (n.type !== 'dir') return fail(`bash: cd: ${args[0]}: Not a directory`);
    if (!ctx.fs.can(n, ctx.user, 1)) return fail(`bash: cd: ${args[0]}: Permission denied`);
    ctx.setCwd(p);
    return ok(args[0] === '-' ? p + '\n' : '');
  },
};
export default cmd;
