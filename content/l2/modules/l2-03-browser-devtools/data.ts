import type { DevtoolsDataset, NetRequest } from '../../../../src/devtools/types';

/**
 * Конструкторы «загрузки страницы» для уроков DevTools. Продукт — ShopFlow, SaaS-платформа для
 * интернет-магазинов: панель продавца app.shopflow.io и витрины магазинов *.shopflow.store.
 */

export const APP = 'https://app.shopflow.io';
const CDN_IP = '104.18.22.61:443';
const API_IP = '203.0.113.80:443';

/** Фейковый токен: в уроках про HAR важно, что он вообще виден в заголовках */
export const TOKEN = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1XzQ0MTIiLCJzdG9yZSI6InN0XzIyMzEifQ.k3Jf9sQe1W';

type Extra = Partial<NetRequest>;

const staticAsset =
  (type: string, contentType: string) =>
  (url: string, size: number, startMs: number, timeMs: number, extra: Extra = {}): NetRequest => ({
    method: 'GET',
    url,
    status: 200,
    type,
    size,
    startMs,
    timeMs,
    remoteAddress: CDN_IP,
    responseHeaders: { 'content-type': contentType, 'cache-control': 'public, max-age=31536000, immutable' },
    ...extra,
  });

export const js = staticAsset('script', 'application/javascript');
export const css = staticAsset('stylesheet', 'text/css');
export const img = staticAsset('img', 'image/webp');
export const svg = staticAsset('img', 'image/svg+xml');
export const font = staticAsset('font', 'font/woff2');

/** HTML-страница — всегда первый запрос */
export function doc(url: string, size: number, timeMs: number, extra: Extra = {}): NetRequest {
  return {
    method: 'GET',
    url,
    status: 200,
    type: 'document',
    size,
    startMs: 0,
    timeMs,
    remoteAddress: API_IP,
    requestHeaders: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36' },
    responseHeaders: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' },
    timing: { dns: 12, connect: 18, ssl: 24, waiting: Math.max(1, timeMs - 64), download: 10 },
    ...extra,
  };
}

let reqSeq = 0;
/** Запрос к API (fetch). response — объект (будет JSON) или строка */
export function api(
  method: string,
  url: string,
  status: number,
  o: { start: number; time: number; response?: unknown; payload?: unknown; auth?: string | null; reqId?: string; type?: string; size?: number; extra?: Extra } = { start: 0, time: 100 },
): NetRequest {
  const body = o.response === undefined ? undefined : typeof o.response === 'string' ? o.response : JSON.stringify(o.response);
  const reqId = o.reqId ?? `req_${(++reqSeq).toString(36).padStart(4, '0')}a${status}`;
  const requestHeaders: Record<string, string> = { accept: 'application/json' };
  if (o.auth !== null) requestHeaders.authorization = o.auth ?? TOKEN;
  if (o.payload !== undefined) requestHeaders['content-type'] = 'application/json';
  return {
    method,
    url,
    status,
    type: o.type ?? 'fetch',
    size: o.size ?? (body ? body.length + 310 : 280),
    startMs: o.start,
    timeMs: o.time,
    remoteAddress: API_IP,
    requestHeaders,
    responseHeaders: { 'content-type': 'application/json', 'x-request-id': reqId, date: 'Thu, 05 Nov 2026 06:15:42 GMT' },
    payload: o.payload === undefined ? undefined : typeof o.payload === 'string' ? o.payload : JSON.stringify(o.payload),
    response: body,
    timing: { waiting: Math.max(1, o.time - 8), download: Math.min(8, o.time) },
    ...o.extra,
  };
}

/** Типовые ассеты панели продавца (CSS, JS, шрифт, логотип) — начинают грузиться после HTML */
export function appShell(t0: number, cached = false): NetRequest[] {
  const c: Extra = cached ? { fromCache: true } : {};
  return [
    css(`${APP}/assets/app.3c9e1f.css`, 48_210, t0, cached ? 3 : 64, c),
    js(`${APP}/assets/vendor.81aa2d.js`, 412_880, t0 + 2, cached ? 6 : 182, c),
    js(`${APP}/assets/app.5f02bc.js`, 268_400, t0 + 4, cached ? 5 : 141, c),
    font('https://fonts.gstatic.com/s/inter/v13/inter-latin.woff2', 31_120, t0 + 60, cached ? 2 : 48, c),
    svg(`${APP}/assets/logo.svg`, 3_950, t0 + 70, cached ? 1 : 22, c),
  ];
}

/** Счётчики — ответы заданий вычисляются из данных, а не хардкодятся */
export const errorCount = (ds: DevtoolsDataset) => ds.requests.filter((r) => r.status >= 400 || r.status === 0).length;
export const status4xx = (ds: DevtoolsDataset) => ds.requests.filter((r) => r.status >= 400 && r.status < 500).length;
export const consoleErrors = (ds: DevtoolsDataset) => (ds.console ?? []).filter((m) => m.level === 'error').length;
export const cachedCount = (ds: DevtoolsDataset) => ds.requests.filter((r) => r.fromCache).length;
export const slowest = (ds: DevtoolsDataset) => ds.requests.reduce((a, b) => (b.timeMs > a.timeMs ? b : a));
