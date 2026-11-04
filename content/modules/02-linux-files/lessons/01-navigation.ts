import type { LessonDef } from '../../../../src/content/types';

const scenario = {
  files: {
    '/opt/shop/current/app.jar': { content: '', size: 48_000_000, mtime: '-1d' },
    '/opt/shop/current/.env': { content: 'DB_HOST=db-prod-01\nDB_USER=shop\n', mode: 0o640, owner: 'www-data', group: 'www-data' },
    '/opt/shop/current/config.yml': { content: 'server:\n  port: 8080\n', mtime: '-1d' },
    '/opt/shop/releases/2.13.0/app.jar': { content: '', size: 47_500_000, mtime: '-9d' },
    '/opt/shop/releases/2.14.0/app.jar': { content: '', size: 48_000_000, mtime: '-1d' },
    '/var/log/shop/app.log': { content: 'INFO started\n', mtime: '-2h' },
    '/var/log/shop/app.log.1': { content: 'INFO old\n', mtime: '-1d' },
    '/var/log/shop/app.log.2': { content: 'INFO older\n', mtime: '-2d' },
  },
};

const lesson: LessonDef = {
  id: 'navigation',
  title: 'Навигация: pwd, ls, cd и карта сервера',
  minutes: 20,
  commands: ['pwd', 'ls', 'cd', 'hostname', 'whoami'],
  scenario,
  tasks: [
    {
      id: 'cd-logs',
      prompt: 'Перейди в каталог с логами магазина `/var/log/shop`. Задание засчитается, когда текущим каталогом станет он.',
      check: { type: 'cwd', path: '/var/log/shop' },
      hints: ['Смена каталога — `cd`.', '`cd /var/log/shop`'],
      solution: 'cd /var/log/shop',
    },
    {
      id: 'hidden',
      prompt: 'В каталоге приложения `/opt/shop/current` есть скрытый файл с настройками окружения. Покажи **все** файлы каталога, включая скрытые, в подробном формате.',
      check: { type: 'all', checks: [{ type: 'outputContains', value: ['.env', 'www-data', 'config.yml'] }] },
      hints: ['Скрытые файлы начинаются с точки и без флага не видны.', 'Нужны флаги `-l` (подробно) и `-a` (все). Их можно склеить.'],
      solution: 'ls -la /opt/shop/current',
      tags: ['ls'],
    },
    {
      id: 'releases',
      prompt: 'Сколько релизов лежит в `/opt/shop/releases`? Введи число.',
      answer: { accept: ['2'], normalize: 'number', label: 'Релизов:' },
      hints: ['`ls /opt/shop/releases`'],
      solution: 'ls /opt/shop/releases',
    },
    {
      id: 'newest-log',
      prompt: 'Выведи файлы в `/var/log/shop`, отсортированные по времени изменения (новые сверху), в подробном формате.',
      check: { type: 'all', checks: [{ type: 'outputMatches', pattern: 'app\\.log\\n[\\s\\S]*app\\.log\\.1\\n[\\s\\S]*app\\.log\\.2' }, { type: 'outputContains', value: 'root' }] },
      hints: ['Сортировка по времени — флаг `-t`.', '`ls -lt /var/log/shop`'],
      solution: 'ls -lt /var/log/shop',
      tags: ['ls'],
    },
  ],
  quiz: [
    {
      id: 'q-logs-dir',
      type: 'text',
      prompt: 'В каком каталоге в Linux по стандарту лежат логи? (полный путь)',
      answer: { accept: ['/var/log', '/var/log/'] },
      explanation: '`/var/log` — системные логи и логи большинства сервисов.',
    },
    {
      id: 'q-etc',
      type: 'text',
      prompt: 'Где лежат конфигурационные файлы системы и сервисов (nginx, systemd, hosts)? (полный путь)',
      answer: { accept: ['/etc', '/etc/'] },
      explanation: '`/etc` — конфигурация.',
    },
    {
      id: 'q-up',
      type: 'command',
      prompt: 'Ты в `/var/log/nginx`. Напиши команду, которая перейдёт на уровень выше и сразу покажет, где ты оказался (две команды через `&&`).',
      scenario: { cwd: '/var/log/nginx', dirs: ['/var/log/nginx'] },
      solution: 'cd .. && pwd',
      check: { type: 'all', checks: [{ type: 'cwd', path: '/var/log' }, { type: 'outputContains', value: '/var/log' }] },
      explanation: '`cd ..` — родительский каталог, `pwd` — показать путь. `&&` выполнит вторую команду, только если первая успешна.',
    },
    {
      id: 'q-prompt',
      type: 'choice',
      prompt: 'Приглашение заканчивается на `#`. Что это значит?',
      options: ['Ты в режиме комментария', 'Ты работаешь как root — будь осторожен', 'Сервер в режиме обслуживания'],
      correct: 1,
      explanation: '`#` в приглашении — **root**. Любая команда выполняется без ограничений прав.',
    },
  ],
  glossary: [
    { ru: 'Абсолютный путь', en: 'absolute path', def: 'Путь от корня `/`, работает из любого каталога.' },
    { ru: 'Относительный путь', en: 'relative path', def: 'Путь от текущего каталога.' },
    { ru: 'Иерархия файловой системы', en: 'FHS, Filesystem Hierarchy Standard', def: 'Стандарт расположения каталогов в Linux.' },
    { ru: 'Скрытый файл', en: 'dotfile / hidden file', def: 'Файл, имя которого начинается с точки.' },
  ],
};
export default lesson;
