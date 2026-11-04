import type { LessonDef } from '../../../../src/content/types';

const scenario = {
  resources: { memTotalMb: 7962, memUsedMb: 7100, swapTotalMb: 2047, swapUsedMb: 1650 },
  processes: [
    { pid: 901, user: 'postgres', cpu: 1.1, mem: 9.5, vsz: 1_300_000, rss: 780_000, stat: 'Ss', start: 'Oct12', time: '42:10', command: '/usr/lib/postgresql/16/bin/postgres', service: 'postgresql' },
    { pid: 2240, user: 'shop', cpu: 3.4, mem: 22.1, vsz: 4_100_000, rss: 1_800_000, stat: 'Ssl', start: 'Nov03', time: '58:31', command: '/usr/bin/java -Xmx2g -jar /opt/shop/shop.jar', service: 'shop' },
    { pid: 4502, user: 'shop', cpu: 1.2, mem: 48.7, vsz: 4_400_000, rss: 3_970_000, stat: 'Sl', start: '01:50', time: '9:44', command: 'node /opt/shop/report-worker/index.js', service: 'report-worker' },
  ],
  services: [
    {
      name: 'report-worker', description: 'Report worker', active: 'active' as const, enabled: true, mainPid: 4502,
      logs: [
        { time: '2026-11-03 02:10:44', priority: 'err' as const, message: 'report-worker.service: Main process exited, code=killed, status=9/KILL' },
        { time: '2026-11-03 02:10:44', priority: 'err' as const, message: "report-worker.service: Failed with result 'oom-kill'." },
        { time: '2026-11-04 01:50:00', priority: 'info' as const, message: 'Started Report worker.' },
      ],
      startProcess: { user: 'shop', cpu: 0.5, mem: 3.0, vsz: 900_000, rss: 240_000, stat: 'Sl', start: '14:30', time: '0:01', command: 'node /opt/shop/report-worker/index.js' },
    },
  ],
  kernelLog: [
    { time: '2026-11-03 02:10:43', priority: 'warning' as const, message: 'node invoked oom-killer: gfp_mask=0x140cca(GFP_HIGHUSER_MOVABLE|__GFP_COMP), order=0, oom_score_adj=0' },
    { time: '2026-11-03 02:10:44', priority: 'err' as const, message: 'Out of memory: Killed process 3977 (node) total-vm:6211044kB, anon-rss:5893412kB, file-rss:0kB, shmem-rss:0kB, UID:998 pgtables:12100kB oom_score_adj:0' },
    { time: '2026-11-04 08:00:12', priority: 'info' as const, message: 'EXT4-fs (sda1): re-mounted. Quota mode: none.' },
  ],
};

const lesson: LessonDef = {
  id: 'memory',
  title: 'Память: free, swap, утечки, OOM killer',
  minutes: 25,
  commands: ['free', 'ps', 'journalctl', 'dmesg'],
  scenario,
  tasks: [
    {
      id: 'available',
      prompt: 'Посмотри память в удобных единицах. Сколько памяти **реально доступно** приложениям (колонка available)? Введи число мегабайт (Mi).',
      answer: { accept: ['690'], normalize: 'number', label: 'available, Mi:' },
      hints: ['`free -h`, колонка `available`.'],
      solution: 'free -h',
      tags: ['free'],
    },
    {
      id: 'top-mem',
      prompt: 'Какой процесс занимает **больше всего памяти**? Введи его PID.',
      answer: { accept: ['4502'], normalize: 'number', label: 'PID:' },
      hints: ['`ps aux --sort=-%mem | head -3`'],
      solution: 'ps aux --sort=-%mem | head -3',
      tags: ['ps'],
    },
    {
      id: 'oom',
      prompt: 'Вчера ночью report-worker упал. Найди в **журнале ядра** запись OOM killer и выведи её.',
      check: { type: 'all', checks: [{ type: 'outputContains', value: 'Out of memory: Killed process 3977' }] },
      hints: ['Журнал ядра: `journalctl -k` (или `sudo dmesg -T`).', 'Отфильтруй: `| grep -i "out of memory"`.'],
      solution: 'journalctl -k | grep -i "out of memory"',
      tags: ['journalctl', 'grep'],
    },
    {
      id: 'restart',
      prompt: 'Память почти кончилась, и всё повторяется. В качестве временного решения перезапусти `report-worker` и проверь, что процесс сменился (новый PID).',
      check: { type: 'custom', fn: (sh) => !sh.state.processes.some((p) => p.pid === 4502) && sh.state.services.find((s) => s.name === 'report-worker')?.active === 'active' },
      hints: ['`sudo systemctl restart report-worker`', 'Проверка: `ps aux --sort=-%mem | head -3`.'],
      solution: 'sudo systemctl restart report-worker',
      explanation: 'Это workaround. Причину (рост памяти при ночной выгрузке) нужно передать разработке с данными: время, RSS, запись OOM.',
      tags: ['systemctl'],
    },
  ],
  quiz: [
    { id: 'q-avail', type: 'text', prompt: 'Какую колонку `free -h` смотреть, чтобы понять, хватает ли памяти приложениям? (одно слово)', answer: { accept: ['available', 'avail'] }, explanation: '`available` — free + та часть кеша, которую можно освободить.' },
    { id: 'q-137', type: 'text', prompt: 'Процесс убит OOM killer. Какой код выхода увидит systemd/контейнер? (число)', answer: { accept: ['137'], normalize: 'number' }, explanation: '137 = 128 + 9 (SIGKILL).' },
    { id: 'q-leak', type: 'choice', prompt: 'RSS сервиса растёт с 300 МБ до 4 ГБ за сутки и не падает, после рестарта цикл повторяется. Что это похоже?', options: ['Нормальное кеширование файлов', 'Утечка памяти в приложении', 'Нехватка диска'], correct: 1, explanation: 'Монотонный рост без освобождения — признак утечки. Нужен heap dump для разработчиков.' },
    { id: 'q-kernel', type: 'command', prompt: 'Выведи сообщения ядра, содержащие `oom` (без учёта регистра).', scenario, solution: 'journalctl -k | grep -i oom', check: { type: 'all', checks: [{ type: 'outputContains', value: ['oom-killer', 'Killed process 3977'] }, { type: 'outputNotContains', value: 'EXT4' }] }, explanation: '`journalctl -k | grep -i oom` или `sudo dmesg -T | grep -i oom`.' },
  ],
  glossary: [
    { ru: 'Утечка памяти', en: 'memory leak', def: 'Память выделяется и не освобождается, процесс растёт.' },
    { ru: 'Файл подкачки', en: 'swap', def: 'Область на диске для вытеснения страниц памяти.' },
    { ru: 'Убийца при нехватке памяти', en: 'OOM killer', def: 'Механизм ядра, убивающий процесс при нехватке RAM.' },
  ],
};
export default lesson;
