import { genAccess, hms, toLog, type AccessEntry } from '../../shared/logs';

/** Общий access.log для уроков модуля «Логи»: 13:00–14:30, с всплеском 502 в 14:05–14:12 и «ботом» */
export const access: AccessEntry[] = genAccess({
  seed: 42,
  from: hms(13, 0),
  to: hms(14, 30),
  step: [4, 12],
  override: (e, sec, r) => {
    if (sec >= hms(14, 5) && sec < hms(14, 12) && e.path.startsWith('/api/') && r() < 0.6) return { ...e, status: 502, bytes: 157, rt: 0.002 };
    if (sec >= hms(13, 40) && sec < hms(13, 55) && r() < 0.35) return { ...e, ip: '45.155.205.99', method: 'GET', path: '/wp-login.php', status: 404, bytes: 162, ua: 'python-requests/2.31' };
    return e;
  },
});

export const accessLog = toLog(access);

export const stats = {
  total: access.length,
  s502: access.filter((e) => e.status === 502).length,
  s404: access.filter((e) => e.status === 404).length,
  s5xx: access.filter((e) => e.status >= 500).length,
  bot: access.filter((e) => e.ip === '45.155.205.99').length,
  first502: access.find((e) => e.status === 502)!.time,
  last502: [...access].reverse().find((e) => e.status === 502)!.time,
  uniqueIps: new Set(access.map((e) => e.ip)).size,
  topIp: (() => {
    const c = new Map<string, number>();
    for (const e of access) c.set(e.ip, (c.get(e.ip) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1])[0];
  })(),
  checkoutTotal: access.filter((e) => e.path === '/api/checkout').length,
  window1405: access.filter((e) => e.time >= '14:05:00' && e.time < '14:10:00').length,
};
