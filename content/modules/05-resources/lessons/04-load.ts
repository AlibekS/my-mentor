import type { LessonDef } from '../../../../src/content/types';

const scenario = {
  resources: { load: [7.85, 6.12, 3.4] as [number, number, number], cpus: 4, iowait: 68.0 },
  processes: [
    { pid: 901, user: 'postgres', cpu: 2.1, mem: 9.5, vsz: 1_300_000, rss: 780_000, stat: 'Ss', start: 'Oct12', time: '42:10', command: '/usr/lib/postgresql/16/bin/postgres', service: 'postgresql' },
    { pid: 6120, user: 'postgres', cpu: 8.4, mem: 1.2, vsz: 300_000, rss: 95_000, stat: 'D', start: '14:02', time: '2:41', command: 'pg_dump --format=custom --file=/backup/shop-2026-11-04.dump shop' },
    { pid: 6125, user: 'root', cpu: 3.0, mem: 0.3, vsz: 30_000, rss: 9_000, stat: 'D', start: '14:02', time: '0:44', command: 'gzip -9 /backup/old/shop-2026-10.dump' },
    { pid: 2240, user: 'shop', cpu: 4.4, mem: 9.8, vsz: 4_100_000, rss: 790_000, stat: 'Sl', start: 'Nov03', time: '58:31', command: '/usr/bin/java -jar /opt/shop/shop.jar' },
  ],
};

const lesson: LessonDef = {
  id: 'load',
  title: 'load average, CPU и iowait',
  minutes: 20,
  commands: ['uptime', 'nproc', 'top', 'ps'],
  scenario,
  tasks: [
    {
      id: 'load1',
      prompt: 'Какая средняя нагрузка за **последнюю минуту**? Введи число.',
      answer: { accept: ['7.85'], normalize: 'number', label: 'load 1m:' },
      hints: ['`uptime`'],
      solution: 'uptime',
      tags: ['uptime'],
    },
    {
      id: 'cores',
      prompt: 'Сколько на сервере ядер CPU? Введи число (с ним сравнивают load).',
      answer: { accept: ['4'], normalize: 'number', label: 'Ядер:' },
      hints: ['`nproc`'],
      solution: 'nproc',
      tags: ['nproc'],
    },
    {
      id: 'wa',
      prompt: 'Load почти вдвое больше числа ядер. Посмотри `top`: какой показатель в строке `%Cpu(s)` аномально высокий? Введи его обозначение (две буквы).',
      answer: { accept: ['wa', 'iowait'], label: 'Показатель:' },
      hints: ['`top` — строка `%Cpu(s)`: us, sy, id, wa…'],
      solution: 'top',
      explanation: '`wa` ~68% — процессы ждут диск, а не считают. Добавление CPU не поможет.',
      tags: ['top'],
    },
    {
      id: 'd-state',
      prompt: 'Какие процессы сейчас в состоянии непрерываемого ожидания I/O (STAT `D`)? Выведи их строки из `ps aux`.',
      check: { type: 'all', checks: [{ type: 'outputContains', value: ['pg_dump', 'gzip'] }, { type: 'outputNotContains', value: 'shop.jar' }] },
      hints: ["`ps aux | awk '$8 ~ /D/'` — 8-я колонка STAT.", "Или проще: `ps aux | grep ' D '`."],
      solution: "ps aux | awk '$8 ~ /D/'",
      explanation: 'Бэкап (`pg_dump`) и сжатие старого дампа одновременно в рабочее время — они и грузят диск.',
      tags: ['ps', 'awk'],
    },
  ],
  quiz: [
    { id: 'q-load', type: 'choice', prompt: 'load average: 3.0, 3.1, 2.9 на сервере с 16 ядрами. Это…', options: ['Серьёзная перегрузка', 'Спокойная нагрузка — около 19% от числа ядер', 'Нельзя сказать без перезагрузки'], correct: 1, explanation: 'Load сравнивают с числом ядер.' },
    { id: 'q-trend', type: 'text', prompt: 'load average: 1.20, 3.50, 6.00 — нагрузка растёт или снижается? (одно слово)', answer: { accept: ['снижается', 'падает', 'уменьшается', 'спадает', 'decreasing'] }, explanation: '1-минутное значение меньше 15-минутного — пик прошёл.' },
    { id: 'q-st', type: 'text', prompt: 'В облачной VM в `top` высокий показатель, означающий, что гипервизор забирает CPU у твоей машины. Как он обозначается? (две буквы)', answer: { accept: ['st', 'steal'] }, explanation: '`st` (steal time) — проблема на уровне облака/типа инстанса.' },
    { id: 'q-nproc', type: 'command', prompt: 'Выведи число ядер CPU.', scenario, solution: 'nproc', explanation: '`nproc` (или `grep -c processor /proc/cpuinfo`).' },
  ],
  glossary: [
    { ru: 'Средняя нагрузка', en: 'load average', def: 'Среднее число готовых к работе или ждущих I/O процессов за 1/5/15 минут.' },
    { ru: 'Ожидание ввода-вывода', en: 'iowait (wa)', def: 'Доля времени, когда CPU простаивает в ожидании диска.' },
    { ru: 'Украденное время', en: 'steal time (st)', def: 'CPU, отданный гипервизором другим виртуалкам.' },
  ],
};
export default lesson;
