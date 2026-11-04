import type { LessonDef } from '../../../../src/content/types';
import { baseProcs } from '../data';

const scenario = {
  host: 'web-prod-03',
  processes: [
    ...baseProcs.filter((p) => p.service !== 'nginx'),
    { pid: 6610, user: 'root', cpu: 0.3, mem: 0.6, vsz: 210_000, rss: 41_000, stat: 'S', start: '02:14', time: '0:09', command: 'python3 -m http.server 80' },
    { pid: 6655, user: 'root', cpu: 188.4, mem: 0.9, vsz: 98_000, rss: 70_000, stat: 'R', start: '02:20', time: '658:12', command: 'stress --cpu 2 --timeout 0' },
  ],
  listeners: [
    { proto: 'tcp' as const, local: '0.0.0.0:22', pid: 512, process: 'sshd' },
    { proto: 'tcp' as const, local: '127.0.0.1:5432', pid: 901, process: 'postgres' },
    { proto: 'tcp' as const, local: '127.0.0.1:8080', pid: 2240, process: 'java' },
    { proto: 'tcp' as const, local: '0.0.0.0:80', pid: 6610, process: 'python3' },
  ],
  resources: { load: [2.31, 2.18, 2.05] as [number, number, number] },
  services: [
    {
      name: 'nginx',
      description: 'A high performance web server and a reverse proxy server',
      active: 'failed' as const,
      enabled: true,
      logs: [
        { time: '2026-11-04 02:15:01', priority: 'info' as const, message: 'Stopping nginx...' },
        { time: '2026-11-04 02:15:01', priority: 'info' as const, message: 'Stopped nginx.' },
        { time: '2026-11-04 02:30:00', priority: 'info' as const, message: 'Starting nginx...' },
        { time: '2026-11-04 02:30:00', priority: 'err' as const, message: 'nginx: [emerg] bind() to 0.0.0.0:80 failed (98: Address already in use)' },
        { time: '2026-11-04 02:30:00', priority: 'err' as const, message: "nginx.service: Failed with result 'exit-code'." },
      ],
      startProcess: { user: 'root', cpu: 0.1, mem: 0.2, vsz: 55_000, rss: 9_000, stat: 'Ss', start: '08:10', time: '0:00', command: 'nginx: master process /usr/sbin/nginx' },
      listen: [{ proto: 'tcp' as const, local: '0.0.0.0:80' }],
    },
    { name: 'shop', description: 'Shop web application', active: 'active' as const, enabled: true, mainPid: 2240, logs: [] },
  ],
};

const lesson: LessonDef = {
  id: 'boss',
  kind: 'boss',
  title: 'Сайт лёг после ночных работ',
  minutes: 35,
  incident: { ticket: 'INC-4012: «Сайт недоступен с утра, nginx failed»', severity: 'SEV1', customer: 'все пользователи' },
  commands: ['systemctl', 'journalctl', 'ss', 'ps', 'kill', 'curl'],
  scenario,
  tasks: [
    {
      id: 'failed',
      prompt: 'Какие юниты упали? Введи имя сервиса.',
      answer: { accept: ['nginx', 'nginx.service'], label: 'Сервис:' },
      hints: ['`systemctl --failed`'],
      solution: 'systemctl --failed',
      tags: ['systemctl'],
    },
    {
      id: 'why',
      prompt: 'Почему nginx не стартует? Найди в журнале ошибку и введи **номер порта**, который не удалось занять.',
      answer: { accept: ['80'], normalize: 'number', label: 'Порт:' },
      hints: ['`journalctl -u nginx -n 10`', 'Ищи `bind() ... failed`.'],
      solution: 'journalctl -u nginx -n 10',
      tags: ['journalctl'],
    },
    {
      id: 'who',
      prompt: 'Кто занял порт 80? Найди процесс и введи его **PID**.',
      answer: { accept: ['6610'], normalize: 'number', label: 'PID:' },
      hints: ['`ss -tulpn` показывает слушающие порты и процессы (чужие — через sudo).', '`sudo ss -tulpn | grep :80`'],
      solution: 'sudo ss -tulpn | grep ":80 "',
      tags: ['ss'],
    },
    {
      id: 'free-and-start',
      prompt: 'Это забытый тестовый `python3 -m http.server 80`. Заверши его **корректно** (SIGTERM) и запусти nginx. Задание засчитается, когда nginx станет active.',
      check: { type: 'all', checks: [{ type: 'processGone', pid: 6610 }, { type: 'serviceState', name: 'nginx', state: 'active' }] },
      hints: ['Процесс от root → `sudo kill 6610`.', '`sudo systemctl start nginx`'],
      solution: 'sudo kill 6610 && sudo systemctl start nginx',
      tags: ['kill', 'systemctl'],
    },
    {
      id: 'load',
      prompt: 'Load average > 2 на 2-ядерном сервере. Найди процесс, который грузит CPU, и заверши его корректно.',
      check: { type: 'all', checks: [{ type: 'processGone', pid: 6655 }, { type: 'custom', fn: (sh) => !sh.log.some((r) => /kill\s+-9\s+6655/.test(r.line)) }] },
      hints: ['`ps aux --sort=-%cpu | head -3`', '`sudo kill 6655` (без -9 — сначала вежливо).'],
      solution: 'sudo kill 6655',
      tags: ['ps', 'kill'],
    },
    {
      id: 'verify',
      prompt: 'Проверь, что сайт снова отвечает: запроси **заголовки** `http://localhost`.',
      check: { type: 'all', checks: [{ type: 'outputContains', value: 'HTTP/1.1 200' }, { type: 'commandUsed', name: 'curl' }] },
      hints: ['`curl -I http://localhost`'],
      solution: 'curl -I http://localhost',
      tags: ['curl'],
    },
  ],
  quiz: [
    { id: 'q-98', type: 'text', prompt: 'Ошибка `bind() ... failed (98: Address already in use)`. Что она значит одной фразой? (ключевые слова: порт занят)', answer: { accept: [], normalize: 'keywords', keywords: [['порт', 'port', 'адрес', 'address'], ['занят', 'используется', 'in use', 'busy']] }, explanation: 'Порт уже слушает другой процесс; найти его — `ss -tulpn` или `lsof -i :80`.' },
    { id: 'q-rca', type: 'text', prompt: 'RCA: что стало первопричиной недоступности сайта? (ключевые слова: тестовый процесс/http.server и порт 80)', answer: { accept: [], normalize: 'keywords', keywords: [['тест', 'http.server', 'python', 'стажер', 'стажёр', 'ручн'], ['80', 'порт', 'port']] }, explanation: 'Ручной тестовый процесс на проде занял порт 80; при перезапуске nginx не смог его занять.' },
    { id: 'q-prevent', type: 'choice', prompt: 'Какой action item лучше всего предотвратит повтор?', options: ['Запретить ночные работы', 'Работы на проде только через change-процесс и с проверкой после; алерт на failed-юниты и недоступность сайта', 'Всегда делать kill -9 всему подозрительному'], correct: 1, explanation: 'Процесс изменений + мониторинг закрывают и причину, и время обнаружения (инцидент заметили только утром).' },
  ],
  glossary: [
    { ru: 'Средняя нагрузка', en: 'load average', def: 'Среднее число процессов, готовых к работе или ждущих I/O, за 1/5/15 минут.' },
    { ru: 'Слушающий сокет', en: 'listening socket', def: 'Порт, на котором процесс принимает соединения.' },
  ],
};
export default lesson;
