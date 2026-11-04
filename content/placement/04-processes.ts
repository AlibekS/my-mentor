import type { PlacementTopic } from '../../src/content/types';

const t: PlacementTopic = {
  moduleId: '04-processes',
  questions: [
    { id: 'pl-proc-1', difficulty: 1, lessons: ['systemd'], prompt: 'Какой командой посмотреть статус systemd-сервиса `nginx`? (команда целиком)', answer: { accept: ['systemctl status nginx', 'sudo systemctl status nginx', 'systemctl status nginx.service'], normalize: 'exact' } },
    { id: 'pl-proc-2', difficulty: 2, lessons: ['signals'], prompt: 'Какой сигнал посылает `kill -9`? (имя сигнала)', answer: { accept: ['SIGKILL', 'KILL'] } },
    {
      id: 'pl-proc-3',
      difficulty: 3,
      lessons: ['ps-top'],
      prompt: 'nginx не стартует: порт 8080 занят. Найди процесс, который занял порт **8080**, и введи его PID.',
      scenario: {
        processes: [
          { pid: 1, user: 'root', cpu: 0, mem: 0.1, vsz: 1, rss: 1, stat: 'Ss', start: 'Oct12', time: '0:41', command: '/sbin/init' },
          { pid: 4242, user: 'alibek', cpu: 0.2, mem: 0.5, vsz: 1, rss: 1, stat: 'S', start: '09:12', time: '0:01', command: 'python3 -m http.server 8080' },
          { pid: 5120, user: 'root', cpu: 1.0, mem: 2.0, vsz: 1, rss: 1, stat: 'Ss', start: '08:00', time: '0:30', command: '/usr/sbin/sshd -D' },
        ],
        listeners: [
          { proto: 'tcp', local: '0.0.0.0:22', pid: 5120, process: 'sshd' },
          { proto: 'tcp', local: '0.0.0.0:8080', pid: 4242, process: 'python3' },
        ],
      },
      answer: { accept: ['4242'], normalize: 'number' },
    },
    { id: 'pl-proc-4', difficulty: 3, lessons: ['journal-exit'], prompt: 'Какой командой посмотреть логи сервиса `app` только за последний час? (journalctl с опциями)', answer: { accept: ['journalctl -u app --since "1 hour ago"', "journalctl -u app --since '1 hour ago'", 'journalctl -u app --since "-1h"', 'journalctl -u app -S "1 hour ago"', 'journalctl --since "1 hour ago" -u app'], normalize: 'exact' } },
  ],
};
export default t;
