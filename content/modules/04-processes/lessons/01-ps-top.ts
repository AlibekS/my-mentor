import type { LessonDef } from '../../../../src/content/types';
import { baseProcs } from '../data';

const procs = [
  ...baseProcs,
  { pid: 4410, user: 'shop', cpu: 97.3, mem: 1.2, vsz: 120_000, rss: 95_000, stat: 'R', start: '13:10', time: '78:02', command: 'python3 /opt/shop/scripts/rebuild_search_index.py --full' },
  { pid: 4502, user: 'shop', cpu: 0.2, mem: 31.5, vsz: 3_900_000, rss: 2_520_000, stat: 'S', start: '11:40', time: '2:10', command: 'node /opt/shop/report-worker/index.js' },
];

const lesson: LessonDef = {
  id: 'ps-top',
  title: 'Процессы: ps aux, top, pgrep',
  minutes: 25,
  commands: ['ps', 'top', 'pgrep'],
  scenario: { processes: procs },
  tasks: [
    {
      id: 'cpu',
      prompt: 'Сервер тормозит. Найди процесс, который ест **больше всего CPU**, и введи его PID.',
      answer: { accept: ['4410'], normalize: 'number', label: 'PID:' },
      hints: ['`top` или `ps aux` с сортировкой.', '`ps aux --sort=-%cpu | head -3`'],
      solution: 'ps aux --sort=-%cpu | head -3',
      tags: ['ps'],
    },
    {
      id: 'mem',
      prompt: 'Выведи **топ-3 процесса по памяти** (с заголовком или без — главное, чтобы первым шёл самый «тяжёлый»).',
      // первая строка данных — PID 4502, вторая — 2240; не больше 5 строк (топ, а не весь список)
      check: { type: 'custom', fn: (_sh, last) => { if (!last) return false; const rows = last.stdout.split('\n').filter((l) => l.trim() && !/^\s*(USER|UID|PID)\b/.test(l)); const pid = (r: string) => /^\s*(\d+)\s/.exec(r)?.[1] ?? /^\S+\s+(\d+)\s/.exec(r)?.[1]; return rows.length >= 2 && rows.length <= 5 && pid(rows[0]) === '4502' && pid(rows[1]) === '2240'; } },
      hints: ['Сортировка по `%mem` по убыванию.', '`ps aux --sort=-%mem | head -4` (первая строка — заголовок).'],
      solution: 'ps aux --sort=-%mem | head -4',
      tags: ['ps'],
    },
    {
      id: 'pgrep',
      prompt: 'Какие PID у процессов **nginx**? Выведи их с командной строкой одной командой (без `ps | grep`).',
      check: { type: 'all', checks: [{ type: 'outputContains', value: ['1101', '1102', 'nginx: master'] }, { type: 'commandUsed', name: 'pgrep' }] },
      hints: ['`pgrep` ищет по имени.', 'Флаг `-a` покажет командную строку.'],
      solution: 'pgrep -a nginx',
      tags: ['pgrep'],
    },
    {
      id: 'what',
      prompt: 'Что делает процесс, который грузит CPU? Посмотри его командную строку и введи **имя скрипта** (файл .py).',
      answer: { accept: ['rebuild_search_index.py', '/opt/shop/scripts/rebuild_search_index.py', 'rebuild_search_index'], label: 'Скрипт:' },
      hints: ['Колонка COMMAND в `ps aux` для PID 4410.', '`ps aux | grep 4410`'],
      solution: 'ps aux | grep 4410',
      explanation: 'Полная переиндексация поиска (`--full`) в разгар дня. Её стоит переносить в ночное окно — это тема для разговора с владельцем задачи, а не повод сразу убивать процесс.',
      tags: ['ps', 'grep'],
    },
  ],
  quiz: [
    { id: 'q-rss', type: 'text', prompt: 'Какая колонка `ps aux` показывает реально занятую процессом оперативную память? (аббревиатура)', answer: { accept: ['RSS', 'RSS (resident set size)', 'resident set size'] }, explanation: '**RSS** (resident set size). VSZ — виртуальная, часто сильно больше и мало что говорит.' },
    { id: 'q-d', type: 'text', prompt: 'Какой буквой в колонке STAT обозначается процесс в непрерываемом ожидании ввода-вывода (часто признак проблем с диском или NFS)?', answer: { accept: ['D', 'D (uninterruptible sleep)'] }, explanation: '`D` — uninterruptible sleep. Много таких процессов → смотри диск/сеть, растёт load average.' },
    { id: 'q-sort', type: 'command', prompt: 'Выведи процессы, отсортированные по CPU по убыванию (любым способом), из `ps aux`.', scenario: { processes: procs }, solution: 'ps aux --sort=-%cpu', check: { type: 'custom', fn: (_sh, last) => { if (!last) return false; const rows = last.stdout.split('\n').filter((l) => l.trim() && !/^\s*(USER|UID|PID)\b/.test(l)); const pid = (r: string) => /^\s*(\d+)\s/.exec(r)?.[1] ?? /^\S+\s+(\d+)\s/.exec(r)?.[1]; return rows.length >= 2 && pid(rows[0]) === '4410' && pid(rows[1]) === '2240'; } }, explanation: '`ps aux --sort=-%cpu` или `ps aux | sort -k3 -rn`.' },
    { id: 'q-wa', type: 'choice', prompt: 'В `top` строка `%Cpu(s): 5.0 us, 2.0 sy, 0.0 ni, 30.0 id, 63.0 wa`. Что это значит?', options: ['Процессор перегружен вычислениями', 'Процессы в основном ждут диск (iowait)', 'Всё в порядке, сервер простаивает'], correct: 1, explanation: '`wa` 63% — процессор простаивает в ожидании ввода-вывода. Ищи медленный диск или того, кто его грузит.' },
  ],
  glossary: [
    { ru: 'Идентификатор процесса', en: 'PID, process ID', def: 'Уникальный номер запущенного процесса.' },
    { ru: 'Резидентная память', en: 'RSS, resident set size', def: 'Объём RAM, реально занятый процессом.' },
    { ru: 'Ожидание ввода-вывода', en: 'iowait', def: 'Время, когда CPU простаивает в ожидании диска/сети.' },
  ],
};
export default lesson;
