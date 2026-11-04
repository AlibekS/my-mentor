import type { LessonDef } from '../../../../src/content/types';
import { access, accessLog, stats } from '../data';

const bytes5xx = access.filter((e) => e.status >= 500).reduce((s, e) => s + e.bytes, 0);
const totalBytes = access.reduce((s, e) => s + e.bytes, 0);

const lesson: LessonDef = {
  id: 'fields',
  title: 'Поля: cut, awk и формат access.log',
  minutes: 35,
  commands: ['awk', 'cut'],
  scenario: { files: { '/var/log/nginx/access.log': accessLog } },
  tasks: [
    {
      id: 'status-dist',
      prompt: 'Построй **распределение HTTP-статусов** в `/var/log/nginx/access.log`: сколько раз встречается каждый код. Статус — 9-е поле.',
      // «21 502» (sort | uniq -c) или «502 21» (awk-массив из теории) — порядок колонок не важен
      check: { type: 'all', checks: [{ type: 'outputMatches', pattern: `^[ \\t]*(${stats.s502}[ \\t]+502|502[ \\t]+${stats.s502})[ \\t]*$` }, { type: 'outputMatches', pattern: '^[ \\t]*(\\d+[ \\t]+200|200[ \\t]+\\d+)[ \\t]*$' }] },
      hints: ["`awk '{print $9}' файл` выведет все статусы.", 'Дальше рецепт: `| sort | uniq -c | sort -rn`.'],
      solution: "awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c | sort -rn",
      tags: ['awk', 'pipes'],
    },
    {
      id: 'urls-502',
      prompt: 'Выведи **время и URL** (поля 4 и 7) всех запросов со статусом **502**.',
      check: { type: 'all', checks: [{ type: 'outputLines', value: stats.s502 }, { type: 'outputContains', value: `[04/Nov/2026:${stats.first502} /api/` }, { type: 'outputNotContains', value: ' 502' }] },
      hints: ['Условие в awk: `$9 == 502`.', "`awk '$9 == 502 {print $4, $7}' файл`"],
      solution: "awk '$9 == 502 {print $4, $7}' /var/log/nginx/access.log",
      tags: ['awk'],
    },
    {
      id: 'sum-bytes',
      prompt: 'Сколько **байт** отдал сервер всего (сумма 10-го поля)? Выведи число одной awk-командой.',
      check: { type: 'outputNumber', value: totalBytes },
      hints: ['Накопи сумму: `{s += $10}`.', 'Выведи в конце: `END {print s}`.'],
      solution: "awk '{s += $10} END {print s}' /var/log/nginx/access.log",
      tags: ['awk'],
    },
    {
      id: 'count-5xx',
      prompt: 'Сколько ответов с кодом **5xx** (500 и выше)? Выведи число.',
      check: { type: 'outputNumber', value: stats.s5xx },
      hints: ["`awk '$9 >= 500' файл` выведет строки 5xx.", 'Посчитай: `| wc -l`.'],
      solution: "awk '$9 >= 500' /var/log/nginx/access.log | wc -l",
      explanation: `Всего 5xx: ${stats.s5xx}, суммарно ${bytes5xx} байт. Можно и через \`grep -cE '" 5[0-9]{2} '\`.`,
      tags: ['awk'],
    },
  ],
  quiz: [
    {
      id: 'q-field',
      type: 'text',
      prompt: 'В формате nginx combined, если делить строку по пробелам, каким по счёту полем идёт HTTP-статус? (число)',
      answer: { accept: ['9'], normalize: 'number' },
      explanation: '`$9` — статус, `$7` — URL, `$1` — IP, `$10` — байты.',
    },
    {
      id: 'q-passwd',
      type: 'command',
      prompt: 'Выведи список имён пользователей из `/etc/passwd` (первое поле, разделитель `:`).',
      scenario: {},
      solution: "cut -d: -f1 /etc/passwd",
      explanation: "`cut -d: -f1 /etc/passwd` или `awk -F: '{print $1}' /etc/passwd`.",
    },
    {
      id: 'q-quotes',
      type: 'choice',
      prompt: 'Почему awk-программу пишут в **одинарных** кавычках?',
      options: ['Так быстрее', 'Иначе bash подставит свои переменные $1, $9 до запуска awk', 'awk не понимает двойные кавычки'],
      correct: 1,
      explanation: 'В двойных кавычках bash раскрывает `$9` (обычно в пустую строку).',
    },
    {
      id: 'q-404',
      type: 'command',
      prompt: 'Выведи URL (поле 7) всех запросов с кодом 404 из `/var/log/nginx/access.log`.',
      scenario: { files: { '/var/log/nginx/access.log': accessLog } },
      solution: "awk '$9 == 404 {print $7}' /var/log/nginx/access.log",
      explanation: "Условие + действие: `awk '$9 == 404 {print $7}'`.",
    },
  ],
  glossary: [
    { ru: 'Поле', en: 'field / column', def: 'Часть строки между разделителями.' },
    { ru: 'Разделитель', en: 'delimiter / field separator', def: 'Символ, по которому строка делится на поля (пробел, :, ,).' },
  ],
};
export default lesson;
