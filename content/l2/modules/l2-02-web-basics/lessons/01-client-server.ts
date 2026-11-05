import type { LessonDef } from '../../../../../src/content/types';
import { HOME, IP, JSON_H, baseHosts, json } from '../data';

const ping = { pong: true, region: 'eu-central', version: '4.12.1' };
const URL_HOST = 'nomad-outdoor.shopflow.kz';
const URL_PORT = 8443;
const URL_PATH = '/admin/orders';
const CLIENT_URL = `https://${URL_HOST}:${URL_PORT}${URL_PATH}?status=failed&page=2`;

const ticket = `Ticket: ZD-3101
Created: 2026-11-04 10:02 UTC
Customer: Nomad Outdoor (plan: Business)
Subject: Не грузится список неудачных заказов
Status: Open
Assignee: L2
---
Открываю ссылку из закладок — страница крутится и не открывается:
${CLIENT_URL}
Вчера работало.
`;

const scenario = {
  files: { [`${HOME}/tickets/ZD-3101.txt`]: { content: ticket, owner: 'alibek' } },
  network: {
    hosts: { ...baseHosts, [URL_HOST]: { ip: IP.shops } },
    http: {
      'https://api.shopflow.kz/v1/ping': { status: 200, headers: JSON_H, body: json(ping) },
      'https://status.shopflow.kz/': { status: 200, body: '<html><body><h1>ShopFlow Status</h1><p>All systems operational</p></body></html>\n' },
      [`https://${URL_HOST}/admin/orders`]: { status: 200, body: '<html><body>Orders</body></html>\n' },
      [`https://${URL_HOST}:${URL_PORT}/admin/orders`]: { status: 0, error: 'timeout' as const, timeMs: 10000 },
    },
  },
};

const lesson: LessonDef = {
  id: 'client-server',
  title: 'Клиент, сервер и URL',
  minutes: 20,
  commands: ['curl', 'cat'],
  scenario,
  tasks: [
    {
      id: 'ping',
      prompt: 'Отправь свой первый HTTP-запрос: запроси `https://api.shopflow.kz/v1/ping` и посмотри, что ответил сервер.',
      check: { type: 'outputMatches', pattern: '"pong"\\s*:\\s*true' },
      hints: ['Команда — `curl` и адрес после неё.', '`curl https://api.shopflow.kz/v1/ping`'],
      solution: 'curl https://api.shopflow.kz/v1/ping',
      explanation: 'curl отправил запрос (request), сервер вернул ответ (response) — JSON с полями `pong`, `region`, `version`. Так выглядит ответ API: данные для программ, а не страница для человека.',
      tags: ['curl'],
    },
    {
      id: 'version',
      prompt: 'Какую **версию** (`version`) сообщил сервер в ответе на `/v1/ping`? Версия пригодится в эскалации: «на 4.x.y воспроизводится».',
      answer: { accept: [ping.version, `v${ping.version}`, `version ${ping.version}`, `"version":"${ping.version}"`, `version: ${ping.version}`], label: 'Версия:' },
      hints: ['Смотри ответ из предыдущего задания или запроси ещё раз: `curl https://api.shopflow.kz/v1/ping`.'],
      solution: 'curl https://api.shopflow.kz/v1/ping',
      tags: ['curl'],
    },
    {
      id: 'host',
      prompt: 'Клиент прислал ссылку в тикете `~/tickets/ZD-3101.txt`. Открой тикет. Какой **домен (host)** в этой ссылке?',
      answer: { accept: [URL_HOST, `${URL_HOST}:${URL_PORT}`, `https://${URL_HOST}`, `${URL_HOST}.`], label: 'Домен:' },
      hints: ['`cat ~/tickets/ZD-3101.txt`', 'Домен — между `https://` и двоеточием с портом (или первым `/`).'],
      solution: 'cat ~/tickets/ZD-3101.txt',
      explanation: `Домен \`${URL_HOST}\` — по нему видно магазин клиента (nomad-outdoor) на платформе ShopFlow.`,
    },
    {
      id: 'port',
      prompt: 'Какой **порт** указан в ссылке клиента? Введи число.',
      answer: { accept: [String(URL_PORT)], normalize: 'number', label: 'Порт:' },
      hints: ['Порт — число после двоеточия за доменом.'],
      solution: 'cat ~/tickets/ZD-3101.txt',
      explanation: `Порт ${URL_PORT} — нестандартный. Для https по умолчанию 443, и наша админка работает именно там. Попробуй сам: \`curl -I https://${URL_HOST}${URL_PATH}\` отвечает, а с \`:${URL_PORT}\` — таймаут. Скорее всего, у клиента старая закладка: просим открыть ссылку без порта.`,
    },
    {
      id: 'path',
      prompt: 'Какой **путь (path)** в ссылке клиента? Введи его без параметров (всё, что до `?`).',
      answer: { accept: [URL_PATH, `${URL_PATH}/`, URL_PATH.slice(1), `${URL_PATH.slice(1)}/`], label: 'Путь:', placeholder: '/...' },
      hints: ['Путь начинается с `/` после домена и порта.', 'Параметры (`?status=...`) в путь не входят.'],
      solution: 'cat ~/tickets/ZD-3101.txt',
      explanation: `Путь \`${URL_PATH}\` — страница заказов в админке, а параметры \`status=failed&page=2\` — фильтр «неудачные» и вторая страница списка. Это готовые шаги воспроизведения.`,
    },
  ],
  quiz: [
    {
      id: 'q-port',
      type: 'text',
      prompt: 'Какой порт используется по умолчанию для `https://`, если в адресе порт не указан? (число)',
      answer: { accept: ['443'], normalize: 'number' },
      explanation: 'https — **443**, http — **80**.',
    },
    {
      id: 'q-query',
      type: 'text',
      prompt: 'В адресе `https://shopflow.kz/pricing?lang=de&currency=EUR` какое значение у параметра `currency`?',
      answer: { accept: ['EUR', 'currency=EUR'] },
      explanation: 'Параметры идут после `?` парами `имя=значение` через `&`: `lang=de`, `currency=EUR`.',
    },
    {
      id: 'q-dns',
      type: 'choice',
      prompt: 'Что первым делом делает браузер, когда ты вводишь `https://shopflow.kz`?',
      options: ['Отправляет HTTP-запрос GET /', 'Спрашивает у DNS, какой IP-адрес у имени shopflow.kz', 'Скачивает картинки и стили'],
      correct: 1,
      explanation: 'Сначала DNS: имя → IP. Только потом соединение и HTTP-запрос.',
    },
    {
      id: 'q-curl',
      type: 'command',
      prompt: 'Запроси страницу статуса `https://status.shopflow.kz/` и выведи её ответ.',
      scenario,
      solution: 'curl https://status.shopflow.kz/',
      explanation: '`curl URL` печатает тело ответа сервера.',
    },
  ],
  glossary: [
    { ru: 'Клиент', en: 'client', def: 'Тот, кто отправляет запрос: браузер, приложение, curl.' },
    { ru: 'Сервер', en: 'server', def: 'Тот, кто принимает запрос и возвращает ответ.' },
    { ru: 'Запрос / ответ', en: 'request / response', def: 'Сообщение клиента серверу и ответ сервера.' },
    { ru: 'Адрес ресурса', en: 'URL', def: 'Протокол + домен + порт + путь + параметры.' },
    { ru: 'Параметры запроса', en: 'query parameters', def: 'Пары имя=значение после «?» в URL.' },
    { ru: 'Программный интерфейс', en: 'API', def: '«Вход для программ»: запросы и ответы в JSON вместо страниц.' },
  ],
};
export default lesson;
