import type { LessonDef } from '../../../../src/content/types';
import { accessLog, stats } from '../data';

const lesson: LessonDef = {
  id: 'pipes',
  title: 'Пайпы, sort, uniq -c, wc — топ-N',
  minutes: 30,
  commands: ['sort', 'uniq', 'wc', 'head', 'cut'],
  scenario: { files: { '/var/log/nginx/access.log': accessLog } },
  tasks: [
    {
      id: 'top-ip',
      prompt: 'Найди IP-адрес, который сделал **больше всего запросов** в `/var/log/nginx/access.log`. IP — первое поле строки. Построй топ и введи этот IP.',
      answer: { accept: [stats.topIp[0]], label: 'IP:' },
      hints: ['Достань первое поле: `cut -d" " -f1 файл`.', 'Рецепт: `| sort | uniq -c | sort -rn | head`.', `cut -d" " -f1 /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -3`],
      solution: 'cut -d" " -f1 /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -3',
      tags: ['sort', 'uniq', 'pipes'],
    },
    {
      id: 'unique',
      prompt: 'Сколько **уникальных** IP-адресов в логе? Выведи число командой.',
      check: { type: 'outputNumber', value: stats.uniqueIps },
      hints: ['`sort -u` оставит уникальные строки.', 'Потом посчитай строки `wc -l`.'],
      solution: 'cut -d" " -f1 /var/log/nginx/access.log | sort -u | wc -l',
      tags: ['sort', 'pipes'],
    },
    {
      id: 'bot-count',
      prompt: 'Сколько запросов сделал этот самый активный IP? Выведи **топ-1 строку** из рецепта (`число IP`).',
      check: { type: 'all', checks: [{ type: 'outputContains', value: stats.topIp[0] }, { type: 'outputMatches', pattern: `^\\s*${stats.topIp[1]}\\s` }, { type: 'outputLines', value: 1 }] },
      hints: ['Тот же рецепт, но `head -1`.'],
      solution: 'cut -d" " -f1 /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -1',
      tags: ['uniq', 'pipes'],
    },
    {
      id: 'pipeline4',
      prompt: 'Построй топ-5 **запрашиваемых URL** (7-е поле, разделитель — пробел) с количеством. Нужен пайплайн минимум из 4 команд.',
      check: { type: 'all', checks: [{ type: 'minPipes', value: 3 }, { type: 'outputLines', value: 5 }, { type: 'outputMatches', pattern: '^\\s*\\d+ /' }] },
      hints: ['`cut -d" " -f7` достанет URL.', '`... | sort | uniq -c | sort -rn | head -5`'],
      solution: 'cut -d" " -f7 /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -5',
      tags: ['pipes'],
    },
  ],
  quiz: [
    {
      id: 'q-sort-before',
      type: 'choice',
      prompt: 'Почему перед `uniq -c` почти всегда ставят `sort`?',
      options: ['uniq схлопывает только соседние одинаковые строки', 'sort ускоряет uniq', 'Без sort uniq выдаст ошибку'],
      correct: 0,
      explanation: '`uniq` сравнивает строку только с предыдущей, поэтому одинаковые значения должны идти подряд.',
    },
    {
      id: 'q-rn',
      type: 'text',
      prompt: 'Какие флаги `sort` нужны, чтобы отсортировать числа по убыванию? (одной группой флагов)',
      answer: { accept: ['-rn', '-nr', '-n -r', '-r -n'], normalize: 'exact' },
      explanation: '`-n` — числовая, `-r` — обратная.',
    },
    {
      id: 'q-count-lines',
      type: 'command',
      prompt: 'Сколько строк в `/var/log/nginx/access.log` содержат `/api/checkout`? Напиши команду с пайпом (grep + wc).',
      scenario: { files: { '/var/log/nginx/access.log': accessLog } },
      solution: 'grep /api/checkout /var/log/nginx/access.log | wc -l',
      explanation: `Ответ: ${stats.checkoutTotal}. \`grep -c\` тоже засчитается.`,
    },
    {
      id: 'q-recipe',
      type: 'text',
      prompt: 'Допиши рецепт топ-N: `... | sort | uniq -c | ??? | head`. Что вместо ???',
      answer: { accept: ['sort -rn', 'sort -nr', 'sort -n -r', 'sort -r -n'], normalize: 'exact' },
      explanation: 'После подсчёта сортируем по количеству: `sort -rn`.',
    },
  ],
  glossary: [
    { ru: 'Конвейер', en: 'pipeline', def: 'Цепочка команд, соединённых `|`.' },
    { ru: 'Стандартный ввод/вывод', en: 'stdin / stdout', def: 'Потоки, через которые команды получают и отдают данные.' },
  ],
};
export default lesson;
