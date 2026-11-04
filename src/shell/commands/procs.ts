import { fail, ok, type CommandContext, type CommandDef, type Proc } from '../types';
import { joinLines } from '../args';
import { releaseProcess } from '../procstate';

function psLine(p: Proc) {
  return `${p.user.padEnd(10)} ${String(p.pid).padStart(6)} ${p.cpu.toFixed(1).padStart(4)} ${p.mem.toFixed(1).padStart(4)} ${String(p.vsz).padStart(7)} ${String(p.rss).padStart(6)} ?        ${p.stat.padEnd(4)} ${p.start.padEnd(5)} ${p.time.padStart(6)} ${p.command}`;
}

/** Колонки ps -o: имя → [заголовок, ширина (отрицательная — выравнивание влево), значение] */
const PS_COLS: Record<string, [string, number, (p: Proc) => string]> = {
  pid: ['PID', 7, (p) => String(p.pid)],
  ppid: ['PPID', 7, (p) => String(p.pid === 1 ? 0 : 1)],
  user: ['USER', -10, (p) => p.user],
  uid: ['UID', 5, (p) => (p.user === 'root' ? '0' : '1000')],
  '%cpu': ['%CPU', 5, (p) => p.cpu.toFixed(1)],
  pcpu: ['%CPU', 5, (p) => p.cpu.toFixed(1)],
  '%mem': ['%MEM', 5, (p) => p.mem.toFixed(1)],
  pmem: ['%MEM', 5, (p) => p.mem.toFixed(1)],
  rss: ['RSS', 7, (p) => String(p.rss)],
  rssize: ['RSS', 7, (p) => String(p.rss)],
  vsz: ['VSZ', 8, (p) => String(p.vsz)],
  stat: ['STAT', -5, (p) => p.stat],
  s: ['S', -2, (p) => p.stat[0]],
  state: ['S', -2, (p) => p.stat[0]],
  start: ['START', -6, (p) => p.start],
  stime: ['STIME', -6, (p) => p.start],
  lstart: ['STARTED', -8, (p) => p.start],
  time: ['TIME', 9, (p) => p.time],
  cputime: ['TIME', 9, (p) => p.time],
  etime: ['ELAPSED', 11, (p) => p.time],
  etimes: ['ELAPSED', 8, (p) => p.time],
  tty: ['TT', -8, () => '?'],
  comm: ['COMMAND', -16, (p) => p.command.split(/[\s:]/)[0].split('/').pop()!],
  ucmd: ['CMD', -16, (p) => p.command.split(/[\s:]/)[0].split('/').pop()!],
  cmd: ['CMD', 0, (p) => p.command],
  args: ['COMMAND', 0, (p) => p.command],
  command: ['COMMAND', 0, (p) => p.command],
};

function psSortValue(p: Proc, key: string): number | string {
  switch (key) {
    case '%cpu': case 'pcpu': case 'cpu': return p.cpu;
    case '%mem': case 'pmem': case 'mem': return p.mem;
    case 'rss': case 'rssize': return p.rss;
    case 'vsz': return p.vsz;
    case 'pid': return p.pid;
    case 'user': return p.user;
    case 'comm': case 'cmd': case 'args': case 'command': return p.command;
    default: return 0;
  }
}

const ps: CommandDef = {
  name: 'ps',
  summary: 'список процессов. ps aux — все процессы с CPU/памятью; ps -ef — другой формат; ps -eo pid,user,%cpu,%mem,cmd --sort=-%cpu — свои колонки; ps -p PID; ps -u пользователь',
  usage: 'ps aux | ps -ef | ps -eo pid,%cpu,cmd --sort=-%cpu | ps -p PID -o pid,etime,cmd',
  run(args, _s, ctx) {
    let procs = [...ctx.state.processes];
    let sortArg: string | undefined;
    let cols: string[] | undefined;
    let noHeader = false;
    const rest: string[] = [];
    const pids: number[] = [];
    const users: string[] = [];
    const names: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      const val = (flag: string) => (a.length > flag.length ? a.slice(flag.length).replace(/^=/, '') : args[++i] ?? '');
      if (a.startsWith('--sort')) sortArg = val('--sort');
      else if (a === '--no-headers' || a === '--no-heading') noHeader = true;
      else if (a.startsWith('-o') || a.startsWith('--format') || a === 'o') {
        const v = a === 'o' ? args[++i] ?? '' : val(a.startsWith('-o') ? '-o' : '--format');
        cols = [...(cols ?? []), ...v.split(/[,\s]+/).filter(Boolean)];
      } else if (/^-[a-zA-Z]*o$/.test(a)) {
        // -eo pid,cmd
        rest.push(a.slice(0, -1));
        cols = [...(cols ?? []), ...(args[++i] ?? '').split(/[,\s]+/).filter(Boolean)];
      } else if (a.startsWith('-p') || a.startsWith('--pid') || a === 'p') pids.push(...(a === 'p' ? args[++i] ?? '' : val(a.startsWith('-p') ? '-p' : '--pid')).split(',').map(Number));
      else if (a.startsWith('-u') || a.startsWith('-U') || a.startsWith('--user')) users.push(...val(a.startsWith('--user') ? '--user' : a.slice(0, 2)).split(','));
      else if (a.startsWith('-C')) names.push(...val('-C').split(','));
      else rest.push(a);
    }
    if (sortArg) {
      for (const k of sortArg.split(',').reverse()) {
        const desc = k.startsWith('-');
        const key = k.replace(/^[-+]/, '');
        procs.sort((x, y) => {
          const a = psSortValue(x, key);
          const b = psSortValue(y, key);
          const c = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b));
          return desc ? -c : c;
        });
      }
    }
    const selected = pids.length || users.length || names.length;
    if (pids.length) procs = procs.filter((p) => pids.includes(p.pid));
    if (users.length) procs = procs.filter((p) => users.includes(p.user));
    if (names.length) procs = procs.filter((p) => names.includes(p.command.split(' ')[0].split('/').pop()!));
    const a = rest.join(' ');
    const all = /aux|-e|-A|ax/.test(a) || selected;
    if (!all) procs = procs.filter((p) => p.user === ctx.user && p.command.includes('bash'));
    if (selected && !procs.length) return { stdout: noHeader ? '' : '    PID TTY          TIME CMD\n', stderr: '', exitCode: 1 };
    if (cols) {
      const unknown = cols.find((c) => !PS_COLS[c.replace(/=.*/, '').toLowerCase()]);
      if (unknown) return fail(`error: unknown user-defined format specifier "${unknown}"`);
      const defs = cols.map((c) => {
        const [name, title] = c.split('=');
        const d = PS_COLS[name.toLowerCase()];
        return [title ?? d[0], d[1], d[2]] as const;
      });
      const fmt = (vals: string[]) => vals.map((v, i) => { const w = defs[i][1]; return w === 0 ? v : w < 0 ? v.padEnd(-w) : v.padStart(w); }).join(' ').trimEnd();
      const head = defs.every((d) => d[0] === '') || noHeader ? [] : [fmt(defs.map((d) => d[0]))];
      return ok(joinLines([...head, ...procs.map((p) => fmt(defs.map((d) => d[2](p))))]));
    }
    if (/-ef|-e\s*-f|-f\s*-e|-[A-Za-z]*f/.test(a) && !/aux/.test(a)) {
      return ok(
        (noHeader ? '' : 'UID          PID    PPID  C STIME TTY          TIME CMD\n') +
          joinLines(procs.map((p) => `${p.user.padEnd(8)} ${String(p.pid).padStart(7)} ${String(p.pid === 1 ? 0 : 1).padStart(7)}  0 ${p.start.padEnd(5)} ?        00:${p.time.padStart(5, '0')} ${p.command}`)),
      );
    }
    if (all) return ok((noHeader ? '' : 'USER          PID %CPU %MEM     VSZ    RSS TTY      STAT START    TIME COMMAND\n') + joinLines(procs.map(psLine)));
    return ok('    PID TTY          TIME CMD\n' + joinLines(procs.map((p) => `${String(p.pid).padStart(7)} pts/0    00:00:00 bash`)) + `${String(ctx.state.nextPid).padStart(7)} pts/0    00:00:00 ps\n`);
  },
};

const top: CommandDef = {
  name: 'top',
  summary: 'монитор процессов (в эмуляторе — статичный снимок, отсортированный по CPU). В реальности: P — по CPU, M — по памяти, q — выход',
  run(_a, _s, ctx) {
    const r = ctx.state.resources;
    const procs = [...ctx.state.processes].sort((a, b) => b.cpu - a.cpu);
    const free = r.memTotalMb - r.memUsedMb;
    let out = `top - ${ctx.state.now.toTimeString().slice(0, 8)} up ${r.uptime},  2 users,  load average: ${r.load.map((x) => x.toFixed(2)).join(', ')}\n`;
    out += `Tasks: ${procs.length} total,   1 running, ${procs.length - 1} sleeping,   0 stopped,   ${procs.filter((p) => p.stat.includes('Z')).length} zombie\n`;
    const cpus = r.cpus ?? 2;
    const us = Math.min(99, procs.reduce((s, p) => s + p.cpu, 0) / cpus);
    const wa = r.iowait ?? 0.3;
    out += `%Cpu(s): ${us.toFixed(1)} us,  1.2 sy,  0.0 ni, ${Math.max(0, 98.5 - us - wa).toFixed(1)} id, ${wa.toFixed(1)} wa,  0.0 hi,  0.1 si,  0.0 st\n`;
    out += `MiB Mem :  ${r.memTotalMb.toFixed(1)} total,  ${free.toFixed(1)} free,  ${r.memUsedMb.toFixed(1)} used,   512.0 buff/cache\n`;
    out += `MiB Swap:  ${r.swapTotalMb.toFixed(1)} total,  ${(r.swapTotalMb - r.swapUsedMb).toFixed(1)} free,  ${r.swapUsedMb.toFixed(1)} used.  ${(free + 400).toFixed(1)} avail Mem\n\n`;
    out += '    PID USER      PR  NI    VIRT    RES  S  %CPU  %MEM     TIME+ COMMAND\n';
    out += joinLines(
      procs.map(
        (p) =>
          `${String(p.pid).padStart(7)} ${p.user.padEnd(9)} 20   0 ${String(p.vsz).padStart(7)} ${String(p.rss).padStart(6)}  ${p.stat[0]} ${p.cpu.toFixed(1).padStart(5)} ${p.mem.toFixed(1).padStart(5)} ${p.time.padStart(9)} ${p.command.split(' ')[0].split('/').pop()}`,
      ),
    );
    return ok(out + '\x1b[2m[снимок; в реальном top данные обновляются, выход — q]\x1b[0m\n');
  },
};

const SIGNALS: Record<string, number> = { HUP: 1, INT: 2, QUIT: 3, KILL: 9, USR1: 10, USR2: 12, TERM: 15, CONT: 18, STOP: 19, TSTP: 20 };

/** "-9", "-KILL", "-SIGKILL", "KILL", "9" → 9; null — не сигнал */
function parseSignal(s: string): number | null {
  const v = s.replace(/^-/, '').toUpperCase().replace(/^SIG/, '');
  if (/^\d+$/.test(v)) return parseInt(v, 10) <= 64 ? parseInt(v, 10) : null;
  return SIGNALS[v] ?? null;
}

/** Разобрать аргументы kill/pkill/killall: сигнал и остальное */
function splitSignal(args: string[]): { sig: number; rest: string[]; error?: string } {
  let sig = 15;
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-s' || a === '-n' || a === '--signal') {
      const v = parseSignal(args[++i] ?? '');
      if (v === null) return { sig, rest, error: `${args[i] ?? ''}: invalid signal specification` };
      sig = v;
    } else if (/^-\w+$/.test(a) && parseSignal(a) !== null) sig = parseSignal(a)!;
    else rest.push(a);
  }
  return { sig, rest };
}

/** Послать сигнал процессу; возвращает текст ошибки или '' */
function signalProcess(ctx: CommandContext, pid: number, sig: number, who = 'bash: kill'): string {
  const idx = ctx.state.processes.findIndex((p) => p.pid === pid);
  if (idx < 0) return `${who}: (${pid}) - No such process\n`;
  const p = ctx.state.processes[idx];
  if (ctx.user !== 'root' && p.user !== ctx.user) return `${who}: (${pid}) - Operation not permitted\n`;
  // 0 — проверка существования; HUP — перечитать конфиг; USR/STOP/CONT — процесс не завершается
  if (sig === 0 || sig === 1 || sig === 10 || sig === 12 || sig === 18 || sig === 19 || sig === 20) return '';
  if (p.stat.includes('D') && sig !== 9) return ''; // не реагирует: ждёт ввода-вывода
  ctx.state.processes.splice(idx, 1);
  releaseProcess(ctx.state, pid);
  if (p.service) {
    const s = ctx.state.services.find((x) => x.name === p.service);
    if (s) {
      s.active = sig === 9 ? 'failed' : 'inactive';
      s.mainPid = undefined;
      s.logs.push({ time: '2026-11-04 14:30:00', priority: sig === 9 ? 'err' : 'info', message: sig === 9 ? `${s.name}.service: Main process exited, code=killed, status=9/KILL` : `Stopped ${s.description}.` });
    }
  }
  return '';
}

const kill: CommandDef = {
  name: 'kill',
  summary: 'послать сигнал процессу: kill PID (SIGTERM, вежливо), kill -9 PID (SIGKILL, принудительно — крайняя мера), kill -HUP PID — перечитать конфиг',
  usage: 'kill [-9|-15|-HUP|-s SIGNAL] PID...',
  run(args, _s, ctx) {
    if (args[0] === '-l' || args[0] === '-L') return ok(' 1) SIGHUP\t 2) SIGINT\t 3) SIGQUIT\t 9) SIGKILL\n10) SIGUSR1\t12) SIGUSR2\t15) SIGTERM\t18) SIGCONT\n19) SIGSTOP\t20) SIGTSTP\n');
    const { sig, rest, error } = splitSignal(args);
    if (error) return fail(`bash: kill: ${error}`, 1);
    const bad = rest.find((x) => x.startsWith('-'));
    if (bad) return fail(`bash: kill: ${bad.slice(1)}: invalid signal specification`, 1);
    if (!rest.length) return fail('kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ... or kill -l [sigspec]', 2);
    let err = '';
    for (const ps of rest) {
      const pid = parseInt(ps, 10);
      if (Number.isNaN(pid) || !/^\d+$/.test(ps)) {
        err += `bash: kill: ${ps}: arguments must be process or job IDs\n`;
        continue;
      }
      err += signalProcess(ctx, pid, sig);
    }
    return err ? fail(err) : ok();
  },
};

const procName = (p: Proc) => p.command.split(/[\s:]/)[0].split('/').pop()!;

/** pkill [-signal] [-f] [-u user] pattern — по имени (или всей командной строке с -f) */
const pkill: CommandDef = {
  name: 'pkill',
  summary: 'послать сигнал процессам по имени: pkill nginx, pkill -f "часть командной строки", pkill -9 -f rebuild',
  usage: 'pkill [-SIGNAL] [-f] [-u user] шаблон',
  run(args, _s, ctx) {
    const { sig, rest, error } = splitSignal(args);
    if (error) return fail(`pkill: ${error}`, 2);
    let full = false;
    let exact = false;
    const users: string[] = [];
    const pos: string[] = [];
    for (let i = 0; i < rest.length; i++) {
      const a = rest[i];
      if (a === '-u' || a === '-U') users.push(...(rest[++i] ?? '').split(','));
      else if (/^-[fxe]+$/.test(a)) {
        full ||= a.includes('f');
        exact ||= a.includes('x');
      } else if (a.startsWith('-')) return fail(`pkill: invalid option -- '${a.slice(1)}'`, 2);
      else pos.push(a);
    }
    if (!pos.length && !users.length) return fail('pkill: no matching criteria specified\nTry `pkill --help\' for more information.', 2);
    let re: RegExp | null = null;
    try {
      re = pos[0] !== undefined ? new RegExp(exact ? `^(?:${pos[0]})$` : pos[0]) : null;
    } catch {
      return fail('pkill: invalid regular expression', 2);
    }
    const targets = ctx.state.processes.filter((p) => (!re || re.test(full ? p.command : procName(p))) && (!users.length || users.includes(p.user)));
    if (!targets.length) return { stdout: '', stderr: '', exitCode: 1 };
    let err = '';
    for (const p of targets) err += signalProcess(ctx, p.pid, sig, 'pkill: killing pid').replace(/^pkill: killing pid: \((\d+)\) - (.*)$/m, 'pkill: killing pid $1 failed: $2');
    return err ? fail(err) : ok();
  },
};

/** killall [-signal] имя — точное имя процесса */
const killall: CommandDef = {
  name: 'killall',
  summary: 'послать сигнал всем процессам с точным именем: killall nginx, killall -9 java',
  usage: 'killall [-SIGNAL] имя...',
  run(args, _s, ctx) {
    const { sig, rest, error } = splitSignal(args);
    if (error) return fail(`killall: ${error}`, 1);
    const names = rest.filter((x) => !x.startsWith('-'));
    if (!names.length) return fail('Usage: killall [OPTION]... [--] NAME...', 1);
    let err = '';
    for (const n of names) {
      const targets = ctx.state.processes.filter((p) => procName(p) === n);
      if (!targets.length) {
        err += `${n}: no process found\n`;
        continue;
      }
      for (const p of targets) err += signalProcess(ctx, p.pid, sig, 'killall').replace(/^killall: \((\d+)\) - Operation not permitted$/m, `${n}(\$1): Operation not permitted`);
    }
    return err ? fail(err) : ok();
  },
};

const pgrep: CommandDef = {
  name: 'pgrep',
  summary: 'найти PID по имени процесса. -a — с командной строкой, -l — с именем, -f — искать по всей командной строке, -u — процессы пользователя, -c — посчитать',
  usage: 'pgrep [-alfcx] [-u user] шаблон',
  run(args, _s, ctx) {
    let fl = '';
    const users: string[] = [];
    const pos: string[] = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-u' || a === '-U') users.push(...(args[++i] ?? '').split(','));
      else if (a.startsWith('-') && a.length > 1) fl += a.slice(1);
      else pos.push(a);
    }
    const pat = pos[0];
    if (pat === undefined && !users.length) return fail('pgrep: no matching criteria specified', 2);
    let re: RegExp | null = null;
    try {
      re = pat === undefined ? null : new RegExp(fl.includes('x') ? `^(?:${pat})$` : pat);
    } catch {
      return fail('pgrep: invalid regular expression', 2);
    }
    const m = ctx.state.processes.filter((p) => (!re || re.test(fl.includes('f') ? p.command : procName(p))) && (!users.length || users.includes(p.user)));
    if (fl.includes('c')) return { stdout: `${m.length}\n`, stderr: '', exitCode: m.length ? 0 : 1 };
    if (!m.length) return { stdout: '', stderr: '', exitCode: 1 };
    return ok(joinLines(m.map((p) => (fl.includes('a') ? `${p.pid} ${p.command}` : fl.includes('l') ? `${p.pid} ${procName(p)}` : String(p.pid)))));
  },
};

export default [ps, top, kill, pgrep, pkill, killall];
