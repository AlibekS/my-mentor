import type { LessonDef } from '../../../../../src/content/types';

const files: Record<string, string> = {
  '/var/log/shop/app.log': '2026-11-04 10:00:01 INFO  Shop started\n',
  '/var/log/shop/app.log.1': '2026-11-03 23:59:58 INFO  Shop stopped\n',
  '/var/log/shop/payments.log': '2026-11-04 10:02:11 INFO  Payment ok order=ORD-1001\n',
  '/var/log/nginx/access.log': '10.20.1.14 - - [04/Nov/2026:10:00:05 +0500] "GET / HTTP/1.1" 200 5120\n',
  '/var/log/nginx/access.log.1': '10.20.1.14 - - [03/Nov/2026:23:59:01 +0500] "GET / HTTP/1.1" 200 5120\n',
  '/var/log/nginx/error.log': '',
  '/etc/shop/app.conf': 'port=8080\n',
  '/opt/shop/VERSION': '3.4.1\n',
  '/home/alibek/notes.txt': 'Не забыть: логи магазина — в /var/log/shop\n',
};
const nginxFiles = Object.keys(files).filter((p) => p.startsWith('/var/log/nginx/')).length;

const lesson: LessonDef = {
  id: 'shell',
  title: 'Сервер, терминал и навигация: pwd, ls, cd',
  minutes: 20,
  commands: ['hostname', 'pwd', 'ls', 'cd'],
  scenario: { host: 'shop-web-01', files },
  tasks: [
    {
      id: 'host',
      prompt:
        'Ты подключился к серверу по SSH. Первым делом убедись, **на каком сервере** ты находишься. Имя видно в приглашении после `@`, а ещё его печатает команда `hostname`. Введи имя сервера.',
      answer: { accept: ['shop-web-01'], label: 'Сервер:' },
      hints: ['Посмотри на приглашение терминала: `пользователь@сервер:каталог$`.', 'Или выполни `hostname`.'],
      solution: 'hostname',
      explanation: 'Имя сервера — `shop-web-01`. Проверять его — привычка, которая спасает от действий «не на том сервере».',
      tags: ['hostname'],
    },
    {
      id: 'cd-abs',
      prompt:
        'Перейди в каталог с логами магазина — `/var/log/shop`. Задание засчитается, когда текущим каталогом станет он (приглашение тоже изменится).',
      check: { type: 'cwd', path: '/var/log/shop' },
      hints: ['Перейти в каталог — команда `cd`, после неё — путь.', '`cd /var/log/shop`'],
      solution: 'cd /var/log/shop',
      explanation: 'Путь начинается с `/` — это абсолютный путь, он работает из любого каталога.',
      tags: ['cd'],
    },
    {
      id: 'cd-rel',
      prompt:
        'Теперь ты в `/var/log/shop`. Рядом с ним лежит каталог `/var/log/nginx` — логи веб-сервера. Перейди туда. Попробуй **относительный путь**: подняться на уровень выше (`..`) и зайти в соседний каталог.',
      check: { type: 'cwd', path: '/var/log/nginx' },
      hints: ['`..` — каталог уровнем выше. Из `/var/log/shop` это `/var/log`.', '`cd ../nginx`', 'Абсолютный путь тоже засчитается: `cd /var/log/nginx`.'],
      solution: 'cd ../nginx',
      explanation: '`../nginx` = «подняться в `/var/log` и зайти в `nginx`». Задание проверяет результат — где ты оказался, поэтому подходит и абсолютный путь.',
      tags: ['cd'],
    },
    {
      id: 'no-such',
      prompt:
        'Коллега пишет в чате по-английски: *«Logs are in /var/logs/shop»*. Выполни `cd /var/logs/shop` — терминал ответит ошибкой на английском. Что она означает? Ответь своими словами (по-русски или по-английски).',
      answer: {
        accept: [],
        normalize: 'keywords',
        keywords: [['нет', 'не сущест', 'не найд', 'отсутств', 'no such', 'not found', 'not exist', "doesn't exist", 'неправильн', 'неверн', 'ошибка в пути', 'опечат']],
        label: 'Ошибка значит:',
        placeholder: 'например: такого каталога нет',
      },
      hints: ['Выполни `cd /var/logs/shop` и прочитай ответ терминала.', '*No such file or directory* — «нет такого файла или каталога». Сравни путь с правильным: `/var/log/shop`.'],
      solution: 'cd /var/logs/shop',
      explanation: '*No such file or directory* — такого пути нет. Коллега ошибся: каталог называется `/var/log` (без буквы s). Такие опечатки — самая частая причина этой ошибки.',
    },
    {
      id: 'count',
      prompt: 'Сколько файлов лежит в каталоге `/var/log/nginx`? Посмотри и введи число.',
      answer: { accept: [String(nginxFiles)], normalize: 'number', label: 'Файлов:' },
      hints: ['Содержимое каталога показывает `ls`.', 'Ты уже в `/var/log/nginx`? Тогда хватит `ls`. Из любого места — `ls /var/log/nginx`.'],
      solution: 'ls /var/log/nginx',
      explanation: `В каталоге ${nginxFiles} файла: текущие логи \`access.log\` и \`error.log\` и вчерашний \`access.log.1\` (старые логи получают номер в конце имени).`,
      tags: ['ls'],
    },
  ],
  quiz: [
    {
      id: 'q-pwd',
      type: 'command',
      prompt: 'Напиши команду, которая покажет, в каком каталоге ты сейчас находишься.',
      scenario: { cwd: '/opt/shop', dirs: ['/opt/shop'] },
      solution: 'pwd',
      explanation: '`pwd` — print working directory, полный путь к текущему каталогу.',
    },
    {
      id: 'q-home',
      type: 'command',
      prompt: 'Ты в `/var/log`. Вернись в свой домашний каталог.',
      scenario: { cwd: '/var/log' },
      solution: 'cd',
      check: { type: 'cwd', path: '/home/alibek' },
      explanation: '`cd` без аргументов или `cd ~` ведёт домой — в `/home/<пользователь>`.',
    },
    {
      id: 'q-dotdot',
      type: 'text',
      prompt: 'Что означают две точки `..` в команде `cd ..`?',
      answer: { accept: [], normalize: 'keywords', keywords: [['выше', 'родител', 'parent', 'вверх', 'наверх', 'up', 'предыдущ', 'назад']] },
      explanation: '`..` — родительский каталог, на уровень выше. Из `/var/log/shop` команда `cd ..` ведёт в `/var/log`.',
    },
    {
      id: 'q-abs',
      type: 'choice',
      prompt: 'Ты находишься в `/home/alibek`. Какой путь приведёт к логу nginx **независимо** от текущего каталога?',
      options: ['nginx/error.log', '/var/log/nginx/error.log', '../nginx/error.log'],
      correct: 1,
      explanation: 'Абсолютный путь начинается с `/` (от корня) и работает из любого места. Остальные — относительные, они зависят от того, где ты стоишь.',
    },
    {
      id: 'q-prompt',
      type: 'text',
      prompt: 'Приглашение терминала: `anna@crm-api-02:/etc$`. Как называется сервер?',
      answer: { accept: ['crm-api-02'] },
      explanation: 'Формат приглашения: `пользователь@сервер:каталог$`. Пользователь — anna, сервер — crm-api-02, каталог — /etc.',
    },
  ],
  glossary: [
    { ru: 'Сервер', en: 'server / host', def: 'Компьютер в дата-центре или облаке, на котором работает продукт.' },
    { ru: 'Терминал, командная строка', en: 'terminal, command line', def: 'Окно, в котором управляют сервером текстовыми командами.' },
    { ru: 'Оболочка', en: 'shell (bash)', def: 'Программа, которая читает и выполняет твои команды.' },
    { ru: 'Приглашение', en: 'prompt', def: 'Строка перед курсором: пользователь@сервер:каталог$.' },
    { ru: 'Каталог', en: 'directory, folder', def: 'Папка с файлами.' },
    { ru: 'Абсолютный путь', en: 'absolute path', def: 'Путь от корня `/`, работает из любого каталога.' },
    { ru: 'Относительный путь', en: 'relative path', def: 'Путь от текущего каталога.' },
  ],
};
export default lesson;
