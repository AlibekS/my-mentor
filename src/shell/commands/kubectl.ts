import { fail, ok, type CommandDef, type KubeDeployment, type KubePod } from '../types';
import { joinLines } from '../args';
import { describePod, podOf, readyCount, rolloutPods } from '../kube';

/**
 * kubectl (симуляция). Состояние кластера — в сценарии: деплойменты с «поведением»
 * (какой статус получат поды при данном образе/лимитах/env), сервисы, события.
 */
const kubectl: CommandDef = {
  name: 'kubectl',
  summary: 'Kubernetes (симуляция): get pods|deploy|svc|endpoints|events|nodes, describe, logs [--previous], rollout restart|status|history|undo, scale, set image|resources|env, delete pod, top',
  usage: 'kubectl get|describe|logs|rollout|scale|set|delete|top … [-n namespace] [-A]',
  run(argsIn, _s, ctx) {
    const k = ctx.state.kube;
    // разбор флагов
    let ns = k.namespace ?? 'default';
    let allNs = false;
    let wide = false;
    let output = '';
    let tail: number | undefined;
    let previous = false;
    let replicas: number | undefined;
    let limits = '';
    let toRev: number | undefined;
    let selector: string | undefined;
    const pos: string[] = [];
    for (let i = 0; i < argsIn.length; i++) {
      const a = argsIn[i];
      if (a === '-n' || a === '--namespace') ns = argsIn[++i];
      else if (a.startsWith('--namespace=')) ns = a.slice(12);
      else if (a === '-A' || a === '--all-namespaces') allNs = true;
      else if (a === '-o' || a === '--output') output = argsIn[++i];
      else if (a.startsWith('-o=') || a.startsWith('--output=')) output = a.split('=')[1];
      else if (/^-o[a-z]/.test(a)) output = a.slice(2); // -owide
      else if (a === '-l' || a === '--selector') selector = argsIn[++i];
      else if (a.startsWith('--selector=') || a.startsWith('-l=')) selector = a.slice(a.indexOf('=') + 1);
      else if (/^-l\w/.test(a)) selector = a.slice(2);
      else if (a.startsWith('--previous=')) previous = a.endsWith('true');
      else if (/^-[it]+$/.test(a) || a === '--stdin' || a === '--tty' || a === '--all-containers' || a.startsWith('--all-containers=') || a === '--timestamps') continue;
      else if (a === '--tail') tail = parseInt(argsIn[++i], 10);
      else if (a.startsWith('--tail=')) tail = parseInt(a.slice(7), 10);
      else if (a === '-p' || a === '--previous') previous = true;
      else if (a.startsWith('--replicas=')) replicas = parseInt(a.slice(11), 10);
      else if (a === '--replicas') replicas = parseInt(argsIn[++i], 10);
      else if (a.startsWith('--limits=')) limits = a.slice(9);
      else if (a === '--limits') limits = argsIn[++i];
      else if (a.startsWith('--to-revision=')) toRev = parseInt(a.slice(14), 10);
      else if (a === '-f' || a === '--follow' || a === '-w' || a === '--watch' || a.startsWith('--sort-by') || a === '--') continue;
      else if (a === '-c' || a === '--container') i++;
      else pos.push(a);
    }
    if (output === 'wide') wide = true;
    wide ||= false;
    const inNs = <T extends { namespace?: string }>(x: T) => allNs || (x.namespace ?? 'default') === ns;
    const deps = (k.deployments ?? []).filter(inNs);
    // -l app=checkout — по метке app (в тренажёре метка = имя деплоймента)
    const selVal = selector?.replace(/^\s*app\s*=\s*/, '').trim();
    const pods = k.pods.filter(inNs).filter((p) => !selVal || p.deployment === selVal || p.name.startsWith(selVal + '-'));
    const findDep = (ref?: string): KubeDeployment | undefined => {
      if (!ref) return undefined;
      const name = ref.replace(/^(deployment|deploy|deployments)(\.apps)?\//, '');
      return deps.find((d) => d.name === name);
    };
    const notFound = (kind: string, name?: string) => fail(`Error from server (NotFound): ${kind} "${name ?? ''}" not found`);
    if (pos[0] === 'events') pos.splice(0, 1, 'get', 'events');
    const [sub, a1, a2] = pos;

    switch (sub) {
      case 'get': {
        const kind = (a1 ?? '').toLowerCase();
        const nsCol = allNs ? 'NAMESPACE     ' : '';
        const nsVal = (x: { namespace?: string }) => (allNs ? (x.namespace ?? 'default').padEnd(14) : '');
        if (/^(po|pod|pods)$/.test(kind)) {
          const list = a2 ? pods.filter((p) => p.name === a2) : pods;
          if (a2 && !list.length) return notFound('pods', a2);
          if (!list.length) return ok(`No resources found in ${ns} namespace.\n`);
          return ok(
            `${nsCol}NAME                                READY   STATUS             RESTARTS   AGE${wide ? '   IP             NODE' : ''}\n` +
              joinLines(list.map((p) => `${nsVal(p)}${p.name.padEnd(35)} ${(p.ready ?? '1/1').padEnd(7)} ${p.status.padEnd(18)} ${String(p.restarts ?? 0).padEnd(10)} ${p.age}${wide ? `   ${(p.ip ?? '').padEnd(14)} ${p.node ?? ''}` : ''}`)),
          );
        }
        if (/^(deploy|deployment|deployments)$/.test(kind)) {
          if (!deps.length) return ok(`No resources found in ${ns} namespace.\n`);
          return ok(`${nsCol}NAME              READY   UP-TO-DATE   AVAILABLE   AGE${wide ? '   IMAGES' : ''}\n` + joinLines(deps.map((d) => `${nsVal(d)}${d.name.padEnd(17)} ${`${readyCount(k, d)}/${d.replicas}`.padEnd(7)} ${String(d.replicas).padEnd(12)} ${String(readyCount(k, d)).padEnd(11)} 12d${wide ? `   ${d.image}` : ''}`)));
        }
        if (/^(svc|service|services)$/.test(kind)) {
          const svcs = (k.services ?? []).filter(inNs);
          return ok(`${nsCol}NAME              TYPE           CLUSTER-IP      PORT(S)          AGE\n` + joinLines(svcs.map((s) => `${nsVal(s)}${s.name.padEnd(17)} ${s.type.padEnd(14)} ${s.clusterIp.padEnd(15)} ${s.ports.padEnd(16)} ${s.age}`)));
        }
        if (/^(ep|endpoints)$/.test(kind)) {
          const svcs = (k.services ?? []).filter(inNs).filter((s) => !a2 || s.name === a2);
          return ok('NAME              ENDPOINTS                         AGE\n' + joinLines(svcs.map((s) => {
            const sel = s.selector?.replace(/^app=/, '');
            const port = /^(\d+)/.exec(s.ports)?.[1] ?? '80';
            const eps = pods.filter((p) => p.deployment === sel && p.status === 'Running' && (p.ready ?? '1/1').startsWith('1')).map((p) => `${p.ip}:${port}`);
            return `${s.name.padEnd(17)} ${(eps.length ? eps.slice(0, 3).join(',') + (eps.length > 3 ? ` + ${eps.length - 3} more...` : '') : '<none>').padEnd(33)} ${s.age}`;
          })));
        }
        if (/^(ev|event|events)$/.test(kind)) {
          const ev = [...(k.events ?? []), ...pods.flatMap((p) => (p.events ?? []).map((e) => {
            const [type, reason, ...rest] = e.split(/\s{2,}/);
            return `${(rest[0] ?? '1m').padEnd(11)} ${(type ?? 'Normal').padEnd(9)} ${(reason ?? '').padEnd(18)} pod/${p.name.padEnd(30)} ${rest.slice(2).join(' ') || rest.slice(1).join(' ')}`;
          }))];
          if (!ev.length) return ok(`No resources found in ${ns} namespace.\n`);
          return ok('LAST SEEN   TYPE      REASON             OBJECT                              MESSAGE\n' + joinLines(ev));
        }
        if (/^(no|node|nodes)$/.test(kind)) {
          return ok('NAME       STATUS   ROLES    AGE   VERSION\n' + joinLines((k.nodes ?? [{ name: 'worker-1', status: 'Ready', cpu: '4', memory: '16Gi' }]).map((n) => `${n.name.padEnd(10)} ${n.status.padEnd(8)} <none>   90d   v1.31.2`)));
        }
        if (/^(ns|namespace|namespaces)$/.test(kind)) {
          const all = new Set(['default', 'kube-system', ...k.pods.map((p) => p.namespace ?? 'default'), ...(k.deployments ?? []).map((d) => d.namespace ?? 'default')]);
          return ok('NAME          STATUS   AGE\n' + joinLines([...all].map((n) => `${n.padEnd(13)} Active   90d`)));
        }
        return fail(`error: the server doesn't have a resource type "${a1 ?? ''}"`);
      }
      case 'describe': {
        const kind = (a1 ?? '').toLowerCase();
        let name = a2;
        let kk = kind;
        if (kind.includes('/')) [kk, name] = kind.split('/');
        if (/^(po|pod|pods)$/.test(kk)) {
          if (!name) return pods.length ? ok(pods.map((x) => describePod(x, k)).join('\n\n')) : ok(`No resources found in ${ns} namespace.\n`);
          const p = pods.find((x) => x.name === name);
          return p ? ok(describePod(p, k)) : notFound('pods', name);
        }
        if (/^(svc|service|services)$/.test(kk)) {
          const sv = (k.services ?? []).filter(inNs).find((x) => x.name === name);
          if (!sv) return notFound('services', name);
          const sel = sv.selector?.replace(/^app=/, '');
          const port = /^(\d+)/.exec(sv.ports)?.[1] ?? '80';
          const eps = pods.filter((p) => p.deployment === sel && p.status === 'Running' && (p.ready ?? '1/1').startsWith('1')).map((p) => `${p.ip}:${port}`);
          return ok(`Name:              ${sv.name}\nNamespace:         ${sv.namespace ?? 'default'}\nSelector:          ${sv.selector ?? '<none>'}\nType:              ${sv.type}\nIP:                ${sv.clusterIp}\nPort:              <unset>  ${sv.ports}\nEndpoints:         ${eps.join(',') || '<none>'}\n`);
        }
        if (/^(deploy|deployment|deployments)$/.test(kk)) {
          const d = findDep(name);
          if (!d) return notFound('deployments.apps', name);
          return ok(`Name:               ${d.name}\nNamespace:          ${d.namespace ?? 'default'}\nReplicas:           ${d.replicas} desired | ${d.replicas} updated | ${d.replicas} total | ${readyCount(k, d)} available | ${d.replicas - readyCount(k, d)} unavailable\nPod Template:\n  Containers:\n   ${d.container ?? d.name}:\n    Image:      ${d.image}\n    Limits:\n      memory:  ${d.memoryLimit ?? '<none>'}\n    Environment:\n${Object.entries(d.env ?? {}).map(([a, b]) => `      ${a}:  ${b}`).join('\n') || '      <none>'}\nEvents:\n  Normal  ScalingReplicaSet  5m  deployment-controller  Scaled up replica set\n`);
        }
        return fail(`error: the server doesn't have a resource type "${a1 ?? ''}"`);
      }
      case 'logs': {
        let p: KubePod | undefined;
        if (a1?.includes('/')) {
          const d = findDep(a1);
          p = d && pods.find(podOf(k, d));
        } else if (!a1 && selVal) {
          // kubectl logs -l app=x — по первому подходящему поду (в жизни — по всем)
          const all = pods.filter((x) => !previous || x.previousLogs);
          if (!all.length) return ok('');
          const parts = all.map((x) => (previous ? x.previousLogs : x.logs) ?? '').filter(Boolean);
          let l = parts.join('\n').split('\n').filter(Boolean);
          if (tail !== undefined) l = l.slice(-tail);
          return ok(joinLines(l));
        } else p = pods.find((x) => x.name === a1);
        if (!p) return notFound('pods', a1);
        if (previous && !p.previousLogs) return fail(`Error from server (BadRequest): previous terminated container "${p.deployment ?? 'app'}" in pod "${p.name}" not found`);
        if (!previous && p.status === 'ImagePullBackOff') return fail(`Error from server (BadRequest): container "${p.deployment ?? 'app'}" in pod "${p.name}" is waiting to start: trying and failing to pull image`);
        let l = (previous ? p.previousLogs : p.logs ?? '')!.split('\n').filter(Boolean);
        if (tail !== undefined) l = l.slice(-tail);
        return ok(joinLines(l));
      }
      case 'rollout': {
        const d = findDep(a2 && a1 && !a1.includes('/') && /^(deploy|deployment)$/.test(a2) ? pos[3] : a2);
        const dd = d ?? findDep(pos[3]);
        if (!dd) return notFound('deployments.apps', a2);
        if (a1 === 'restart') {
          rolloutPods(k, dd);
          return ok(`deployment.apps/${dd.name} restarted\n`);
        }
        if (a1 === 'status') {
          const r = readyCount(k, dd);
          if (r === dd.replicas) return ok(`deployment "${dd.name}" successfully rolled out\n`);
          return { stdout: `Waiting for deployment "${dd.name}" rollout to finish: ${r} of ${dd.replicas} updated replicas are available...\nerror: deployment "${dd.name}" exceeded its progress deadline\n`, stderr: '', exitCode: 1 };
        }
        if (a1 === 'history') {
          const h = dd.history ?? [{ image: dd.image }];
          return ok(`deployment.apps/${dd.name}\nREVISION  CHANGE-CAUSE\n` + joinLines(h.map((x, i) => `${String(i + 1).padEnd(9)} ${x.cause ?? `image=${x.image}`}`)));
        }
        if (a1 === 'undo') {
          const h = dd.history ?? [];
          const target = toRev ? h[toRev - 1] : h[h.length - 2];
          if (!target) return fail(`error: no rollout history found for deployment "${dd.name}"`);
          dd.image = target.image;
          h.push({ image: target.image, cause: `rollback to ${toRev ? `revision ${toRev}` : 'previous revision'} (image=${target.image})` });
          rolloutPods(k, dd);
          return ok(`deployment.apps/${dd.name} rolled back\n`);
        }
        return fail(`error: unknown command "rollout ${a1 ?? ''}" (в тренажёре: restart, status, history, undo)`);
      }
      case 'scale': {
        const d = findDep(a1?.includes('/') ? a1 : a2 ?? a1);
        if (!d) return notFound('deployments.apps', a1);
        if (replicas === undefined || Number.isNaN(replicas)) return fail('error: required flag(s) "replicas" not set');
        d.replicas = replicas;
        const mine = podOf(k, d);
        const spec = k.pods.filter(mine);
        if (spec.length > replicas) k.pods = k.pods.filter((p) => !(mine(p) && spec.indexOf(p) >= replicas));
        else if (spec.length < replicas) {
          const keep = k.pods.filter(mine);
          rolloutPods(k, d);
          const fresh = k.pods.filter(mine).slice(keep.length);
          k.pods = [...k.pods.filter((p) => !mine(p)), ...keep, ...fresh];
        }
        return ok(`deployment.apps/${d.name} scaled\n`);
      }
      case 'set': {
        const what = a1;
        const d = findDep(a2?.includes('/') ? a2 : pos[3] ?? a2);
        if (!d) return notFound('deployments.apps', a2);
        const kv = pos.filter((x) => x.includes('=') && !x.startsWith('-'));
        if (what === 'image') {
          const img = kv[0]?.split('=').slice(1).join('=');
          if (!img) return fail('error: at least one image update is required');
          d.image = img;
          (d.history ??= []).push({ image: img });
        } else if (what === 'resources') {
          const m = /memory=([\w.]+)/.exec(limits);
          if (!m) return fail('error: you must specify an update to requests or limits (e.g. --limits=memory=512Mi)');
          d.memoryLimit = m[1];
          (d.history ??= []).push({ image: d.image, cause: `limits memory=${m[1]}` });
        } else if (what === 'env') {
          d.env = { ...(d.env ?? {}) };
          for (const x of kv) {
            const [kk, ...v] = x.split('=');
            if (kk.endsWith('-')) delete d.env[kk.slice(0, -1)];
            else d.env[kk] = v.join('=');
          }
          (d.history ??= []).push({ image: d.image, cause: `env ${kv.join(' ')}` });
        } else return fail(`error: unknown command "set ${what ?? ''}" (в тренажёре: image, resources, env)`);
        rolloutPods(k, d);
        return ok(`deployment.apps/${d.name} ${what === 'image' ? 'image updated' : what === 'resources' ? 'resource requirements updated' : 'env updated'}\n`);
      }
      case 'delete': {
        const name = a1?.includes('/') ? a1.split('/')[1] : a2;
        const p = pods.find((x) => x.name === name);
        if (!p) return notFound('pods', name);
        k.pods = k.pods.filter((x) => x !== p);
        const d = (k.deployments ?? []).find((x) => x.name === p.deployment && (x.namespace ?? k.namespace ?? 'default') === (p.namespace ?? k.namespace ?? 'default'));
        if (d) {
          // контроллер создаёт замену
          const mine = podOf(k, d);
          const others = k.pods.filter(mine);
          const before = d.replicas;
          d.replicas = 1;
          const saved = k.pods;
          k.pods = k.pods.filter((x) => !mine(x));
          rolloutPods(k, d);
          const fresh = k.pods.filter(mine);
          k.pods = [...saved, ...fresh];
          d.replicas = before;
          void others;
        }
        return ok(`pod "${p.name}" deleted\n`);
      }
      case 'top': {
        if (/^(po|pod|pods)$/.test(a1 ?? '')) return ok('NAME                                CPU(cores)   MEMORY(bytes)\n' + joinLines(pods.filter((p) => p.status === 'Running').map((p) => `${p.name.padEnd(35)} ${String(p.cpuM ?? 12).padStart(4)}m        ${String(p.memoryMi ?? 180).padStart(5)}Mi`)));
        if (/^(no|node|nodes)$/.test(a1 ?? '')) return ok('NAME       CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%\n' + joinLines((k.nodes ?? []).map((n) => `${n.name.padEnd(10)} ${n.cpu.padEnd(12)} ${String(n.cpuPct ?? 30).padStart(3)}%   ${n.memory.padEnd(15)} ${n.memPct ?? 50}%`)));
        return fail('error: в тренажёре: kubectl top pods | top nodes');
      }
      case 'exec': {
        const dx = a1?.includes('/') ? findDep(a1) : undefined;
        const p = pods.find((x) => x.name === a1) ?? (dx ? pods.find(podOf(k, dx)) : undefined);
        if (!p) return notFound('pods', a1);
        if (p.status !== 'Running') return fail(`error: unable to upgrade connection: container not found ("${p.deployment ?? 'app'}")`);
        const cmd = argsIn.slice(argsIn.indexOf('--') + 1);
        if (cmd[0] === 'env' || cmd[0] === 'printenv') return ok(joinLines([`HOSTNAME=${p.name}`, ...Object.entries(p.env ?? {}).map(([a, b]) => `${a}=${b}`)]));
        return fail('в тренажёре внутри пода доступна только команда env: kubectl exec POD -- env');
      }
      case 'config':
        if (a1 === 'current-context') return ok('prod-eu-1\n');
        if (a1 === 'get-contexts') return ok('CURRENT   NAME         CLUSTER      AUTHINFO     NAMESPACE\n*         prod-eu-1    prod-eu-1    l3-support   ' + (k.namespace ?? 'default') + '\n          staging-1    staging-1    l3-support   default\n');
        if (a1 === 'view') return ok(`apiVersion: v1\nkind: Config\ncurrent-context: prod-eu-1\n`);
        return fail('в тренажёре: kubectl config current-context | get-contexts');
      default:
        return fail(`error: unknown command "${sub ?? ''}" for "kubectl"`);
    }
  },
};
export default kubectl;
