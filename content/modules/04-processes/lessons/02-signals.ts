import type { LessonDef } from '../../../../src/content/types';
import { baseProcs } from '../data';

const lesson: LessonDef = {
  id: 'signals',
  title: 'Сигналы и kill',
  minutes: 20,
  commands: ['kill', 'pgrep', 'ps', 'sudo'],
  scenario: {
    processes: [
      ...baseProcs,
      { pid: 5120, user: 'alibek', cpu: 99.1, mem: 0.4, vsz: 30_000, rss: 22_000, stat: 'R', start: '14:20', time: '9:58', command: 'bash ./my-loop-test.sh' },
      { pid: 5301, user: 'shop', cpu: 0.0, mem: 2.1, vsz: 400_000, rss: 170_000, stat: 'S', start: '02:00', time: '0:12', command: 'python3 /opt/shop/scripts/nightly_export.py' },
    ],
    services: [{ name: 'nginx', description: 'A high performance web server and a reverse proxy server', active: 'active', enabled: true, mainPid: 1101, since: 'Sat 2026-11-01 08:00:00 +05', logs: [] }],
  },
  tasks: [
    {
      id: 'own',
      prompt: 'Твой тестовый скрипт `my-loop-test.sh` ушёл в бесконечный цикл и ест CPU. Найди его PID и заверши **вежливо** (SIGTERM).',
      // процесс завершён, и ни разу не использовался SIGKILL (после kill -9 задание не засчитать — нужен сброс окружения)
      check: { type: 'custom', fn: (sh, last) => !!last && !sh.state.processes.some((p) => p.pid === 5120) && !sh.log.some((r) => /\b(kill|pkill|killall)\b.*\s(-9|-(SIG)?KILL|-s\s+(SIG)?KILL|-n\s+9)(\s|$)/i.test(r.line)) },
      hints: ['Найди PID: `pgrep -af my-loop` (`-f` ищет по всей командной строке) или `ps aux | grep loop`.', '`kill` без флагов посылает SIGTERM.'],
      solution: 'kill 5120',
      tags: ['kill'],
    },
    {
      id: 'foreign',
      prompt: 'Зависла ночная выгрузка `nightly_export.py` (пользователь `shop`). Попробуй завершить её обычным `kill` — получишь ошибку. Заверши процесс правильно (подсказка: чужой процесс).',
      check: { type: 'processGone', pid: 5301 },
      hints: ['`Operation not permitted` — процесс не твой.', '`sudo kill 5301`'],
      solution: 'sudo kill 5301',
      tags: ['kill', 'sudo'],
    },
    {
      id: 'hup',
      prompt: 'После правки конфига nginx нужно, чтобы он **перечитал конфиг без остановки**. Пошли мастер-процессу nginx нужный сигнал (процесс должен остаться жив).',
      // kill -HUP / -1 / -SIGHUP / -s HUP / -n 1 мастер-процессу (PID напрямую или через pgrep) либо systemctl reload; мастер должен остаться жив
      check: {
        type: 'custom',
        fn: (sh, last) => {
          if (!last || last.exitCode !== 0 || !sh.state.processes.some((p) => p.pid === 1101)) return false;
          const hup = /\bkill\s+(-s\s+|-n\s+)?-?(SIG)?(HUP|1)(\s|$)/i.test(last.line) && /\b1101\b|pgrep|pidof|nginx\.pid/.test(last.line);
          return hup || /\bsystemctl\s+reload\s+nginx\b|\bnginx\s+-s\s+reload\b/.test(last.line);
        },
      },
      hints: ['Мастер-процесс nginx — PID 1101 (`pgrep -a nginx`).', 'Сигнал «перечитать конфиг» — HUP.', '`sudo kill -HUP 1101`'],
      solution: 'sudo kill -HUP 1101',
      explanation: 'На практике чаще пишут `sudo systemctl reload nginx` или `sudo nginx -s reload` (оба засчитываются и здесь) — под капотом это тот же SIGHUP мастер-процессу.',
      tags: ['kill'],
    },
  ],
  quiz: [
    { id: 'q-default', type: 'text', prompt: 'Какой сигнал посылает `kill PID` без флагов? (имя или номер)', answer: { accept: ['SIGTERM', 'TERM', '15', 'SIGTERM (15)', 'SIGTERM 15', '15 (SIGTERM)', 'TERM (15)'] }, explanation: '**SIGTERM (15)** — просьба завершиться корректно.' },
    { id: 'q-9', type: 'text', prompt: 'Какой номер у сигнала, который нельзя перехватить и который немедленно убивает процесс?', answer: { accept: ['9'], normalize: 'number' }, explanation: '`kill -9` = SIGKILL.' },
    { id: 'q-zombie', type: 'choice', prompt: 'В `ps` много процессов в состоянии `Z`. Что делать?', options: ['kill -9 каждому зомби', 'Разобраться с родительским процессом, который не забирает их статус', 'Перезагрузить сервер немедленно'], correct: 1, explanation: 'Зомби уже мертвы; их «хоронит» родитель. Нужно чинить или перезапускать родителя.' },
    { id: 'q-order', type: 'text', prompt: 'Каков правильный порядок: каким сигналом пробовать сначала, прежде чем использовать SIGKILL? (имя сигнала)', answer: { accept: ['SIGTERM', 'TERM', '15', 'kill -15', 'SIGTERM (15)', 'SIGTERM 15', '15 (SIGTERM)', 'TERM (15)'] }, explanation: 'Сначала TERM, ждём, проверяем, и только потом KILL.' },
  ],
  glossary: [
    { ru: 'Сигнал', en: 'signal', def: 'Асинхронное уведомление процессу (TERM, KILL, HUP…).' },
    { ru: 'Зомби-процесс', en: 'zombie process', def: 'Завершившийся процесс, чей статус ещё не забрал родитель.' },
    { ru: 'Корректное завершение', en: 'graceful shutdown', def: 'Остановка с закрытием соединений и сохранением данных.' },
  ],
};
export default lesson;
