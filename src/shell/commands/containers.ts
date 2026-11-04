import { fail, ok, type CommandDef } from '../types';
import { joinLines } from '../args';

const docker: CommandDef = {
  name: 'docker',
  summary: 'контейнеры (симуляция): docker ps [-a], docker logs [--tail N] имя, docker restart имя, docker exec имя команда',
  usage: 'docker ps|logs|restart|exec ...',
  run(args, _s, ctx) {
    const [sub, ...rest] = args;
    const cs = ctx.state.docker.containers;
    const find = (n: string) => cs.find((c) => c.name === n || c.id.startsWith(n));
    switch (sub) {
      case 'ps': {
        const list = rest.includes('-a') ? cs : cs.filter((c) => c.status.startsWith('Up'));
        return ok('CONTAINER ID   IMAGE                  STATUS                     PORTS                NAMES\n' + joinLines(list.map((c) => `${c.id.slice(0, 12).padEnd(14)} ${c.image.padEnd(22)} ${c.status.padEnd(26)} ${(c.ports ?? '').padEnd(20)} ${c.name}`)));
      }
      case 'logs': {
        const name = rest.filter((x) => !x.startsWith('-') && !/^\d+$/.test(x))[0];
        const c = name && find(name);
        if (!c) return fail(`Error response from daemon: No such container: ${name ?? ''}`);
        const ti = rest.indexOf('--tail');
        const l = (c.logs ?? '').split('\n').filter(Boolean);
        return ok(joinLines(ti >= 0 ? l.slice(-parseInt(rest[ti + 1], 10)) : l));
      }
      case 'restart':
      case 'start':
      case 'stop': {
        const c = rest[0] && find(rest[0]);
        if (!c) return fail(`Error response from daemon: No such container: ${rest[0] ?? ''}`);
        c.status = sub === 'stop' ? 'Exited (0) 1 second ago' : 'Up 1 second';
        return ok(c.name + '\n');
      }
      case 'exec': {
        const opts = rest.filter((x) => x.startsWith('-'));
        const pos = rest.filter((x) => !x.startsWith('-'));
        const c = pos[0] && find(pos[0]);
        if (!c) return fail(`Error response from daemon: No such container: ${pos[0] ?? ''}`);
        if (!c.status.startsWith('Up')) return fail(`Error response from daemon: container ${c.id.slice(0, 12)} is not running`);
        void opts;
        const cmd = pos.slice(1);
        if (!cmd.length) return fail('"docker exec" requires at least 2 arguments.');
        if (cmd[0] === 'sh' || cmd[0] === 'bash') return ok(`\x1b[2m[тренажёр: интерактивный шелл в контейнере не эмулируется — укажите команду, например: docker exec ${c.name} env]\x1b[0m\n`);
        if (cmd[0] === 'env') return ok(`PATH=/usr/local/bin:/usr/bin\nHOSTNAME=${c.id.slice(0, 12)}\nAPP_ENV=production\n`);
        return ctx.exec(cmd, '');
      }
      default:
        return fail(`docker: '${sub ?? ''}' is not a docker command (в тренажёре: ps, logs, restart, start, stop, exec).`);
    }
  },
};

const kubectl: CommandDef = {
  name: 'kubectl',
  summary: 'Kubernetes (симуляция): kubectl get pods|svc|events, describe pod имя, logs имя [--previous], rollout restart deployment/имя',
  usage: 'kubectl get|describe|logs|rollout ...',
  run(args, _s, ctx) {
    const k = ctx.state.kube;
    const pos = args.filter((x, i) => !x.startsWith('-') && !(args[i - 1] === '-n' || args[i - 1] === '--tail'));
    const [sub, kind, name] = pos;
    switch (sub) {
      case 'get':
        if (/^(po|pod|pods)$/.test(kind ?? ''))
          return ok('NAME                              READY   STATUS             RESTARTS   AGE\n' + joinLines(k.pods.map((p) => `${p.name.padEnd(33)} ${p.ready.padEnd(7)} ${p.status.padEnd(18)} ${String(p.restarts).padEnd(10)} ${p.age}`)));
        if (/^(svc|service|services)$/.test(kind ?? ''))
          return ok('NAME         TYPE        CLUSTER-IP     PORT(S)    AGE\n' + joinLines((k.services ?? []).map((s) => `${s.name.padEnd(12)} ${s.type.padEnd(11)} ${s.clusterIp.padEnd(14)} ${s.ports.padEnd(10)} ${s.age}`)));
        if (/^(ev|event|events)$/.test(kind ?? '')) return ok('LAST SEEN   TYPE      REASON      OBJECT      MESSAGE\n' + joinLines(k.events ?? []));
        return fail(`error: the server doesn't have a resource type "${kind ?? ''}"`);
      case 'describe': {
        const p = k.pods.find((x) => x.name === name);
        if (!p) return fail(`Error from server (NotFound): pods "${name ?? ''}" not found`);
        return ok(p.describe ?? `Name: ${p.name}\nStatus: ${p.status}\n`);
      }
      case 'logs': {
        const p = k.pods.find((x) => x.name === kind);
        if (!p) return fail(`error: error from server (NotFound): pods "${kind ?? ''}" not found`);
        return ok(p.logs ?? '');
      }
      case 'rollout':
        if (kind === 'restart' && name) return ok(`${name.replace(/^deploy(ment)?\//, 'deployment.apps/')} restarted\n`);
        return fail('error: в тренажёре поддерживается kubectl rollout restart deployment/имя');
      default:
        return fail(`error: unknown command "${sub ?? ''}" for "kubectl"`);
    }
  },
};

export default [docker, kubectl];
