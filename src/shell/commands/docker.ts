import { fail, ok, type CommandDef, type Container } from '../types';
import { joinLines } from '../args';

function find(cs: Container[], n?: string) {
  return n ? cs.find((c) => c.name === n || c.id.startsWith(n)) : undefined;
}

const nf = (n?: string) => fail(`Error response from daemon: No such container: ${n ?? ''}`);

const docker: CommandDef = {
  name: 'docker',
  summary: 'контейнеры (симуляция): ps [-a], logs [--tail N], inspect [--format], exec, restart/start/stop, stats --no-stream, images, system df, rm, image prune',
  usage: 'docker ps|logs|inspect|exec|restart|stats|images|system df …',
  run(args, _s, ctx) {
    const st = ctx.state.docker;
    const cs = st.containers;
    const [sub, ...rest] = args;
    if (ctx.user !== 'root' && !(ctx.fs.groups[ctx.user] ?? []).includes('docker') && sub && sub !== '--version' && sub !== 'version')
      return fail('permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock\n(Подсказка тренажёра: используй sudo docker …)');
    switch (sub) {
      case '--version':
      case 'version':
        return ok('Docker version 27.3.1, build ce12230\n');
      case 'ps': {
        const all = rest.includes('-a') || rest.includes('--all');
        const fIdx = rest.indexOf('--filter');
        const filt = fIdx >= 0 ? rest[fIdx + 1] : rest.find((r) => r.startsWith('--filter='))?.slice(9);
        let list = all ? cs : cs.filter((c) => /^(Up|Restarting)/.test(c.status));
        if (filt?.startsWith('status=')) {
          const v = filt.slice(7);
          list = cs.filter((c) => (v === 'running' ? c.status.startsWith('Up') : v === 'exited' ? c.status.startsWith('Exited') : v === 'restarting' ? c.status.startsWith('Restarting') : true));
        }
        if (filt?.startsWith('name=')) list = list.filter((c) => c.name.includes(filt.slice(5)));
        if (rest.includes('-q')) return ok(joinLines(list.map((c) => c.id.slice(0, 12))));
        return ok('CONTAINER ID   IMAGE                       STATUS                          PORTS                    NAMES\n' + joinLines(list.map((c) => `${c.id.slice(0, 12).padEnd(14)} ${c.image.padEnd(27)} ${c.status.padEnd(31)} ${(c.ports ?? '').padEnd(24)} ${c.name}`)));
      }
      case 'logs': {
        const name = rest.filter((x, i) => !x.startsWith('-') && !['--tail', '-n', '--since'].includes(rest[i - 1]))[0];
        const c = find(cs, name);
        if (!c) return nf(name);
        const ti = Math.max(rest.indexOf('--tail'), rest.indexOf('-n'));
        let l = (c.logs ?? '').split('\n').filter(Boolean);
        if (ti >= 0) l = l.slice(-parseInt(rest[ti + 1], 10));
        // docker logs пишет stdout контейнера в stdout, а stderr — в stderr; для простоты всё в stdout
        return ok(joinLines(l));
      }
      case 'inspect': {
        const fi = rest.findIndex((r) => r === '--format' || r === '-f');
        const fmt = fi >= 0 ? rest[fi + 1] : rest.find((r) => r.startsWith('--format='))?.slice(9);
        const name = rest.filter((x, i) => !x.startsWith('-') && i !== fi + 1 || (fi < 0 && !x.startsWith('-')))[0];
        const c = find(cs, name);
        if (!c) return fail(`Error: No such object: ${name ?? ''}`);
        const status = c.status.startsWith('Up') ? 'running' : c.status.startsWith('Restarting') ? 'restarting' : 'exited';
        const exitCode = c.exitCode ?? (/Exited \((\d+)\)/.exec(c.status)?.[1] ? parseInt(/Exited \((\d+)\)/.exec(c.status)![1], 10) : 0);
        const data = {
          Id: c.id,
          Name: '/' + c.name,
          RestartCount: c.restartCount ?? 0,
          State: { Status: status, Running: status === 'running', OOMKilled: !!c.oomKilled, ExitCode: exitCode, Restarting: status === 'restarting' },
          Config: { Image: c.image, Env: Object.entries(c.env ?? {}).map(([k, v]) => `${k}=${v}`) },
          HostConfig: { Memory: (c.memLimitMb ?? 0) * 1024 * 1024, RestartPolicy: { Name: 'unless-stopped' } },
        };
        if (fmt) {
          const out = fmt.replace(/\{\{\s*\.([\w.]+)\s*\}\}/g, (_m, path: string) => {
            let v: unknown = data;
            for (const k of path.split('.')) v = v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined;
            return Array.isArray(v) ? `[${v.join(' ')}]` : String(v ?? '<no value>');
          });
          return ok(out + '\n');
        }
        return ok(JSON.stringify([data], null, 4) + '\n');
      }
      case 'exec': {
        const pos = rest.filter((x) => !/^-(it|i|t|u)$/.test(x));
        const c = find(cs, pos[0]);
        if (!c) return nf(pos[0]);
        if (!c.status.startsWith('Up')) return fail(`Error response from daemon: container ${c.id.slice(0, 12)} is not running`);
        const cmd = pos.slice(1);
        if (!cmd.length) return fail('"docker exec" requires at least 2 arguments.');
        if (['sh', 'bash', '/bin/sh', '/bin/bash'].includes(cmd[0]) && cmd.length === 1)
          return ok(`\x1b[2m[тренажёр: интерактивный шелл в контейнере не эмулируется — укажи команду: docker exec ${c.name} env | cat <файл> | ls <каталог>]\x1b[0m\n`);
        if (cmd[0] === 'env' || cmd[0] === 'printenv') return ok(joinLines([`HOSTNAME=${c.id.slice(0, 12)}`, 'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin', ...Object.entries(c.env ?? {}).map(([k, v]) => `${k}=${v}`)]));
        if (cmd[0] === 'cat') {
          const f = c.files?.[cmd[1]];
          return f !== undefined ? ok(f) : fail(`cat: ${cmd[1]}: No such file or directory`);
        }
        if (cmd[0] === 'ls') {
          const dir = (cmd[cmd.length - 1] ?? '/').replace(/\/$/, '');
          const names = Object.keys(c.files ?? {}).filter((p) => p.startsWith(dir + '/')).map((p) => p.slice(dir.length + 1).split('/')[0]);
          return ok(joinLines([...new Set(names)].sort()));
        }
        return fail(`OCI runtime exec failed: exec: "${cmd[0]}": executable file not found in $PATH (в тренажёре: env, cat, ls)`, 126);
      }
      case 'restart':
      case 'start':
      case 'stop': {
        const c = find(cs, rest[0]);
        if (!c) return nf(rest[0]);
        if (sub === 'stop') c.status = 'Exited (0) 1 second ago';
        else if (c.onStart) {
          c.status = c.onStart.status;
          if (c.onStart.logs) c.logs = (c.logs ?? '') + c.onStart.logs;
          if (c.onStart.exitCode !== undefined) c.exitCode = c.onStart.exitCode;
          c.restartCount = (c.restartCount ?? 0) + 1;
        } else {
          c.status = 'Up 1 second';
          c.exitCode = 0;
          c.oomKilled = false;
        }
        return ok(c.name + '\n');
      }
      case 'rm': {
        const force = rest.includes('-f');
        const c = find(cs, rest.filter((x) => !x.startsWith('-'))[0]);
        if (!c) return nf(rest[0]);
        if (c.status.startsWith('Up') && !force) return fail(`Error response from daemon: cannot remove container "/${c.name}": container is running: stop the container before removing or force remove`);
        st.containers = cs.filter((x) => x !== c);
        return ok(c.name + '\n');
      }
      case 'stats': {
        if (!rest.includes('--no-stream')) return fail('docker stats: в тренажёре только снимок — добавь --no-stream');
        const list = cs.filter((c) => c.status.startsWith('Up'));
        return ok('CONTAINER ID   NAME              CPU %     MEM USAGE / LIMIT     MEM %\n' + joinLines(list.map((c) => {
          const lim = c.memLimitMb ?? 7962;
          const used = c.memMb ?? 120;
          return `${c.id.slice(0, 12).padEnd(14)} ${c.name.padEnd(17)} ${(c.cpu ?? 0.5).toFixed(2).padStart(5)}%    ${(used + 'MiB / ' + (lim >= 1024 ? (lim / 1024).toFixed(2) + 'GiB' : lim + 'MiB')).padEnd(21)} ${((used / lim) * 100).toFixed(2)}%`;
        })));
      }
      case 'images': {
        const imgs = st.images ?? [];
        const list = rest.includes('-f') || rest.includes('--filter') ? imgs.filter((i) => i.dangling) : imgs;
        return ok('REPOSITORY              TAG          IMAGE ID       SIZE\n' + joinLines(list.map((i) => `${i.repo.padEnd(23)} ${i.tag.padEnd(12)} ${i.id.padEnd(14)} ${i.sizeMb >= 1024 ? (i.sizeMb / 1024).toFixed(1) + 'GB' : i.sizeMb + 'MB'}`)));
      }
      case 'system': {
        if (rest[0] === 'df') {
          const imgs = st.images ?? [];
          const isz = imgs.reduce((s, i) => s + i.sizeMb, 0);
          const rec = imgs.filter((i) => i.dangling).reduce((s, i) => s + i.sizeMb, 0);
          const csz = cs.reduce((s, c) => s + (c.sizeMb ?? 0), 0);
          const crec = cs.filter((c) => !c.status.startsWith('Up')).reduce((s, c) => s + (c.sizeMb ?? 0), 0);
          const g = (mb: number) => (mb >= 1024 ? (mb / 1024).toFixed(2) + 'GB' : mb + 'MB');
          return ok(`TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE\nImages          ${String(imgs.length).padEnd(9)} ${String(imgs.filter((i) => !i.dangling).length).padEnd(9)} ${g(isz).padEnd(9)} ${g(rec)}\nContainers      ${String(cs.length).padEnd(9)} ${String(cs.filter((c) => c.status.startsWith('Up')).length).padEnd(9)} ${g(csz).padEnd(9)} ${g(crec)}\n`);
        }
        if (rest[0] === 'prune') {
          if (!rest.includes('-f')) return fail('WARNING! This will remove all stopped containers and dangling images.\n(в тренажёре добавь -f для подтверждения)');
          const before = (st.images ?? []).filter((i) => i.dangling).reduce((s, i) => s + i.sizeMb, 0) + cs.filter((c) => !/^(Up|Restarting)/.test(c.status)).reduce((s, c) => s + (c.sizeMb ?? 0), 0);
          st.images = (st.images ?? []).filter((i) => !i.dangling);
          st.containers = cs.filter((c) => /^(Up|Restarting)/.test(c.status));
          return ok(`Total reclaimed space: ${before >= 1024 ? (before / 1024).toFixed(2) + 'GB' : before + 'MB'}\n`);
        }
        return fail(`docker system ${rest[0] ?? ''}: в тренажёре — df, prune -f`);
      }
      case 'image':
        if (rest[0] === 'prune') {
          if (!rest.includes('-f')) return fail('WARNING! This will remove all dangling images. (добавь -f)');
          const freed = (st.images ?? []).filter((i) => i.dangling).reduce((s, i) => s + i.sizeMb, 0);
          st.images = (st.images ?? []).filter((i) => !i.dangling);
          return ok(`Total reclaimed space: ${freed}MB\n`);
        }
        return fail('docker image: в тренажёре — prune -f');
      default:
        return fail(`docker: '${sub ?? ''}' is not a docker command.\nВ тренажёре: ps, logs, inspect, exec, restart, start, stop, rm, stats, images, system df/prune, image prune`);
    }
  },
};
export default docker;
