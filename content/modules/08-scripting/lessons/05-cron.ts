import type { LessonDef } from '../../../../src/content/types';

const scenario = {
  files: {
    '/opt/scripts/health.sh': { content: '#!/usr/bin/env bash\necho "health ok"\n', mode: 0o755 },
    '/var/spool/cron/crontabs/backup': { content: '# m h dom mon dow command\n15 2 * * * pg_dump shop > /backup/shop.sql\n', owner: 'root', mode: 0o600 },
    '/var/log/syslog': 'Nov  4 02:15:01 srv CRON[8812]: (backup) CMD (pg_dump shop > /backup/shop.sql)\nNov  4 02:15:01 srv CRON[8811]: (CRON) info (No MTA installed, discarding output)\nNov  4 02:15:01 srv CRON[8812]: /bin/sh: 1: pg_dump: not found\n',
  },
};

const lesson: LessonDef = {
  id: 'cron',
  title: 'cron и systemd timers',
  minutes: 25,
  commands: ['crontab'],
  scenario,
  tasks: [
    {
      id: 'install',
      prompt: 'Поставь `/opt/scripts/health.sh` на запуск **каждые 5 минут** с записью вывода и ошибок в `/var/log/health.log`. Создай файл `~/mycron` (через `nano` или `echo`) и установи его командой `crontab ~/mycron`.',
      check: {
        type: 'custom',
        fn: (sh) => {
          const n = sh.fs.lookup('/var/spool/cron/crontabs/alibek');
          if (!n) return false;
          return n.content.split('\n').some((l) => /^\*\/5\s+\*\s+\*\s+\*\s+\*\s+(?:(?:\/usr)?\/bin\/)?(?:(?:ba)?sh\s+)?\/opt\/scripts\/health\.sh\s*>>?\s*\/var\/log\/health\.log\s+2>&1\s*$/.test(l.trim()));
        },
      },
      hints: ['Строка: `*/5 * * * * /opt/scripts/health.sh >> /var/log/health.log 2>&1`', "Создать файл: `echo '…' > ~/mycron` (одинарные кавычки, чтобы `*` не раскрылась).", 'Установить: `crontab ~/mycron`, проверить: `crontab -l`.'],
      solution: "echo '*/5 * * * * /opt/scripts/health.sh >> /var/log/health.log 2>&1' > ~/mycron\ncrontab ~/mycron",
    },
    {
      id: 'when',
      prompt: 'Посмотри задачи пользователя `backup` (`sudo crontab -u backup -l`). В какое время запускается бэкап? Введи `ЧЧ:ММ`.',
      answer: { accept: ['02:15', '2:15', '02:15 ночи', '2:15 ночи', 'в 02:15', 'в 2:15', '02:15:00'], label: 'Время:' },
      hints: ['`sudo crontab -u backup -l`', 'Первое поле — минуты, второе — часы.'],
      solution: 'sudo crontab -u backup -l\n# 15 2 → 02:15',
    },
    {
      id: 'why-fails',
      prompt: 'Бэкап не создаётся. Найди в `/var/log/syslog` ошибку запуска и введи, **какую команду** cron не нашёл.',
      answer: { accept: ['pg_dump'], label: 'Команда:' },
      hints: ['`grep CRON /var/log/syslog`'],
      solution: 'grep CRON /var/log/syslog',
      explanation: 'У cron минимальный PATH. Решение — полный путь (`/usr/bin/pg_dump`) или `PATH=...` в начале crontab. Плюс: вывод задачи «discarding output» — надо перенаправлять в лог.',
    },
  ],
  quiz: [
    { id: 'q-daily3', type: 'text', prompt: 'Запиши расписание cron «каждый день в 03:00» (5 полей).', answer: { accept: ['0 3 * * *', '00 03 * * *', '0 03 * * *', '00 3 * * *'] }, explanation: '`0 3 * * *` — минута 0, час 3.' },
    { id: 'q-every', type: 'choice', prompt: 'Что означает `* 3 * * *`?', options: ['Один раз в 03:00', 'Каждую минуту с 03:00 до 03:59', 'Каждые 3 минуты'], correct: 1, explanation: '`*` в поле минут — каждую минуту.' },
    { id: 'q-weekdays', type: 'text', prompt: 'Расписание «по будням (пн–пт) в 09:30» (5 полей).', answer: { accept: ['30 9 * * 1-5', '30 09 * * 1-5', '30 9 * * mon-fri', '30 09 * * mon-fri'] }, explanation: '`30 9 * * 1-5`.' },
    { id: 'q-timers', type: 'text', prompt: 'Какой командой показать все systemd-таймеры и время следующего запуска? (команда целиком)', answer: { accept: ['systemctl list-timers', 'systemctl list-timers --all', 'sudo systemctl list-timers', 'sudo systemctl list-timers --all'], normalize: 'exact' }, explanation: '`systemctl list-timers`.' },
  ],
  glossary: [
    { ru: 'Планировщик задач', en: 'cron / crontab', def: 'Запуск команд по расписанию из пяти полей.' },
    { ru: 'Таймер systemd', en: 'systemd timer', def: 'Юнит, запускающий сервис по расписанию (OnCalendar).' },
    { ru: 'Блокировка запуска', en: 'flock', def: 'Не дать задаче запуститься повторно, пока работает предыдущий запуск.' },
  ],
};
export default lesson;
