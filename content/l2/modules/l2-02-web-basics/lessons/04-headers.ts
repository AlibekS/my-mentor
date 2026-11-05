import type { LessonDef } from '../../../../../src/content/types';
import { JSON_H, baseHosts, json, urlAccept } from '../data';

const API = 'https://api.shopflow.kz';
const REQ = 'req_c40b19';
const RETRY = 60;
const MAX_AGE = 86400;
const MAX_AGE_H = MAX_AGE / 3600;

const scenario = {
  network: {
    hosts: baseHosts,
    http: {
      [`${API}/v1/products`]: {
        status: 429,
        headers: { ...JSON_H, 'Retry-After': String(RETRY), 'X-RateLimit-Limit': '100', 'X-RateLimit-Remaining': '0', 'X-Request-Id': REQ },
        body: json({ error: 'rate_limit_exceeded', message: 'Limit 100 requests per minute' }),
      },
      'https://shopflow.kz/pricing-old': { status: 301, headers: { Location: 'https://shopflow.kz/pricing', 'X-Request-Id': 'req_c40b77' }, body: '' },
      'https://shopflow.kz/pricing': { status: 200, headers: { 'X-Request-Id': 'req_c40b78' }, body: '<html><body><h1>Pricing</h1></body></html>\n' },
      'https://cdn.shopflow.kz/assets/app.js': {
        status: 200,
        headers: { 'Content-Type': 'application/javascript', 'Cache-Control': `public, max-age=${MAX_AGE}`, 'X-Request-Id': 'req_c40c02' },
        body: 'console.log("ShopFlow admin 4.12.1");\n',
      },
    },
  },
};

const lesson: LessonDef = {
  id: 'headers',
  title: 'Заголовки: Location, Retry-After, Cache-Control, X-Request-Id',
  minutes: 25,
  commands: ['curl'],
  scenario,
  tasks: [
    {
      id: 'head',
      prompt: `Склад клиента получает ошибки от \`${API}/v1/products\`. Выведи **только заголовки** ответа (без тела).`,
      check: {
        type: 'all',
        checks: [
          { type: 'outputContains', value: ['429', 'Retry-After'] },
          { type: 'outputNotContains', value: 'rate_limit_exceeded' },
        ],
      },
      hints: ['У curl есть флаг «только заголовки» — запрос HEAD.', `\`curl -I ${API}/v1/products\``],
      solution: `curl -I ${API}/v1/products`,
      explanation: 'Код **429 Too Many Requests** — превышен лимит. Заголовки рассказывают подробности: лимит, остаток, когда повторить и номер запроса.',
      tags: ['curl'],
    },
    {
      id: 'retry',
      prompt: 'Через сколько **секунд** сервер разрешает повторить запрос (заголовок `Retry-After`)? Введи число.',
      answer: { accept: [String(RETRY)], normalize: 'number', label: 'Секунд:' },
      hints: [`\`curl -I ${API}/v1/products\` — строка \`Retry-After:\`.`],
      solution: `curl -I ${API}/v1/products`,
      explanation: `Retry-After: ${RETRY} — повторить через ${RETRY} секунд. В ответе клиенту: «ваша интеграция превышает лимит 100 запросов в минуту, повторяйте через Retry-After».`,
      tags: ['curl'],
    },
    {
      id: 'request-id',
      prompt: 'Какой **X-Request-Id** у этого ответа? Запиши его — это доказательство для тикета.',
      answer: { accept: [REQ, `X-Request-Id: ${REQ}`, REQ.replace('req_', '')], label: 'X-Request-Id:', placeholder: 'req_...' },
      hints: [`\`curl -I ${API}/v1/products\` — строка \`X-Request-Id:\`.`],
      solution: `curl -I ${API}/v1/products`,
      tags: ['curl'],
    },
    {
      id: 'location',
      prompt: 'Куда перенаправляет старая ссылка `https://shopflow.kz/pricing-old`? Введи адрес из заголовка `Location`.',
      answer: { accept: urlAccept('https://shopflow.kz/pricing'), label: 'Location:' },
      hints: ['`curl -I https://shopflow.kz/pricing-old`', 'Ищи строку `Location:`.'],
      solution: 'curl -I https://shopflow.kz/pricing-old',
      explanation: 'Код 301 + `Location: https://shopflow.kz/pricing`. Чтобы curl сам прошёл по перенаправлению — `curl -L`.',
      tags: ['curl'],
    },
    {
      id: 'cache',
      prompt: 'После релиза клиенты видят старую версию админки. Посмотри заголовки `https://cdn.shopflow.kz/assets/app.js`. Сколько **часов** браузер может хранить этот файл в кэше (`Cache-Control: max-age` — в секундах)?',
      answer: {
        accept: [String(MAX_AGE_H), `${MAX_AGE_H} часа`, `${MAX_AGE_H} часов`, `${MAX_AGE_H} ч`, `${MAX_AGE_H}ч`, `${MAX_AGE_H}h`, `${MAX_AGE_H} hours`, 'сутки', '1 сутки', 'одни сутки', '1 день', 'день', '24:00'],
        label: 'Часов:',
      },
      hints: ['`curl -I https://cdn.shopflow.kz/assets/app.js` — строка `Cache-Control`.', 'В часе 3600 секунд: раздели max-age на 3600.'],
      solution: `curl -I https://cdn.shopflow.kz/assets/app.js\n# ${MAX_AGE} / 3600 = ${MAX_AGE_H} часа`,
      explanation: `max-age=${MAX_AGE} секунд = **${MAX_AGE_H} часа**. Пока кэш не истёк, браузер берёт старый файл. Клиенту советуем обновить страницу с очисткой кэша (Ctrl+F5).`,
      tags: ['curl'],
    },
  ],
  quiz: [
    {
      id: 'q-location',
      type: 'text',
      prompt: 'Какой заголовок ответа содержит новый адрес при перенаправлении (301/302)?',
      answer: { accept: ['Location', 'Location:'] },
      explanation: '**Location** — «иди сюда». `curl -L` переходит по нему автоматически.',
    },
    {
      id: 'q-flag',
      type: 'text',
      prompt: 'Какой флаг curl показывает **весь разговор** с сервером: что отправили (`>`) и что получили (`<`)?',
      answer: { accept: ['-v', '--verbose'] },
      explanation: '`curl -v` — verbose. `-I` — только заголовки ответа, `-i` — заголовки и тело.',
    },
    {
      id: 'q-content-type',
      type: 'choice',
      prompt: 'API должно вернуть JSON, а вернуло `Content-Type: text/html` и HTML-страницу «502 Bad Gateway». Что это значит?',
      options: ['Клиент неправильно настроил интеграцию', 'Ответил не наше приложение, а прокси перед ним: приложение недоступно — проблема на нашей стороне', 'Так и должно быть'],
      correct: 1,
      explanation: 'HTML вместо JSON + 502 — ответ прокси/балансировщика: до приложения запрос не дошёл. Эскалируем с временем и request id.',
    },
    {
      id: 'q-head',
      type: 'command',
      prompt: 'Выведи только заголовки ответа `https://shopflow.kz/pricing`.',
      scenario,
      solution: 'curl -I https://shopflow.kz/pricing',
      check: { type: 'all', checks: [{ type: 'outputContains', value: ['200', 'X-Request-Id'] }, { type: 'outputNotContains', value: '<html>' }] },
      explanation: '`curl -I URL` — запрос HEAD, только заголовки.',
    },
  ],
  glossary: [
    { ru: 'Заголовок', en: 'header', def: 'Служебная строка «Имя: значение» в запросе или ответе.' },
    { ru: 'Ограничение частоты', en: 'rate limit', def: 'Лимит запросов за период; превышение → 429.' },
    { ru: 'Кэш', en: 'cache', def: 'Сохранённая копия ответа, чтобы не скачивать снова.' },
    { ru: 'Сеть доставки контента', en: 'CDN', def: 'Серверы-кэши по всему миру, которые отдают статические файлы.' },
    { ru: 'Подробный режим', en: 'verbose (-v)', def: 'curl показывает весь обмен: запрос (>) и ответ (<).' },
  ],
};
export default lesson;
