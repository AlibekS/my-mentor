import { rng } from '../../../shared/logs';

/**
 * Лог приложения интернет-магазина для уроков «Логи для L2».
 * Формат строки (время — UTC, буква Z в конце):
 *   2026-11-04T09:12:03Z ERROR [payment] request_id=req-7f3a91 user_id=u-1042 order_id=ORD-58213 msg="Card declined by issuing bank"
 * Фон генерируется детерминированно (seed), «сюжетные» строки урока подмешиваются по времени.
 */
export type Level = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface LogEntry {
  /** секунды от полуночи UTC */
  sec: number;
  level: Level;
  service: string;
  requestId?: string;
  userId?: string;
  orderId?: string;
  email?: string;
  msg: string;
  /** строки после основной (стек-трейс) */
  extra?: string[];
}

const pad = (n: number) => String(n).padStart(2, '0');
export const hhmmss = (sec: number) => `${pad(Math.floor(sec / 3600) % 24)}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}`;
export const hm = (h: number, m: number, s = 0) => h * 3600 + m * 60 + s;
/** время UTC → Алматы (UTC+5), «ЧЧ:ММ» */
export const almaty = (sec: number) => hhmmss(sec + 5 * 3600).slice(0, 5);

export function line(e: LogEntry, date = '2026-11-04'): string {
  const ids = [e.requestId && `request_id=${e.requestId}`, e.userId && `user_id=${e.userId}`, e.orderId && `order_id=${e.orderId}`, e.email && `email=${e.email}`].filter(Boolean).join(' ');
  const main = `${date}T${hhmmss(e.sec)}Z ${e.level.padEnd(5)} [${e.service}] ${ids ? ids + ' ' : ''}msg="${e.msg}"`;
  return [main, ...(e.extra ?? [])].join('\n');
}

/** Фоновый поток событий: обычные покупки, входы, редкие предупреждения и ошибки */
export function background(opts: { seed: number; from: number; to: number; errorRate?: number }): LogEntry[] {
  const r = rng(opts.seed);
  const hex = () => Math.floor(r() * 0xffffff).toString(16).padStart(6, '0');
  const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
  const users = Array.from({ length: 24 }, (_, i) => `u-${1101 + i}`);
  const out: LogEntry[] = [];
  const errRate = opts.errorRate ?? 0.12;
  for (let sec = opts.from; sec < opts.to; sec += 20 + Math.floor(r() * 40)) {
    const requestId = `req-${hex()}`;
    const userId = pick(users);
    const kind = r();
    if (kind < 0.3) {
      out.push({ sec, level: 'INFO', service: 'api', requestId, userId, msg: pick(['GET /api/products 200', 'GET /api/products/42 200', 'GET /api/cart 200']) });
      if (r() < 0.4) out.push({ sec, level: 'DEBUG', service: 'cart', requestId, userId, msg: `Cart recalculated items=${1 + Math.floor(r() * 5)}` });
    } else if (kind < 0.45) {
      if (r() < 0.2) out.push({ sec, level: 'WARN', service: 'auth', requestId, userId, msg: 'Invalid password attempt' });
      else out.push({ sec, level: 'INFO', service: 'auth', requestId, userId, msg: 'User logged in' });
    } else {
      const orderId = `ORD-${51000 + Math.floor(r() * 7000)}`;
      out.push({ sec, level: 'INFO', service: 'api', requestId, userId, orderId, msg: 'POST /api/checkout' });
      out.push({ sec: sec + 1, level: 'INFO', service: 'checkout', requestId, userId, orderId, msg: 'Order created' });
      const p = r();
      if (p < errRate) {
        out.push({ sec: sec + 2, level: 'ERROR', service: 'payment', requestId, userId, orderId, msg: pick(['Card declined by issuing bank', 'Insufficient funds', 'Card expired']) });
      } else {
        if (p < errRate + 0.08) out.push({ sec: sec + 2, level: 'WARN', service: 'payment', requestId, userId, orderId, msg: `Payment provider slow: ${1800 + Math.floor(r() * 1500)} ms` });
        out.push({ sec: sec + 3, level: 'INFO', service: 'payment', requestId, userId, orderId, msg: 'Payment captured' });
        if (r() < 0.5) out.push({ sec: sec + 4, level: 'INFO', service: 'notify', requestId, userId, orderId, msg: 'Order confirmation email sent' });
      }
    }
  }
  return out;
}

/** Склеить фон и сюжет по времени (стабильно), вернуть записи и текст файла */
export function buildLog(bg: LogEntry[], story: LogEntry[], date = '2026-11-04') {
  const entries = [...bg.map((e, i) => ({ e, k: i })), ...story.map((e, i) => ({ e, k: bg.length + i }))]
    .sort((a, b) => a.e.sec - b.e.sec || a.k - b.k)
    .map((x) => x.e);
  const ids = new Set(story.map((e) => e.requestId).filter(Boolean));
  for (const e of bg) if (e.requestId && ids.has(e.requestId)) throw new Error(`request_id collision ${e.requestId}`);
  const lines = entries.map((e) => line(e, date));
  return { entries, lines, text: lines.join('\n') + '\n' };
}
