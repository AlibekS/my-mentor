import type { LessonDef } from '../../../../src/content/types';

const GB = 1024 ** 3;

const scenario = {
  resources: { disks: [{ fs: '/dev/sda1', sizeGb: 50, usedGb: 48.5, mount: '/' }] },
  files: {
    '/var/log/shop/app.log': { content: '', size: 1.5 * GB },
    '/var/log/shop/debug.log': { content: '', size: 21 * GB },
    '/var/log/nginx/access.log': { content: '', size: 2 * GB },
    '/etc/logrotate.d/nginx': '/var/log/nginx/*.log {\n    daily\n    rotate 14\n    compress\n    postrotate\n        systemctl reload nginx\n    endscript\n}\n',
  },
  processes: [
    { pid: 2240, user: 'shop', cpu: 3, mem: 9, vsz: 4_000_000, rss: 790_000, stat: 'Ssl', start: 'Nov03', time: '58:31', command: '/usr/bin/java -jar /opt/shop/shop.jar', service: 'shop' },
    { pid: 1101, user: 'root', cpu: 0.1, mem: 0.2, vsz: 55000, rss: 9000, stat: 'Ss', start: 'Nov01', time: '1:12', command: 'nginx: master process', service: 'nginx' },
  ],
  services: [
    { name: 'shop', description: 'Shop web application', active: 'active' as const, enabled: true, mainPid: 2240, logs: [], startProcess: { user: 'shop', cpu: 2, mem: 8, vsz: 4_000_000, rss: 600_000, stat: 'Ssl', start: '14:30', time: '0:01', command: '/usr/bin/java -jar /opt/shop/shop.jar' } },
    { name: 'nginx', description: 'nginx', active: 'active' as const, enabled: true, mainPid: 1101, logs: [] },
  ],
  openFiles: [
    { path: '/var/log/shop/app.log', pid: 2240, command: 'java' },
    { path: '/var/log/shop/debug.log', pid: 2240, command: 'java' },
    { path: '/var/log/nginx/access.log', pid: 1101, command: 'nginx' },
  ],
};

const lesson: LessonDef = {
  id: 'deleted-open',
  title: 'Удалённые, но открытые файлы; truncate; logrotate',
  minutes: 25,
  commands: ['lsof', 'truncate', 'rm', 'df', 'systemctl'],
  scenario,
  tasks: [
    {
      id: 'rm-trap',
      prompt: 'Воспроизведём ошибку дежурного: удали `/var/log/shop/debug.log` через `sudo rm`, затем посмотри `df -h`. Освободилось ли место? Введи `Use%` для `/` после удаления (число).',
      answer: { accept: ['97'], normalize: 'number', label: 'Use%:' },
      hints: ['`sudo rm /var/log/shop/debug.log`', 'Потом `df -h`.'],
      solution: 'sudo rm /var/log/shop/debug.log\ndf -h',
      explanation: 'Место не освободилось: java всё ещё держит файл открытым.',
    },
    {
      id: 'lsof',
      prompt: 'Найди **удалённые, но открытые** файлы и введи PID процесса, который держит `debug.log`.',
      answer: { accept: ['2240'], normalize: 'number', label: 'PID:' },
      hints: ['`sudo lsof +L1`'],
      solution: 'sudo lsof +L1',
      tags: ['lsof'],
    },
    {
      id: 'release',
      prompt: 'Освободи место корректно — **перезапусти сервис**, которому принадлежит процесс, и убедись через `df -h`, что место вернулось (`/` < 60%).',
      check: { type: 'custom', fn: (sh) => sh.state.deletedOpen.length === 0 && !sh.state.processes.some((p) => p.pid === 2240) && sh.state.services.find((s) => s.name === 'shop')?.active === 'active' },
      hints: ['Процесс 2240 — сервис `shop`.', '`sudo systemctl restart shop`'],
      solution: 'sudo systemctl restart shop',
      tags: ['systemctl'],
    },
    {
      id: 'truncate',
      prompt: 'А теперь правильный способ для живого лога: **обнули** `/var/log/nginx/access.log`, не удаляя его и не перезапуская nginx.',
      check: { type: 'custom', fn: (sh) => { const n = sh.fs.lookup('/var/log/nginx/access.log'); return !!n && sh.fs.size(n) === 0; } },
      hints: ['`truncate -s 0 файл` (нужен sudo).'],
      solution: 'sudo truncate -s 0 /var/log/nginx/access.log',
      tags: ['truncate'],
    },
  ],
  quiz: [
    { id: 'q-why', type: 'choice', prompt: 'Почему после `rm` активного лога место на диске не освободилось?', options: ['rm работает медленно', 'Процесс держит файл открытым: данные живут, пока он не закроет дескриптор', 'Нужно очистить корзину'], correct: 1, explanation: 'Имя удалено, inode с данными жив, пока есть открытые дескрипторы.' },
    { id: 'q-lsof', type: 'text', prompt: 'Какой командой (с аргументом) найти удалённые, но открытые файлы?', answer: { accept: ['lsof +L1', 'sudo lsof +L1', 'lsof | grep deleted', 'sudo lsof | grep deleted'], normalize: 'exact' }, explanation: '`sudo lsof +L1` или `sudo lsof | grep deleted`.' },
    { id: 'q-trunc', type: 'text', prompt: 'Как обнулить лог, не удаляя файл? (команда целиком для `/var/log/app.log`, без sudo)', answer: { accept: ['truncate -s 0 /var/log/app.log', ': > /var/log/app.log', '> /var/log/app.log', 'cat /dev/null > /var/log/app.log'], normalize: 'exact' }, explanation: '`truncate -s 0 файл` или `: > файл`.' },
    { id: 'q-copytruncate', type: 'text', prompt: 'Какая опция logrotate копирует лог и обнуляет оригинал — для приложений, которые не умеют переоткрывать файл? (одно слово)', answer: { accept: ['copytruncate'] }, explanation: '`copytruncate`. Альтернатива — `postrotate` с reload сервиса.' },
  ],
  glossary: [
    { ru: 'Файловый дескриптор', en: 'file descriptor', def: 'Номер открытого процессом файла.' },
    { ru: 'Ротация логов', en: 'logrotate', def: 'Утилита для периодической ротации, сжатия и удаления логов.' },
  ],
};
export default lesson;
