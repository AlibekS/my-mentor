import type { LessonDef } from '../../../../src/content/types';

const scenario = {
  files: {
    '/etc/nginx/nginx.conf': { content: 'worker_processes auto;\n', mtime: '-40d' },
    '/etc/nginx/sites-enabled/shop.conf': { content: 'server { listen 80; proxy_pass http://127.0.0.1:8080; }\n', mtime: '-3h' },
    '/etc/shop/config.yml': { content: 'db:\n  pool: 50\n', mtime: '-5h' },
    '/etc/ssh/sshd_config': { content: 'PermitRootLogin no\n', mtime: '-90d' },
    '/var/log/shop/app.log': { content: '', size: 120 * 1024 * 1024, mtime: '-1h' },
    '/var/log/shop/app.log.1': { content: '', size: 95 * 1024 * 1024, mtime: '-1d' },
    '/var/log/nginx/access.log': { content: '', size: 30 * 1024 * 1024, mtime: '-1h' },
    '/var/lib/shop/dumps/heap-2026-11-03.hprof': { content: '', size: 6 * 1024 * 1024 * 1024, mtime: '-1d' },
    '/var/lib/shop/cache/c1.bin': { content: '', size: 2 * 1024 * 1024, mtime: '-1d' },
    '/opt/shop/README.md': '# Shop\n',
    '/home/alibek/old/backup-readme.txt': { content: 'x', owner: 'alibek' },
  },
};

const lesson: LessonDef = {
  id: 'find',
  title: 'Поиск файлов: find',
  minutes: 25,
  commands: ['find'],
  scenario,
  tasks: [
    {
      id: 'by-name',
      prompt: 'Найди, где лежит конфиг сайта магазина: файл `shop.conf` где-то в `/etc`.',
      check: { type: 'outputContains', value: '/etc/nginx/sites-enabled/shop.conf' },
      hints: ['`find <где> -name <имя>`.', '`find /etc -name shop.conf`'],
      solution: 'find /etc -name shop.conf',
      tags: ['find'],
    },
    {
      id: 'big',
      prompt: 'Диск почти заполнен. Найди в `/var` все **файлы больше 1 ГБ**.',
      check: { type: 'all', checks: [{ type: 'outputContains', value: 'heap-2026-11-03.hprof' }, { type: 'outputNotContains', value: 'app.log' }] },
      hints: ['Размер — `-size`, больше — плюс, гигабайты — `G`.', '`find /var -type f -size +1G`'],
      solution: 'find /var -type f -size +1G',
      tags: ['find'],
    },
    {
      id: 'changed',
      prompt: 'После утреннего релиза что-то сломалось. Какие файлы в `/etc` изменены **менее суток назад**? Выведи их.',
      check: { type: 'all', checks: [{ type: 'outputContains', value: ['shop.conf', 'config.yml'] }, { type: 'outputNotContains', value: ['sshd_config', 'nginx.conf'] }] },
      hints: ['Время изменения — `-mtime`; «меньше суток» — `-1`.', 'Добавь `-type f`, чтобы не выводить каталоги.'],
      solution: 'find /etc -type f -mtime -1',
      tags: ['find'],
    },
    {
      id: 'count-logs',
      prompt: 'Сколько файлов с расширением `.log` (ровно `*.log`) лежит в `/var/log` на любой глубине? Выведи число.',
      check: { type: 'outputNumber', value: 2 },
      hints: ['`find /var/log -name "*.log"` — а потом посчитать строки.', 'Пайп в `wc -l`.'],
      solution: 'find /var/log -name "*.log" | wc -l',
      tags: ['find'],
    },
  ],
  quiz: [
    {
      id: 'q-quotes',
      type: 'choice',
      prompt: 'Почему шаблон в `find /var/log -name "*.log"` пишут в кавычках?',
      options: ['Иначе find не поймёт звёздочку', 'Иначе оболочка сама раскроет * по файлам текущего каталога', 'Это просто стиль'],
      correct: 1,
      explanation: 'Без кавычек bash сделает glob-подстановку **до** запуска find.',
    },
    {
      id: 'q-size',
      type: 'command',
      prompt: 'Напиши команду: найти в `/var/log` файлы больше 100 МБ.',
      scenario: { files: { '/var/log/a.log': { content: '', size: 200 * 1024 * 1024 }, '/var/log/b.log': { content: '', size: 10 * 1024 * 1024 } } },
      solution: 'find /var/log -type f -size +100M',
      explanation: '`-size +100M` — больше 100 мегабайт.',
    },
    {
      id: 'q-mtime',
      type: 'text',
      prompt: 'Какое условие `find` выберет файлы, изменённые **за последние 60 минут**? (опция и значение)',
      answer: { accept: ['-mmin -60', '-mmin -60 '], normalize: 'exact' },
      explanation: '`-mmin -60` — минуты; `-mtime -1` — сутки.',
    },
    {
      id: 'q-devnull',
      type: 'text',
      prompt: 'Как спрятать сообщения `Permission denied` от find? Допиши в конец команды перенаправление stderr в никуда.',
      answer: { accept: ['2>/dev/null', '2> /dev/null'], normalize: 'exact' },
      explanation: '`2>/dev/null` отправляет поток ошибок (stderr, дескриптор 2) в /dev/null.',
    },
  ],
  glossary: [
    { ru: 'Стандартный поток ошибок', en: 'stderr', def: 'Отдельный поток (дескриптор 2) для сообщений об ошибках.' },
    { ru: 'Шаблон имени', en: 'glob pattern', def: 'Шаблон с * и ? для подстановки имён файлов.' },
    { ru: 'Дамп памяти', en: 'heap dump', def: 'Снимок памяти процесса (часто Java .hprof) для анализа утечек.' },
  ],
};
export default lesson;
