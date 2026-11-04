import type { LessonDef } from '../../../../src/content/types';

const scenario = {
  files: {
    '/etc/hosts': '127.0.0.1 localhost\n10.0.1.15 srv-prod-01\n10.0.9.99 payments.internal.shop.kz   # temp fix by Dias, remove after migration\n',
  },
  network: {
    hosts: {
      'shop.kz': { ip: '10.0.2.5' },
      'api.shop.kz': { ip: '10.0.2.7', cname: 'lb-eu.shop.kz' },
      'lb-eu.shop.kz': { ip: '10.0.2.7' },
      'payments.internal.shop.kz': { ip: '10.0.3.40' },
      'cdn.shop.kz': { ip: '151.101.1.57', cname: 'shop.global.fastly.net' },
    },
  },
};

const lesson: LessonDef = {
  id: 'dns',
  title: 'DNS: dig, nslookup, NXDOMAIN, TTL',
  minutes: 25,
  commands: ['dig', 'nslookup', 'cat'],
  scenario,
  tasks: [
    {
      id: 'short',
      prompt: 'В какой IP резолвится `shop.kz`? Выведи **только адрес** одной командой.',
      check: { type: 'outputEquals', value: '10.0.2.5' },
      hints: ['У `dig` есть короткий режим.', '`dig +short shop.kz`'],
      solution: 'dig +short shop.kz',
      tags: ['dig'],
    },
    {
      id: 'nx',
      prompt: 'Клиент пишет, что не открывается `app.shop.kz`. Проверь DNS и введи **status** из ответа.',
      answer: { accept: ['NXDOMAIN', 'status: NXDOMAIN'], label: 'status:' },
      hints: ['`dig app.shop.kz`, строка HEADER.'],
      solution: 'dig app.shop.kz',
      explanation: 'NXDOMAIN — такой записи нет. Вероятно, её забыли создать (или клиент ошибся в адресе — уточни).',
      tags: ['dig'],
    },
    {
      id: 'cname',
      prompt: 'На какое **имя** (CNAME) указывает `api.shop.kz`? Введи имя.',
      answer: { accept: ['lb-eu.shop.kz', 'lb-eu.shop.kz.'], label: 'CNAME:' },
      hints: ['`dig api.shop.kz` — ANSWER SECTION.'],
      solution: 'dig api.shop.kz',
      tags: ['dig'],
    },
    {
      id: 'hosts',
      prompt: 'Сервер ходит к `payments.internal.shop.kz` не туда: DNS отвечает `10.0.3.40`, а соединения идут на другой адрес. Найди, что перебивает DNS, и введи **IP**, на который на самом деле ходит сервер.',
      answer: { accept: ['10.0.9.99'], label: 'IP:' },
      hints: ['Что проверяется раньше DNS?', '`cat /etc/hosts`'],
      solution: 'cat /etc/hosts',
      explanation: 'Забытая «временная» запись в `/etc/hosts` перебивает DNS. Удалять её — через change, с проверкой, что новый адрес работает.',
    },
  ],
  quiz: [
    { id: 'q-nx', type: 'text', prompt: 'Какой status вернёт DNS, если такого имени не существует?', answer: { accept: ['NXDOMAIN'] }, explanation: 'NXDOMAIN — non-existent domain.' },
    { id: 'q-ttl', type: 'choice', prompt: 'DNS-запись поменяли час назад, но у части клиентов открывается старый сервер. TTL записи был 86400. Почему?', options: ['DNS сломан', 'Старый ответ кеширован до истечения TTL (до суток)', 'У клиентов плохой интернет'], correct: 1, explanation: 'TTL 86400 с = 24 часа кеширования. Перед миграциями TTL снижают заранее.' },
    { id: 'q-file', type: 'text', prompt: 'В каком файле указано, к каким DNS-серверам обращается Linux? (полный путь)', answer: { accept: ['/etc/resolv.conf'] }, explanation: '`/etc/resolv.conf` (на Ubuntu часто указывает на локальный systemd-resolved 127.0.0.53).' },
    { id: 'q-dig', type: 'command', prompt: 'Выведи только IP для `cdn.shop.kz` (короткий вывод dig).', scenario, solution: 'dig +short cdn.shop.kz', check: { type: 'all', checks: [{ type: 'outputContains', value: '151.101.1.57' }, { type: 'commandUsed', name: 'dig' }, { type: 'outputNotContains', value: ['ANSWER SECTION', 'HEADER'] }] }, explanation: '`dig +short` покажет цепочку CNAME и итоговый адрес; оставить только IP — `dig +short cdn.shop.kz | tail -1`.' },
  ],
  glossary: [
    { ru: 'Несуществующий домен', en: 'NXDOMAIN', def: 'Ответ DNS: такого имени нет.' },
    { ru: 'Время жизни записи', en: 'TTL, time to live', def: 'Сколько секунд ответ DNS можно кешировать.' },
    { ru: 'Каноническое имя', en: 'CNAME', def: 'DNS-запись-псевдоним, указывающая на другое имя.' },
  ],
};
export default lesson;
