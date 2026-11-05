import type { LessonDef } from '../../../../../src/content/types';
import { HOME, IP, baseHosts, hostAccept } from '../data';

const KB = `# KB-204: Подключение своего домена к магазину

1. В панели вашего регистратора создайте запись CNAME:
   www.ваш-домен  →  shops.shopflow.kz
2. Подождите до 1 часа.
3. Проверка: dig +short www.ваш-домен — должно быть shops.shopflow.kz.

Внимание: адрес old-shops.shopflow.kz устарел и с 1 октября 2026 не обслуживает магазины.
`;

const scenario = {
  files: { [`${HOME}/kb/custom-domain.md`]: { content: KB, owner: 'alibek' } },
  network: {
    hosts: {
      ...baseHosts,
      'www.nomad-outdoor.kz': { ip: IP.shops, cname: 'shops.shopflow.kz' },
      'shop.astana-flowers.kz': { ip: IP.oldShops, cname: 'old-shops.shopflow.kz' },
    },
  },
};

const lesson: LessonDef = {
  id: 'dns',
  title: 'DNS: dig, nslookup, NXDOMAIN, CNAME',
  minutes: 20,
  commands: ['dig', 'nslookup', 'cat'],
  scenario,
  tasks: [
    {
      id: 'ip',
      prompt: 'Узнай, в какой **IP-адрес** превращается имя `api.shopflow.kz`. Выведи ответ DNS.',
      check: { type: 'outputContains', value: IP.api },
      hints: ['Для проверки DNS есть команда `dig`.', '`dig +short api.shopflow.kz` — только результат, без подробностей.'],
      solution: 'dig +short api.shopflow.kz',
      explanation: `\`${IP.api}\` — адрес нашего API. Подойдёт и \`dig api.shopflow.kz\` (смотри ANSWER SECTION), и \`nslookup api.shopflow.kz\`.`,
      tags: ['dig'],
    },
    {
      id: 'nx',
      prompt: 'Клиент пишет: «не открывается shopflw.kz». Проверь это имя через `dig` и введи **status** из ответа DNS.',
      answer: { accept: ['NXDOMAIN', 'status: NXDOMAIN', 'status NXDOMAIN', 'NX DOMAIN', 'non-existent domain', 'nonexistent domain'], label: 'status:' },
      hints: ['`dig shopflw.kz`', 'Смотри строку `->>HEADER<<-`, слово после `status:`.'],
      solution: 'dig shopflw.kz',
      explanation: '**NXDOMAIN** — такого имени нет. Клиент опечатался: `shopflw` вместо `shopflow`. Отвечаем с правильной ссылкой.',
      tags: ['dig'],
    },
    {
      id: 'cname',
      prompt: 'Магазин Nomad Outdoor подключил свой домен `www.nomad-outdoor.kz`. На какое **имя** указывает его запись CNAME?',
      answer: { accept: hostAccept('shops.shopflow.kz'), label: 'CNAME:' },
      hints: ['`dig www.nomad-outdoor.kz` — смотри ANSWER SECTION, строку с CNAME.', 'Или `dig +short www.nomad-outdoor.kz` — первая строка и есть CNAME.'],
      solution: 'dig www.nomad-outdoor.kz',
      explanation: '`www.nomad-outdoor.kz` → CNAME `shops.shopflow.kz` → A `' + IP.shops + '`. Так и должно быть по инструкции KB-204.',
      tags: ['dig'],
    },
    {
      id: 'wrong-cname',
      prompt: 'Тикет: «подключили `shop.astana-flowers.kz`, а магазин не открывается». Сравни настройку домена с инструкцией `~/kb/custom-domain.md`. На какое имя **сейчас** указывает CNAME этого домена?',
      answer: { accept: hostAccept('old-shops.shopflow.kz'), label: 'CNAME сейчас:' },
      hints: ['`cat ~/kb/custom-domain.md` — как должно быть.', '`dig shop.astana-flowers.kz` или `nslookup shop.astana-flowers.kz` — как есть.'],
      solution: 'cat ~/kb/custom-domain.md\ndig shop.astana-flowers.kz',
      explanation: 'CNAME указывает на устаревший `old-shops.shopflow.kz`, а должен — на `shops.shopflow.kz`. Исправляет клиент у своего регистратора; L2 пишет, что именно поменять.',
      tags: ['dig'],
    },
  ],
  quiz: [
    {
      id: 'q-nx',
      type: 'text',
      prompt: 'Какой status вернёт DNS, если такого имени не существует?',
      answer: { accept: ['NXDOMAIN', 'status: NXDOMAIN'] },
      explanation: '**NXDOMAIN** — non-existent domain.',
    },
    {
      id: 'q-record',
      type: 'text',
      prompt: 'Какой тип DNS-записи делает имя псевдонимом **другого имени** (например, `www.client.kz → shops.shopflow.kz`)?',
      answer: { accept: ['CNAME', 'CNAME-запись', 'запись CNAME', 'canonical name'] },
      explanation: '**CNAME** — псевдоним. Запись **A** — имя → IP-адрес.',
    },
    {
      id: 'q-ttl',
      type: 'choice',
      prompt: 'Клиент исправил CNAME 10 минут назад. У него сайт открывается, у коллеги — ещё нет. TTL старой записи — 3600. Что вероятнее всего?',
      options: ['DNS сломан, нужна эскалация в L3', 'У коллеги ещё закэширован старый ответ — он обновится в течение часа (TTL 3600 с)', 'У коллеги вирус'],
      correct: 1,
      explanation: 'Ответ DNS кэшируется на TTL секунд. 3600 с = 1 час.',
    },
    {
      id: 'q-dig',
      type: 'command',
      prompt: 'Выведи **только** IP-адрес `status.shopflow.kz` (короткий вывод dig).',
      scenario,
      solution: 'dig +short status.shopflow.kz',
      check: { type: 'all', checks: [{ type: 'outputContains', value: IP.status }, { type: 'outputNotContains', value: ['ANSWER SECTION', 'HEADER', 'Server:'] }] },
      explanation: '`dig +short имя` — только результат.',
    },
  ],
  glossary: [
    { ru: 'Система доменных имён', en: 'DNS', def: '«Телефонная книга» интернета: имя → IP-адрес.' },
    { ru: 'IP-адрес', en: 'IP address', def: 'Числовой адрес компьютера в сети, например 203.0.113.12.' },
    { ru: 'Запись A', en: 'A record', def: 'DNS-запись: имя → IPv4-адрес.' },
    { ru: 'Псевдоним', en: 'CNAME', def: 'DNS-запись: имя → другое имя.' },
    { ru: 'Домен не существует', en: 'NXDOMAIN', def: 'Ответ DNS: такого имени нет.' },
    { ru: 'Время жизни записи', en: 'TTL, time to live', def: 'Сколько секунд ответ DNS можно хранить в кэше.' },
  ],
};
export default lesson;
