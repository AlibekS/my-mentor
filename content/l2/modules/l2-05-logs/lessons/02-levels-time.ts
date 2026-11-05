import type { LessonDef } from '../../../../../src/content/types';
import { almaty, background, buildLog, hm, type LogEntry } from '../data';

const FATAL_AT = hm(9, 47, 31);
const trace = [
  'java.lang.IllegalStateException: Email worker crashed',
  '    at com.shop.notify.EmailWorker.run(EmailWorker.java:61)',
  '    at java.base/java.lang.Thread.run(Thread.java:833)',
  'Caused by: com.shop.notify.SmtpException: Cannot send order confirmation',
  '    at com.shop.notify.SmtpClient.send(SmtpClient.java:97)',
  'Caused by: java.net.UnknownHostException: smtp.mailer-provider.example',
  '    at java.base/java.net.InetAddress.getAllByName(InetAddress.java:1302)',
];
const story: LogEntry[] = [
  { sec: hm(8, 12, 30), level: 'INFO', service: 'api', requestId: 'req-118ab2', userId: 'u-2077', orderId: 'ORD-60101', msg: 'POST /api/checkout' },
  { sec: hm(8, 12, 31), level: 'ERROR', service: 'payment', requestId: 'req-118ab2', userId: 'u-2077', orderId: 'ORD-60101', msg: 'Card expired' },
  { sec: hm(9, 21, 5), level: 'INFO', service: 'api', requestId: 'req-3d90f4', userId: 'u-2077', orderId: 'ORD-60277', msg: 'POST /api/checkout' },
  { sec: hm(9, 21, 6), level: 'INFO', service: 'checkout', requestId: 'req-3d90f4', userId: 'u-2077', orderId: 'ORD-60277', msg: 'Order created' },
  { sec: hm(9, 21, 7), level: 'ERROR', service: 'payment', requestId: 'req-3d90f4', userId: 'u-2077', orderId: 'ORD-60277', msg: 'Insufficient funds' },
  { sec: FATAL_AT, level: 'FATAL', service: 'notify', msg: 'Unhandled exception, email worker stopped', extra: trace },
];
// после падения email-воркера писем больше нет
const bg = background({ seed: 202, from: hm(8, 0), to: hm(10, 0) }).filter((e) => !(e.service === 'notify' && e.sec > FATAL_AT));
const { entries, lines, text } = buildLog(bg, story);
const nErr = entries.filter((e) => e.level === 'ERROR').length;
const fatalLine = lines.find((l) => l.includes(' FATAL '))!.split('\n')[0];

const ticket = `Ticket: ZD-7781
From: Aliya N. <aliya.n@example.kz>
Subject: Payment error

Hello!
Today at about 14:20 (Almaty time) I tried to pay and got an error.
My user ID is u-2077. Can you check what happened?

Aliya
`;

const lesson: LessonDef = {
  id: 'levels-time',
  title: 'Уровни и время: UTC и Алматы',
  minutes: 25,
  commands: ['grep'],
  scenario: { host: 'shop-app-01', files: { '/var/log/shop/app.log': text, '/home/alibek/tickets/ZD-7781.txt': ticket } },
  tasks: [
    {
      id: 'count',
      prompt: 'Сколько в логе `/var/log/shop/app.log` строк уровня **ERROR**? Выведи число командой.',
      check: { type: 'outputNumber', value: nErr },
      hints: ['Посчитать строки — `grep -c`.', '`grep -c ERROR /var/log/shop/app.log`'],
      solution: 'grep -c ERROR /var/log/shop/app.log',
      explanation: `ERROR-строк — ${nErr}. Большинство — отказы банков (Card declined, Insufficient funds): это ошибки клиентов, а не поломка магазина.`,
      tags: ['grep'],
    },
    {
      id: 'ticket-time',
      prompt:
        'Тикет на английском лежит в `~/tickets/ZD-7781.txt`. Клиентка пишет время **по Алматы**, а лог — в **UTC**. Найди её ошибку **в то время, о котором она пишет**, и введи **request_id** этого запроса.',
      answer: { accept: ['req-3d90f4', 'request_id=req-3d90f4'], label: 'request_id:' },
      hints: [
        '`cat ~/tickets/ZD-7781.txt` — время и user_id.',
        '14:20 по Алматы − 5 часов = 09:20 UTC. У клиентки две ошибки за день — нужна та, что около 09:20.',
        "`grep user_id=u-2077 /var/log/shop/app.log | grep ERROR` или `grep 'T09:2' /var/log/shop/app.log | grep u-2077`",
      ],
      solution: "cat ~/tickets/ZD-7781.txt\ngrep user_id=u-2077 /var/log/shop/app.log | grep ERROR",
      explanation: 'В 08:12 UTC (13:12 Алматы) у неё была другая ошибка — Card expired. В 09:21:07 UTC (14:21 Алматы) — Insufficient funds, request_id `req-3d90f4`. Без перевода времени легко взять не ту строку.',
      tags: ['grep'],
    },
    {
      id: 'fatal',
      prompt: 'В логе есть одна строка уровня **FATAL** — за ней идёт стек-трейс. Выведи строку FATAL **вместе со стек-трейсом** (7 строк после неё).',
      check: {
        type: 'all',
        checks: [
          { type: 'outputContains', value: [fatalLine, trace[trace.length - 2]] },
          { type: 'custom', fn: (_sh, last) => !!last && last.stdout.split('\n').filter((l) => l.trim()).length <= 25 },
        ],
      },
      hints: ['Строки после совпадения показывает флаг `-A` (after) с числом.', '`grep -A 7 FATAL /var/log/shop/app.log`'],
      solution: 'grep -A 7 FATAL /var/log/shop/app.log',
      explanation: '`-A 7` — совпадение и 7 строк после. Можно взять и с запасом (`-A 10`) — лишние строки после трейса не помешают.',
      tags: ['grep'],
    },
    {
      id: 'caused-by',
      prompt:
        'Прочитай стек-трейс (он на английском). Найди **последнюю** строку `Caused by:` — это настоящая причина. Что не получилось у сервиса? Ответь своими словами.',
      answer: {
        accept: [],
        normalize: 'keywords',
        keywords: [['unknownhost', 'unknown host', 'dns', 'хост', 'host', 'адрес', 'имя сервера', 'имени', 'resolve', 'резолв', 'не найд', 'неизвестн']],
        label: 'Причина:',
        placeholder: 'например: не удалось найти …',
      },
      hints: ['`grep "Caused by" /var/log/shop/app.log`', '*UnknownHostException: smtp.mailer-provider.example* — «неизвестный хост»: сервер не смог найти адрес по имени (проблема DNS или опечатка в имени).'],
      solution: 'grep "Caused by" /var/log/shop/app.log',
      explanation: '*UnknownHostException* — сервис не смог узнать IP-адрес почтового сервера `smtp.mailer-provider.example` по имени (DNS). Поэтому письма не отправились и email-воркер упал. Строки `at …` — места в коде, их L2 просто прикладывает к эскалации.',
      tags: ['grep'],
    },
    {
      id: 'almaty',
      prompt: 'L3 спросит, когда клиенты перестали получать письма. Строка FATAL записана в UTC. **Во сколько это было по Алматы** (UTC+5)? Введи часы и минуты.',
      answer: { accept: [], normalize: 'keywords', keywords: [[almaty(FATAL_AT)]], label: 'Время в Алматы:', placeholder: 'ЧЧ:ММ' },
      hints: ['Время FATAL — в начале строки, перед буквой Z.', 'К времени UTC прибавь 5 часов.'],
      solution: 'grep FATAL /var/log/shop/app.log',
      explanation: `09:47 UTC + 5 часов = ${almaty(FATAL_AT)} по Алматы. В эскалации пиши оба: «09:47 UTC (${almaty(FATAL_AT)} Алматы)».`,
    },
  ],
  quiz: [
    {
      id: 'q-utc',
      type: 'text',
      prompt: 'Строка лога: `2026-11-03T21:40:00Z`. Сколько это по Алматы (UTC+5)? Запиши время **и дату**, например «… 3 ноября».',
      answer: { accept: [], normalize: 'keywords', keywords: [['2:40'], ['4 ноя', '4 nov', 'nov 4', 'ноября 4', '04', '4.11', '4-', '4го', '4 числ', 'следующ', 'next day']] },
      explanation: '21:40 + 5 часов = 02:40 **следующего дня** — 4 ноября. При переходе через полночь меняется дата.',
    },
    {
      id: 'q-to-utc',
      type: 'text',
      prompt: 'Клиент из Астаны: «ошибка была в 10:15 по моему времени». Какое время искать в логе (UTC)?',
      answer: { accept: ['05:15', '5:15', '05:15 utc', '5:15 utc', '05:15z', 'T05:15'], normalize: 'text' },
      explanation: 'Казахстан — UTC+5, значит, UTC = 10:15 − 5 = 05:15.',
    },
    {
      id: 'q-level',
      type: 'choice',
      prompt: 'Какой уровень означает, что **сервис упал целиком** и нужна срочная эскалация?',
      options: ['INFO', 'WARN', 'FATAL'],
      correct: 2,
      explanation: '`FATAL` (или `CRITICAL`) — программа не может продолжать работу. `WARN` — подозрительно, но работает.',
    },
    {
      id: 'q-after',
      type: 'command',
      prompt: 'Выведи строку с `FATAL` и **3 строки после** неё из `/var/log/shop/app.log`.',
      scenario: { files: { '/var/log/shop/app.log': text } },
      solution: 'grep -A 3 FATAL /var/log/shop/app.log',
      explanation: '`grep -A 3 FATAL файл` — after context. `-B` — строки до, `-C` — вокруг.',
    },
  ],
  glossary: [
    { ru: 'Всемирное координированное время', en: 'UTC', def: 'Время «без пояса», в нём пишут логи серверов. Казахстан = UTC+5.' },
    { ru: 'Часовой пояс', en: 'time zone', def: 'Сдвиг местного времени от UTC, например +5 для Алматы.' },
    { ru: 'Стек-трейс', en: 'stack trace', def: 'Список мест в коде, где произошла ошибка; причина — в последнем `Caused by`.' },
    { ru: 'Исключение', en: 'exception', def: 'Ошибка внутри программы (UnknownHostException, TimeoutException…).' },
    { ru: 'Предупреждение', en: 'warning (WARN)', def: 'Подозрительное событие, но работа продолжается.' },
  ],
};
export default lesson;
