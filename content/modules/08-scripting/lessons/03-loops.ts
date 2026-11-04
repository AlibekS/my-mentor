import type { LessonDef } from '../../../../src/content/types';

const scenario = {
  files: {
    '/var/log/app/api.log': 'INFO a\nERROR x\nERROR y\n',
    '/var/log/app/worker.log': 'INFO a\nINFO b\n',
    '/var/log/app/billing.log': 'ERROR z\nINFO c\nERROR q\nERROR w\n',
    '/home/alibek/servers.txt': { owner: 'alibek', content: 'web-01\nweb-02\ndb-01\ncache-01\n' },
    '/home/alibek/endpoints.txt': { owner: 'alibek', content: 'shop.kz /health\napi.shop.kz /v1/health\npay.shop.kz /status\n' },
  },
  network: {
    hosts: {
      'web-01': { ip: '10.0.1.11' }, 'web-02': { ip: '10.0.1.12', reachable: false }, 'db-01': { ip: '10.0.1.20' }, 'cache-01': { ip: '10.0.1.30' },
      'shop.kz': { ip: '10.0.2.5' }, 'api.shop.kz': { ip: '10.0.2.7' }, 'pay.shop.kz': { ip: '10.0.2.9' },
    },
    http: {
      'https://shop.kz/health': { status: 200, body: 'ok' },
      'https://api.shop.kz/v1/health': { status: 200, body: 'ok' },
      'https://pay.shop.kz/status': { status: 503, body: 'down' },
    },
  },
};

const lesson: LessonDef = {
  id: 'loops',
  title: 'Циклы: for, while read',
  minutes: 30,
  commands: ['for', 'while'],
  scenario,
  tasks: [
    {
      id: 'logs',
      prompt: 'Для **каждого** `.log` в `/var/log/app` выведи строку `имя_файла: число_ошибок` (полный путь и количество `ERROR`).',
      check: { type: 'all', checks: [{ type: 'outputContains', value: ['/var/log/app/api.log: 2', '/var/log/app/worker.log: 0', '/var/log/app/billing.log: 3'] }] },
      hints: ['`for f in /var/log/app/*.log; do …; done`', 'Внутри: `echo "$f: $(grep -c ERROR "$f")"`'],
      solution: 'for f in /var/log/app/*.log; do echo "$f: $(grep -c ERROR "$f")"; done',
    },
    {
      id: 'ping',
      prompt: 'Проверь доступность всех серверов из `~/servers.txt` (по одному ping-пакету) и для каждого выведи `имя up` или `имя DOWN`.',
      check: { type: 'all', checks: [{ type: 'outputContains', value: ['web-01 up', 'web-02 DOWN', 'db-01 up', 'cache-01 up'] }] },
      hints: ['`for h in $(cat ~/servers.txt); do …; done`', 'Внутри: `ping -c 1 "$h" > /dev/null && echo "$h up" || echo "$h DOWN"`'],
      solution: 'for h in $(cat ~/servers.txt); do ping -c 1 "$h" > /dev/null && echo "$h up" || echo "$h DOWN"; done',
    },
    {
      id: 'endpoints',
      prompt: 'Файл `~/endpoints.txt` содержит пары `хост путь`. Прочитай его **построчно** (`while read`) и для каждой пары выведи `хост код`, где код — HTTP-статус `https://хост путь`.',
      check: { type: 'all', checks: [{ type: 'outputContains', value: ['shop.kz 200', 'api.shop.kz 200', 'pay.shop.kz 503'] }, { type: 'custom', fn: (_s, l) => !!l && /while\s+(?:IFS=(?:"[^"]*"|'[^']*'|\S*)\s+)?read\b/.test(l.line) }] },
      hints: ['`while read -r host path; do …; done < ~/endpoints.txt`', 'Код: `$(curl -s -o /dev/null -w "%{http_code}" "https://$host$path")`'],
      solution: 'while read -r host path; do echo "$host $(curl -s -o /dev/null -w "%{http_code}" "https://$host$path")"; done < ~/endpoints.txt',
    },
  ],
  quiz: [
    { id: 'q-read', type: 'choice', prompt: 'Почему для строк с пробелами лучше `while read`, чем `for x in $(cat file)`?', options: ['while быстрее', 'for разобьёт строки по пробелам на отдельные слова', 'for не умеет читать файлы'], correct: 1, explanation: '`$(cat file)` без кавычек делится по пробелам и переводам строк.' },
    { id: 'q-until', type: 'text', prompt: 'Какое ключевое слово выполняет цикл, **пока команда завершается неудачно** (противоположность while)?', answer: { accept: ['until'] }, explanation: '`until systemctl is-active -q shop; do sleep 2; done`.' },
    { id: 'q-for', type: 'command', prompt: 'Выведи `== web-01`, `== web-02`, `== db-01` (каждое с новой строки) одним циклом for по списку.', scenario, solution: 'for h in web-01 web-02 db-01; do echo "== $h"; done', explanation: '`for h in web-01 web-02 db-01; do echo "== $h"; done`.' },
    { id: 'q-count', type: 'command', prompt: 'Посчитай циклом `while` с переменной `i` от 1 до 3 и выведи числа 1, 2, 3 по строкам.', scenario, solution: 'i=1; while [ $i -le 3 ]; do echo $i; i=$((i + 1)); done', explanation: 'Не забывай менять счётчик, иначе цикл бесконечный.' },
  ],
  glossary: [
    { ru: 'Цикл', en: 'loop', def: 'Повторение команд: for по списку, while/until по условию.' },
    { ru: 'Построчное чтение', en: 'while read', def: 'Чтение входа по строке в переменные.' },
  ],
};
export default lesson;
