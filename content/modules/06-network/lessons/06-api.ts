import type { LessonDef } from '../../../../src/content/types';

const orders = {
  items: [
    { id: 1042, status: 'paid', total: 89.0, customer: { email: 'aigerim.s@mail.kz', country: 'KZ' } },
    { id: 1043, status: 'failed', total: 279.0, customer: { email: 'lukas@company.de', country: 'DE' }, error: 'card_declined' },
    { id: 1044, status: 'paid', total: 34.9, customer: { email: 'anna@gmail.com', country: 'PL' } },
    { id: 1045, status: 'failed', total: 12.5, customer: { email: 'timur@mail.kz', country: 'KZ' }, error: 'provider_timeout' },
    { id: 1046, status: 'failed', total: 99.0, customer: { email: 'omar@outlook.com', country: 'AE' }, error: 'provider_timeout' },
    { id: 1047, status: 'refunded', total: 59.0, customer: { email: 'ewa@company.de', country: 'PL' } },
  ],
  next: null,
};

const scenario = {
  env: { TOKEN: 'sk_test_51Hx7Lq2' },
  network: {
    hosts: { 'api.shop.kz': { ip: '10.0.2.7' } },
    http: {
      'https://api.shop.kz/v1/orders': { status: 200, auth: 'Bearer sk_test_51Hx7Lq2', headers: { 'Content-Type': 'application/json', 'X-RateLimit-Remaining': '57' }, body: JSON.stringify(orders) + '\n' },
      'https://api.shop.kz/v1/webhooks': { status: 200, auth: 'Bearer sk_test_51Hx7Lq2', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ webhooks: [{ id: 'wh_1', url: 'https://erp.client.kz/hooks/orders', events: ['order.paid'], active: false, last_error: '410 Gone' }] }) + '\n' },
    },
  },
};

const lesson: LessonDef = {
  id: 'api',
  title: 'REST API, токены и jq',
  minutes: 35,
  commands: ['curl', 'jq'],
  scenario,
  tasks: [
    {
      id: 'no-token',
      prompt: 'Запроси `https://api.shop.kz/v1/orders` **без токена** и выведи только HTTP-код.',
      check: { type: 'all', checks: [{ type: 'outputMatches', pattern: '^401\\s*$' }] },
      hints: ['`curl -s -o /dev/null -w "%{http_code}" URL`'],
      solution: 'curl -s -o /dev/null -w "%{http_code}" https://api.shop.kz/v1/orders',
      explanation: '401 — нет аутентификации. Токен в тренажёре лежит в переменной окружения `$TOKEN`.',
      tags: ['curl'],
    },
    {
      id: 'with-token',
      prompt: 'Теперь с токеном из переменной `$TOKEN` (заголовок `Authorization: Bearer ...`): получи заказы и выведи **количество** элементов `items` через jq.',
      check: { type: 'all', checks: [{ type: 'outputEquals', value: '6' }, { type: 'commandUsed', name: 'jq' }] },
      hints: ['`curl -s -H "Authorization: Bearer $TOKEN" URL | jq ...`', "`jq '.items | length'`"],
      solution: `curl -s -H "Authorization: Bearer $TOKEN" https://api.shop.kz/v1/orders | jq '.items | length'`,
      tags: ['curl', 'jq'],
    },
    {
      id: 'failed',
      prompt: 'Выведи **id** заказов в статусе `failed` с причиной `provider_timeout` — по одному id в строке.',
      check: { type: 'all', checks: [{ type: 'outputEquals', value: '1045\n1046' }, { type: 'commandUsed', name: 'jq' }] },
      hints: ["`.items[] | select(.status == \"failed\" and .error == \"provider_timeout\") | .id`"],
      solution: `curl -s -H "Authorization: Bearer $TOKEN" https://api.shop.kz/v1/orders | jq '.items[] | select(.status == "failed" and .error == "provider_timeout") | .id'`,
      tags: ['jq'],
    },
    {
      id: 'webhook',
      prompt: 'Клиент: «перестали приходить вебхуки в нашу ERP». Посмотри `/v1/webhooks` (с токеном) и введи `last_error` вебхука.',
      answer: { accept: ['410 Gone', '410', 'Gone', 'HTTP 410', 'HTTP 410 Gone'], label: 'last_error:' },
      hints: ["`curl -s -H \"Authorization: Bearer $TOKEN\" https://api.shop.kz/v1/webhooks | jq '.webhooks[0]'`"],
      solution: `curl -s -H "Authorization: Bearer $TOKEN" https://api.shop.kz/v1/webhooks | jq '.webhooks[0]'`,
      explanation: 'URL клиента отвечает **410 Gone** — эндпоинт на их стороне удалён, поэтому мы отключили вебхук (`active: false`). Решение — клиент обновляет URL и включает вебхук; наша проблема только в том, чтобы понятно это объяснить.',
      tags: ['jq'],
    },
  ],
  quiz: [
    { id: 'q-bearer', type: 'text', prompt: 'Как выглядит заголовок с OAuth-токеном? Допиши: `Authorization: ____ <token>` (одно слово)', answer: { accept: ['Bearer'] }, explanation: '`Authorization: Bearer <token>`.' },
    { id: 'q-r', type: 'text', prompt: 'Какой флаг jq выводит строки без кавычек?', answer: { accept: ['-r', '--raw-output'] }, explanation: '`jq -r` — raw output.' },
    { id: 'q-jq', type: 'command', prompt: 'Выведи email клиентов всех заказов из файла `/tmp/orders.json` по одному в строке, без кавычек.', scenario: { files: { '/tmp/orders.json': JSON.stringify(orders) } }, solution: "jq -r '.items[].customer.email' /tmp/orders.json", explanation: "`jq -r '.items[].customer.email' файл`." },
    { id: 'q-422', type: 'choice', prompt: 'POST /v1/refunds вернул 422 с телом `{"error":"amount exceeds captured amount"}`. Что это?', options: ['Сервер упал', 'Запрос корректен по форме, но не прошёл бизнес-валидацию — сумма возврата больше списанной', 'Нужно повторить запрос'], correct: 1, explanation: '422 Unprocessable Entity — данные понятны, но недопустимы. Тело ответа объясняет причину.' },
  ],
  glossary: [
    { ru: 'Токен доступа', en: 'access token / bearer token', def: 'Секрет, подтверждающий право клиента на вызов API.' },
    { ru: 'Ограничение частоты', en: 'rate limit', def: 'Лимит запросов за период; превышение → 429.' },
    { ru: 'Вебхук', en: 'webhook', def: 'HTTP-запрос от нашей системы клиенту при событии.' },
  ],
};
export default lesson;
