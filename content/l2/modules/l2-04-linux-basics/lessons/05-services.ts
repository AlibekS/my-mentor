import type { LessonDef } from '../../../../../src/content/types';
import type { JournalEntry, Service } from '../../../../../src/shell/types';

const apiLogs: JournalEntry[] = [
  { time: '2026-11-04 09:30:00', priority: 'info', message: 'Starting Shop API...' },
  { time: '2026-11-04 09:30:02', priority: 'info', message: 'Started Shop API.' },
  { time: '2026-11-04 09:51:58', priority: 'warning', message: 'Redis connection lost, reconnecting (attempt 1/3)' },
  { time: '2026-11-04 09:52:03', priority: 'warning', message: 'Redis reconnect attempt 2/3 failed' },
  { time: '2026-11-04 09:52:08', priority: 'err', message: 'Error: Redis connection to 10.0.3.15:6379 failed - connect ECONNREFUSED' },
  { time: '2026-11-04 09:52:08', priority: 'crit', message: 'Cannot start without cache, exiting' },
  { time: '2026-11-04 09:52:08', priority: 'err', message: 'shop-api.service: Main process exited, code=exited, status=1/FAILURE' },
  { time: '2026-11-04 09:52:08', priority: 'err', message: "shop-api.service: Failed with result 'exit-code'." },
];
const last5 = apiLogs.slice(-5);

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
  { name: 'shop-api', description: 'Shop API', active: 'failed', enabled: true, logs: apiLogs },
  {
    name: 'shop-worker',
    description: 'Shop background jobs (emails, invoices)',
    active: 'active',
    enabled: true,
    mainPid: 1420,
    since: 'Sat 2026-11-01 08:00:05 +05',
    logs: [{ time: '2026-11-01 08:00:05', priority: 'info', message: 'Started Shop background jobs (emails, invoices).' }],
  },
];

const lesson: LessonDef = {
  id: 'services',
  title: 'Сервисы: systemctl status и journalctl',
  minutes: 25,
  commands: ['systemctl', 'journalctl'],
  scenario: { host: 'shop-web-01', services },
  tasks: [
    {
      id: 'nginx',
      prompt: 'Проверь, работает ли веб-сервер `nginx`. Посмотри его статус и введи состояние из строки `Active:`.',
      answer: { accept: ['active', 'active (running)', 'running', 'работает', 'активен', 'активный', 'запущен', 'да'], label: 'Состояние:' },
      hints: ['Статус сервиса — `systemctl status имя`.', '`systemctl status nginx` — смотри строку `Active:`.'],
      solution: 'systemctl status nginx',
      explanation: '`Active: active (running)` — nginx работает.',
      tags: ['systemctl'],
    },
    {
      id: 'failed',
      prompt: 'Клиенты жалуются на ошибки при оформлении заказа. Узнай, **какой сервис упал** на этом сервере. Введи его имя.',
      answer: { accept: ['shop-api', 'shop-api.service'], label: 'Сервис:' },
      hints: ['Список упавших сервисов — `systemctl --failed`.', 'Можно посмотреть и все сервисы: `systemctl list-units --type=service`.'],
      solution: 'systemctl --failed',
      explanation: '`shop-api` в состоянии `failed`. nginx и shop-worker работают.',
      tags: ['systemctl'],
    },
    {
      id: 'journal',
      prompt: 'Выведи **последние 5 строк** журнала сервиса `shop-api`.',
      check: {
        type: 'all',
        checks: [
          { type: 'outputLines', value: 5 },
          { type: 'outputContains', value: [last5[0].message, last5[4].message] },
        ],
      },
      hints: ['Журнал сервиса — `journalctl -u имя`.', 'Сколько последних строк — флаг `-n`: `journalctl -u shop-api -n 5`.'],
      solution: 'journalctl -u shop-api -n 5',
      explanation: '`-u shop-api` — только этот сервис, `-n 5` — последние 5 строк. Подойдёт и `journalctl -u shop-api | tail -n 5`.',
      tags: ['journalctl'],
    },
    {
      id: 'cause',
      prompt:
        'Найди в журнале `shop-api` строку с `Error` — она на английском. Прочитай её: **к чему** сервис не смог подключиться? Ответь по-русски или по-английски.',
      answer: {
        accept: [],
        normalize: 'keywords',
        keywords: [['redis', 'редис', 'кэш', 'кеш', 'cache', '6379', '10.0.3.15']],
        label: 'Не смог подключиться к:',
      },
      hints: ['Найди строку с `Error` в `journalctl -u shop-api`.', '*Redis connection … failed* — не удалось подключиться к Redis (это кэш, *cache*), адрес 10.0.3.15:6379.'],
      solution: 'journalctl -u shop-api -n 5',
      explanation: 'shop-api не смог подключиться к Redis (кэш) на 10.0.3.15:6379 — *connection refused*, и без кэша завершился. Проблема, скорее всего, на стороне Redis — это пойдёт в эскалацию.',
      tags: ['journalctl'],
    },
    {
      id: 'time',
      prompt: 'Во сколько (по времени сервера) `shop-api` упал? Найди в журнале строку `Failed with result` и введи время (часы и минуты).',
      answer: { accept: [], normalize: 'keywords', keywords: [['9:52']], label: 'Время:', placeholder: 'ЧЧ:ММ' },
      hints: ['`journalctl -u shop-api` — время в начале каждой строки.', 'Или `systemctl status shop-api` — внизу последние строки журнала.'],
      solution: "journalctl -u shop-api | grep 'Failed with result'",
      explanation: 'Сервис упал в 09:52:08 по времени сервера. Время падения — обязательная часть эскалации.',
      tags: ['journalctl'],
    },
  ],
  quiz: [
    {
      id: 'q-status',
      type: 'command',
      prompt: 'Покажи статус сервиса `nginx`.',
      scenario: { services: [services[0]] },
      solution: 'systemctl status nginx',
      explanation: '`systemctl status nginx` (можно `nginx.service`).',
    },
    {
      id: 'q-journal',
      type: 'text',
      prompt: 'Какой командой посмотреть журнал только сервиса `shop-api`? (команда целиком)',
      answer: { accept: [], normalize: 'keywords', keywords: [['journalctl'], ['-u', '--unit', '-xeu'], ['shop-api']] },
      explanation: '`journalctl -u shop-api`; добавь `-n 20` для последних 20 строк.',
    },
    {
      id: 'q-enabled',
      type: 'text',
      prompt: 'В статусе: `Loaded: loaded (…; enabled; …)` и `Active: inactive (dead)`. Работает ли сервис сейчас? (да/нет)',
      answer: { accept: ['нет', 'no', 'не работает', 'нет, не работает', 'остановлен', 'нет, остановлен'] },
      explanation: '`enabled` — только автозапуск при загрузке. «Работает или нет» — в строке `Active`: `inactive (dead)` — остановлен.',
    },
    {
      id: 'q-what-next',
      type: 'choice',
      prompt: 'L2 видит, что `shop-api` в состоянии `failed`. Runbook для этого случая нет. Что правильно?',
      options: [
        'Перезапустить сервис несколько раз, пока не заработает',
        'Записать статус, ошибку из журнала и время падения и эскалировать в L3',
        'Закрыть тикет: nginx ведь работает',
      ],
      correct: 1,
      explanation: 'Без runbook L2 собирает факты и эскалирует. Перезапуск вслепую может стереть следы и не устранить первопричину.',
    },
  ],
  glossary: [
    { ru: 'Сервис, демон', en: 'service, daemon', def: 'Программа, которая постоянно работает в фоне.' },
    { ru: 'Журнал systemd', en: 'journal', def: 'Общий журнал сообщений сервисов, читается `journalctl`.' },
    { ru: 'Автозапуск', en: 'enabled', def: 'Сервис стартует сам при загрузке сервера.' },
    { ru: 'Упал', en: 'failed / down', def: 'Сервис завершился с ошибкой и не работает.' },
    { ru: 'В соединении отказано', en: 'connection refused (ECONNREFUSED)', def: 'По адресу никто не принимает подключения.' },
    { ru: 'Инструкция', en: 'runbook', def: 'Пошаговый документ: что делать в известной ситуации.' },
  ],
};
export default lesson;
