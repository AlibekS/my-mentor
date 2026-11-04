import type { LessonDef } from '../../../../src/content/types';
import { access, accessLog } from '../data';

const in1405 = access.filter((e) => e.time >= '14:05:00' && e.time < '14:10:00').length;
const n50x = access.filter((e) => [502, 503, 504].includes(e.status)).length;

const payLogs = [
  { time: '2026-11-04 13:58:00', priority: 'info' as const, message: 'health ok' },
  { time: '2026-11-04 14:04:58', priority: 'warning' as const, message: 'db pool usage 95%' },
  { time: '2026-11-04 14:05:01', priority: 'err' as const, message: 'db pool exhausted: timeout waiting for connection (30s)' },
  { time: '2026-11-04 14:05:40', priority: 'err' as const, message: 'db pool exhausted: timeout waiting for connection (30s)' },
  { time: '2026-11-04 14:07:12', priority: 'crit' as const, message: 'worker crashed, restarting' },
  { time: '2026-11-04 14:12:30', priority: 'info' as const, message: 'db pool usage 40%' },
  { time: '2026-11-04 14:20:00', priority: 'info' as const, message: 'health ok' },
  { time: '2026-11-04 09:10:00', priority: 'err' as const, message: 'smtp relay timeout' },
];

const lesson: LessonDef = {
  id: 'regex-time',
  title: 'Регулярки, окна времени, tail -f, journalctl',
  minutes: 35,
  commands: ['grep', 'journalctl', 'tail'],
  scenario: {
    files: { '/var/log/nginx/access.log': accessLog },
    services: [{ name: 'payment', description: 'Payment API', active: 'active', enabled: true, mainPid: 2412, logs: payLogs }],
    processes: [{ pid: 2412, user: 'payment', cpu: 12, mem: 6, vsz: 900000, rss: 480000, stat: 'Ssl', start: '09:00', time: '12:31', command: '/usr/bin/payment-api', service: 'payment' }],
  },
  tasks: [
    {
      id: 'e-50x',
      prompt: 'Посчитай ответы с кодами **502, 503 или 504** в `/var/log/nginx/access.log` одним `grep -E`. Выведи число.',
      check: { type: 'outputNumber', value: n50x },
      hints: ['Набор символов: `50[234]`.', "Статус окружён пробелами: `grep -cE '\" 50[234] ' файл`."],
      solution: `grep -cE '" 50[234] ' /var/log/nginx/access.log`,
      tags: ['grep'],
    },
    {
      id: 'window',
      prompt: 'Сколько всего запросов пришло в окне **14:05:00–14:09:59**? Выведи число.',
      check: { type: 'outputNumber', value: in1405 },
      hints: ['Время в логе выглядит так: `04/Nov/2026:14:05:12`.', 'Окно 14:05–14:09 — это `14:0[5-9]`.', "`grep -c '04/Nov/2026:14:0[5-9]' файл`"],
      solution: "grep -c '04/Nov/2026:14:0[5-9]' /var/log/nginx/access.log",
      tags: ['grep'],
    },
    {
      id: 'journal-err',
      prompt: 'У сервиса `payment` логи в journald. Выведи только записи уровня **err и серьёзнее** за период с **14:00** сегодня.',
      check: { type: 'all', checks: [{ type: 'outputContains', value: ['db pool exhausted', 'worker crashed'] }, { type: 'outputNotContains', value: ['health ok', 'smtp relay', 'pool usage'] }] },
      hints: ['`journalctl -u payment` — логи сервиса.', 'Фильтр уровня: `-p err`, время: `--since "14:00"`.'],
      solution: 'journalctl -u payment -p err --since "14:00"',
      tags: ['journalctl'],
    },
    {
      id: 'cause',
      prompt: 'По журналу сервиса `payment`: что закончилось у сервиса в 14:05? Введи ответ (2–3 слова, можно по-английски).',
      answer: { accept: [], normalize: 'keywords', keywords: [['pool', 'пул'], ['db', 'бд', 'баз', 'connection', 'соединен', 'подключ']], label: 'Что закончилось:' },
      hints: ['Посмотри ошибки сервиса за 14:00–14:10.'],
      solution: 'journalctl -u payment --since "14:00" --until "14:10"',
      explanation: '**DB connection pool exhausted** — закончились соединения в пуле к БД: запросы ждали 30 с и падали, nginx отдавал 502.',
      tags: ['journalctl'],
    },
  ],
  quiz: [
    {
      id: 'q-or',
      type: 'command',
      prompt: 'Выведи строки, где есть **ERROR или FATAL**, из файла `/var/log/app/app.log` (одним grep).',
      scenario: { files: { '/var/log/app/app.log': 'INFO a\nERROR b\nWARN c\nFATAL d\nINFO e\n' } },
      solution: 'grep -E "ERROR|FATAL" /var/log/app/app.log',
      explanation: '`grep -E "ERROR|FATAL"` (или `grep -e ERROR -e FATAL`).',
    },
    {
      id: 'q-since',
      type: 'text',
      prompt: 'Какой опцией journalctl ограничить вывод временем «начиная с»? (длинное имя опции)',
      answer: { accept: ['--since', 'since', '-S'] },
      explanation: '`--since "1 hour ago"`, `--since "2026-11-04 14:00"`; конец — `--until`.',
    },
    {
      id: 'q-prio',
      type: 'choice',
      prompt: 'Что покажет `journalctl -p err`?',
      options: ['Только записи уровня err', 'Записи err и более серьёзные (crit, alert, emerg)', 'Записи err и менее серьёзные'],
      correct: 1,
      explanation: '`-p` задаёт порог: этот уровень и всё серьёзнее.',
    },
    {
      id: 'q-dot',
      type: 'text',
      prompt: 'Какой флаг grep ищет фиксированную строку без регулярок (удобно для IP с точками)?',
      answer: { accept: ['-F', 'F', '--fixed-strings'] },
      explanation: '`grep -F 10.0.0.1` — точки не будут означать «любой символ».',
    },
  ],
  glossary: [
    { ru: 'Пул соединений', en: 'connection pool', def: 'Набор заранее открытых соединений к БД, которые переиспользуются.' },
    { ru: 'Журнал systemd', en: 'journald / journal', def: 'Системный журнал, читается командой journalctl.' },
    { ru: 'Уровень важности', en: 'log level / priority', def: 'emerg, alert, crit, err, warning, notice, info, debug.' },
  ],
};
export default lesson;
