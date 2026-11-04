import { fail, ok, type CommandDef, type Service } from '../types';
import { joinLines } from '../args';

function findSvc(ctx: Parameters<CommandDef['run']>[2], name: string): Service | undefined {
  const n = name.replace(/\.service$/, '');
  return ctx.state.services.find((s) => s.name === n);
}

export function startService(ctx: Parameters<CommandDef['run']>[2], s: Service): string | null {
  const t = '2026-11-04 14:30:00';
  s.logs.push({ time: t, priority: 'info', message: `Starting ${s.description}...` });
  if (s.failOnStart) {
    s.active = 'failed';
    for (const l of s.failOnStart.split('\n')) s.logs.push({ time: t, priority: 'err', message: l });
    s.logs.push({ time: t, priority: 'err', message: `${s.name}.service: Failed with result 'exit-code'.` });
    s.logs.push({ time: t, priority: 'err', message: `Failed to start ${s.description}.` });
    return `Job for ${s.name}.service failed because the control process exited with error code.\nSee "systemctl status ${s.name}.service" and "journalctl -xeu ${s.name}.service" for details.\n`;
  }
  // порт уже занят?
  for (const l of s.listen ?? []) {
    const busy = ctx.state.listeners.find((x) => x.local.split(':').pop() === l.local.split(':').pop() && x.process !== s.name);
    if (busy) {
      s.active = 'failed';
      s.logs.push({ time: t, priority: 'err', message: `bind() to ${l.local} failed (98: Address already in use)` });
      s.logs.push({ time: t, priority: 'err', message: `Failed to start ${s.description}.` });
      return `Job for ${s.name}.service failed because the control process exited with error code.\nSee "systemctl status ${s.name}.service" and "journalctl -xeu ${s.name}.service" for details.\n`;
    }
  }
  s.active = 'active';
  s.since = 'Wed 2026-11-04 14:30:00 +05';
  const pid = ctx.state.nextPid++;
  s.mainPid = pid;
  if (s.startProcess) ctx.state.processes.push({ ...s.startProcess, pid, service: s.name });
  for (const l of s.listen ?? []) ctx.state.listeners.push({ ...l, pid, process: s.name });
  s.logs.push({ time: t, priority: 'info', message: `Started ${s.description}.` });
  return null;
}

function stopService(ctx: Parameters<CommandDef['run']>[2], s: Service) {
  if (s.mainPid) {
    ctx.state.processes = ctx.state.processes.filter((p) => p.service !== s.name);
    ctx.state.listeners = ctx.state.listeners.filter((l) => l.process !== s.name);
  }
  s.mainPid = undefined;
  s.active = 'inactive';
  s.logs.push({ time: '2026-11-04 14:30:00', priority: 'info', message: `Stopped ${s.description}.` });
}

const systemctl: CommandDef = {
  name: 'systemctl',
  summary: 'управление сервисами systemd: status, start, stop, restart, enable, disable, is-active, list-units --failed',
  usage: 'systemctl status|start|stop|restart|enable|is-active|list-units [сервис]',
  run(args, _s, ctx) {
    const pos = args.filter((x) => !x.startsWith('-'));
    const [action, name] = pos;
    if (!action) {
      return ok(joinLines(ctx.state.services.map((s) => `  ${(s.name + '.service').padEnd(28)} loaded ${s.active.padEnd(8)} ${s.active === 'active' ? 'running' : s.active === 'failed' ? 'failed ' : 'dead   '} ${s.description}`)));
    }
    if (action === 'list-units' || action === '--failed') {
      const list = args.includes('--failed') || args.includes('--state=failed') ? ctx.state.services.filter((s) => s.active === 'failed') : ctx.state.services;
      const head = '  UNIT                         LOAD   ACTIVE   SUB     DESCRIPTION\n';
      return ok(head + joinLines(list.map((s) => `${s.active === 'failed' ? '●' : ' '} ${(s.name + '.service').padEnd(28)} loaded ${s.active.padEnd(8)} ${s.active === 'active' ? 'running' : s.active === 'failed' ? 'failed ' : 'dead   '} ${s.description}`)) + `\n${list.length} loaded units listed.\n`);
    }
    if (action === 'daemon-reload') return ctx.user === 'root' ? ok() : fail('Failed to reload daemon: Access denied\n(Подсказка тренажёра: нужны права root — sudo)');
    if (!name) return fail(`Too few arguments.`);
    const s = findSvc(ctx, name);
    if (!s) {
      if (action === 'is-active') return { stdout: 'inactive\n', stderr: '', exitCode: 4 };
      return fail(`Unit ${name.replace(/\.service$/, '')}.service could not be found.`, action === 'status' ? 4 : 5);
    }
    const needRoot = ['start', 'stop', 'restart', 'enable', 'disable', 'reload'];
    if (needRoot.includes(action) && ctx.user !== 'root') {
      return fail(`Failed to ${action} ${s.name}.service: Access denied\nSee system logs and 'systemctl status ${s.name}.service' for details.\n(Подсказка тренажёра: нужны права root — sudo systemctl ${action} ${s.name})`, 1);
    }
    switch (action) {
      case 'status': {
        const dot = s.active === 'active' ? '\x1b[32m●\x1b[0m' : s.active === 'failed' ? '\x1b[31m×\x1b[0m' : '○';
        const sub = s.active === 'active' ? 'active (running)' : s.active === 'failed' ? 'failed (Result: exit-code)' : 'inactive (dead)';
        let out = `${dot} ${s.name}.service - ${s.description}\n`;
        out += `     Loaded: loaded (/lib/systemd/system/${s.name}.service; ${s.enabled ? 'enabled' : 'disabled'}; preset: enabled)\n`;
        out += `     Active: ${sub}${s.since ? ' since ' + s.since : ''}\n`;
        if (s.mainPid) {
          const p = ctx.state.processes.find((x) => x.pid === s.mainPid);
          out += `   Main PID: ${s.mainPid} (${s.name})\n`;
          if (p) out += `     Memory: ${(p.rss / 1024).toFixed(1)}M\n`;
        }
        out += '\n' + joinLines(s.logs.slice(-6).map((l) => `${l.time.slice(5).replace('-', ' ').replace(/^(\d\d) (\d\d)/, (_m, mo, d) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+mo - 1] + ' ' + d)} ${ctx.state.host} ${s.name}[${s.mainPid ?? 1234}]: ${l.message}`));
        return { stdout: out, stderr: '', exitCode: s.active === 'active' ? 0 : 3 };
      }
      case 'is-active':
        return { stdout: s.active + '\n', stderr: '', exitCode: s.active === 'active' ? 0 : 3 };
      case 'is-enabled':
        return { stdout: (s.enabled ? 'enabled' : 'disabled') + '\n', stderr: '', exitCode: s.enabled ? 0 : 1 };
      case 'start': {
        if (s.active === 'active') return ok();
        const e = startService(ctx, s);
        return e ? fail(e) : ok();
      }
      case 'stop':
        stopService(ctx, s);
        return ok();
      case 'restart':
      case 'reload': {
        stopService(ctx, s);
        const e = startService(ctx, s);
        return e ? fail(e) : ok();
      }
      case 'enable':
        s.enabled = true;
        return ok(`Created symlink /etc/systemd/system/multi-user.target.wants/${s.name}.service → /lib/systemd/system/${s.name}.service.\n`);
      case 'disable':
        s.enabled = false;
        return ok(`Removed "/etc/systemd/system/multi-user.target.wants/${s.name}.service".\n`);
      default:
        return fail(`Unknown command verb '${action}'.`);
    }
  },
};

const PRIOS = ['emerg', 'alert', 'crit', 'err', 'warning', 'notice', 'info', 'debug'];

const journalctl: CommandDef = {
  name: 'journalctl',
  summary: 'журнал systemd: -u сервис, -n N последних, --since "1 hour ago" / "2026-11-04 10:00", -p err (уровень и выше), -f следить, -x пояснения, -e в конец',
  usage: 'journalctl [-u сервис] [-n N] [--since время] [-p уровень]',
  run(args, _s, ctx) {
    let unit: string | undefined;
    let n: number | undefined;
    let since: string | undefined;
    let until: string | undefined;
    let prio: string | undefined;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-u' || a === '--unit') unit = args[++i];
      else if (a.startsWith('--unit=')) unit = a.slice(7);
      else if (a === '-n' || a === '--lines') n = parseInt(args[++i], 10);
      else if (/^-n\d+$/.test(a)) n = parseInt(a.slice(2), 10);
      else if (a === '--since' || a === '-S') since = args[++i];
      else if (a.startsWith('--since=')) since = a.slice(8);
      else if (a === '--until' || a === '-U') until = args[++i];
      else if (a === '-p' || a === '--priority') prio = args[++i];
      else if (a.startsWith('-p') && a.length > 2) prio = a.slice(2);
      else if (/^-[xefr]+$/.test(a) || a === '--no-pager') continue;
      else if (/^-[a-z]*u$/.test(a)) unit = args[++i]; // -xeu nginx
      else return fail(`journalctl: unrecognized option '${a}'`);
    }
    const svcs = unit ? ctx.state.services.filter((s) => s.name === unit!.replace(/\.service$/, '')) : ctx.state.services;
    if (unit && !svcs.length) return ok('-- No entries --\n');
    let entries = svcs.flatMap((s) => s.logs.map((l) => ({ ...l, svc: s.name, pid: s.mainPid ?? 1234 })));
    entries.sort((a, b) => a.time.localeCompare(b.time));
    const parseTime = (v: string): string => {
      const now = ctx.state.now.getTime();
      const m = /^(\d+)\s*(hour|hours|min|minutes|minute|day|days|h|m|d)\s*ago$/.exec(v.trim());
      let t: Date;
      if (m) {
        const k = m[2].startsWith('h') ? 3600e3 : m[2].startsWith('d') ? 86400e3 : 60e3;
        t = new Date(now - parseInt(m[1], 10) * k);
      } else if (v === 'today') t = new Date(new Date(now).setHours(0, 0, 0, 0));
      else if (v === 'yesterday') t = new Date(new Date(now).setHours(0, 0, 0, 0) - 86400e3);
      else if (/^\d\d:\d\d(:\d\d)?$/.test(v)) return '2026-11-04 ' + (v.length === 5 ? v + ':00' : v);
      else return v.length === 10 ? v + ' 00:00:00' : v.length === 16 ? v + ':00' : v;
      const p2 = (x: number) => String(x).padStart(2, '0');
      return `${t.getFullYear()}-${p2(t.getMonth() + 1)}-${p2(t.getDate())} ${p2(t.getHours())}:${p2(t.getMinutes())}:${p2(t.getSeconds())}`;
    };
    if (since) {
      const s = parseTime(since);
      entries = entries.filter((e) => e.time >= s);
    }
    if (until) {
      const u = parseTime(until);
      entries = entries.filter((e) => e.time <= u);
    }
    if (prio) {
      const lvl = /^\d$/.test(prio) ? parseInt(prio, 10) : PRIOS.indexOf(prio.replace('error', 'err').replace('warn', 'warning'));
      if (lvl < 0) return fail(`Failed to parse priority value: ${prio}`);
      entries = entries.filter((e) => PRIOS.indexOf(e.priority) <= lvl);
    }
    if (n !== undefined) entries = entries.slice(-n);
    if (!entries.length) return ok('-- No entries --\n');
    const mons = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return ok(
      joinLines(
        entries.map((e) => {
          const [d, t] = e.time.split(' ');
          const [, mo, dd] = d.split('-');
          const color = PRIOS.indexOf(e.priority) <= 3 ? '\x1b[31m' : e.priority === 'warning' ? '\x1b[33m' : '';
          return `${mons[+mo - 1]} ${dd} ${t} ${ctx.state.host} ${e.svc}[${e.pid}]: ${color}${e.message}${color ? '\x1b[0m' : ''}`;
        }),
      ),
    );
  },
};

export default [systemctl, journalctl];
