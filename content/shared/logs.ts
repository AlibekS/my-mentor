/**
 * Генераторы реалистичных, но детерминированных логов для сценариев.
 * Детерминированность важна: ответы в заданиях фиксированы.
 */

/** Псевдослучайный генератор с seed (mulberry32) */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

export interface AccessEntry {
  ip: string;
  time: string; // HH:MM:SS
  method: string;
  path: string;
  status: number;
  bytes: number;
  ua?: string;
  rt?: number;
}

export function accessLine(e: AccessEntry, date = '04/Nov/2026'): string {
  return `${e.ip} - - [${date}:${e.time} +0500] "${e.method} ${e.path} HTTP/1.1" ${e.status} ${e.bytes} "-" "${e.ua ?? 'Mozilla/5.0'}"${e.rt !== undefined ? ` rt=${e.rt.toFixed(3)}` : ''}`;
}

/**
 * Сгенерировать access.log между from и to (секунды от полуночи).
 * override(e, sec) позволяет «впрыснуть» инцидент.
 */
export function genAccess(opts: {
  seed: number;
  from: number;
  to: number;
  step: [number, number];
  ips?: string[];
  paths?: [string, string][];
  override?: (e: AccessEntry, sec: number, r: () => number) => AccessEntry | null;
}): AccessEntry[] {
  const r = rng(opts.seed);
  const ips = opts.ips ?? ['10.20.1.14', '10.20.1.15', '172.16.4.21', '172.16.4.22', '185.12.40.7', '91.204.8.33', '37.150.2.11', '2.133.91.4'];
  const paths = opts.paths ?? [
    ['GET', '/'],
    ['GET', '/api/products'],
    ['GET', '/api/products/42'],
    ['POST', '/api/cart'],
    ['GET', '/api/cart'],
    ['POST', '/api/checkout'],
    ['GET', '/static/app.js'],
    ['GET', '/health'],
  ];
  const out: AccessEntry[] = [];
  for (let sec = opts.from; sec < opts.to; sec += opts.step[0] + Math.floor(r() * (opts.step[1] - opts.step[0] + 1))) {
    const [method, path] = paths[Math.floor(r() * paths.length)];
    const roll = r();
    const status = roll < 0.9 ? 200 : roll < 0.95 ? 304 : roll < 0.985 ? 404 : 301;
    let e: AccessEntry | null = {
      ip: ips[Math.floor(r() * ips.length)],
      time: `${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}`,
      method,
      path,
      status,
      bytes: status === 200 ? 200 + Math.floor(r() * 4800) : status === 304 ? 0 : 150 + Math.floor(r() * 50),
      rt: 0.01 + r() * 0.2,
    };
    if (opts.override) e = opts.override(e, sec, r);
    if (e) out.push(e);
  }
  return out;
}

export const hms = (h: number, m: number, s = 0) => h * 3600 + m * 60 + s;

export const toLog = (entries: AccessEntry[]) => entries.map((e) => accessLine(e)).join('\n') + '\n';

export function count<T>(arr: T[], pred: (x: T) => boolean) {
  return arr.filter(pred).length;
}
