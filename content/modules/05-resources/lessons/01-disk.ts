import type { LessonDef } from '../../../../src/content/types';

const GB = 1024 ** 3;
const MB = 1024 ** 2;

export const diskScenario = {
  resources: { disks: [{ fs: '/dev/sda1', sizeGb: 50, usedGb: 47.5, mount: '/' }, { fs: '/dev/sdb1', sizeGb: 200, usedGb: 121, mount: '/var/lib/postgresql' }] },
  files: {
    '/var/log/syslog': { content: '', size: 180 * MB },
    '/var/log/nginx/access.log': { content: '', size: 900 * MB },
    '/var/log/shop/app.log': { content: '', size: 1.2 * GB },
    '/var/log/shop/debug.log': { content: '', size: 21 * GB, mtime: '-1h' },
    '/var/lib/docker/overlay2/a1b2/diff.tar': { content: '', size: 6 * GB },
    '/var/crash/java-core.2240': { content: '', size: 3.5 * GB, mtime: '-3d' },
    '/home/alibek/db-dump-2026-10-01.sql': { content: '', size: 2 * GB, owner: 'alibek', mtime: '-34d' },
    '/opt/shop/shop.jar': { content: '', size: 52 * MB },
  },
};

/** Размер /var/log в том виде, как его печатает `du -sh` (целые гигабайты, округление вверх) */
const varLogG = Math.ceil(
  Object.entries(diskScenario.files)
    .filter(([path]) => path.startsWith('/var/log/'))
    .reduce((sum, [, f]) => sum + (typeof f === 'string' ? 0 : f.size ?? 0), 0) / GB,
);

const lesson: LessonDef = {
  id: 'disk',
  title: 'Диск: df, du, поиск виновника',
  minutes: 25,
  commands: ['df', 'du', 'sort', 'find'],
  scenario: diskScenario,
  tasks: [
    {
      id: 'df',
      prompt: 'Какой раздел почти заполнен? Посмотри занятость файловых систем в удобных единицах и введи **точку монтирования**.',
      answer: { accept: ['/', '/ (root)', 'root', 'корень', 'корневой', 'корневой раздел'], label: 'Mounted on:' },
      hints: ['`df -h`', 'Смотри на `Use%` и колонку `Mounted on`.'],
      solution: 'df -h',
      tags: ['df'],
    },
    {
      id: 'du-var',
      prompt: 'Выведи размер **каждого подкаталога** `/var`, отсортированный по размеру (самый большой — последним).',
      // последняя строка (без итоговых /var и total) — log, среди строк есть lib; пути могут быть с /var/ и слешем на конце или относительными
      check: {
        type: 'custom',
        fn: (_sh, last) => {
          if (!last) return false;
          const rows = last.stdout.trim().split('\n').filter((l) => l.trim() && !/\s(\/var\/?|\.\/?|total|итого)$/.test(l));
          return rows.length >= 3 && /(\s|\/)log\/?$/.test(rows[rows.length - 1]) && rows.some((l) => /(\s|\/)lib\/?$/.test(l));
        },
      },
      hints: ['`du -sh /var/*` — по каталогу на строку.', '`| sort -h` сортирует K/M/G правильно. Не забудь `sudo`.'],
      solution: 'sudo du -sh /var/* | sort -h',
      tags: ['du', 'sort'],
    },
    {
      id: 'culprit',
      prompt: 'Спустись глубже и найди **файл**-виновник в `/var/log` (самый большой). Введи полный путь.',
      answer: { accept: ['/var/log/shop/debug.log'], label: 'Файл:' },
      hints: ['`sudo du -ah /var/log | sort -h | tail -3`', 'или `sudo find /var/log -type f -size +1G`'],
      solution: 'sudo du -ah /var/log | sort -h | tail -3',
      tags: ['du'],
    },
    {
      id: 'big-files',
      prompt: 'Найди на сервере все файлы **больше 1 ГБ** (вне зависимости от каталога), без шума «Permission denied».',
      check: { type: 'all', checks: [{ type: 'outputContains', value: ['debug.log', 'java-core.2240', 'db-dump-2026-10-01.sql', 'app.log'] }] },
      hints: ['`find / -type f -size +1G`', 'Ошибки — в `/dev/null`: `2>/dev/null`. Или через sudo.'],
      solution: 'sudo find / -type f -size +1G 2>/dev/null',
      tags: ['find'],
    },
  ],
  quiz: [
    { id: 'q-sorth', type: 'text', prompt: 'Какой флаг `sort` правильно сортирует размеры вида `900M`, `1.2G`, `21G`?', answer: { accept: ['-h', 'h', '--human-numeric-sort'] }, explanation: '`sort -h` (human). `sort -n` поставит 900M после 21G.' },
    { id: 'q-inodes', type: 'choice', prompt: '`df -h` показывает 40% занято, но приложение пишет `No space left on device`. Что проверить?', options: ['Перезагрузить сервер', 'Inodes: `df -i` — могли закончиться из-за миллионов мелких файлов', 'Это ошибка приложения, диск ни при чём'], correct: 1, explanation: 'Место и inodes — разные ресурсы.' },
    { id: 'q-du', type: 'command', prompt: 'Выведи общий размер каталога `/var/log` одной строкой в удобных единицах.', scenario: diskScenario, solution: 'sudo du -sh /var/log', check: { type: 'all', checks: [{ type: 'outputMatches', pattern: `^\\s*${varLogG}G(\\s|$)` }, { type: 'outputLines', value: 1 }] }, explanation: '`du -sh` — summary + human.' },
    { id: 'q-where', type: 'text', prompt: 'В каком каталоге обычно копятся образы и слои Docker? (полный путь)', answer: { accept: ['/var/lib/docker', '/var/lib/docker/'] }, explanation: '`/var/lib/docker` — чистится `docker system prune` (осторожно).' },
  ],
  glossary: [
    { ru: 'Индексный дескриптор', en: 'inode', def: 'Структура с метаданными файла; их число на разделе ограничено.' },
    { ru: 'Точка монтирования', en: 'mount point', def: 'Каталог, к которому подключена файловая система.' },
    { ru: 'Дамп ядра', en: 'core dump', def: 'Снимок памяти упавшего процесса.' },
  ],
};
export default lesson;
