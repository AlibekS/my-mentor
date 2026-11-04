import type { KubeDeployment, KubePod, KubePodSpec, KubeState } from './types';

/** Детерминированный «хеш» для имён подов */
function hash(s: string, len: number): string {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const abc = 'bcdfghjklmnpqrstvwxz2456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += abc[Math.abs(h) % abc.length];
    h = Math.imul(h ^ (i + 7), 16777619);
  }
  return out;
}

export const memMi = (v?: string): number => {
  if (!v) return 0;
  const m = /^(\d+(?:\.\d+)?)(Mi|Gi|M|G)?$/.exec(v.trim());
  if (!m) return 0;
  const n = parseFloat(m[1]);
  return m[2]?.startsWith('G') ? n * 1024 : n;
};

export function behaviorFor(d: KubeDeployment): KubePodSpec {
  for (const b of d.behaviors) {
    if (b.image && b.image !== d.image) continue;
    if (b.memoryLimitAtLeastMi !== undefined && memMi(d.memoryLimit) < b.memoryLimitAtLeastMi) continue;
    if (b.envHas && !(d.env && b.envHas in d.env)) continue;
    return b.spec;
  }
  return { status: 'Running', ready: '1/1', restarts: 0 };
}

/** Пересоздать поды деплоймента (rollout restart / смена образа / undo) */
export function rolloutPods(k: KubeState, d: KubeDeployment, age = '5s') {
  const ns = d.namespace ?? k.namespace ?? 'default';
  k.pods = k.pods.filter((p) => !(p.deployment === d.name && (p.namespace ?? k.namespace ?? 'default') === ns));
  const spec = behaviorFor(d);
  const rs = hash(d.name + d.image + (d.memoryLimit ?? '') + JSON.stringify(d.env ?? {}), 10);
  for (let i = 0; i < d.replicas; i++) {
    k.counter = (k.counter ?? 0) + 1;
    k.pods.push({
      ...structuredClone(spec),
      ready: spec.ready ?? (spec.status === 'Running' ? '1/1' : '0/1'),
      restarts: spec.restarts ?? 0,
      name: `${d.name}-${rs}-${hash(d.name + k.counter, 5)}`,
      namespace: ns,
      deployment: d.name,
      image: d.image,
      node: `worker-${(k.counter % 3) + 1}`,
      age,
      ip: `10.244.${(k.counter % 3) + 1}.${10 + (k.counter % 200)}`,
      memoryLimit: d.memoryLimit,
      env: d.env,
    });
  }
}

/** Под принадлежит деплойменту: совпадают имя и namespace (checkout в prod ≠ checkout в staging) */
export const podOf = (k: KubeState, d: KubeDeployment) => (p: KubePod) =>
  p.deployment === d.name && (p.namespace ?? k.namespace ?? 'default') === (d.namespace ?? k.namespace ?? 'default');

export function initKube(k: KubeState) {
  for (const d of k.deployments ?? []) {
    if (!d.history?.length) d.history = [{ image: d.image }];
    if (!k.pods.some(podOf(k, d))) rolloutPods(k, d, '3d');
  }
}

export function readyCount(k: KubeState, d: KubeDeployment): number {
  return k.pods.filter((p) => podOf(k, d)(p) && p.status === 'Running' && (p.ready ?? '1/1').startsWith('1')).length;
}

export function describePod(p: KubePod, k: KubeState): string {
  if (p.describe) return p.describe;
  const dep = k.deployments?.find((d) => d.name === p.deployment);
  const waiting = p.status !== 'Running' && p.status !== 'Completed';
  // под не назначен ни на один узел (FailedScheduling) — ни узла, ни IP
  const unscheduled = p.status === 'Pending' && (p.events ?? []).some((e) => /FailedScheduling/.test(e));
  const state = p.status === 'Running' ? `Running\n      Started:      Wed, 04 Nov 2026 14:${p.age === '5s' ? '30' : '00'}:00 +0500` : p.status === 'Pending' ? (/FailedScheduling/.test((p.events ?? []).join(' ')) ? 'Waiting\n      Reason:       Pending' : 'Waiting\n      Reason:       ContainerCreating') : `Waiting\n      Reason:       ${p.status}`;
  const last = p.lastReason ? `\n    Last State:     Terminated\n      Reason:       ${p.lastReason}\n      Exit Code:    ${p.exitCode ?? 1}\n      Started:      Wed, 04 Nov 2026 14:29:31 +0500\n      Finished:     Wed, 04 Nov 2026 14:29:33 +0500` : '';
  const env = Object.entries(p.env ?? dep?.env ?? {}).map(([kk, v]) => `      ${kk}:  ${v}`).join('\n');
  const events = p.events?.length ? p.events.map((e) => `  ${e}`).join('\n') : waiting ? '  Warning  BackOff  30s (x12 over 6m)  kubelet  Back-off restarting failed container' : '  Normal   Started  2m  kubelet  Started container';
  return `Name:             ${p.name}
Namespace:        ${p.namespace ?? 'default'}
Node:             ${unscheduled ? '<none>' : `${p.node ?? 'worker-1'}/10.0.5.1${(p.node ?? '1').slice(-1)}`}
Status:           ${p.status === 'Running' || p.status === 'Pending' ? p.status : 'Running'}
IP:               ${unscheduled ? '' : p.ip ?? '10.244.1.10'}
Controlled By:    ${p.deployment ? `ReplicaSet/${p.name.split('-').slice(0, -1).join('-')}` : '<none>'}
Containers:
  ${dep?.container ?? p.deployment ?? 'app'}:
    Image:          ${p.image ?? dep?.image ?? 'unknown'}
    State:          ${state}${last}
    Ready:          ${p.status === 'Running' ? 'True' : 'False'}
    Restart Count:  ${p.restarts ?? 0}
    Limits:
      memory:  ${p.memoryLimit ?? dep?.memoryLimit ?? '<none>'}
    Environment:
${env || '      <none>'}
Conditions:
  Type              Status
  Ready             ${p.status === 'Running' ? 'True' : 'False'}
Events:
  Type     Reason   Age   From     Message
  ----     ------   ----  ----     -------
${events}
${p.message ? `\nMessage: ${p.message}` : ''}`.replace(/\n+$/, '\n');
}
