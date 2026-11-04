import { fail, ok, type CommandContext, type CommandDef, type CommandResult } from '../types';
import { joinLines, lines } from '../args';
import { abs, fmtDateTime, readInputs } from '../cmdutil';
import { errText, FsErr } from '../vfs';
import { resolveHost } from './network';

/**
 * Команды, к которым сисадмин тянется по привычке: xargs, tac, seq, basename/dirname, stat,
 * egrep/fgrep, zcat/zgrep, timeout, nc, service, printenv, flock, paste.
 */

const run = (ctx: CommandContext, argv: string[], stdin = ''): CommandResult => ctx.exec(argv, stdin);

const xargs: CommandDef = {
  name: 'xargs',
  summary: 'собрать аргументы из stdin и запустить команду: find … | xargs rm, … | xargs -n1 echo, -I{} — подстановка',
  usage: 'xargs [-n N] [-I {}] [-r] команда [аргументы]',
  run(args, stdin, ctx) {
    let n = Infinity;
    let repl: string | undefined;
    let i = 0;
    for (; i < args.length && args[i].startsWith('-'); i++) {
      const a = args[i];
      if (a === '-n') n = parseInt(args[++i] ?? '1', 10) || 1;
      else if (/^-n\d+$/.test(a)) n = parseInt(a.slice(2), 10);
      else if (a === '-I') repl = args[++i] ?? '{}';
      else if (a.startsWith('-I')) repl = a.slice(2);
      else if (a === '-0' || a === '-r' || a === '--no-run-if-empty' || a === '-t' || a === '-d') {
        if (a === '-d') i++;
      } else return fail(`xargs: invalid option -- '${a.replace(/^-+/, '')}'`);
    }
    const cmd = args.slice(i).length ? args.slice(i) : ['echo'];
    const items = repl ? lines(stdin).filter((l) => l.trim()) : stdin.split(/\s+/).filter(Boolean);
    if (!items.length) return cmd[0] === 'echo' ? ok('\n') : ok();
    let stdout = '';
    let stderr = '';
    let code = 0;
    const batches: string[][] = [];
    if (repl) for (const it of items) batches.push(cmd.map((w) => w.split(repl!).join(it)));
    else for (let k = 0; k < items.length; k += n === Infinity ? items.length : n) batches.push([...cmd, ...items.slice(k, k + (n === Infinity ? items.length : n))]);
    for (const b of batches) {
      const r = run(ctx, b);
      stdout += r.stdout;
      stderr += r.stderr;
      if (r.exitCode !== 0) code = r.exitCode === 127 ? 127 : 123;
    }
    return { stdout, stderr, exitCode: code };
  },
};

const tac: CommandDef = {
  name: 'tac',
  summary: 'вывести файл задом наперёд (последние строки — первыми)',
  run(args, stdin, ctx) {
    const r = readInputs('tac', args.filter((a) => !a.startsWith('-')), stdin, ctx);
    return { stdout: r.inputs.map((x) => joinLines(lines(x.content).reverse())).join(''), stderr: r.stderr, exitCode: r.failed ? 1 : 0 };
  },
};

const seq: CommandDef = {
  name: 'seq',
  summary: 'последовательность чисел: seq 5, seq 2 10, seq 0 5 100',
  usage: 'seq [начало [шаг]] конец',
  run(args) {
    const nums = args.filter((a) => !/^-[sw]/.test(a)).map(Number);
    if (!nums.length || nums.some(Number.isNaN)) return fail(`seq: invalid argument`);
    const [from, step, to] = nums.length === 1 ? [1, 1, nums[0]] : nums.length === 2 ? [nums[0], 1, nums[1]] : nums;
    if (step === 0) return fail('seq: invalid Zero increment value');
    const out: number[] = [];
    for (let x = from; step > 0 ? x <= to : x >= to; x += step) {
      out.push(x);
      if (out.length > 100000) break;
    }
    return ok(joinLines(out.map(String)));
  },
};

const basename: CommandDef = {
  name: 'basename',
  summary: 'имя файла без пути: basename /var/log/app.log → app.log; basename /x/app.log .log → app',
  run(args) {
    const pos = args.filter((a) => !a.startsWith('-'));
    if (!pos[0]) return fail('basename: missing operand');
    let b = pos[0].replace(/\/+$/, '');
    b = b.slice(b.lastIndexOf('/') + 1) || '/';
    if (pos[1] && b.endsWith(pos[1]) && b !== pos[1]) b = b.slice(0, -pos[1].length);
    return ok(b + '\n');
  },
};

const dirname: CommandDef = {
  name: 'dirname',
  summary: 'каталог из пути: dirname /var/log/app.log → /var/log',
  run(args) {
    if (!args[0]) return fail('dirname: missing operand');
    const p = args[0].replace(/\/+$/, '');
    const i = p.lastIndexOf('/');
    return ok((i < 0 ? '.' : i === 0 ? '/' : p.slice(0, i)) + '\n');
  },
};

const stat: CommandDef = {
  name: 'stat',
  summary: 'подробности о файле: размер, права, владелец, время изменения. stat -c "%a %U %s" файл — свой формат',
  usage: 'stat [-c формат] файл...',
  run(args, _s, ctx) {
    let fmt: string | undefined;
    const files: string[] = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-c' || args[i] === '--format' || args[i] === '--printf') fmt = args[++i];
      else if (args[i].startsWith('--format=') || args[i].startsWith('--printf=')) fmt = args[i].slice(args[i].indexOf('=') + 1);
      else if (!args[i].startsWith('-')) files.push(args[i]);
    }
    if (!files.length) return fail('stat: missing operand');
    let out = '';
    let err = '';
    for (const f of files) {
      const n = ctx.fs.lookup(abs(ctx, f));
      if (!n) {
        err += `stat: cannot statx '${f}': No such file or directory\n`;
        continue;
      }
      const size = ctx.fs.size(n);
      const mode = (n.mode & 0o777).toString(8).padStart(3, '0');
      const rwx = (n.type === 'dir' ? 'd' : '-') + [6, 3, 0].map((sh) => ((n.mode >> sh) & 4 ? 'r' : '-') + ((n.mode >> sh) & 2 ? 'w' : '-') + ((n.mode >> sh) & 1 ? 'x' : '-')).join('');
      const t = fmtDateTime(new Date(n.mtime)) + '.000000000 +0500';
      if (fmt !== undefined) {
        out +=
          fmt
            .replace(/%a/g, String(parseInt(mode, 8).toString(8)))
            .replace(/%A/g, rwx)
            .replace(/%U/g, n.owner)
            .replace(/%G/g, n.group)
            .replace(/%s/g, String(size))
            .replace(/%n/g, f)
            .replace(/%y/g, t)
            .replace(/%Y/g, String(Math.floor(n.mtime / 1000)))
            .replace(/%F/g, n.type === 'dir' ? 'directory' : size ? 'regular file' : 'regular empty file')
            .replace(/\\n/g, '\n') + (args.includes('--printf') ? '' : '\n');
        continue;
      }
      out += `  File: ${f}\n  Size: ${size}\t\tBlocks: ${Math.ceil(size / 512)}\tIO Block: 4096   ${n.type === 'dir' ? 'directory' : size ? 'regular file' : 'regular empty file'}\n`;
      out += `Access: (0${mode}/${rwx})  Uid: ( ${n.owner === 'root' ? 0 : 1000}/${n.owner.padStart(8)})   Gid: ( ${n.group === 'root' ? 0 : 1000}/${n.group.padStart(8)})\n`;
      out += `Modify: ${t}\nChange: ${t}\n`;
    }
    return { stdout: out, stderr: err, exitCode: err ? 1 : 0 };
  },
};

const egrep: CommandDef = {
  name: 'egrep',
  summary: 'то же, что grep -E (устаревший вариант)',
  run: (args, stdin, ctx) => ctx.exec(['grep', '-E', ...args], stdin),
};

const fgrep: CommandDef = {
  name: 'fgrep',
  summary: 'то же, что grep -F (поиск фиксированной строки)',
  run: (args, stdin, ctx) => ctx.exec(['grep', '-F', ...args], stdin),
};

/** В тренажёре сжатые логи хранятся как текст — zcat/zgrep читают их как обычные файлы */
const zcat: CommandDef = {
  name: 'zcat',
  summary: 'вывести сжатый (.gz) файл без распаковки на диск',
  run: (args, stdin, ctx) => ctx.exec(['cat', ...args.filter((a) => a !== '-f')], stdin),
};

const zgrep: CommandDef = {
  name: 'zgrep',
  summary: 'grep по сжатым (.gz) логам: zgrep ERROR app.log.2.gz',
  run: (args, stdin, ctx) => ctx.exec(['grep', ...args], stdin),
};

const zless: CommandDef = {
  name: 'zless',
  summary: 'просмотр сжатого (.gz) файла',
  run: (args, stdin, ctx) => ctx.exec(['less', ...args], stdin),
};

const timeout: CommandDef = {
  name: 'timeout',
  summary: 'ограничить время работы команды: timeout 5 curl -s https://…  (код 124 — если не уложилась)',
  usage: 'timeout [-s SIGNAL] секунды команда [аргументы]',
  run(args, stdin, ctx) {
    let i = 0;
    while (i < args.length && args[i].startsWith('-')) i += args[i] === '-s' || args[i] === '-k' ? 2 : 1;
    const dur = args[i];
    const cmd = args.slice(i + 1);
    if (!dur || !cmd.length) return fail("timeout: missing operand\nTry 'timeout --help' for more information.", 125);
    const m = /^(\d+(?:\.\d+)?)([smhd]?)$/.exec(dur);
    if (!m) return fail(`timeout: invalid time interval '${dur}'`, 125);
    const limitMs = parseFloat(m[1]) * ({ '': 1, s: 1, m: 60, h: 3600, d: 86400 } as Record<string, number>)[m[2]] * 1000;
    const r = ctx.exec(cmd, stdin);
    // curl в тренажёре сообщает о долгом ответе через код 28 (timeout)
    if (r.exitCode === 28 || /timed out|Timeout was reached/i.test(r.stderr)) return { stdout: r.stdout, stderr: '', exitCode: 124 };
    if (cmd[0] === 'sleep' && parseFloat(cmd[1] ?? '0') * 1000 > limitMs) return { stdout: '', stderr: '', exitCode: 124 };
    return r;
  },
};

const nc: CommandDef = {
  name: 'nc',
  summary: 'проверить, открыт ли TCP-порт: nc -zv host 443 (код 0 — открыт)',
  usage: 'nc -zv хост порт',
  run(args, _s, ctx) {
    let flags = '';
    const pos: string[] = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-w' || args[i] === '-W' || args[i] === '-i') i++;
      else if (args[i].startsWith('-')) flags += args[i].slice(1);
      else pos.push(args[i]);
    }
    const [host, port] = pos;
    if (!host || !port) return fail('usage: nc [-zv] [-w timeout] destination port', 1);
    const v = flags.includes('v');
    const local = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === ctx.state.host;
    if (local) {
      const open = ctx.state.listeners.some((l) => l.local.endsWith(':' + port) && l.proto === (flags.includes('u') ? 'udp' : 'tcp'));
      if (open) return { stdout: '', stderr: v ? `Connection to ${host} ${port} port [tcp/*] succeeded!\n` : '', exitCode: 0 };
      return { stdout: '', stderr: v ? `nc: connect to ${host} port ${port} (tcp) failed: Connection refused\n` : '', exitCode: 1 };
    }
    const res = resolveHost(ctx, host);
    if (!res) return { stdout: '', stderr: `nc: getaddrinfo for host "${host}" port ${port}: Name or service not known\n`, exitCode: 1 };
    const h = res.host;
    // порт открыт, если есть HTTP-эндпоинт на этом хосте и порту без ошибки соединения
    const scheme = port === '443' ? 'https' : port === '80' ? 'http' : null;
    const eps = Object.entries(ctx.state.network.http).filter(([url]) => {
      try {
        const u = new URL(url);
        return u.hostname === host && (u.port ? u.port === port : (scheme !== null && u.protocol === scheme + ':'));
      } catch {
        return false;
      }
    });
    const refused = eps.length > 0 && eps.every(([, e]) => e.error === 'refused');
    // reachable:false в сценарии — про ICMP (ping); TCP решают HTTP-эндпоинты. Без эндпоинтов — недоступен
    const tmo = (eps.length > 0 && eps.every(([, e]) => e.error === 'timeout')) || (!eps.length && h.reachable === false);
    const ip = res.ip;
    if (refused || (!eps.length && !scheme && !tmo)) return { stdout: '', stderr: v ? `nc: connect to ${host} (${ip}) port ${port} (tcp) failed: Connection refused\n` : '', exitCode: 1 };
    if (tmo) return { stdout: '', stderr: v ? `nc: connect to ${host} (${ip}) port ${port} (tcp) timed out: Operation now in progress\n` : '', exitCode: 1 };
    return { stdout: '', stderr: v ? `Connection to ${host} (${ip}) ${port} port [tcp/${port === '443' ? 'https' : port === '80' ? 'http' : '*'}] succeeded!\n` : '', exitCode: 0 };
  },
};

/** service nginx restart → systemctl restart nginx (SysV-привычка) */
const service: CommandDef = {
  name: 'service',
  summary: 'старый способ управления сервисами: service nginx status|start|stop|restart (в systemd вызывает systemctl)',
  usage: 'service имя status|start|stop|restart|reload',
  run(args, stdin, ctx) {
    if (args[0] === '--status-all') return ctx.exec(['systemctl', 'list-units'], stdin);
    const [name, action] = args;
    if (!name || !action) return fail('Usage: service < option > | --status-all | [ service_name [ command | --full-restart ] ]');
    return ctx.exec(['systemctl', action, name], stdin);
  },
};

const printenv: CommandDef = {
  name: 'printenv',
  summary: 'переменные окружения: printenv, printenv HOME',
  run(args, _s, ctx) {
    const env = Object.entries(ctx.env).filter(([k]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(k));
    if (!args.length) return ok(joinLines(env.map(([k, v]) => `${k}=${v}`)));
    const vals = args.map((a) => ctx.env[a]);
    return { stdout: joinLines(vals.filter((v): v is string => v !== undefined)), stderr: '', exitCode: vals.every((v) => v !== undefined) ? 0 : 1 };
  },
};

const flock: CommandDef = {
  name: 'flock',
  summary: 'не запускать задачу, если предыдущая ещё работает: flock -n /tmp/job.lock команда',
  usage: 'flock [-n] файл команда [аргументы]',
  run(args, stdin, ctx) {
    let i = 0;
    while (i < args.length && args[i].startsWith('-')) i += args[i] === '-w' || args[i] === '-E' ? 2 : 1;
    const lock = args[i];
    let cmd = args.slice(i + 1);
    if (!lock || !cmd.length) return fail('flock: bad usage\nTry \'flock --help\' for more information.', 64);
    if (cmd[0] === '-c') cmd = ['bash', '-c', cmd.slice(1).join(' ')];
    try {
      if (!ctx.fs.exists(abs(ctx, lock))) ctx.fs.write(abs(ctx, lock), '', ctx.user);
    } catch (e) {
      if (e instanceof FsErr) return fail(`flock: cannot open lock file ${lock}: ${errText[e.code]}`, 1);
      throw e;
    }
    return ctx.exec(cmd, stdin);
  },
};

const paste: CommandDef = {
  name: 'paste',
  summary: 'склеить строки: paste -sd+ file (в одну строку через +), paste a b (столбцами)',
  usage: 'paste [-s] [-d разделитель] [файл...]',
  run(args, stdin, ctx) {
    let serial = false;
    let delim = '\t';
    const files: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-d') delim = args[++i] ?? '\t';
      else if (/^-s?d.+/.test(a)) {
        serial ||= a.includes('s');
        delim = a.slice(a.indexOf('d') + 1);
      } else if (a === '-s') serial = true;
      else if (/^-sd$/.test(a) || a === '-ds') {
        serial = true;
        delim = args[++i] ?? '\t';
      } else files.push(a);
    }
    const r = readInputs('paste', files, stdin, ctx);
    const cols = r.inputs.map((x) => lines(x.content));
    let out: string[];
    if (serial) out = cols.map((c) => c.join(delim));
    else {
      const n = Math.max(0, ...cols.map((c) => c.length));
      out = Array.from({ length: n }, (_, k) => cols.map((c) => c[k] ?? '').join(delim));
    }
    return { stdout: joinLines(out), stderr: r.stderr, exitCode: r.failed ? 1 : 0 };
  },
};

export default [xargs, tac, seq, basename, dirname, stat, egrep, fgrep, zcat, zgrep, zless, timeout, nc, service, printenv, flock, paste];
