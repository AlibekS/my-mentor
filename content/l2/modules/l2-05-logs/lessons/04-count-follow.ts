import type { LessonDef } from '../../../../../src/content/types';
import { background, buildLog, hm, line, type LogEntry } from '../data';

// всплеск ошибок склада 09:30–09:40 — их больше, чем отказов банков
const story: LogEntry[] = Array.from({ length: 14 }, (_, i) => ({
  sec: hm(9, 30, 5) + i * 41,
  level: 'ERROR' as const,
  service: 'inventory',
  requestId: `req-1nv${String(i).padStart(3, '0')}`,
  userId: `u-${1101 + ((i * 7) % 24)}`,
  msg: 'Stock service unavailable, cannot reserve items',
}));
const { entries, text } = buildLog(background({ seed: 404, from: hm(9, 0), to: hm(10, 0) }), story);
const nErr = entries.filter((e) => e.level === 'ERROR').length;
const levelCounts = new Map<string, number>();
for (const e of entries) levelCounts.set(e.level, (levelCounts.get(e.level) ?? 0) + 1);
const errByService = new Map<string, number>();
for (const e of entries.filter((x) => x.level === 'ERROR')) errByService.set(e.service, (errByService.get(e.service) ?? 0) + 1);
const [topService, topCount] = [...errByService.entries()].sort((a, b) => b[1] - a[1])[0];

// «прямой эфир»: клиент u-1042 пробует оплатить, пока ты смотришь tail -f
const live: LogEntry[] = [
  { sec: hm(10, 0, 3), level: 'INFO', service: 'auth', requestId: 'req-f00a10', userId: 'u-1105', msg: 'User logged in' },
  { sec: hm(10, 0, 9), level: 'INFO', service: 'api', requestId: 'req-f00a2c', userId: 'u-1042', orderId: 'ORD-60790', msg: 'POST /api/checkout' },
  { sec: hm(10, 0, 10), level: 'WARN', service: 'payment', requestId: 'req-f00a2c', userId: 'u-1042', orderId: 'ORD-60790', msg: '3-D Secure page opened, waiting for customer' },
  { sec: hm(10, 5, 10), level: 'ERROR', service: 'payment', requestId: 'req-f00a2c', userId: 'u-1042', orderId: 'ORD-60790', msg: '3-D Secure verification failed: customer did not confirm the payment in the bank app within 5 minutes' },
];

const lesson: LessonDef = {
  id: 'count-follow',
  title: 'Считаем и следим: пайпы, sort | uniq -c, tail -f',
  minutes: 25,
  commands: ['grep', 'wc', 'awk', 'sort', 'uniq', 'tail'],
  scenario: { host: 'shop-app-01', files: { '/var/log/shop/app.log': text }, streams: { '/var/log/shop/app.log': live.map((e) => line(e)) } },
  tasks: [
    {
      id: 'count',
      prompt: 'Сколько всего строк с `ERROR` в `/var/log/shop/app.log`? Посчитай **через пайп**: найди строки и передай их в `wc -l`.',
      check: { type: 'outputNumber', value: nErr },
      hints: ['Первая команда находит строки, вторая — считает.', '`grep ERROR /var/log/shop/app.log | wc -l`'],
      solution: 'grep ERROR /var/log/shop/app.log | wc -l',
      explanation: `Ошибок — ${nErr}. \`grep -c ERROR\` дал бы то же число.`,
      tags: ['grep', 'wc', 'pipes'],
    },
    {
      id: 'levels',
      prompt: 'Построй «сводку по уровням»: сколько в логе строк **каждого уровня** (DEBUG, INFO, WARN, ERROR). Уровень — вторая колонка строки.',
      check: {
        type: 'custom',
        fn: (_sh, last) => {
          if (!last) return false;
          const got = new Map<string, number>();
          for (const l of last.stdout.split('\n')) {
            const m = /^\s*(\d+)\s+([A-Z]+)\s*$/.exec(l);
            if (m) got.set(m[2], parseInt(m[1], 10));
          }
          return got.size === levelCounts.size && [...levelCounts].every(([k, v]) => got.get(k) === v);
        },
      },
      hints: ["Вторая колонка: `awk '{print $2}' /var/log/shop/app.log`.", 'Чтобы посчитать каждое значение: `| sort | uniq -c`.', "`awk '{print $2}' /var/log/shop/app.log | sort | uniq -c`"],
      solution: "awk '{print $2}' /var/log/shop/app.log | sort | uniq -c",
      explanation: `Сводка: ${[...levelCounts].map(([k, v]) => `${k} — ${v}`).join(', ')}. \`sort\` ставит одинаковые уровни рядом, \`uniq -c\` считает каждый.`,
      tags: ['awk', 'sort', 'uniq', 'pipes'],
    },
    {
      id: 'top-service',
      prompt: 'У **какого сервиса** больше всего ошибок? Сервис — третья колонка (`[…]`). Посчитай и введи имя сервиса.',
      answer: { accept: [topService, `[${topService}]`], label: 'Сервис:' },
      hints: ['Сначала оставь только ошибки, потом достань третью колонку.', "`grep ERROR /var/log/shop/app.log | awk '{print $3}' | sort | uniq -c`"],
      solution: "grep ERROR /var/log/shop/app.log | awk '{print $3}' | sort | uniq -c | sort -rn",
      explanation: `\`[${topService}]\` — ${topCount} ошибок, больше, чем отказов банков у \`[payment]\`. Это уже не проблема одного клиента — повод сообщить L3.`,
      tags: ['awk', 'sort', 'uniq', 'pipes'],
    },
    {
      id: 'live',
      prompt:
        "Клиент `u-1042` в чате: *«I'm trying to pay right now»*. Запусти **слежение** за `/var/log/shop/app.log` и посмотри, что приходит. Последняя новая строка — ошибка на английском. **Что пошло не так?** Ответь своими словами.",
      answer: {
        accept: [],
        normalize: 'keywords',
        keywords: [['3-d', '3d', '3ds', 'secure', 'подтвер', 'confirm', 'верифик', 'verif']],
        label: 'Что случилось:',
        placeholder: 'например: клиент не …',
      },
      hints: ['Слежение — `tail -f файл`. Выход в реальной жизни — Ctrl+C.', 'Можно следить только за клиентом: `tail -f /var/log/shop/app.log | grep u-1042`.', '*did not confirm the payment in the bank app* — не подтвердил оплату в приложении банка.'],
      solution: 'tail -f /var/log/shop/app.log',
      explanation: '*3-D Secure verification failed: customer did not confirm the payment in the bank app within 5 minutes* — клиент не подтвердил оплату в приложении банка за 5 минут. Магазин работает; ответ клиенту: «Please confirm the payment in your bank app when it asks».',
      tags: ['tail'],
    },
  ],
  quiz: [
    {
      id: 'q-uniq',
      type: 'choice',
      prompt: 'Почему перед `uniq -c` почти всегда ставят `sort`?',
      options: ['uniq склеивает только соседние одинаковые строки', 'sort ускоряет работу терминала', 'Без sort uniq выдаёт ошибку'],
      correct: 0,
      explanation: '`uniq` смотрит только на соседние строки. `sort` ставит одинаковые значения рядом, и счёт получается верным.',
    },
    {
      id: 'q-follow',
      type: 'text',
      prompt: 'Какой флаг `tail` позволяет следить за новыми строками в файле в реальном времени?',
      answer: { accept: ['-f', 'f', '--follow', '-F'] },
      explanation: '`tail -f` — follow. Выход — Ctrl+C.',
    },
    {
      id: 'q-stop',
      type: 'text',
      prompt: 'Какой комбинацией клавиш остановить `tail -f`?',
      answer: { accept: ['ctrl+c', 'ctrl c', 'ctrl-c', '^c', 'контрол c', 'ctrl + c', 'ctr+c'] },
      explanation: '`Ctrl+C` прерывает работающую команду.',
    },
    {
      id: 'q-wc-cmd',
      type: 'command',
      prompt: 'Посчитай строки с `WARN` в `/var/log/shop/app.log`, используя **пайп** и `wc -l`.',
      scenario: { files: { '/var/log/shop/app.log': text } },
      solution: 'grep WARN /var/log/shop/app.log | wc -l',
      check: { type: 'all', checks: [{ type: 'outputNumber', value: levelCounts.get('WARN') ?? 0 }, { type: 'minPipes', value: 1 }] },
      explanation: '`grep WARN файл | wc -l` — найти и посчитать.',
    },
  ],
  glossary: [
    { ru: 'Пайп, конвейер', en: 'pipe (|)', def: 'Передаёт вывод одной команды на вход следующей.' },
    { ru: 'Колонка, поле', en: 'field, column ($1, $2…)', def: 'Часть строки между пробелами; `awk` печатает нужную.' },
    { ru: 'Следить за файлом', en: 'follow (tail -f)', def: 'Показывать новые строки лога, как только они появляются.' },
    { ru: 'Проверка 3-D Secure', en: '3-D Secure (3DS)', def: 'Подтверждение онлайн-оплаты в приложении банка или по SMS.' },
  ],
};
export default lesson;
