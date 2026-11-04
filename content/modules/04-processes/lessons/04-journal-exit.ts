import type { LessonDef } from '../../../../src/content/types';

const workerLogs = [
  { time: '2026-11-04 11:00:00', priority: 'info' as const, message: 'Started Report worker.' },
  { time: '2026-11-04 11:42:10', priority: 'warning' as const, message: 'heap usage 85%' },
  { time: '2026-11-04 11:58:51', priority: 'warning' as const, message: 'heap usage 97%' },
  { time: '2026-11-04 11:59:02', priority: 'err' as const, message: 'report-worker.service: Main process exited, code=killed, status=9/KILL' },
  { time: '2026-11-04 11:59:02', priority: 'err' as const, message: "report-worker.service: Failed with result 'oom-kill'." },
  { time: '2026-11-04 11:59:07', priority: 'info' as const, message: 'report-worker.service: Scheduled restart job, restart counter is at 1.' },
  { time: '2026-11-04 12:00:00', priority: 'info' as const, message: 'Started Report worker.' },
  { time: '2026-11-04 12:58:40', priority: 'err' as const, message: 'report-worker.service: Main process exited, code=killed, status=9/KILL' },
  { time: '2026-11-04 12:58:40', priority: 'err' as const, message: "report-worker.service: Failed with result 'oom-kill'." },
  { time: '2026-11-04 13:00:00', priority: 'info' as const, message: 'Started Report worker.' },
];

const lesson: LessonDef = {
  id: 'journal-exit',
  title: 'journalctl и коды выхода',
  minutes: 25,
  commands: ['journalctl', 'echo'],
  scenario: {
    services: [
      { name: 'report-worker', description: 'Report worker', active: 'active', enabled: true, mainPid: 4502, logs: workerLogs },
      { name: 'mailer', description: 'Transactional mail sender', active: 'failed', enabled: true, logs: [{ time: '2026-11-04 05:00:30', priority: 'err', message: 'smtp: connection refused' }] },
    ],
  },
  tasks: [
    {
      id: 'last',
      prompt: 'Выведи **последние 5 строк** журнала сервиса `report-worker`.',
      check: { type: 'all', checks: [{ type: 'outputLines', value: 5 }, { type: 'outputContains', value: '13:00:00' }] },
      hints: ['`journalctl -u <сервис> -n <N>`'],
      solution: 'journalctl -u report-worker -n 5',
      tags: ['journalctl'],
    },
    {
      id: 'kills',
      prompt: 'Сколько раз сегодня процесс `report-worker` был **убит** (status=9/KILL)? Выведи число одним пайпом.',
      check: { type: 'outputNumber', value: 2 },
      hints: ['`journalctl -u report-worker | grep -c ...`', 'Ищи `status=9/KILL`.'],
      solution: 'journalctl -u report-worker | grep -c "status=9/KILL"',
      tags: ['journalctl', 'grep'],
    },
    {
      id: 'why',
      prompt: 'По журналу: какой результат (Result) systemd указывает как причину падения? Введи значение в кавычках из лога.',
      answer: { accept: ['oom-kill', "'oom-kill'", 'oom'], label: 'Result:' },
      hints: ['`journalctl -u report-worker -p err`'],
      solution: 'journalctl -u report-worker -p err',
      explanation: '`oom-kill` — процесс убит из-за нехватки памяти. Плюс предупреждения `heap usage 97%` перед этим — классическая утечка памяти или слишком маленький лимит.',
      tags: ['journalctl'],
    },
    {
      id: 'exit',
      prompt: 'Проверь, активен ли `mailer`, командой `systemctl is-active`, а затем выведи **код выхода** этой проверки.',
      check: { type: 'all', checks: [{ type: 'outputMatches', pattern: '(^|\\n)3\\n?$' }, { type: 'custom', fn: (sh) => sh.log.some((r) => /is-active\s+mailer/.test(r.line)) }] },
      hints: ['Код выхода последней команды — в переменной `$?`.', '`systemctl is-active mailer; echo $?` или двумя командами.'],
      solution: 'systemctl is-active mailer; echo $?',
      tags: ['systemctl'],
    },
  ],
  quiz: [
    { id: 'q-137', type: 'text', prompt: 'Процесс завершился с кодом 137. Каким сигналом его убили? (имя или номер)', answer: { accept: ['SIGKILL', 'KILL', '9'] }, explanation: '137 − 128 = 9 → **SIGKILL**, часто от OOM killer.' },
    { id: 'q-127', type: 'text', prompt: 'Какой код выхода возвращает bash, если команда не найдена?', answer: { accept: ['127'], normalize: 'number' }, explanation: '127 — command not found; 126 — найдено, но нельзя запустить.' },
    { id: 'q-follow', type: 'command', prompt: 'Выведи записи журнала сервиса `report-worker` уровня err и серьёзнее.', scenario: { services: [{ name: 'report-worker', description: 'w', active: 'active', enabled: true, logs: workerLogs }] }, solution: 'journalctl -u report-worker -p err', explanation: '`journalctl -u report-worker -p err`.' },
    { id: 'q-and', type: 'choice', prompt: 'Что выведет `false && echo A || echo B`?', options: ['A', 'B', 'A и B'], correct: 1, explanation: '`false` возвращает 1, `&&` не выполняет echo A, `||` выполняет echo B.' },
  ],
  glossary: [
    { ru: 'Код выхода', en: 'exit code', def: '0 — успех, иначе ошибка; > 128 — убит сигналом.' },
    { ru: 'Убийца при нехватке памяти', en: 'OOM killer', def: 'Механизм ядра, убивающий процесс при нехватке RAM.' },
  ],
};
export default lesson;
