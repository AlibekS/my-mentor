import type { LessonDef } from '../../../../src/content/types';

const GB = 1024 ** 3;
const MB = 1024 ** 2;

const scenario = {
  host: 'app-prod-02',
  resources: { disks: [{ fs: '/dev/nvme0n1p1', sizeGb: 80, usedGb: 78.5, mount: '/' }] },
  files: {
    '/var/log/orders/orders.log': { content: '', size: 3 * GB },
    '/var/log/orders/orders.log.1': { content: '', size: 2.8 * GB, mtime: '-1d' },
    '/var/log/orders/trace.log': { content: '', size: 18 * GB },
    '/var/crash/orders-api.core.31337': { content: '', size: 12 * GB, mtime: '-2d' },
    '/var/crash/orders-api.core.30211': { content: '', size: 12 * GB, mtime: '-5d' },
    '/opt/orders-api/app.jar': { content: '', size: 80 * MB },
    '/etc/orders-api/app.env': 'LOG_LEVEL=TRACE   # временно для отладки INC-6001, вернуть INFO!\nTRACE_FILE=/var/log/orders/trace.log\n',
    '/etc/logrotate.d/orders': '/var/log/orders/orders.log {\n    daily\n    rotate 3\n    compress\n    copytruncate\n}\n',
    '/home/alibek/l2-notes.txt': { owner: 'alibek', content: '18:31 sudo rm /var/log/orders/debug.log (25G) — место не освободилось??\n' },
  },
  processes: [
    { pid: 31900, user: 'orders', cpu: 6.2, mem: 18, vsz: 5_100_000, rss: 1_400_000, stat: 'Ssl', start: '09:00', time: '44:01', command: '/usr/bin/java -jar /opt/orders-api/app.jar', service: 'orders-api' },
  ],
  services: [
    {
      name: 'orders-api', description: 'Orders API', active: 'active' as const, enabled: true, mainPid: 31900,
      logs: [
        { time: '2026-11-04 18:29:51', priority: 'err' as const, message: 'java.io.IOException: No space left on device' },
        { time: '2026-11-04 18:30:02', priority: 'err' as const, message: 'Failed to persist order 88123: No space left on device' },
      ],
      startProcess: { user: 'orders', cpu: 2, mem: 8, vsz: 4_000_000, rss: 600_000, stat: 'Ssl', start: '18:45', time: '0:02', command: '/usr/bin/java -jar /opt/orders-api/app.jar' },
    },
  ],
  openFiles: [
    { path: '/var/log/orders/orders.log', pid: 31900, command: 'java' },
    { path: '/var/log/orders/trace.log', pid: 31900, command: 'java' },
    { path: '/var/log/orders/debug.log', pid: 31900, command: 'java' },
  ],
};
// debug.log уже «удалён» дежурным, но держится процессом: добавим его как удалённый-открытый
(scenario.files as Record<string, unknown>)['/var/log/orders/debug.log'] = { content: '', size: 25 * GB };

const lesson: LessonDef = {
  id: 'boss',
  kind: 'boss',
  title: 'Диск забит — заказы не сохраняются',
  minutes: 40,
  incident: { ticket: 'INC-6110: «500 на оформлении заказа, No space left on device»', severity: 'SEV1', customer: 'все покупатели' },
  commands: ['df', 'du', 'sort', 'find', 'lsof', 'truncate', 'rm', 'systemctl'],
  scenario,
  tasks: [
    {
      id: 'l2-rm',
      prompt: 'Сначала воспроизведи действие дежурного из `~/l2-notes.txt` (`sudo rm /var/log/orders/debug.log`), затем проверь `df -h`. Сколько процентов занято на `/`? Введи число.',
      answer: { accept: ['98'], normalize: 'number', label: 'Use%:' },
      hints: ['`cat ~/l2-notes.txt`, затем выполни ту же команду.', '`df -h`'],
      solution: 'sudo rm /var/log/orders/debug.log\ndf -h',
    },
    {
      id: 'why',
      prompt: 'Почему место не вернулось? Найди удалённые, но открытые файлы и введи **размер в ГБ** того, что держит процесс (примерно, целым числом).',
      answer: { accept: ['25', '26', '27', '26.8', '26.84'], normalize: 'number', label: 'ГБ:' },
      hints: ['`sudo lsof +L1` — колонка SIZE/OFF в байтах.', '26843545600 байт = 25 ГиБ (1024³) ≈ 26,8 ГБ (1000³) — засчитывается любой вариант.'],
      solution: 'sudo lsof +L1\n# 26843545600 байт = 25 ГБ',
      tags: ['lsof'],
    },
    {
      id: 'hunt',
      prompt: 'Найди остальные «пожиратели»: выведи **все файлы больше 5 ГБ** на сервере.',
      check: { type: 'all', checks: [{ type: 'outputContains', value: ['trace.log', 'orders-api.core.31337', 'orders-api.core.30211'] }] },
      hints: ['`sudo find / -type f -size +5G 2>/dev/null`'],
      solution: 'sudo find / -type f -size +5G 2>/dev/null',
      tags: ['find'],
    },
    {
      id: 'cores',
      prompt: 'Старые дампы памяти в `/var/crash` уже проанализированы (тикет INC-6001 закрыт). Удали **оба** core-файла.',
      check: { type: 'all', checks: [{ type: 'fileExists', path: '/var/crash/orders-api.core.31337', negate: true }, { type: 'fileExists', path: '/var/crash/orders-api.core.30211', negate: true }] },
      hints: ['`sudo rm /var/crash/orders-api.core.*`'],
      solution: 'sudo rm /var/crash/orders-api.core.*',
      tags: ['rm'],
    },
    {
      id: 'trace',
      prompt: '`trace.log` (18 ГБ) — живой файл, в него пишет приложение. Освободи место **без удаления файла**.',
      check: { type: 'custom', fn: (sh) => { const n = sh.fs.lookup('/var/log/orders/trace.log'); return !!n && sh.fs.size(n) === 0; } },
      hints: ['`sudo truncate -s 0 /var/log/orders/trace.log`'],
      solution: 'sudo truncate -s 0 /var/log/orders/trace.log',
      tags: ['truncate'],
    },
    {
      id: 'restart',
      prompt: 'Перезапусти `orders-api`, чтобы он отпустил удалённый `debug.log`, и убедись, что `/` занят меньше чем на 70%.',
      // старый процесс 31900 должен завершиться (иначе задание засчитывалось бы сразу, ещё до rm)
      check: { type: 'custom', fn: (sh) => !sh.state.processes.some((p) => p.pid === 31900) && sh.state.deletedOpen.length === 0 && sh.state.services.find((s) => s.name === 'orders-api')?.active === 'active' },
      hints: ['`sudo systemctl restart orders-api`', 'Потом `df -h`.'],
      solution: 'sudo systemctl restart orders-api\ndf -h',
      tags: ['systemctl'],
    },
  ],
  quiz: [
    { id: 'q-rca', type: 'text', prompt: 'RCA одной фразой (ключевые слова: TRACE/debug-логирование и ротация/logrotate или дампы).', answer: { accept: [], normalize: 'keywords', keywords: [['trace', 'debug', 'логирован', 'уровень лог'], ['ротац', 'logrotate', 'не ротир', 'дамп', 'core']] }, explanation: 'После отладки INC-6001 оставили LOG_LEVEL=TRACE: trace.log и debug.log не попадали в logrotate и выросли до 43 ГБ, плюс два забытых core-дампа по 12 ГБ.' },
    { id: 'q-l2', type: 'choice', prompt: 'Почему действие дежурного `rm debug.log` не помогло?', options: ['Файл был в корзине', 'Процесс держал файл открытым; место освобождается только после закрытия дескриптора (рестарт) — нужно было truncate', 'rm не работает с большими файлами'], correct: 1, explanation: 'Для живых логов — `truncate -s 0`, а не `rm`.' },
    { id: 'q-prevent', type: 'text', prompt: 'Назови профилактику (ключевые слова: logrotate для всех логов / алерт на 80% / возврат LOG_LEVEL через change).', answer: { accept: [], normalize: 'keywords', keywords: [['logrotate', 'ротац', 'алерт', 'alert', '80', 'log_level', 'info', 'change', 'мониторинг']] }, explanation: 'Logrotate на все `*.log`, алерт на 80% (а не 95%), временный TRACE — только через change с датой отката, автоочистка `/var/crash`.' },
  ],
  glossary: [
    { ru: 'Уровень логирования', en: 'log level', def: 'TRACE < DEBUG < INFO < WARN < ERROR; на проде обычно INFO.' },
    { ru: 'Порог алерта', en: 'alert threshold', def: 'Значение метрики, при котором срабатывает оповещение.' },
  ],
};
export default lesson;
