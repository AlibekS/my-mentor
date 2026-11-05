import type { Host } from '../../../../src/shell/types';

/**
 * Общие данные модуля «Как устроен веб-сервис»: вымышленный SaaS ShopFlow (платформа интернет-магазинов).
 * IP-адреса — из документационных диапазонов (203.0.113.0/24, 198.51.100.0/24).
 */
export const HOME = '/home/alibek';

export const IP = {
  site: '203.0.113.10',
  api: '203.0.113.12',
  status: '203.0.113.14',
  cdn: '198.51.100.40',
  shops: '203.0.113.20',
  oldShops: '198.51.100.77',
};

/** DNS-записи ShopFlow */
export const baseHosts: Record<string, Host> = {
  'shopflow.kz': { ip: IP.site },
  'www.shopflow.kz': { ip: IP.site, cname: 'shopflow.kz' },
  'api.shopflow.kz': { ip: IP.api },
  'status.shopflow.kz': { ip: IP.status },
  'cdn.shopflow.kz': { ip: IP.cdn },
  'shops.shopflow.kz': { ip: IP.shops },
  'old-shops.shopflow.kz': { ip: IP.oldShops },
};

export const json = (v: unknown) => JSON.stringify(v) + '\n';
export const JSON_H = { 'Content-Type': 'application/json' };

/** Варианты ответа «URL»: с протоколом и без, со слэшем на конце и без */
export function urlAccept(url: string): string[] {
  const noProto = url.replace(/^https?:\/\//, '');
  const out = new Set<string>();
  for (const u of [url, noProto]) {
    out.add(u);
    out.add(u.endsWith('/') ? u.slice(0, -1) : u + '/');
  }
  for (const u of [...out]) out.add(`Location: ${u}`);
  return [...out];
}

/** Варианты ответа «доменное имя»: с точкой на конце (как в dig) и без */
export function hostAccept(name: string): string[] {
  return [name, name + '.', `CNAME ${name}`, `CNAME ${name}.`, `https://${name}`, `https://${name}/`];
}
