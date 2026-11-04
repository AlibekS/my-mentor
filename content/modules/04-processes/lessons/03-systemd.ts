import type { LessonDef } from '../../../../src/content/types';
import { baseProcs } from '../data';

const lesson: LessonDef = {
  id: 'systemd',
  title: 'systemd: status, start, restart, enable',
  minutes: 25,
  commands: ['systemctl'],
  scenario: {
    processes: baseProcs.filter((p) => p.service !== 'shop'),
    services: [
      { name: 'nginx', description: 'A high performance web server', active: 'active', enabled: true, mainPid: 1101, since: 'Sat 2026-11-01 08:00:00 +05', logs: [{ time: '2026-11-01 08:00:00', priority: 'info', message: 'Started nginx.' }] },
      { name: 'postgresql', description: 'PostgreSQL RDBMS', active: 'active', enabled: true, mainPid: 901, since: 'Mon 2026-10-12 03:11:00 +05', logs: [] },
      {
        name: 'shop',
        description: 'Shop web application',
        active: 'inactive',
        enabled: false,
        logs: [{ time: '2026-11-04 05:00:01', priority: 'info', message: 'Stopped Shop web application (system reboot).' }],
        startProcess: { user: 'shop', cpu: 2.0, mem: 9.0, vsz: 4_000_000, rss: 700_000, stat: 'Ssl', start: '14:30', time: '0:04', command: '/usr/bin/java -jar /opt/shop/shop.jar' },
        listen: [{ proto: 'tcp', local: '127.0.0.1:8080' }],
      },
      {
        name: 'mailer',
        description: 'Transactional mail sender',
        active: 'failed',
        enabled: true,
        logs: [
          { time: '2026-11-04 05:00:30', priority: 'err', message: 'smtp: dial tcp 10.0.5.25:587: connect: connection refused' },
          { time: '2026-11-04 05:00:30', priority: 'err', message: "mailer.service: Failed with result 'exit-code'." },
        ],
        failOnStart: 'smtp: dial tcp 10.0.5.25:587: connect: connection refused',
      },
    ],
  },
  tasks: [
    {
      id: 'failed',
      prompt: 'После ночной перезагрузки сервера проверь, какие юниты **упали**. Введи имя упавшего сервиса.',
      answer: { accept: ['mailer', 'mailer.service'], label: 'Сервис:' },
      hints: ['`systemctl --failed`'],
      solution: 'systemctl --failed',
      tags: ['systemctl'],
    },
    {
      id: 'shop-down',
      prompt: 'Сайт не работает, хотя `--failed` про `shop` молчит. Посмотри статус сервиса `shop` и введи, включён ли он в автозапуск (enabled/disabled).',
      answer: { accept: ['disabled', 'disable', 'выключен', 'отключен', 'не включен', 'нет'], label: 'Автозапуск:' },
      hints: ['`systemctl status shop` — строка Loaded.'],
      solution: 'systemctl status shop',
      tags: ['systemctl'],
    },
    {
      id: 'enable-now',
      prompt: 'Запусти `shop` **сейчас** и включи **автозапуск**, чтобы после следующей перезагрузки он поднялся сам.',
      check: { type: 'custom', fn: (sh) => { const s = sh.state.services.find((x) => x.name === 'shop'); return !!s && s.active === 'active' && s.enabled; } },
      hints: ['Нужны и `start`, и `enable` (через sudo).', '`sudo systemctl enable --now shop` — или двумя командами: `enable` и `start`.'],
      solution: 'sudo systemctl enable --now shop',
      explanation: '`enable --now` включает автозапуск и сразу запускает сервис — то же, что `enable` + `start`.',
      tags: ['systemctl'],
    },
    {
      id: 'is-active',
      prompt: 'Проверь одной командой, работает ли теперь `shop` — так, чтобы вывод был одним словом (удобно для скриптов).',
      check: { type: 'custom', fn: (_sh, last) => !!last && /\bsystemctl\b.*\bis-active\b.*\bshop\b/.test(last.line) && last.stdout.trim() === 'active' },
      hints: ['`systemctl is-active shop`'],
      solution: 'systemctl is-active shop',
      tags: ['systemctl'],
    },
  ],
  quiz: [
    { id: 'q-enable', type: 'choice', prompt: 'Что делает `systemctl enable nginx`?', options: ['Запускает nginx прямо сейчас', 'Включает автозапуск при загрузке, но сейчас не запускает', 'Перезапускает nginx'], correct: 1, explanation: '`enable` — автозапуск. Сразу и запустить: `enable --now`.' },
    { id: 'q-reload', type: 'text', prompt: 'Какой командой systemd перечитать изменённые файлы юнитов (после правки .service)? (команда целиком, с sudo или без)', answer: { accept: ['systemctl daemon-reload', 'sudo systemctl daemon-reload'], normalize: 'exact' }, explanation: '`sudo systemctl daemon-reload`.' },
    { id: 'q-cmd', type: 'command', prompt: 'Перезапусти сервис `nginx` (с правами root).', scenario: { services: [{ name: 'nginx', description: 'nginx', active: 'active', enabled: true, logs: [] }] }, solution: 'sudo systemctl restart nginx', check: { type: 'all', checks: [{ type: 'serviceState', name: 'nginx', state: 'active' }, { type: 'custom', fn: (_s, l) => !!l && l.exitCode === 0 && /systemctl\s+(restart|reload-or-restart|try-restart)\s+nginx\b|service\s+nginx\s+restart|systemctl\s+stop\s+nginx\b.*systemctl\s+start\s+nginx\b/.test(l.line) }] }, explanation: '`sudo systemctl restart nginx`.' },
    { id: 'q-user', type: 'text', prompt: 'Какой параметр в секции [Service] юнита задаёт пользователя, от которого работает сервис?', answer: { accept: ['User', 'User=', 'User=shop', 'User=<имя>'] }, explanation: '`User=shop` — важно, когда разбираешь Permission denied.' },
  ],
  glossary: [
    { ru: 'Юнит', en: 'unit', def: 'Объект systemd: сервис, таймер, сокет, точка монтирования.' },
    { ru: 'Автозапуск', en: 'enabled at boot', def: 'Сервис стартует при загрузке системы.' },
    { ru: 'Демон', en: 'daemon', def: 'Фоновый процесс-сервис.' },
  ],
};
export default lesson;
