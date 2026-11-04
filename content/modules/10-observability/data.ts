import { rng } from '../../shared/logs';
import type { LogEntry, ObsDataset, Series, Trace } from '../../../src/obs/types';

/**
 * Два часа телеметрии магазина 13:00–15:00 (шаг 1 мин).
 * Инцидент: с 14:04 у payments пул соединений к БД (50) упирается в максимум из‑за медленного
 * запроса нового отчёта (reconcile) → таймауты 30 с → 5xx у payments, 502 у checkout, рост p95.
 * Отдельно: у catalog медленная утечка памяти (для USE).
 */
export const START = 13 * 3600;
export const STEP = 60;
export const POINTS = 121;
export const INCIDENT = 64; // индекс точки 14:04
const r = rng(10);

const series: Series[] = [];
const counter = (metric: string, labels: Record<string, string>, ratePerSec: (i: number) => number) => {
  let acc = Math.floor(r() * 1000);
  const values: number[] = [];
  for (let i = 0; i < POINTS; i++) {
    if (i > 0) acc += Math.max(0, ratePerSec(i)) * STEP;
    values.push(Math.round(acc));
  }
  series.push({ metric, labels, values });
};
const gauge = (metric: string, labels: Record<string, string>, f: (i: number) => number) =>
  series.push({ metric, labels, values: Array.from({ length: POINTS }, (_, i) => Math.round(f(i) * 100) / 100) });

const wave = (i: number, base: number, amp = 0.15) => base * (1 + amp * Math.sin(i / 9) + (r() - 0.5) * 0.08);
const inc = (i: number) => i >= INCIDENT && i < INCIDENT + 38; // 14:04–14:41
const ramp = (i: number) => (inc(i) ? Math.min(1, (i - INCIDENT + 1) / 4) : 0);

// RED: запросы
for (const [service, route, base] of [['checkout', '/api/checkout', 6], ['checkout', '/api/cart', 14], ['catalog', '/api/products', 40], ['payments', '/v1/charge', 6]] as const) {
  const err = (i: number) => {
    if (service === 'payments' && inc(i)) return 0.45 * ramp(i);
    if (service === 'checkout' && route === '/api/checkout' && inc(i)) return 0.4 * ramp(i);
    return 0.004;
  };
  counter('http_requests_total', { service, route, code: '200' }, (i) => wave(i, base) * (1 - err(i)));
  counter('http_requests_total', { service, route, code: service === 'checkout' ? '502' : '500' }, (i) => wave(i, base) * err(i));
  counter('http_requests_total', { service, route, code: '404' }, (i) => (route === '/api/products' ? wave(i, base) * 0.02 : 0.002));
}

// Задержка: гистограмма checkout и payments
const LE = ['0.05', '0.1', '0.25', '0.5', '1', '2.5', '5', '+Inf'];
for (const service of ['checkout', 'payments']) {
  // доли запросов не дольше le: норма / инцидент
  const normal = [0.45, 0.78, 0.94, 0.985, 0.996, 0.999, 1, 1];
  const bad = [0.2, 0.35, 0.5, 0.58, 0.62, 0.66, 0.7, 1]; // 30% висят до таймаута
  LE.forEach((le, k) => {
    counter('http_request_duration_seconds_bucket', { service, le }, (i) => {
      const rate = service === 'checkout' ? wave(i, 20) : wave(i, 6);
      const share = normal[k] + (bad[k] - normal[k]) * ramp(i);
      return rate * share;
    });
  });
}

// USE: пул соединений payments
gauge('db_pool_connections_in_use', { service: 'payments' }, (i) => (inc(i) ? Math.min(50, 12 + 38 * Math.min(1, (i - INCIDENT + 2) / 3)) : 8 + 6 * r()));
gauge('db_pool_connections_max', { service: 'payments' }, () => 50);
gauge('db_pool_wait_seconds', { service: 'payments' }, (i) => (inc(i) ? 30 * ramp(i) : 0.002));

// USE: память подов catalog — утечка у одного
for (const [pod, leak] of [['catalog-6f7d9c-abcde', true], ['catalog-6f7d9c-fghij', false]] as const) {
  gauge('container_memory_working_set_bytes', { pod, service: 'catalog' }, (i) => (leak ? 400 + i * 6.5 : 420 + 20 * Math.sin(i / 7)) * 1024 * 1024);
}
gauge('container_spec_memory_limit_bytes', { service: 'catalog' }, () => 1024 * 1024 * 1024);
// CPU нод
for (const node of ['worker-1', 'worker-2']) gauge('node_cpu_utilization', { node }, (i) => Math.min(0.95, wave(i, node === 'worker-1' ? 0.42 : 0.35, 0.2) + (inc(i) ? 0.05 : 0)));
// up
for (const job of ['checkout', 'catalog', 'payments']) gauge('up', { job }, () => 1);

// ---------- логи ----------
export const logs: LogEntry[] = [];
const traceIds: string[] = [];
const tid = (i: number) => `4bf92f35${(0x1000 + i).toString(16)}a3ce`;
let li = 0;
for (let sec = START; sec < START + (POINTS - 1) * STEP; sec += 20 + Math.floor(r() * 25)) {
  const i = Math.floor((sec - START) / STEP);
  const id = tid(li++);
  if (inc(i) && r() < 0.6 * ramp(i)) {
    logs.push({ ts: sec, service: 'payments', level: 'error', msg: 'HikariPool-1 - Connection is not available, request timed out after 30000ms', trace_id: id });
    logs.push({ ts: sec + 30, service: 'checkout', level: 'error', msg: 'upstream payments returned 500: charge failed', trace_id: id, route: '/api/checkout' });
    traceIds.push(id);
  } else {
    logs.push({ ts: sec, service: 'checkout', level: 'info', msg: 'order placed', trace_id: id, route: '/api/checkout' });
    if (r() < 0.15) logs.push({ ts: sec + 2, service: 'catalog', level: 'warn', msg: 'slow query products search 820ms' });
  }
}
// новый отчёт стартовал в 14:02
logs.push({ ts: START + 62 * 60 + 5, service: 'payments', level: 'info', msg: 'reconcile-report job started (scheduled 14:02, new in release 3.7.0)' });
logs.push({ ts: START + 62 * 60 + 9, service: 'payments', level: 'warn', msg: 'slow query 28734ms: SELECT * FROM payments p JOIN refunds r ON ... WHERE p.created_at > now() - interval \'90 days\' (no index on refunds.payment_id)' });
logs.push({ ts: START + 101 * 60 + 40, service: 'payments', level: 'info', msg: 'reconcile-report job finished in 39m31s' });
logs.sort((a, b) => a.ts - b.ts);

// ---------- трейсы ----------
export const traces: Trace[] = [];
const okTrace = (k: number, sec: number): Trace => ({
  traceId: tid(10000 + k),
  ts: sec,
  root: 'POST /api/checkout',
  spans: [
    { id: 'a', service: 'checkout', op: 'POST /api/checkout', startMs: 0, durMs: 182 },
    { id: 'b', parent: 'a', service: 'catalog', op: 'GET /api/products/:id', startMs: 8, durMs: 34 },
    { id: 'c', parent: 'a', service: 'payments', op: 'POST /v1/charge', startMs: 50, durMs: 118 },
    { id: 'd', parent: 'c', service: 'payments', op: 'db: INSERT payments', startMs: 62, durMs: 9 },
    { id: 'e', parent: 'c', service: 'bank-api', op: 'POST /authorize', startMs: 75, durMs: 88 },
  ],
});
for (let k = 0; k < 12; k++) traces.push(okTrace(k, START + k * 300));
traceIds.slice(0, 10).forEach((id, k) => {
  const sec = logs.find((l) => l.trace_id === id)!.ts;
  traces.push({
    traceId: id,
    ts: sec,
    root: 'POST /api/checkout',
    spans: [
      { id: 'a', service: 'checkout', op: 'POST /api/checkout', startMs: 0, durMs: 30120 + k * 7, error: 'upstream payments returned 500' },
      { id: 'b', parent: 'a', service: 'catalog', op: 'GET /api/products/:id', startMs: 6, durMs: 31 },
      { id: 'c', parent: 'a', service: 'payments', op: 'POST /v1/charge', startMs: 45, durMs: 30060, error: 'charge failed' },
      { id: 'd', parent: 'c', service: 'payments', op: 'db: acquire connection (pool)', startMs: 52, durMs: 30000, error: 'Connection is not available, request timed out after 30000ms' },
    ],
  });
});
traces.sort((a, b) => a.ts - b.ts);

export const obs: ObsDataset = { start: START, step: STEP, points: POINTS, series, logs, traces };

export const DASHBOARD = {
  title: 'Shop — RED overview',
  panels: [
    { title: 'Запросы в секунду по сервисам', query: 'sum by (service) (rate(http_requests_total[5m]))', unit: 'req/s' as const },
    { title: 'Доля ошибок 5xx по сервисам', query: 'sum by (service) (rate(http_requests_total{code=~"5.."}[5m])) / sum by (service) (rate(http_requests_total[5m]))', unit: '%' as const, threshold: 0.05 },
    { title: 'Latency p95 checkout', query: 'histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket{service="checkout"}[5m])))', unit: 's' as const, threshold: 1 },
    { title: 'Пул соединений БД payments', query: 'db_pool_connections_in_use', unit: '' as const, threshold: 50 },
  ],
};
