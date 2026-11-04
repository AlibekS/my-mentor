import { fail, ok, type CommandDef } from '../types';
import { abs } from '../cmdutil';

const path = (user: string) => `/var/spool/cron/crontabs/${user}`;

const cmd: CommandDef = {
  name: 'crontab',
  summary: 'расписание задач cron: crontab -l (показать), crontab файл (установить из файла), crontab -r (удалить). Формат: мин час день месяц день_недели команда',
  usage: 'crontab -l | crontab файл | crontab -r',
  run(argsIn, _s, ctx) {
    let args = argsIn;
    let user = ctx.user;
    const ui = args.indexOf('-u');
    if (ui >= 0) {
      if (ctx.user !== 'root') return fail('crontab: must be privileged to use -u');
      user = args[ui + 1] ?? user;
      args = args.filter((_a, i) => i !== ui && i !== ui + 1);
    }
    const p = path(user);
    if (args[0] === '-l') {
      const n = ctx.fs.lookup(p);
      return n ? ok(n.content) : fail(`no crontab for ${user}`);
    }
    if (args[0] === '-r') {
      if (ctx.fs.exists(p)) ctx.fs.remove(p, 'root');
      return ok();
    }
    if (args[0] === '-e') return fail('crontab -e: в тренажёре открой файл в редакторе (nano mycron), затем установи: crontab mycron');
    if (!args[0]) return fail('usage: crontab [-l | -r | file]');
    const text = ctx.fs.read(abs(ctx, args[0]), ctx.user);
    for (const [i, line] of text.split('\n').entries()) {
      const l = line.trim();
      if (!l || l.startsWith('#') || /^[A-Z_]+=/.test(l)) continue;
      const parts = l.split(/\s+/);
      if (!/^@(reboot|hourly|daily|weekly|monthly)$/.test(parts[0]) && (parts.length < 6 || !parts.slice(0, 5).every((f) => /^[\d*/,\-]+$/.test(f))))
        return fail(`"${args[0]}":${i + 1}: bad minute\nerrors in crontab file, can't install.`);
    }
    if (!ctx.fs.exists('/var/spool/cron/crontabs')) ctx.fs.mkdir('/var/spool/cron/crontabs', 'root', true);
    ctx.fs.write(p, text, 'root');
    return ok();
  },
};
export default cmd;
