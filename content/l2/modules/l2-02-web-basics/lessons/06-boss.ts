import type { LessonDef } from '../../../../../src/content/types';
import { HOME, IP, JSON_H, baseHosts, hostAccept, json } from '../data';

const API = 'https://api.shopflow.kz';
const REQ = 'req_e93b2a';

const components = [
  { name: 'Storefront', status: 'operational' },
  { name: 'Admin panel', status: 'operational' },
  { name: 'Checkout', status: 'degraded_performance' },
  { name: 'Payments (cardpay)', status: 'major_outage' },
  { name: 'Public API', status: 'operational' },
  { name: 'Webhooks', status: 'operational' },
];
const bad = components.filter((c) => c.status !== 'operational');
const good = components.filter((c) => c.status === 'operational');

const ticket = `Ticket: ZD-3500
Created: 2026-11-04 11:12 UTC
Customer: Nomad Outdoor (plan: Business)
Requester: aidar@nomad-outdoor.kz
Subject: Магазин не открывается, оплата не проходит
Status: New
Priority: P1
Assignee: L2
---
У части покупателей не открывается наш магазин nomad-outdoor.kz — «сайт недоступен».
Те, кто заходит через www.nomad-outdoor.kz, не могут оплатить: «Ошибка оплаты».
Вчера мы меняли настройки домена по старой инструкции, которая была у нас сохранена.
`;

const KB = `# KB-204: Подключение своего домена к магазину

1. В панели вашего регистратора создайте запись CNAME:
   ваш-домен  →  shops.shopflow.kz
2. Подождите до 1 часа.
3. Проверка: dig +short ваш-домен — должно быть shops.shopflow.kz.

Внимание: адрес old-shops.shopflow.kz устарел и с 1 октября 2026 не обслуживает магазины.
`;

const scenario = {
  files: {
    [`${HOME}/tickets/ZD-3500.txt`]: { content: ticket, owner: 'alibek' },
    [`${HOME}/kb/custom-domain.md`]: { content: KB, owner: 'alibek' },
  },
  network: {
    hosts: {
      ...baseHosts,
      'nomad-outdoor.kz': { ip: IP.oldShops, cname: 'old-shops.shopflow.kz' },
      'www.nomad-outdoor.kz': { ip: IP.shops, cname: 'shops.shopflow.kz' },
    },
    http: {
      'https://www.nomad-outdoor.kz/': { status: 200, body: '<html><body><h1>Nomad Outdoor</h1><p>Палатки, рюкзаки, снаряжение</p></body></html>\n' },
      'https://nomad-outdoor.kz/': { status: 0, error: 'refused' as const },
      [`POST ${API}/v1/checkout/sessions`]: {
        status: 502,
        headers: { ...JSON_H, 'X-Request-Id': REQ },
        body: json({ error: 'payment_provider_unavailable', provider: 'cardpay', message: 'Upstream payment provider did not respond' }),
      },
      [`${API}/v1/checkout/sessions`]: { status: 405, reason: 'Method Not Allowed', headers: { ...JSON_H, Allow: 'POST', 'X-Request-Id': 'req_e93a00' }, body: json({ error: 'method_not_allowed', message: 'Use POST' }) },
      'https://status.shopflow.kz/api/v2/components.json': { status: 200, headers: JSON_H, body: json({ page: 'ShopFlow Status', updated_at: '2026-11-04T11:15:00Z', components }) },
    },
  },
};

const lesson: LessonDef = {
  id: 'boss',
  kind: 'boss',
  title: 'Магазин не открывается, оплата падает',
  minutes: 35,
  incident: { ticket: 'ZD-3500: «Магазин nomad-outdoor.kz не открывается у части покупателей, а через www не проходит оплата»', severity: 'SEV2', customer: 'Nomad Outdoor (тариф Business)' },
  commands: ['cat', 'dig', 'nslookup', 'curl', 'jq'],
  scenario,
  tasks: [
    {
      id: 'dns',
      prompt: 'Начни с первой жалобы. Куда указывает CNAME домена `nomad-outdoor.kz`? Сравни с инструкцией `~/kb/custom-domain.md` и введи имя, на которое домен указывает **сейчас**.',
      answer: { accept: hostAccept('old-shops.shopflow.kz'), label: 'CNAME сейчас:' },
      hints: ['`cat ~/tickets/ZD-3500.txt` и `cat ~/kb/custom-domain.md` — что клиент делал и как должно быть.', '`dig nomad-outdoor.kz` (ANSWER SECTION) или `nslookup nomad-outdoor.kz`.'],
      solution: 'dig nomad-outdoor.kz',
      explanation: 'Домен указывает на устаревший `old-shops.shopflow.kz` (клиент взял старую инструкцию), а должен — на `shops.shopflow.kz`. Исправляет клиент у своего регистратора.',
      tags: ['dig'],
    },
    {
      id: 'www',
      prompt: 'Проверь, работает ли сама витрина: выведи **только HTTP-код** ответа `https://www.nomad-outdoor.kz/`.',
      check: { type: 'outputMatches', pattern: '^\\s*(HTTP/[\\d.]+\\s+)?200(\\s+OK)?\\s*$', flags: 'i' },
      hints: ['`-s -o /dev/null -w "%{http_code}\\n"`', '`curl -s -o /dev/null -w "%{http_code}\\n" https://www.nomad-outdoor.kz/`'],
      solution: 'curl -s -o /dev/null -w "%{http_code}\\n" https://www.nomad-outdoor.kz/',
      explanation: '200 — по правильному адресу (www → shops.shopflow.kz) витрина работает. Значит, первая жалоба — только DNS основного домена. Для сравнения: `curl -I https://nomad-outdoor.kz/` — соединение отклонено.',
      tags: ['curl'],
    },
    {
      id: 'checkout',
      prompt: `Теперь вторая жалоба. Повтори запрос витрины к API оплаты: **POST** на \`${API}/v1/checkout/sessions\`. Какой HTTP-код вернулся? Введи число.`,
      answer: { accept: [], normalize: 'keywords', keywords: [['502']], label: 'Код:' },
      hints: ['Метод — флагом `-X POST`; код удобно смотреть с `-i` (заголовки + тело).', `\`curl -i -X POST ${API}/v1/checkout/sessions\``],
      solution: `curl -i -X POST ${API}/v1/checkout/sessions`,
      explanation: '**502 Bad Gateway**, в теле `payment_provider_unavailable`, `provider: cardpay` — наш сервис не дождался ответа платёжного провайдера. Это проблема платформы, а не настроек клиента. (Если вышел 405 — ушёл GET вместо POST.)',
      tags: ['curl'],
    },
    {
      id: 'request-id',
      prompt: 'Какой **X-Request-Id** у ответа на этот POST-запрос? Приложим его к тикету и к инциденту.',
      answer: { accept: [REQ, `X-Request-Id: ${REQ}`, REQ.replace('req_', '')], label: 'X-Request-Id:', placeholder: 'req_...' },
      hints: ['Заголовки показывает `-i` (или `-v`).', `\`curl -i -X POST ${API}/v1/checkout/sessions\` — строка \`X-Request-Id:\`.`],
      solution: `curl -i -X POST ${API}/v1/checkout/sessions`,
      tags: ['curl'],
    },
    {
      id: 'status-page',
      prompt: 'Может, это уже известный инцидент? Запроси страницу статуса `https://status.shopflow.kz/api/v2/components.json` и с помощью `jq` выведи **названия** компонентов, у которых статус **не** `operational`.',
      check: {
        type: 'all',
        checks: [
          { type: 'outputContains', value: bad.map((c) => c.name) },
          { type: 'outputNotContains', value: good.map((c) => c.name) },
        ],
      },
      hints: ['Сначала посмотри структуру: `curl -s https://status.shopflow.kz/api/v2/components.json | jq .` — компоненты в массиве `components`.', "`select(.status != \"operational\")` оставит только проблемные.", "`curl -s https://status.shopflow.kz/api/v2/components.json | jq '.components[] | select(.status != \"operational\") | .name'`"],
      solution: `curl -s https://status.shopflow.kz/api/v2/components.json | jq '.components[] | select(.status != "operational") | .name'`,
      explanation: `${bad.map((c) => `**${c.name}** — ${c.status}`).join(', ')}. Сбой у провайдера cardpay уже объявлен — связываем тикет с инцидентом, клиенту даём ссылку на страницу статуса и время следующего обновления.`,
      tags: ['jq'],
    },
  ],
  quiz: [
    {
      id: 'q-who-dns',
      type: 'text',
      prompt: 'Кто должен исправить первую проблему (CNAME домена nomad-outdoor.kz указывает на old-shops.shopflow.kz)? Ответь одним-двумя словами.',
      answer: { accept: [], normalize: 'keywords', keywords: [['клиент', 'customer', 'client', 'регистратор', 'registrar', 'nomad', 'владел']] },
      explanation: 'DNS домена клиента настраивает **сам клиент** у своего регистратора. L2 точно пишет, что поменять: CNAME → shops.shopflow.kz.',
    },
    {
      id: 'q-cname-target',
      type: 'text',
      prompt: 'На какое имя должен указывать CNAME домена клиента по инструкции KB-204?',
      answer: { accept: hostAccept('shops.shopflow.kz') },
      explanation: '`shops.shopflow.kz` — актуальный адрес для своих доменов магазинов.',
    },
    {
      id: 'q-502',
      type: 'choice',
      prompt: 'API оплаты ответил 502 с телом `payment_provider_unavailable`. Что из этого верно?',
      options: ['Клиент неправильно настроил оплату — пусть проверит настройки', 'Наш сервис не получил ответ от вышестоящего (платёжного провайдера) — проблема на стороне платформы', 'Покупатель ввёл неверные данные карты'],
      correct: 1,
      explanation: '502 Bad Gateway — «шлюз» (наш сервис) не получил нормальный ответ от того, к кому обращался. Ошибка 5xx — смотрим на себя.',
    },
    {
      id: 'q-www',
      type: 'command',
      prompt: 'Выведи только результат DNS (без подробностей) для `www.nomad-outdoor.kz`.',
      scenario,
      solution: 'dig +short www.nomad-outdoor.kz',
      check: { type: 'all', checks: [{ type: 'outputContains', value: 'shops.shopflow.kz' }, { type: 'outputNotContains', value: ['ANSWER SECTION', 'HEADER'] }] },
      explanation: '`dig +short` покажет цепочку: CNAME `shops.shopflow.kz.` и IP.',
    },
  ],
  glossary: [
    { ru: 'Страница статуса', en: 'status page', def: 'Публичная страница с состоянием компонентов платформы и текущими инцидентами.' },
    { ru: 'Крупный сбой', en: 'major outage', def: 'Компонент не работает.' },
    { ru: 'Работает с перебоями', en: 'degraded performance', def: 'Компонент работает, но медленно или с ошибками.' },
    { ru: 'Регистратор домена', en: 'domain registrar', def: 'Компания, где клиент купил домен и настраивает его DNS-записи.' },
  ],
};
export default lesson;
