import { fail, ok, type CommandDef, type Proc } from '../types';
import { joinLines } from '../args';

function psLine(p: Proc) {
  return `${p.user.padEnd(10)} ${String(p.pid).padStart(6)} ${p.cpu.toFixed(1).padStart(4)} ${p.mem.toFixed(1).padStart(4)} ${String(p.vsz).padStart(7)} ${String(p.rss).padStart(6)} ?        ${p.stat.padEnd(4)} ${p.start.padEnd(5)} ${p.time.padStart(6)} ${p.command}`;
}

const ps: CommandDef = {
  name: 'ps',
  summary: 'список процессов. ps aux — все процессы с CPU/памятью; ps -ef — другой формат',
  usage: 'ps aux | ps -ef',
  run(args, _s, ctx) {
    let procs = [...ctx.state.processes];
    const sortArg = args.find((x) => x.startsWith('--sort='))?.slice(7);
    if (sortArg) {
      const desc = sortArg.startsWith('-');
      const key = sortArg.replace(/^[-+]/, '');
      const val = (p: Proc) => (key === '%cpu' || key === 'pcpu' ? p.cpu : key === '%mem' || key === 'pmem' ? p.mem : key === 'rss' ? p.rss : key === 'pid' ? p.pid : 0);
      procs.sort((x, y) => (desc ? val(y) - val(x) : val(x) - val(y)));
    }
    const a = args.filter((x) => !x.startsWith('--sort')).join(' ');
    if (/aux|-e|ax/.test(a)) {
      if (/-ef|-e\s*-f/.test(a)) {
        return ok(
          'UID          PID    PPID  C STIME TTY          TIME CMD\n' +
            joinLines(procs.map((p) => `${p.user.padEnd(8)} ${String(p.pid).padStart(7)} ${String(p.pid === 1 ? 0 : 1).padStart(7)}  0 ${p.start.padEnd(5)} ?        00:${p.time.padStart(5, '0')} ${p.command}`)),
        );
      }
      return ok('USER          PID %CPU %MEM     VSZ    RSS TTY      STAT START    TIME COMMAND\n' + joinLines(procs.map(psLine)));
    }
    const mine = procs.filter((p) => p.user === ctx.user && p.command.includes('bash'));
    return ok('    PID TTY          TIME CMD\n' + joinLines(mine.map((p) => `${String(p.pid).padStart(7)} pts/0    00:00:00 bash`)) + `${String(ctx.state.nextPid).padStart(7)} pts/0    00:00:00 ps\n`);
  },
};

const top: CommandDef = {
  name: 'top',
  summary: 'монитор процессов (в эмуляторе — статичный снимок, отсортированный по CPU). В реальности: P — по CPU, M — по памяти, q — выход',
  run(_a, _s, ctx) {
    const r = ctx.state.resources;
    const procs = [...ctx.state.processes].sort((a, b) => b.cpu - a.cpu);
    const free = r.memTotalMb - r.memUsedMb;
    const cpuUser = Math.min(99, procs.reduce((s, p) => s + p.cpu, 0) / 4);
    let out = `top - ${ctx.state.now.toTimeString().slice(0, 8)} up ${r.uptime},  2 users,  load average: ${r.load.map((x) => x.toFixed(2)).join(', ')}\n`;
    out += `Tasks: ${procs.length} total,   1 running, ${procs.length - 1} sleeping,   0 stopped,   ${procs.filter((p) => p.stat.includes('Z')).length} zombie\n`;
    out += `%Cpu(s): ${cpuUser.toFixed(1)} us,  1.2 sy,  0.0 ni, ${(98 - cpuUser).toFixed(1)} id,  0.3 wa,  0.0 hi,  0.1 si,  0.0 st\n`;
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

const kill: CommandDef = {
  name: 'kill',
  summary: 'послать сигнал процессу: kill PID (SIGTERM, вежливо), kill -9 PID (SIGKILL, принудительно — крайняя мера)',
  usage: 'kill [-9|-15|-HUP] PID...',
  run(args, _s, ctx) {
    if (args[0] === '-l') return ok(' 1) SIGHUP\t 2) SIGINT\t 9) SIGKILL\t15) SIGTERM\t19) SIGSTOP\n');
    const pids = args.filter((x) => !x.startsWith('-'));
    if (!pids.length) return fail('kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ... or kill -l [sigspec]', 2);
    const sig = args.find((x) => x.startsWith('-')) ?? '-15';
    let err = '';
    for (const ps of pids) {
      const pid = parseInt(ps, 10);
      const idx = ctx.state.processes.findIndex((p) => p.pid === pid);
      if (Number.isNaN(pid)) {
        err += `bash: kill: ${ps}: arguments must be process or job IDs\n`;
        continue;
      }
      if (idx < 0) {
        err += `bash: kill: (${pid}) - No such process\n`;
        continue;
      }
      const p = ctx.state.processes[idx];
      if (ctx.user !== 'root' && p.user !== ctx.user) {
        err += `bash: kill: (${pid}) - Operation not permitted\n`;
        continue;
      }
      if (sig === '-HUP' || sig === '-1') continue; // перечитать конфиг
      if (p.stat.includes('D') && sig !== '-9') continue; // не реагирует
      ctx.state.processes.splice(idx, 1);
      ctx.state.listeners = ctx.state.listeners.filter((l) => l.pid !== pid);
      if (p.service) {
        const s = ctx.state.services.find((x) => x.name === p.service);
        if (s) {
          s.active = sig === '-9' ? 'failed' : 'inactive';
          s.mainPid = undefined;
          s.logs.push({ time: '2026-11-04 14:30:00', priority: sig === '-9' ? 'err' : 'info', message: sig === '-9' ? `${s.name}.service: Main process exited, code=killed, status=9/KILL` : `Stopped ${s.description}.` });
        }
      }
    }
    return err ? fail(err) : ok();
  },
};

const pgrep: CommandDef = {
  name: 'pgrep',
  summary: 'найти PID по имени процесса. -a — с командной строкой',
  run(args, _s, ctx) {
    const pat = args.filter((x) => !x.startsWith('-'))[0];
    if (!pat) return fail('pgrep: no matching criteria specified', 2);
    const fl = args.filter((x) => x.startsWith('-')).join('');
    const re = new RegExp(pat);
    const m = ctx.state.processes.filter((p) => re.test(p.command.split(/[\s:]/)[0].split('/').pop()!) || (fl.includes('f') && re.test(p.command)));
    if (!m.length) return { stdout: '', stderr: '', exitCode: 1 };
    return ok(joinLines(m.map((p) => (fl.includes('a') || fl.includes('l') ? `${p.pid} ${fl.includes('a') ? p.command : p.command.split(' ')[0]}` : String(p.pid)))));
  },
};

export default [ps, top, kill, pgrep];
