import type { LessonDef } from '../../../../src/content/types';

const scenario = {
  files: {
    '/etc/passwd': 'root:x:0:0:root:/root:/bin/bash\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\nshop:x:998:998:Shop app:/opt/shop:/usr/sbin/nologin\nalibek:x:1000:1000:Alibek:/home/alibek:/bin/bash\n',
    '/etc/shop/db.conf': { content: 'DB_PASSWORD=s3cr3t\n', mode: 0o600, owner: 'root', group: 'root' },
    '/etc/shop/app.conf': { content: 'port=8080\n', mode: 0o644 },
    '/opt/shop/bin/healthcheck.sh': { content: '#!/bin/bash\ncurl -s localhost:8080/health\n', mode: 0o644, owner: 'alibek', group: 'alibek' },
    '/var/www/uploads/.keep': { content: '', owner: 'root' },
  },
};

const lesson: LessonDef = {
  id: 'permissions',
  title: 'Права, владельцы, sudo',
  minutes: 30,
  commands: ['ls', 'chmod', 'chown', 'sudo', 'id'],
  scenario,
  tasks: [
    {
      id: 'denied',
      prompt: 'Попробуй прочитать `/etc/shop/db.conf`. Не получится. Посмотри права файла через `ls -l` и введи, **кто его владелец** (пользователь).',
      answer: { accept: ['root'], label: 'Владелец:' },
      hints: ['`ls -l /etc/shop/db.conf`', 'Третья колонка — владелец, четвёртая — группа.'],
      solution: 'ls -l /etc/shop/db.conf',
      tags: ['ls'],
    },
    {
      id: 'exec',
      prompt: 'Скрипт `/opt/shop/bin/healthcheck.sh` принадлежит тебе, но не запускается — нет права на выполнение. Добавь **владельцу** право `x`, не трогая остальные права.',
      check: { type: 'fileMode', path: '/opt/shop/bin/healthcheck.sh', mode: 0o744 },
      hints: ['Символьная запись: `u+x` — добавить (+) владельцу (u) выполнение (x).', '`chmod u+x /opt/shop/bin/healthcheck.sh`'],
      solution: 'chmod u+x /opt/shop/bin/healthcheck.sh',
      tags: ['chmod'],
    },
    {
      id: 'fix-config',
      prompt: 'Приложение работает от пользователя `shop` и должно читать `/etc/shop/db.conf`. Сделай так, чтобы владельцем остался **root**, группой стала **shop**, а права были **640** (группа только читает, остальные — ничего).',
      check: { type: 'all', checks: [{ type: 'fileOwner', path: '/etc/shop/db.conf', owner: 'root', group: 'shop' }, { type: 'fileMode', path: '/etc/shop/db.conf', mode: 0o640 }] },
      hints: ['Это две команды: `chown` для группы и `chmod` для прав. Обе — через `sudo`.', '`sudo chown root:shop /etc/shop/db.conf`', '`sudo chmod 640 /etc/shop/db.conf`'],
      solution: 'sudo chown root:shop /etc/shop/db.conf && sudo chmod 640 /etc/shop/db.conf',
      explanation: '`640` = владелец `rw-`, группа `r--`, остальные `---`. Секрет не утёк «всем», а приложение его читает.',
      tags: ['chown', 'chmod', 'sudo'],
    },
    {
      id: 'uploads',
      prompt: 'Веб-сервер (`www-data`) не может сохранять загрузки в `/var/www/uploads`. Сделай владельцем каталога **и его содержимого** пользователя и группу `www-data`.',
      check: { type: 'all', checks: [{ type: 'fileOwner', path: '/var/www/uploads', owner: 'www-data', group: 'www-data' }, { type: 'fileOwner', path: '/var/www/uploads/.keep', owner: 'www-data' }] },
      hints: ['Рекурсивно — флаг `-R`.', '`sudo chown -R www-data:www-data /var/www/uploads`'],
      solution: 'sudo chown -R www-data:www-data /var/www/uploads',
      tags: ['chown', 'sudo'],
    },
  ],
  quiz: [
    {
      id: 'q-640',
      type: 'text',
      prompt: 'Запиши числом права `rw-r-----`.',
      answer: { accept: ['640', '0640'] },
      explanation: 'rw- = 4+2 = 6, r-- = 4, --- = 0 → **640**.',
    },
    {
      id: 'q-755',
      type: 'text',
      prompt: 'Как выглядят права `755` в символьной записи (9 символов)?',
      answer: { accept: ['rwxr-xr-x'] },
      explanation: '7 = rwx, 5 = r-x, 5 = r-x.',
    },
    {
      id: 'q-dir-x',
      type: 'choice',
      prompt: 'У файла права 644, но пользователь всё равно получает Permission denied при чтении. Что проверить в первую очередь?',
      options: ['Право x на каталоги по пути к файлу', 'Свободное место на диске', 'Версию ядра'],
      correct: 0,
      explanation: 'Без `x` на каталоге нельзя обратиться к файлам внутри него, даже если сам файл читаемый.',
    },
    {
      id: 'q-777',
      type: 'text',
      prompt: 'Коллега предлагает «просто сделать chmod … и всё заработает». Какие числовые права нельзя ставить на прод-конфиг с паролями, потому что они дают всем всё?',
      answer: { accept: ['777', '0777'] },
      explanation: '`777` — чтение, запись и запуск всем. Это создаёт дыру в безопасности; правильно — настроить владельца/группу.',
    },
  ],
  glossary: [
    { ru: 'Права доступа', en: 'permissions / mode', def: 'Разрешения r/w/x для владельца, группы и остальных.' },
    { ru: 'Владелец', en: 'owner', def: 'Пользователь, которому принадлежит файл.' },
    { ru: 'Принцип наименьших привилегий', en: 'principle of least privilege', def: 'Давать ровно те права, которые нужны для работы.' },
    { ru: 'Суперпользователь', en: 'root / superuser', def: 'Пользователь без ограничений прав.' },
  ],
};
export default lesson;
