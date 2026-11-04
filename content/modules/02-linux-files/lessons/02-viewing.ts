import type { LessonDef } from '../../../../src/content/types';

const lines: string[] = [];
// раз в минуту с 10:31 до 14:30 — как раз до рестарта (поток tail -f начинается в 14:30:01)
for (let i = 1; i <= 240; i++) {
  const h = Math.floor((10 * 60 + 30 + i) / 60);
  const m = (10 * 60 + 30 + i) % 60;
  const lvl = i === 237 ? 'ERROR' : i % 37 === 0 ? 'WARN ' : 'INFO ';
  const msg = i === 237 ? 'Connection to db-prod-01:5432 refused' : i % 37 === 0 ? 'slow query 1200ms' : `processed order #${5000 + i}`;
  lines.push(`2026-11-04 ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00 ${lvl} ${msg}`);
}

const lesson: LessonDef = {
  id: 'viewing',
  title: 'Просмотр файлов: cat, less, head, tail, wc',
  minutes: 20,
  commands: ['cat', 'less', 'head', 'tail', 'wc'],
  scenario: {
    files: {
      '/var/log/shop/app.log': lines.join('\n') + '\n',
      '/etc/shop/config.yml': 'server:\n  port: 8080\n  workers: 4\ndb:\n  host: db-prod-01\n  port: 5432\n  pool: 20\n',
    },
    streams: { '/var/log/shop/app.log': ['2026-11-04 14:30:01 INFO  restart requested', '2026-11-04 14:30:03 ERROR Connection to db-prod-01:5432 refused', '2026-11-04 14:30:05 ERROR Connection to db-prod-01:5432 refused'] },
  },
  tasks: [
    {
      id: 'config',
      prompt: 'Выведи конфиг `/etc/shop/config.yml` с номерами строк. На какой строке указан порт БД?',
      answer: { accept: ['6'], normalize: 'number', label: 'Номер строки:' },
      hints: ['У `cat` есть флаг для нумерации строк.', '`cat -n /etc/shop/config.yml`'],
      solution: 'cat -n /etc/shop/config.yml',
    },
    {
      id: 'last5',
      prompt: 'Покажи **последние 5 строк** лога `/var/log/shop/app.log`.',
      check: { type: 'all', checks: [{ type: 'outputLines', value: 5 }, { type: 'outputContains', value: 'refused' }] },
      hints: ['Конец файла — `tail`.', 'Количество строк — флаг `-n`.'],
      solution: 'tail -n 5 /var/log/shop/app.log',
      tags: ['tail'],
    },
    {
      id: 'count',
      prompt: 'Сколько строк в логе? Выведи число командой.',
      // после tail -f в файл дописываются строки потока — засчитываем текущее число строк файла
      check: {
        type: 'custom',
        fn: (sh, last) => {
          const f = sh.fs.lookup('/var/log/shop/app.log');
          if (!last || !f || f.type !== 'file') return false;
          const m = /^(?:\S+:)?\s*(\d+)(?:\s+\S+)?$/.exec(last.stdout.trim());
          return !!m && parseInt(m[1], 10) === f.content.split('\n').filter((l) => l !== '').length;
        },
      },
      hints: ['`wc -l` считает строки.'],
      solution: 'wc -l /var/log/shop/app.log',
    },
    {
      id: 'follow',
      prompt: 'Коллега перезапустил приложение. Последи за логом в реальном времени и посмотри, что оно пишет после рестарта. Какой хост БД недоступен? Введи имя.',
      answer: { accept: ['db-prod-01', 'db-prod-01:5432'], label: 'Хост:' },
      hints: ['Слежение за файлом — `tail -f`.', 'В тренажёре поток завершится сам.'],
      solution: 'tail -f /var/log/shop/app.log',
      tags: ['tail'],
    },
  ],
  quiz: [
    {
      id: 'q-head',
      type: 'command',
      prompt: 'Напиши команду, которая выведет **первые 3 строки** файла `/etc/shop/config.yml`.',
      scenario: { files: { '/etc/shop/config.yml': 'server:\n  port: 8080\n  workers: 4\ndb:\n  host: db-prod-01\n' } },
      solution: 'head -n 3 /etc/shop/config.yml',
      explanation: '`head -n 3 файл` (или `head -3 файл`).',
    },
    {
      id: 'q-follow',
      type: 'text',
      prompt: 'Какой флаг `tail` позволяет следить за файлом и выводить новые строки по мере появления?',
      answer: { accept: ['-f', 'f', '--follow', '-F'] },
      explanation: '`tail -f` (follow). `tail -F` ещё и переоткрывает файл после ротации.',
    },
    {
      id: 'q-less-quit',
      type: 'text',
      prompt: 'Какой клавишей выйти из `less`?',
      answer: { accept: ['q'] },
      explanation: '`q` — quit. А `/текст` — поиск, `G` — в конец.',
    },
    {
      id: 'q-rotate',
      type: 'choice',
      prompt: 'Клиент жалуется на ошибки вчера вечером, а в `app.log` только сегодняшние строки. Где, скорее всего, вчерашние?',
      options: ['Удалены навсегда', 'В ротированных файлах: app.log.1, app.log.2.gz', 'В /etc/app.log'],
      correct: 1,
      explanation: '**logrotate** переименовывает старые логи (`.1`, `.2.gz`). Сжатые читаются через `zcat`/`zgrep`.',
    },
  ],
  glossary: [
    { ru: 'Ротация логов', en: 'log rotation', def: 'Периодическое переименование/сжатие/удаление старых логов (logrotate).' },
    { ru: 'Конвейер, пайп', en: 'pipe', def: 'Передача вывода одной команды на вход другой через `|`.' },
    { ru: 'Следить за файлом', en: 'follow (tail -f)', def: 'Выводить новые строки по мере записи.' },
  ],
};
export default lesson;
