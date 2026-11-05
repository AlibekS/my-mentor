import type { LessonDef } from '../../../../../src/content/types';

const audit = `2026-11-04 08:12:40 user=anna action=login source=10.20.1.14
2026-11-04 08:55:03 user=anna action=update setting=support_email
2026-11-04 09:00:12 user=deploy-bot action=update setting=payment_timeout value=30s
`;

const scenario = {
  host: 'shop-web-01',
  files: {
    '/etc/shop/app.conf': { content: 'port=8080\npayment_timeout=30s\n', mode: 0o644, owner: 'root', group: 'root' },
    '/etc/shop/secrets.env': { content: 'DB_PASSWORD=pr0d-s3cr3t\nPAYBOX_KEY=pk_live_xxx\n', mode: 0o600, owner: 'root', group: 'root' },
    '/var/log/shop/app.log': { content: '2026-11-04 09:00:15 INFO  Settings reloaded\n', mode: 0o644, owner: 'shop', group: 'shop' },
    '/var/log/shop/audit.log': { content: audit, mode: 0o600, owner: 'root', group: 'root' },
  },
};

const lesson: LessonDef = {
  id: 'permissions',
  title: 'Права доступа и sudo: читаем ls -l',
  minutes: 25,
  commands: ['ls', 'whoami', 'id', 'sudo'],
  scenario,
  tasks: [
    {
      id: 'owner',
      prompt: 'Посмотри подробный список файлов в `/etc/shop`. **Кто владелец** файла `secrets.env`? Введи имя пользователя.',
      answer: { accept: ['root', 'root root', 'root:root', 'владелец root'], label: 'Владелец:' },
      hints: ['Подробный список — `ls -l`.', '`ls -l /etc/shop` — третья колонка — владелец, четвёртая — группа.'],
      solution: 'ls -l /etc/shop',
      explanation: 'Владелец — `root`, группа — тоже `root`.',
      tags: ['ls'],
    },
    {
      id: 'denied',
      prompt:
        'Попробуй прочитать `/etc/shop/secrets.env` командой `cat`. Терминал ответит по-английски. **Что означает** эта ошибка? Ответь своими словами.',
      answer: {
        accept: [],
        normalize: 'keywords',
        keywords: [['прав', 'доступ', 'запрещ', 'отказ', 'permission', 'denied', 'access', 'разреш', 'нельзя']],
        label: 'Ошибка значит:',
        placeholder: 'например: нет прав на чтение',
      },
      hints: ['Выполни `cat /etc/shop/secrets.env`.', '*Permission denied* — «доступ запрещён». Сравни с правами файла из `ls -l`: `rw-------`.'],
      solution: 'cat /etc/shop/secrets.env',
      explanation: '*Permission denied* — нет прав. Права `rw-------` разрешают читать только владельцу (root), а ты — `alibek`. И это правильно: в файле пароли.',
    },
    {
      id: 'others',
      prompt:
        'Теперь посмотри права файла `/etc/shop/app.conf`. Что могут делать с ним **остальные** пользователи (последняя тройка прав)? Введи три символа прав или ответь словами.',
      answer: {
        accept: [],
        normalize: 'keywords',
        keywords: [['r--', 'чтен', 'читат', 'read', 'прочит']],
        label: 'Остальные могут:',
        placeholder: 'например: r-- или «только читать»',
      },
      hints: ['`ls -l /etc/shop/app.conf`', 'Права `rw-r--r--` делятся на тройки: `rw-` | `r--` | `r--`. Последняя — для остальных.'],
      solution: 'ls -l /etc/shop/app.conf\n# rw-r--r-- → остальные: r-- (только чтение)',
      explanation: '`rw-r--r--`: владелец — чтение и запись, группа и остальные — только чтение (`r--`). Поэтому `cat /etc/shop/app.conf` у тебя работает.',
      tags: ['ls'],
    },
    {
      id: 'sudo',
      prompt:
        'L3 спрашивает: **кто последним** менял настройки магазина? Это записано в последней строке `/var/log/shop/audit.log`, но файл читает только root. У тебя есть `sudo` — прочитай файл и введи имя пользователя из последней записи (`user=…`).',
      answer: { accept: ['deploy-bot', 'user=deploy-bot', 'deploy bot'], label: 'Пользователь:' },
      hints: ['Без sudo будет Permission denied. Добавь `sudo` перед командой.', '`sudo tail -n 1 /var/log/shop/audit.log` (или `sudo cat …` — файл короткий).'],
      solution: 'sudo tail -n 1 /var/log/shop/audit.log',
      explanation: 'Последняя запись: `user=deploy-bot action=update setting=payment_timeout` — настройки поменял робот деплоя в 09:00. Полезный факт для L3. `sudo` здесь только читает — ничего не меняет.',
      tags: ['sudo', 'tail'],
    },
  ],
  quiz: [
    {
      id: 'q-rwx',
      type: 'text',
      prompt: 'Что означают буквы `r`, `w` и `x` в правах файла? Ответь тремя словами.',
      answer: { accept: [], normalize: 'keywords', keywords: [['чтен', 'чита', 'read'], ['запис', 'измен', 'писать', 'write'], ['выполн', 'запуск', 'исполн', 'execute', 'exec', 'run']] },
      explanation: '`r` — read (чтение), `w` — write (запись/изменение), `x` — execute (запуск).',
    },
    {
      id: 'q-group',
      type: 'text',
      prompt: 'Строка из `ls -l`: `-rw-r----- 1 root adm 5120 Nov 4 10:00 app.log`. Какая у файла **группа**?',
      answer: { accept: ['adm'] },
      explanation: 'Третья колонка — владелец (`root`), четвёртая — группа (`adm`). Группа здесь может читать (`r--`), остальные — ничего.',
    },
    {
      id: 'q-sudo-cmd',
      type: 'command',
      prompt: 'Файл `/var/log/shop/audit.log` читает только root. Выведи его содержимое с помощью `sudo`.',
      scenario: { files: { '/var/log/shop/audit.log': { content: audit, mode: 0o600, owner: 'root', group: 'root' } } },
      solution: 'sudo cat /var/log/shop/audit.log',
      explanation: '`sudo` выполняет одну команду от имени root. Подойдут `sudo cat`, `sudo less`, `sudo tail` — файл короткий.',
    },
    {
      id: 'q-sudo-rule',
      type: 'choice',
      prompt: 'Тебе, L2, выдали `sudo` на сервере. Как правильно им пользоваться?',
      options: [
        'Писать sudo перед каждой командой, чтобы не было ошибок',
        'Читать нужные по тикету логи и статусы; ничего не менять без runbook или согласования с L3',
        'Сразу поставить всем файлам права 777, чтобы больше не просить доступ',
      ],
      correct: 1,
      explanation: 'sudo — это права администратора. L2 использует их для чтения; изменения — по инструкции или через L3.',
    },
  ],
  glossary: [
    { ru: 'Права доступа', en: 'permissions', def: 'Кто может читать (r), изменять (w) и запускать (x) файл.' },
    { ru: 'Владелец', en: 'owner', def: 'Пользователь, которому принадлежит файл (третья колонка `ls -l`).' },
    { ru: 'Группа', en: 'group', def: 'Набор пользователей с общими правами (четвёртая колонка `ls -l`).' },
    { ru: 'Суперпользователь', en: 'root / superuser', def: 'Администратор без ограничений прав.' },
    { ru: 'Доступ запрещён', en: 'Permission denied', def: 'У пользователя нет прав на это действие.' },
  ],
};
export default lesson;
