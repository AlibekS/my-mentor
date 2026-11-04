import type { LessonDef } from '../../../../src/content/types';
import { genAccess, hms, toLog } from '../../../shared/logs';

// Инцидент: релиз 14:00 поменял конфиг (DB_POOL_SIZE=0) → приложение падает с 14:04
const access = genAccess({
  seed: 7,
  from: hms(13, 30),
  to: hms(14, 25),
  step: [3, 9],
  override: (e, sec, r) => (sec >= hms(14, 4, 30) && e.path.startsWith('/api/') && r() < 0.85 ? { ...e, status: 502, bytes: 157, rt: 0.001 } : e),
});
const n502 = access.filter((e) => e.status === 502).length;
const first502 = access.find((e) => e.status === 502)!.time;
const topUrl = (() => {
  const c = new Map<string, number>();
  for (const e of access.filter((x) => x.status === 502)) c.set(e.path, (c.get(e.path) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0][0];
})();

const errLines: string[] = [];
for (const e of access.filter((x) => x.status === 502).slice(0, 25)) {
  errLines.push(`2026/11/04 ${e.time} [error] 1101#0: connect() failed (111: Connection refused) while connecting to upstream, client: ${e.ip}, request: "${e.method} ${e.path} HTTP/1.1", upstream: "http://127.0.0.1:8081${e.path}"`);
}

const scenario = {
  host: 'web-prod-01',
  files: {
    '/var/log/nginx/access.log': toLog(access),
    '/var/log/nginx/error.log': errLines.join('\n') + '\n',
    '/etc/shop-api/app.env': { content: 'APP_PORT=8081\nDB_HOST=db-prod-01\nDB_POOL_SIZE=0\nLOG_LEVEL=info\n', mtime: '-0.5h' },
    '/etc/shop-api/app.env.bak': { content: 'APP_PORT=8081\nDB_HOST=db-prod-01\nDB_POOL_SIZE=20\nLOG_LEVEL=info\n', mtime: '-20d' },
    '/opt/shop-api/CHANGELOG': '2.14.0 (2026-11-04)\n- new config loader\n- DB_POOL_SIZE now read from app.env (default removed)\n2.13.2\n- fixes\n',
  },
  services: [
    {
      name: 'nginx',
      description: 'A high performance web server and a reverse proxy server',
      active: 'active' as const,
      enabled: true,
      mainPid: 1101,
      logs: [{ time: '2026-11-01 08:00:00', priority: 'info' as const, message: 'Started nginx.' }],
    },
    {
      name: 'shop-api',
      description: 'Shop API',
      active: 'failed' as const,
      enabled: true,
      logs: [
        { time: '2026-11-04 14:00:05', priority: 'info' as const, message: 'Stopping Shop API...' },
        { time: '2026-11-04 14:00:07', priority: 'info' as const, message: 'Started Shop API (version 2.14.0).' },
        { time: '2026-11-04 14:00:08', priority: 'warning' as const, message: 'DB_POOL_SIZE=0 — connections will be created on demand' },
        { time: '2026-11-04 14:03:51', priority: 'err' as const, message: 'HikariPool-1 - Connection is not available, request timed out after 30000ms' },
        { time: '2026-11-04 14:04:22', priority: 'err' as const, message: 'HikariPool-1 - Connection is not available, request timed out after 30000ms' },
        { time: '2026-11-04 14:04:29', priority: 'crit' as const, message: 'Health check failed 3 times, exiting' },
        { time: '2026-11-04 14:04:29', priority: 'err' as const, message: 'shop-api.service: Main process exited, code=exited, status=1/FAILURE' },
        { time: '2026-11-04 14:04:30', priority: 'err' as const, message: 'shop-api.service: Start request repeated too quickly. Failed with result \'exit-code\'.' },
      ],
      startProcess: { user: 'shop', cpu: 4, mem: 8, vsz: 3_900_000, rss: 650_000, stat: 'Ssl', start: '14:30', time: '0:03', command: '/usr/bin/java -jar /opt/shop-api/shop-api-2.14.0.jar' },
      listen: [{ proto: 'tcp' as const, local: '127.0.0.1:8081' }],
      requires: [{ path: '/etc/shop-api/app.env', notContains: 'DB_POOL_SIZE=0', error: 'HikariPool-1 - Connection is not available, request timed out after 30000ms\nHealth check failed 3 times, exiting' }],
    },
  ],
  listeners: [{ proto: 'tcp' as const, local: '0.0.0.0:80', pid: 1101, process: 'nginx' }],
  processes: [
    { pid: 1, user: 'root', cpu: 0, mem: 0.1, vsz: 168000, rss: 12000, stat: 'Ss', start: 'Oct12', time: '0:41', command: '/sbin/init' },
    { pid: 1101, user: 'root', cpu: 0.3, mem: 0.2, vsz: 55000, rss: 9000, stat: 'Ss', start: 'Nov01', time: '1:12', command: 'nginx: master process /usr/sbin/nginx', service: 'nginx' },
  ],
};

const lesson: LessonDef = {
  id: 'boss',
  kind: 'boss',
  title: '502 после релиза',
  minutes: 45,
  incident: { ticket: 'INC-3150: «Массовые 502 на /api после релиза 2.14.0»', severity: 'SEV1', customer: 'все пользователи магазина' },
  commands: ['grep', 'awk', 'sort', 'uniq', 'systemctl', 'journalctl', 'cat', 'sed'],
  scenario,
  tasks: [
    {
      id: 'scale',
      prompt: 'Масштаб: сколько ответов **502** в `/var/log/nginx/access.log`? Выведи число.',
      check: { type: 'outputNumber', value: n502 },
      hints: ["`awk '$9 == 502' файл | wc -l` или `grep -c '\" 502 '`."],
      solution: "awk '$9 == 502' /var/log/nginx/access.log | wc -l",
      tags: ['awk'],
    },
    {
      id: 'start',
      prompt: 'Когда начались 502? Выведи **время первого** запроса с 502 (поле 4) — одну строку.',
      check: { type: 'all', checks: [{ type: 'outputContains', value: first502 }, { type: 'outputLines', value: 1 }] },
      hints: ["`awk '$9 == 502 {print $4}' файл | head -1`"],
      solution: "awk '$9 == 502 {print $4}' /var/log/nginx/access.log | head -1",
      tags: ['awk'],
    },
    {
      id: 'top-url',
      prompt: 'Какой URL получил больше всего 502? Построй топ и введи URL.',
      answer: { accept: [topUrl], label: 'URL:' },
      hints: ["Отфильтруй 502 и выведи поле 7: `awk '$9 == 502 {print $7}'`.", '`| sort | uniq -c | sort -rn | head -3`'],
      solution: "awk '$9 == 502 {print $7}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -3",
      tags: ['awk', 'pipes'],
    },
    {
      id: 'nginx-says',
      prompt: 'Что nginx пишет про бэкенд в `/var/log/nginx/error.log`? Введи **код и текст ошибки** соединения (как в логе, например `111: ...`).',
      answer: { accept: [], normalize: 'keywords', keywords: [['111', 'refused', 'отказ']], label: 'Ошибка:' },
      hints: ['`tail -3 /var/log/nginx/error.log`'],
      solution: 'tail -3 /var/log/nginx/error.log',
      tags: ['tail'],
    },
    {
      id: 'root-cause',
      prompt: 'Бэкенд не слушает порт. Проверь сервис `shop-api` и его журнал с 14:00. Какой **параметр конфигурации** сломал релиз? Введи имя параметра.',
      answer: { accept: ['DB_POOL_SIZE', 'DB_POOL_SIZE=0'], label: 'Параметр:' },
      hints: ['`systemctl status shop-api`', '`journalctl -u shop-api --since "14:00"` — смотри warning сразу после старта.', 'Сравни `/etc/shop-api/app.env` и `app.env.bak`.'],
      solution: 'journalctl -u shop-api --since "14:00"',
      explanation: 'Релиз 2.14.0 убрал значение по умолчанию (см. CHANGELOG), а в `app.env` оказалось `DB_POOL_SIZE=0`: пул БД пустой → таймауты 30 с → health check падает → сервис завершается → nginx получает Connection refused → 502.',
      tags: ['journalctl'],
    },
    {
      id: 'restore',
      prompt: 'Восстанови сервис: верни `DB_POOL_SIZE=20` в `/etc/shop-api/app.env` (например, `sudo sed -i ...` или восстановив из `.bak`) и перезапусти `shop-api`. Задание засчитается, когда сервис станет **active**.',
      check: { type: 'all', checks: [{ type: 'serviceState', name: 'shop-api', state: 'active' }, { type: 'fileContains', path: '/etc/shop-api/app.env', value: 'DB_POOL_SIZE=20' }] },
      hints: ["`sudo sed -i 's/DB_POOL_SIZE=0/DB_POOL_SIZE=20/' /etc/shop-api/app.env`", 'Или: `sudo cp /etc/shop-api/app.env.bak /etc/shop-api/app.env`', '`sudo systemctl restart shop-api && systemctl status shop-api`'],
      solution: "sudo sed -i 's/DB_POOL_SIZE=0/DB_POOL_SIZE=20/' /etc/shop-api/app.env && sudo systemctl restart shop-api",
      tags: ['sed', 'systemctl'],
    },
  ],
  quiz: [
    {
      id: 'q-rca',
      type: 'text',
      prompt: 'RCA одной фразой: что стало первопричиной 502? (проверяются ключевые слова про пул/DB_POOL_SIZE и релиз/конфиг)',
      answer: { accept: [], normalize: 'keywords', keywords: [['pool', 'пул', 'db_pool_size'], ['релиз', 'release', 'конфиг', 'config', '2.14', 'деплой', 'deploy', 'умолчан', 'default']] },
      explanation: 'Например: «Релиз 2.14.0 убрал дефолт DB_POOL_SIZE, в конфиге было 0 → пул соединений к БД пуст, приложение падало по health check, nginx отдавал 502».',
    },
    {
      id: 'q-chain',
      type: 'choice',
      prompt: 'Какая цепочка верна?',
      options: [
        'Сеть клиента → таймаут → 504',
        'Пустой пул БД → таймауты → health check → процесс завершился → порт 8081 закрыт → nginx: Connection refused → 502',
        'Диск заполнен → nginx не пишет логи → 502',
      ],
      correct: 1,
      explanation: 'Важно уметь рассказать всю цепочку — это и есть RCA.',
    },
    {
      id: 'q-action',
      type: 'text',
      prompt: 'Предложи action item, чтобы такое не повторилось (ключевые слова: проверка/валидация конфига или дефолт или canary/staging).',
      answer: { accept: [], normalize: 'keywords', keywords: [['валидац', 'провер', 'validate', 'check', 'default', 'дефолт', 'умолчан', 'canary', 'канар', 'staging', 'стейдж', 'тест', 'test', 'smoke']] },
      explanation: 'Например: валидация конфига при старте с понятной ошибкой, вернуть безопасный дефолт, smoke-тест/canary после релиза, алерт на рост 5xx.',
    },
  ],
  glossary: [
    { ru: 'Канареечный релиз', en: 'canary release', def: 'Выкатка новой версии сначала на малую долю трафика.' },
    { ru: 'Проверка здоровья', en: 'health check', def: 'Периодическая проверка, что сервис отвечает корректно.' },
    { ru: 'Откат', en: 'rollback', def: 'Возврат к предыдущей рабочей версии.' },
  ],
};
export default lesson;
