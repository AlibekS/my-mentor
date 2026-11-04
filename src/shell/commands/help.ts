import { fail, ok, type CommandDef } from '../types';

const help: CommandDef = {
  name: 'help',
  summary: 'список доступных команд',
  run: (_a, _s, ctx) => {
    const names = [...ctx.registry.keys()].sort();
    const w = Math.max(...names.map((n) => n.length)) + 2;
    let out = 'Доступные команды (подробнее: man <команда>):\n\n';
    for (const n of names) out += `  \x1b[36m${n.padEnd(w)}\x1b[0m${ctx.registry.get(n)!.summary.split('.')[0]}\n`;
    out += '\nКлавиши: ↑/↓ — история, Tab — дополнение, Ctrl+C — прервать, Ctrl+L — очистить экран.\n';
    return ok(out);
  },
};

const man: CommandDef = {
  name: 'man',
  summary: 'справка по команде на русском: man grep',
  run: (args, _s, ctx) => {
    if (!args[0]) return fail('What manual page do you want?\nFor example, try \'man man\'.');
    const d = ctx.registry.get(args[0]);
    if (!d) return fail(`No manual entry for ${args[0]}`, 16);
    return ok(`\x1b[1m${d.name.toUpperCase()}\x1b[0m — ${d.summary}\n\n${d.usage ? `Использование: ${d.usage}\n` : ''}${d.man ? '\n' + d.man + '\n' : ''}`);
  },
};

const sudo: CommandDef = {
  name: 'sudo',
  summary: 'выполнить команду от root. На проде — осознанно и только когда нужно',
  usage: 'sudo команда [аргументы]',
  run: (args, stdin, ctx) => {
    if (!args.length) return fail('usage: sudo command');
    if (args[0] === '-i' || args[0] === 'su') return fail('sudo: интерактивный root-шелл в тренажёре отключён — используйте sudo перед конкретной командой');
    return ctx.exec(args, stdin, 'root');
  },
};

export default [help, man, sudo];
