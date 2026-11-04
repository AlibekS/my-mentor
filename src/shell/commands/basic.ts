import { fail, ok, type CommandDef } from '../types';
import { lines, joinLines, parseArgs } from '../args';
import { fmtDateTime, pad2, readInputs } from '../cmdutil';

const echo: CommandDef = {
  name: 'echo',
  summary: 'вывести текст. -n без перевода строки, -e с обработкой \\n \\t',
  usage: 'echo [-ne] текст',
  run(args) {
    let n = false;
    let e = false;
    let i = 0;
    while (i < args.length && /^-[ne]+$/.test(args[i])) {
      if (args[i].includes('n')) n = true;
      if (args[i].includes('e')) e = true;
      i++;
    }
    let s = args.slice(i).join(' ');
    if (e) s = s.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    return ok(n ? s : s + '\n');
  },
};

const whoami: CommandDef = { name: 'whoami', summary: 'имя текущего пользователя', run: (_a, _s, ctx) => ok(ctx.user + '\n') };

const id: CommandDef = {
  name: 'id',
  summary: 'uid, gid и группы пользователя',
  run: (args, _s, ctx) => {
    const u = args[0] ?? ctx.user;
    if (u === 'root') return ok('uid=0(root) gid=0(root) groups=0(root)\n');
    const gs = ctx.fs.groups[u] ?? [u];
    return ok(`uid=1000(${u}) gid=1000(${u}) groups=${gs.map((g, i) => `${[1000, 4, 27][i] ?? 1000 + i}(${g})`).join(',')}\n`);
  },
};

const hostname: CommandDef = {
  name: 'hostname',
  summary: 'имя сервера. -I — IP-адреса',
  run: (args, _s, ctx) =>
    ok(args.includes('-I') ? ctx.state.network.interfaces.filter((i) => i.name !== 'lo').map((i) => i.ip.split('/')[0]).join(' ') + ' \n' : ctx.state.host + '\n'),
};

const uname: CommandDef = {
  name: 'uname',
  summary: 'информация о системе. -a всё, -r версия ядра',
  run: (args, _s, ctx) => {
    if (args.includes('-a')) return ok(`Linux ${ctx.state.host} 6.8.0-45-generic #45-Ubuntu SMP x86_64 x86_64 x86_64 GNU/Linux\n`);
    if (args.includes('-r')) return ok('6.8.0-45-generic\n');
    return ok('Linux\n');
  },
};

const date: CommandDef = {
  name: 'date',
  summary: 'текущие дата и время. date -u — в UTC, date +%F — формат',
  run: (args, _s, ctx) => {
    const d = ctx.state.now;
    const fmt = args.find((x) => x.startsWith('+'));
    if (fmt) {
      const map: Record<string, string> = {
        F: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
        T: `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`,
        Y: String(d.getFullYear()),
        m: pad2(d.getMonth() + 1),
        d: pad2(d.getDate()),
        H: pad2(d.getHours()),
        M: pad2(d.getMinutes()),
        S: pad2(d.getSeconds()),
        s: String(Math.floor(d.getTime() / 1000)),
      };
      return ok(fmt.slice(1).replace(/%(\w)/g, (_m, c) => map[c] ?? '%' + c) + '\n');
    }
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const mons = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return ok(`${days[d.getDay()]} ${mons[d.getMonth()]} ${pad2(d.getDate())} ${fmtDateTime(d).slice(11)} ${args.includes('-u') ? 'UTC' : '+05'} ${d.getFullYear()}\n`);
  },
};

const uptime: CommandDef = {
  name: 'uptime',
  summary: 'время работы и средняя нагрузка (load average) за 1, 5, 15 минут',
  run: (_a, _s, ctx) => {
    const r = ctx.state.resources;
    const t = fmtDateTime(ctx.state.now).slice(11);
    return ok(` ${t} up ${r.uptime},  2 users,  load average: ${r.load.map((x) => x.toFixed(2)).join(', ')}\n`);
  },
};

const history: CommandDef = {
  name: 'history',
  summary: 'история введённых команд',
  run: (_a, _s, ctx) => ok(joinLines(ctx.history.map((h, i) => `${String(i + 1).padStart(5)}  ${h}`))),
};

const clear: CommandDef = { name: 'clear', summary: 'очистить экран (или Ctrl+L)', run: () => ok('') };

const env: CommandDef = {
  name: 'env',
  summary: 'переменные окружения',
  run: (_a, _s, ctx) => ok(joinLines(Object.entries(ctx.env).filter(([k]) => k !== '?').map(([k, v]) => `${k}=${v}`))),
};

const exportCmd: CommandDef = {
  name: 'export',
  summary: 'задать переменную окружения: export NAME=value',
  run: (args, _s, ctx) => {
    for (const a of args) {
      const i = a.indexOf('=');
      if (i > 0) ctx.env[a.slice(0, i)] = a.slice(i + 1);
    }
    return ok();
  },
};

const which: CommandDef = {
  name: 'which',
  summary: 'где находится команда',
  run: (args, _s, ctx) => {
    let out = '';
    let code = 0;
    for (const a of args) {
      if (ctx.registry.has(a)) out += `/usr/bin/${a}\n`;
      else code = 1;
    }
    return { stdout: out, stderr: '', exitCode: code };
  },
};

const tr: CommandDef = {
  name: 'tr',
  summary: "замена символов: tr 'a-z' 'A-Z', tr -d '\\r' (удалить), tr -s ' ' (сжать повторы)",
  run: (args, stdin) => {
    const a = parseArgs(args, [], ['d', 's']);
    const expand = (s: string) =>
      s.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\r/g, '\r').replace(/(.)-(.)/g, (_m, x: string, y: string) => {
        let r = '';
        for (let c = x.charCodeAt(0); c <= y.charCodeAt(0); c++) r += String.fromCharCode(c);
        return r;
      });
    const [s1 = '', s2 = ''] = a.positional.map(expand);
    let out = stdin;
    if (a.flags.has('d')) out = [...out].filter((c) => !s1.includes(c)).join('');
    else if (s2) out = [...out].map((c) => (s1.includes(c) ? s2[Math.min(s1.indexOf(c), s2.length - 1)] : c)).join('');
    if (a.flags.has('s')) {
      const set = s2 || s1;
      out = out.replace(new RegExp(`([${set.replace(/[\]\\^-]/g, '\\$&')}])\\1+`, 'g'), '$1');
    }
    return ok(out);
  },
};

const rev: CommandDef = {
  name: 'rev',
  summary: 'перевернуть каждую строку',
  run: (args, stdin, ctx) => {
    const r = readInputs('rev', args, stdin, ctx);
    return ok(joinLines(lines(r.inputs.map((i) => i.content).join('')).map((l) => [...l].reverse().join(''))));
  },
};

const trueCmd: CommandDef = { name: 'true', summary: 'ничего не делает, код выхода 0', run: () => ok() };
const falseCmd: CommandDef = { name: 'false', summary: 'ничего не делает, код выхода 1', run: () => ({ stdout: '', stderr: '', exitCode: 1 }) };

const sleep: CommandDef = { name: 'sleep', summary: 'пауза (в эмуляторе мгновенно)', run: (args) => (args.length ? ok() : fail('sleep: missing operand')) };

const exitCmd: CommandDef = {
  name: 'exit',
  summary: 'выйти из оболочки (в эмуляторе — сбросить root после sudo -i)',
  run: () => ok('logout\n'),
};

export default [echo, whoami, id, hostname, uname, date, uptime, history, clear, env, exportCmd, which, tr, rev, trueCmd, falseCmd, sleep, exitCmd];
