import type { LessonDef } from '../../../../../src/content/types';
import type { Scenario } from '../../../../../src/shell/types';

const CONF_PORT = 8080;
const APP_PORT = 8081;
const health = { status: 200, headers: { 'Content-Type': 'application/json' }, body: '{"status":"ok","service":"reports","version":"3.4.0"}\n' };

const proc = (pid: number, user: string, command: string) => ({ pid, user, cpu: 1.2, mem: 6.4, vsz: 3_800_000, rss: 610_000, stat: 'Ssl', start: '09:05', time: '1:02', command });

const scenario: Scenario = {
  host: 'rep-01',
  processes: [
    proc(1, 'root', '/sbin/init'),
    proc(512, 'root', 'sshd: /usr/sbin/sshd -D'),
    proc(1101, 'root', 'nginx: master process /usr/sbin/nginx'),
    proc(2240, 'reports', `/usr/bin/java -jar /opt/reports/reports.jar --server.port=${APP_PORT}`),
    proc(901, 'postgres', '/usr/lib/postgresql/16/bin/postgres'),
  ],
  listeners: [
    { proto: 'tcp', local: '0.0.0.0:22', pid: 512, process: 'sshd' },
    { proto: 'tcp', local: '0.0.0.0:443', pid: 1101, process: 'nginx' },
    { proto: 'tcp', local: `127.0.0.1:${APP_PORT}`, pid: 2240, process: 'java' },
    { proto: 'tcp', local: '127.0.0.1:5432', pid: 901, process: 'postgres' },
  ],
  network: {
    hosts: {
      'api.shopflow.io': { ip: '203.0.113.80', latencyMs: 38 },
      'db.partner.kz': { ip: '91.215.40.12', reachable: false, latencyMs: 12 },
    },
    http: {
      [`http://localhost:${APP_PORT}/health`]: health,
      [`http://127.0.0.1:${APP_PORT}/health`]: health,
      'https://api.shopflow.io/health': { status: 200, body: '{"status":"ok"}\n' },
      'http://db.partner.kz:5432': { status: 0, error: 'timeout', timeMs: 10000 },
    },
  },
  files: {
    '/etc/hostname': 'rep-01\n',
    '/etc/nginx/conf.d/reports.conf': `# ShopFlow Reports\nserver {\n    listen 443 ssl;\n    server_name reports.shopflow.io;\n\n    location / {\n        proxy_pass http://127.0.0.1:${CONF_PORT};\n        proxy_read_timeout 60s;\n    }\n}\n`,
    '/opt/reports/CHANGELOG.txt': `3.4.0 (2026-11-05, 09:05)\n- moved to Spring Boot 3\n- default port changed to ${APP_PORT}\n`,
  },
};

const lesson: LessonDef = {
  id: 'ports',
  title: 'Порты на практике: curl к порту, nc -zv, ss -tlnp',
  minutes: 25,
  commands: ['cat', 'curl', 'ss', 'nc'],
  scenario,
  tasks: [
    {
      id: 'conf',
      prompt:
        'Тикет от офиса клиента в Мумбаи:\n\n> *The Reports page shows "502 Bad Gateway" since this morning.*\n\n' +
        'Ты на сервере отчётов `rep-01`. Сначала посмотри, куда nginx передаёт запросы: какой **порт** указан в `proxy_pass` в файле `/etc/nginx/conf.d/reports.conf`?',
      answer: { accept: [String(CONF_PORT)], normalize: 'number', label: 'Порт:' },
      hints: ['`cat /etc/nginx/conf.d/reports.conf`', 'Строка `proxy_pass http://127.0.0.1:…;` — число после двоеточия.'],
      solution: 'cat /etc/nginx/conf.d/reports.conf',
      tags: ['cat'],
    },
    {
      id: 'refused',
      prompt: `Проверь, отвечает ли кто-нибудь на этом порту: \`curl http://localhost:${CONF_PORT}/health\`. Какую ошибку выдал curl? (своими словами или текст ошибки)`,
      answer: {
        accept: ['connection refused'],
        normalize: 'keywords',
        keywords: [['refused', 'отказ', 'отклон', 'couldnt connect', 'could not connect', 'failed to connect', 'не удалось подключ', 'не подключ', 'не слуша', 'никто не', '(7)', 'код 7', 'ошибка 7']],
        label: 'Ошибка:',
      },
      hints: [`\`curl http://localhost:${CONF_PORT}/health\``, '*Couldn\'t connect to server* — не удалось подключиться к серверу.'],
      solution: `curl http://localhost:${CONF_PORT}/health\n# curl: (7) Failed to connect … Couldn't connect to server`,
      explanation: 'Connection refused: на этом порту никто не слушает. Поэтому nginx и отвечает клиентам 502.',
      tags: ['curl'],
    },
    {
      id: 'real-port',
      prompt: 'Посмотри на сервере, какие TCP-порты слушают и какими процессами. На каком порту **на самом деле** работает приложение reports (`java`)?',
      answer: { accept: [String(APP_PORT)], normalize: 'number', label: 'Порт:' },
      hints: ['`sudo ss -tlnp`', 'Строка с `java`.'],
      solution: 'sudo ss -tlnp',
      explanation: `Приложение слушает ${APP_PORT}, а nginx ждёт его на ${CONF_PORT}. В /opt/reports/CHANGELOG.txt видно, что в версии 3.4.0 сменили порт по умолчанию — конфиг nginx забыли обновить.`,
      tags: ['ss'],
    },
    {
      id: 'health',
      prompt: 'Убедись, что само приложение здорово: запроси `/health` на **правильном** порту и выведи ответ.',
      check: { type: 'all', checks: [{ type: 'outputMatches', pattern: '"status":\\s*"ok"' }, { type: 'outputContains', value: 'reports' }] },
      hints: [`\`curl http://localhost:${APP_PORT}/health\``],
      solution: `curl -s http://localhost:${APP_PORT}/health`,
      explanation: 'Приложение живое — значит, проблема только в «стыковке» nginx и приложения. Это готовый диагноз для эскалации.',
      tags: ['curl'],
    },
    {
      id: 'timeout',
      prompt: 'Отчёты ещё берут данные из базы партнёра `db.partner.kz` (порт 5432). Проверь порт: `nc -zv db.partner.kz 5432`. Какой результат: открыт, отказ (refused) или таймаут?',
      answer: { accept: ['timeout'], normalize: 'keywords', keywords: [['timeout', 'timed out', 'тайм', 'истек', 'не отвеч', 'нет ответа', 'ожидан']], label: 'Результат:' },
      hints: ['`nc -zv db.partner.kz 5432`', '*timed out* — время ожидания истекло.'],
      solution: 'nc -zv db.partner.kz 5432',
      explanation: 'Таймаут — ответа нет совсем. Обычно это фаервол, который молча отбрасывает пакеты (например, партнёр не добавил наш IP в разрешённые). Это отдельная проблема — сообщить партнёру или L3.',
      tags: ['nc'],
    },
  ],
  quiz: [
    { id: 'q-refused', type: 'text', prompt: 'A customer gets *Connection refused*. Did the packet reach the server computer? (yes/no — да/нет)', answer: { accept: ['да', 'yes', 'дошел', 'да, дошел', 'yes, it did', 'yes it did', 'дошёл', 'да дошел'] }, explanation: 'Да: компьютер ответил «здесь никто не слушает». При таймауте ответа нет вовсе.' },
    { id: 'q-z', type: 'text', prompt: 'Какой флаг `nc` проверяет порт, ничего не отправляя (zero-I/O)?', answer: { accept: ['-z', 'z', '-zv', 'nc -z', 'nc -zv'] }, explanation: '`-z`; вместе с `-v` печатает результат: `nc -zv host port`.' },
    { id: 'q-502', type: 'choice', prompt: 'nginx отдаёт клиентам 502 Bad Gateway. Что это чаще всего значит?', options: ['У клиента плохой интернет', 'nginx не получил нормального ответа от приложения, которому передаёт запросы', 'Истёк пароль пользователя'], correct: 1, explanation: '502 — «шлюз» (nginx) не достучался до приложения или получил от него плохой ответ.' },
    {
      id: 'q-ss',
      type: 'command',
      prompt: 'Напиши команду, которая покажет слушающие TCP-порты **с процессами** на этом сервере.',
      scenario,
      solution: 'sudo ss -tlnp',
      check: { type: 'all', checks: [{ type: 'outputContains', value: ['java', String(APP_PORT), 'nginx'] }, { type: 'outputContains', value: 'pid=' }] },
      explanation: '`sudo ss -tlnp` (или `sudo ss -tulpn`). Без `sudo` процессы других пользователей не видно.',
    },
  ],
  glossary: [
    { ru: 'Обратный прокси', en: 'reverse proxy', def: 'Сервер на входе (например, nginx), который передаёт запросы приложениям.' },
    { ru: 'Соединение отклонено', en: 'connection refused', def: 'Узел ответил, что на порту никто не слушает.' },
    { ru: 'Таймаут', en: 'timeout / timed out', def: 'Ответа не было за отведённое время.' },
    { ru: 'Ошибка шлюза', en: '502 Bad Gateway', def: 'Прокси не получил нормального ответа от приложения.' },
  ],
};
export default lesson;
