import type { LessonDef } from '../../../../../src/content/types';
import type { Service } from '../../../../../src/shell/types';

// Ночной деплой 5.2.0 в 02:14 — приложение не может войти в базу (пароль), nginx отдаёт 502
const pad = (n: number) => String(n).padStart(2, '0');
const errLines: string[] = ['2026/11/03 23:40:12 [warn] 1101#0: *8812 an upstream response is buffered to a temporary file /var/cache/nginx/proxy_temp/1/00/0000000001 while reading upstream'];
const ips = ['37.150.2.11', '91.204.8.33', '185.12.40.7', '2.133.91.4'];
const paths = ['/', '/catalog', '/api/cart', '/', '/api/products'];
let firstRefused = '';
for (let i = 0; i < 18; i++) {
  const sec = 2 * 3600 + 14 * 60 + 9 + i * 23;
  const t = `${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}`;
  if (!firstRefused) firstRefused = t;
  const p = paths[i % paths.length];
  errLines.push(`2026/11/04 ${t} [error] 1101#0: *${9100 + i} connect() failed (111: Connection refused) while connecting to upstream, client: ${ips[i % ips.length]}, server: shop.example.com, request: "GET ${p} HTTP/1.1", upstream: "http://127.0.0.1:8080${p}"`);
}

const services: Service[] = [
  {
    name: 'nginx',
    description: 'A high performance web server and a reverse proxy server',
    active: 'active',
    enabled: true,
    mainPid: 1101,
    since: 'Sat 2026-11-01 08:00:00 +05',
    logs: [{ time: '2026-11-01 08:00:00', priority: 'info', message: 'Started nginx.' }],
  },
  {
    name: 'shop-app',
    description: 'Shop web application',
    active: 'failed',
    enabled: true,
    logs: [
      { time: '2026-11-03 10:00:00', priority: 'info', message: 'Started Shop web application.' },
      { time: '2026-11-04 02:14:05', priority: 'info', message: 'Stopping Shop web application (deploy 5.2.0)...' },
      { time: '2026-11-04 02:14:06', priority: 'info', message: 'Starting Shop web application...' },
      { time: '2026-11-04 02:14:07', priority: 'err', message: 'FATAL: password authentication failed for user "shop" (database db-prod-01:5432)' },
      { time: '2026-11-04 02:14:07', priority: 'err', message: 'shop-app.service: Main process exited, code=exited, status=1/FAILURE' },
      { time: '2026-11-04 02:14:07', priority: 'err', message: "shop-app.service: Failed with result 'exit-code'." },
    ],
  },
];

const bad = { status: 502, reason: 'Bad Gateway', headers: { Server: 'nginx/1.24.0', 'Content-Type': 'text/html' }, body: '<html><head><title>502 Bad Gateway</title></head><body><center><h1>502 Bad Gateway</h1></center><hr><center>nginx</center></body></html>\n' };

const scenario = {
  host: 'shop-web-01',
  files: {
    '/var/log/nginx/error.log': errLines.join('\n') + '\n',
    '/opt/shop/VERSION': '5.2.0\n',
  },
  services,
  listeners: [
    { proto: 'tcp' as const, local: '0.0.0.0:80', pid: 1101, process: 'nginx' },
    { proto: 'tcp' as const, local: '0.0.0.0:443', pid: 1101, process: 'nginx' },
  ],
  network: {
    hosts: { 'shop.example.com': { ip: '203.0.113.10' } },
    http: {
      'https://shop.example.com/': bad,
      'http://shop.example.com/': bad,
      'http://localhost/': bad,
      'http://127.0.0.1/': bad,
      'http://127.0.0.1:8080/': { status: 0, error: 'refused' as const },
      'http://localhost:8080/': { status: 0, error: 'refused' as const },
    },
  },
};

const ESC = '/home/alibek/escalation.txt';
// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

const lesson: LessonDef = {
  id: 'boss',
  kind: 'boss',
  title: 'Сайт не открывается',
  minutes: 35,
  incident: { ticket: 'ZD-6031 и ещё 4 тикета: «Your website is not working — 502 Bad Gateway»', severity: 'SEV1', customer: 'все покупатели shop.example.com' },
  commands: ['curl', 'systemctl', 'journalctl', 'tail', 'grep', 'echo', 'cat'],
  scenario,
  tasks: [
    {
      id: 'confirm',
      prompt: 'Подтверди проблему: какой **HTTP-код** сейчас отдаёт `https://shop.example.com`? Введи число.',
      answer: { accept: ['502'], normalize: 'number', label: 'Код:' },
      hints: ['Заголовки ответа показывает `curl -I адрес`.', '`curl -I https://shop.example.com` — код в первой строке.'],
      solution: 'curl -I https://shop.example.com',
      explanation: '`HTTP/1.1 502 Bad Gateway`, `Server: nginx` — nginx жив, но не может получить ответ от приложения за ним.',
      tags: ['curl'],
    },
    {
      id: 'service',
      prompt: 'nginx работает, значит, проблема глубже. **Какой сервис** на сервере упал? Введи его имя.',
      answer: { accept: ['shop-app', 'shop-app.service'], label: 'Сервис:' },
      hints: ['`systemctl --failed` — список упавших сервисов.', 'Проверь и сам сервис: `systemctl status shop-app`.'],
      solution: 'systemctl --failed',
      explanation: '`shop-app.service` — `failed`. Это приложение магазина, которому nginx передаёт запросы.',
      tags: ['systemctl'],
    },
    {
      id: 'cause',
      prompt:
        'Прочитай журнал упавшего сервиса. Строка с `FATAL` — на английском. **Что пошло не так** и **с чем**? Ответь своими словами по-русски или по-английски.',
      answer: {
        accept: [],
        normalize: 'keywords',
        keywords: [
          ['парол', 'password', 'аутентиф', 'authentic', 'auth', 'учетн', 'логин', 'credential', 'войти', 'вход'],
          ['баз', 'бд', 'database', 'db', 'postgres', '5432'],
        ],
        label: 'Причина:',
        placeholder: 'например: не прошла … к …',
      },
      hints: ['`journalctl -u shop-app -n 20`', '*password authentication failed for user "shop"* — не прошла проверка пароля пользователя shop; *database db-prod-01* — база данных.'],
      solution: 'journalctl -u shop-app -n 20',
      explanation: 'После деплоя 5.2.0 приложение не смогло войти в базу данных db-prod-01: *password authentication failed* — неверный пароль. Скорее всего, при деплое поменялся пароль или конфиг — это уже работа L3.',
      tags: ['journalctl'],
    },
    {
      id: 'since',
      prompt:
        'Когда клиенты начали получать ошибки? Найди в `/var/log/nginx/error.log` **первую** строку с `Connection refused` и введи её время (по времени сервера).',
      answer: { accept: [], normalize: 'keywords', keywords: [['2:14']], label: 'Время:', placeholder: 'ЧЧ:ММ' },
      hints: ['`grep "Connection refused" /var/log/nginx/error.log | head -n 1`', 'Первая строка файла — старое предупреждение `[warn]` за вчера, оно не про этот сбой.'],
      solution: 'grep "Connection refused" /var/log/nginx/error.log | head -n 1',
      explanation: `Первая ошибка — в ${firstRefused}, через пару секунд после неудачного старта shop-app (02:14:07, деплой 5.2.0). Совпадение по времени — сильная улика для L3.`,
      tags: ['grep', 'head'],
    },
    {
      id: 'escalation',
      prompt:
        `Собери факты для L3 в файл \`~/escalation.txt\`: **сервер**, **упавший сервис** и его состояние, **ошибку** из журнала, **время** начала и что клиенты получают **502**. Можно сохранить вывод команд (\`>\` и \`>>\`) и дописать свои строки через \`echo "…" >> ~/escalation.txt\`.`,
      check: {
        type: 'custom',
        fn: (sh) => {
          const n = sh.fs.lookup(ESC);
          if (!n || n.type !== 'file') return false;
          const t = stripAnsi(n.content).toLowerCase();
          return (
            t.includes('shop-web-01') &&
            t.includes('shop-app') &&
            /failed|упал|не работает|не запуска|down/.test(t) &&
            /password|парол|authentic|аутентиф/.test(t) &&
            t.includes('2:14') &&
            t.includes('502')
          );
        },
      },
      hints: [
        'Начни с вывода статуса: `systemctl status shop-app > ~/escalation.txt` — там сервер, сервис, failed и ошибка.',
        'Допиши то, чего не хватает: `echo "Сайт отдаёт 502 с 02:14 (время сервера). Ничего не перезапускал." >> ~/escalation.txt`',
        'Проверь файл: `cat ~/escalation.txt`. Нужны: shop-web-01, shop-app, failed, password, 02:14, 502.',
      ],
      solution:
        'systemctl status shop-app > ~/escalation.txt\necho "Сервер shop-web-01: shop-app failed с 02:14 (после деплоя 5.2.0), сайт отдаёт 502. Ничего не перезапускал." >> ~/escalation.txt\ncat ~/escalation.txt',
      explanation: 'В файле есть всё, что нужно L3, чтобы начать сразу с причины: где, что, какая ошибка, с какого времени и что уже сделано.',
      tags: ['echo', 'redirect'],
    },
  ],
  quiz: [
    {
      id: 'q-summary',
      type: 'text',
      prompt: 'Одной фразой для L3: почему сайт не открывается? (проверяются ключевые слова: приложение/сервис и пароль/база)',
      answer: {
        accept: [],
        normalize: 'keywords',
        keywords: [
          ['shop-app', 'приложен', 'сервис', 'app', 'service'],
          ['парол', 'password', 'аутентиф', 'auth', 'баз', 'database', 'бд'],
        ],
      },
      explanation: 'Например: «После деплоя 5.2.0 в 02:14 shop-app не может войти в базу db-prod-01 (password authentication failed) и упал, поэтому nginx отдаёт 502».',
    },
    {
      id: 'q-502',
      type: 'text',
      prompt: 'Что означал код 502 Bad Gateway в этом инциденте? Кто не ответил nginx?',
      answer: { accept: [], normalize: 'keywords', keywords: [['shop-app', 'приложен', 'бэкенд', 'бекенд', 'backend', 'upstream', 'сервис', 'app', 'магазин']] },
      explanation: 'nginx работал, но приложение `shop-app` за ним упало — nginx не смог к нему подключиться (Connection refused) и вернул клиентам 502.',
    },
    {
      id: 'q-append',
      type: 'command',
      prompt: 'Допиши в конец файла `~/escalation.txt` строку `Ничего не перезапускал`, не стирая того, что там уже есть.',
      scenario: { files: { [ESC]: { content: 'shop-app failed\n', owner: 'alibek', group: 'alibek' } } },
      solution: 'echo "Ничего не перезапускал" >> ~/escalation.txt',
      check: { type: 'fileContains', path: ESC, value: ['shop-app failed', 'Ничего не перезапускал'] },
      explanation: '`>>` дописывает в конец. Один знак `>` перезаписал бы файл — первая строка пропала бы.',
    },
    {
      id: 'q-next',
      type: 'choice',
      prompt: 'Факты собраны. Что L2 делает дальше?',
      options: [
        'Сам меняет пароль базы в конфиге и перезапускает shop-app',
        'Эскалирует в L3 с файлом фактов и отвечает клиентам, что о проблеме известно и над ней работают',
        'Ждёт до утра — может, само починится',
      ],
      correct: 1,
      explanation: 'Исправление пароля и перезапуск — работа L3 (или по runbook). L2 быстро эскалирует с фактами и держит клиентов в курсе.',
    },
  ],
  glossary: [
    { ru: 'Плохой шлюз', en: '502 Bad Gateway', def: 'Прокси (nginx) не получил нормального ответа от приложения за ним.' },
    { ru: 'Ошибка аутентификации', en: 'authentication failed', def: 'Не прошла проверка логина или пароля.' },
    { ru: 'Эскалация', en: 'escalation', def: 'Передача проблемы на следующий уровень поддержки (L3) с собранными фактами.' },
    { ru: 'Перенаправление вывода', en: 'output redirection (> / >>)', def: 'Запись вывода команды в файл: `>` — перезаписать, `>>` — дописать.' },
  ],
};
export default lesson;
