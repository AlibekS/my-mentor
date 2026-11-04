import type { PlacementTopic } from '../../src/content/types';
import { genAccess, hms, toLog } from '../shared/logs';

const access = genAccess({ seed: 99, from: hms(10, 0), to: hms(10, 40), step: [5, 15], override: (e, sec, r) => (sec > hms(10, 20) && r() < 0.2 ? { ...e, status: 500 } : e) });
const log = toLog(access);
const topIp = (() => {
  const c = new Map<string, number>();
  for (const e of access) c.set(e.ip, (c.get(e.ip) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0][0];
})();

const t: PlacementTopic = {
  moduleId: '03-logs',
  questions: [
    { id: 'pl-log-1', difficulty: 1, lessons: ['grep'], prompt: 'Какой флаг grep делает поиск **без учёта регистра**?', answer: { accept: ['-i', 'i', '--ignore-case'] } },
    {
      id: 'pl-log-2',
      difficulty: 2,
      lessons: ['grep', 'pipes'],
      prompt: 'Напиши команду, которая посчитает строки со статусом ` 500 ` в `/var/log/nginx/access.log`.',
      scenario: { files: { '/var/log/nginx/access.log': log } },
      solution: 'grep -c " 500 " /var/log/nginx/access.log',
    },
    {
      id: 'pl-log-3',
      difficulty: 3,
      lessons: ['pipes', 'fields'],
      prompt: 'Исследуй `/var/log/nginx/access.log` и введи IP-адрес, сделавший больше всего запросов.',
      scenario: { files: { '/var/log/nginx/access.log': log } },
      answer: { accept: [topIp] },
    },
    {
      id: 'pl-log-4',
      difficulty: 3,
      lessons: ['fields'],
      prompt: "Напиши awk-команду, которая выведет URL (поле 7) всех запросов со статусом 500 из `/var/log/nginx/access.log`.",
      scenario: { files: { '/var/log/nginx/access.log': log } },
      solution: "awk '$9 == 500 {print $7}' /var/log/nginx/access.log",
    },
  ],
};
export default t;
