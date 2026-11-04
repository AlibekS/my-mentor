import type { LessonDef } from '../../../../src/content/types';

const scenario = {
  host: 'shop-prod-02',
  files: {
    '/etc/passwd': 'root:x:0:0:root:/root:/bin/bash\nshop:x:998:998:Shop app:/opt/shop:/usr/sbin/nologin\nalibek:x:1000:1000:Alibek:/home/alibek:/bin/bash\n',
    '/etc/shop/app.conf': { content: 'port=8080\nworkers=4\n', mode: 0o644, mtime: '-30d' },
    '/etc/shop/secrets.env': { content: 'DB_PASSWORD=pr0d-s3cr3t\nSTRIPE_KEY=sk_live_xxx\n', mode: 0o600, owner: 'root', group: 'root', mtime: '-12.5h' },
    '/opt/shop/releases/3.1.4/shop.jar': { content: '', size: 51_000_000, mtime: '-12d' },
    '/opt/shop/releases/3.2.0/shop.jar': { content: '', size: 52_000_000, mtime: '-12.5h' },
    '/opt/shop/deploy.log': { content: '02:01:10 copy release 3.2.0\n02:01:12 copy config secrets.env (as root)\n02:01:13 systemctl restart shop\n02:01:14 done\n', mtime: '-12.5h' },
  },
  services: [
    {
      name: 'shop',
      description: 'Shop web application',
      active: 'failed' as const,
      enabled: true,
      logs: [
        { time: '2026-11-03 18:00:00', priority: 'info' as const, message: 'Started Shop web application.' },
        { time: '2026-11-04 02:01:13', priority: 'info' as const, message: 'Stopping Shop web application...' },
        { time: '2026-11-04 02:01:13', priority: 'info' as const, message: 'Starting Shop web application...' },
        { time: '2026-11-04 02:01:14', priority: 'err' as const, message: 'Exception in thread "main" java.nio.file.AccessDeniedException: /etc/shop/secrets.env' },
        { time: '2026-11-04 02:01:14', priority: 'err' as const, message: 'shop.service: Main process exited, code=exited, status=1/FAILURE' },
        { time: '2026-11-04 02:01:14', priority: 'err' as const, message: "shop.service: Failed with result 'exit-code'." },
      ],
      startProcess: { user: 'shop', cpu: 3.1, mem: 9.5, vsz: 4_100_000, rss: 780_000, stat: 'Ssl', start: '02:14', time: '0:05', command: '/usr/bin/java -jar /opt/shop/releases/3.2.0/shop.jar' },
      listen: [{ proto: 'tcp' as const, local: '0.0.0.0:8080' }],
      requires: [{ path: '/etc/shop/secrets.env', readableBy: 'shop', error: 'Exception in thread "main" java.nio.file.AccessDeniedException: /etc/shop/secrets.env' }],
    },
  ],
};

const lesson: LessonDef = {
  id: 'boss',
  kind: 'boss',
  title: 'Сервис не стартует после деплоя',
  minutes: 35,
  incident: { ticket: 'INC-2210: «shop.service failed после ночного деплоя 3.2.0, сайт недоступен»', severity: 'SEV1', customer: 'все клиенты магазина' },
  commands: ['hostname', 'systemctl', 'journalctl', 'ls', 'find', 'chown', 'chmod', 'sudo'],
  scenario,
  tasks: [
    {
      id: 'host',
      prompt: 'Первым делом — убедись, что ты на нужном сервере. Введи имя хоста.',
      answer: { accept: ['shop-prod-02'], label: 'Hostname:' },
      hints: ['`hostname`'],
      solution: 'hostname',
    },
    {
      id: 'cause',
      prompt: 'Посмотри статус сервиса `shop` и его журнал. Какой **файл** приложение не может открыть? Введи полный путь.',
      answer: { accept: ['/etc/shop/secrets.env'], label: 'Файл:' },
      hints: ['`systemctl status shop`', 'Подробнее — `journalctl -u shop -n 20`. Ищи Exception.'],
      solution: 'journalctl -u shop -n 20',
      tags: ['journalctl'],
    },
    {
      id: 'why',
      prompt: 'Посмотри права и владельца этого файла. Сервис работает от пользователя `shop`. Почему он не может прочитать файл? Введи текущие права файла **числом**.',
      answer: { accept: ['600', '0600'], label: 'Права:' },
      hints: ['`ls -l /etc/shop/secrets.env`', '`rw-------` = ?'],
      solution: 'ls -l /etc/shop/secrets.env\n# rw------- = 600',
      explanation: '`600 root:root` — читать может только root. Деплой-скрипт скопировал секрет от root (см. `/opt/shop/deploy.log`).',
      tags: ['ls'],
    },
    {
      id: 'fix',
      prompt: 'Почини доступ **правильно**: владелец — `root`, группа — `shop`, права — `640`. (`777` и `644` для секретов — нельзя.)',
      check: { type: 'all', checks: [{ type: 'fileOwner', path: '/etc/shop/secrets.env', owner: 'root', group: 'shop' }, { type: 'fileMode', path: '/etc/shop/secrets.env', mode: 0o640 }] },
      hints: ['Нужны `chown` и `chmod` через `sudo`.', '`sudo chown root:shop /etc/shop/secrets.env`', '`sudo chmod 640 /etc/shop/secrets.env`'],
      solution: 'sudo chown root:shop /etc/shop/secrets.env && sudo chmod 640 /etc/shop/secrets.env',
      tags: ['chown', 'chmod'],
    },
    {
      id: 'restart',
      prompt: 'Перезапусти сервис `shop` и убедись, что он поднялся (статус **active**).',
      check: { type: 'serviceState', name: 'shop', state: 'active' },
      hints: ['`sudo systemctl restart shop`', 'Если снова failed — смотри журнал: возможно, права ещё не те.'],
      solution: 'sudo systemctl restart shop && systemctl status shop',
      tags: ['systemctl'],
    },
  ],
  quiz: [
    {
      id: 'q-root-cause',
      type: 'text',
      prompt: 'Сформулируй первопричину одной фразой (проверяются ключевые слова: про права/доступ и про деплой или секретный файл).',
      answer: { accept: [], normalize: 'keywords', keywords: [['прав', 'доступ', 'permission', 'access', 'владел', 'owner', '600'], ['депло', 'deploy', 'выкладк', 'релиз', 'release', 'скрипт', 'secrets', 'секрет', 'конфиг', 'файл']] },
      explanation: 'Например: «Деплой-скрипт скопировал secrets.env от root с правами 600, сервис от пользователя shop не смог прочитать файл».',
    },
    {
      id: 'q-prevent',
      type: 'choice',
      prompt: 'Какое действие предотвратит повторение (action item в постмортеме)?',
      options: ['Поставить 777 на /etc/shop', 'Исправить деплой-скрипт: выставлять владельца и права секретов после копирования + проверка запуска сервиса', 'Больше не делать ночные деплои'],
      correct: 1,
      explanation: 'Устраняем причину в процессе (деплой), а не симптом.',
    },
    {
      id: 'q-chain',
      type: 'text',
      prompt: 'Какой командой ты смотришь журнал конкретного systemd-сервиса `shop`? (команда целиком, без -n)',
      // любые варианты: -u shop, -xeu shop, --unit=shop.service, с sudo, с --no-pager/-f
      answer: { accept: [], normalize: 'keywords', keywords: [['journalctl'], ['-u', 'u shop', '--unit'], ['shop']] },
      explanation: '`journalctl -u <сервис>`; добавь `-n 50` для последних строк или `-f` для слежения.',
    },
  ],
  glossary: [
    { ru: 'Деплой', en: 'deployment', def: 'Выкладка новой версии приложения на сервер.' },
    { ru: 'Юнит systemd', en: 'systemd unit', def: 'Описание сервиса для systemd (shop.service).' },
  ],
};
export default lesson;
