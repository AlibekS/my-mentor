import type { LessonDef } from '../../../../../src/content/types';
import { JSON_H, baseHosts, json } from '../data';

const API = 'https://api.shopflow.kz';
const REQ = 'req_5d1e07';

const scenario = {
  network: {
    hosts: baseHosts,
    http: {
      [`${API}/v1/orders/99999`]: { status: 404, headers: JSON_H, body: json({ error: 'order_not_found', message: 'Order 99999 does not exist' }) },
      [`${API}/v1/orders/1043`]: { status: 200, headers: JSON_H, body: json({ id: 1043, status: 'failed', total: 279.0, currency: 'EUR' }) },
      [`${API}/v1/reports/export`]: { status: 500, headers: { ...JSON_H, 'X-Request-Id': REQ }, body: json({ error: 'internal_error', message: 'Something went wrong', request_id: REQ }) },
      [`${API}/v1/products`]: { status: 200, headers: JSON_H, body: json({ items: [{ id: 1, name: 'Tent Nomad 2' }], next: null }) },
      'https://shopflow.kz/pricing-old': { status: 301, headers: { Location: 'https://shopflow.kz/pricing' }, body: '' },
      'https://shopflow.kz/pricing': { status: 200, body: '<html><body><h1>Pricing</h1></body></html>\n' },
      'https://shopflow.kz/': { status: 200, body: '<html><body><h1>ShopFlow</h1></body></html>\n' },
    },
  },
};

const lesson: LessonDef = {
  id: 'http-status',
  title: 'HTTP-коды и curl',
  minutes: 25,
  commands: ['curl'],
  scenario,
  tasks: [
    {
      id: 'code-only',
      prompt: `Интеграция клиента запрашивает \`${API}/v1/orders/99999\`. Выведи **только HTTP-код** ответа (одно число, без тела и заголовков).`,
      check: { type: 'outputMatches', pattern: '^\\s*(HTTP/[\\d.]+\\s+)?404(\\s+Not Found)?\\s*$', flags: 'i' },
      hints: ['Нужны три флага: `-s` (тихо), `-o /dev/null` (тело — в «чёрную дыру»), `-w "%{http_code}"` (напечатать код).', `\`curl -s -o /dev/null -w "%{http_code}\\n" ${API}/v1/orders/99999\``],
      solution: `curl -s -o /dev/null -w "%{http_code}\\n" ${API}/v1/orders/99999`,
      explanation: '**404 Not Found** — такого заказа нет. API работает, ошибка в запросе клиента: проверяем, откуда его система берёт номер 99999.',
      tags: ['curl'],
    },
    {
      id: 'which-5xx',
      prompt: `Клиент жалуется: «API сломался». Проверь коды трёх адресов:\n\n- \`${API}/v1/orders/1043\`\n- \`${API}/v1/reports/export\`\n- \`${API}/v1/products\`\n\nКакой из них отвечает **ошибкой сервера (5xx)**? Введи путь (например, \`/v1/...\`).`,
      answer: {
        accept: ['/v1/reports/export', 'v1/reports/export', '/reports/export', 'reports/export', `${API}/v1/reports/export`, 'api.shopflow.kz/v1/reports/export', 'export', 'reports', 'отчёт', 'отчет', 'выгрузка отчётов', 'выгрузка отчетов'],
        label: 'Путь:',
        placeholder: '/v1/...',
      },
      hints: ['Проверь каждый адрес по очереди командой из прошлого задания.', `\`curl -s -o /dev/null -w "%{http_code}\\n" ${API}/v1/reports/export\``],
      solution: `curl -s -o /dev/null -w "%{http_code}\\n" ${API}/v1/orders/1043\ncurl -s -o /dev/null -w "%{http_code}\\n" ${API}/v1/reports/export\ncurl -s -o /dev/null -w "%{http_code}\\n" ${API}/v1/products\n# 500 — у /v1/reports/export`,
      explanation: '`/v1/orders/1043` и `/v1/products` — 200, `/v1/reports/export` — **500**. «API сломался» на деле означает «сломана выгрузка отчётов» — это уже точная формулировка для тикета.',
      tags: ['curl'],
    },
    {
      id: 'request-id',
      prompt: `Посмотри **тело** ответа с ошибкой \`${API}/v1/reports/export\`. Какой \`request_id\` вернул сервер? Его L2 приложит к эскалации в L3.`,
      answer: { accept: [REQ, `request_id: ${REQ}`, `"request_id":"${REQ}"`, `request_id=${REQ}`, REQ.replace('req_', '')], label: 'request_id:', placeholder: 'req_...' },
      hints: ['Просто `curl` (без `-o /dev/null`) печатает тело.', `\`curl -i ${API}/v1/reports/export\` — заголовки и тело вместе.`],
      solution: `curl -i ${API}/v1/reports/export`,
      explanation: `\`${REQ}\` — по нему L3 найдёт в логах точную ошибку. Он же есть в заголовке \`X-Request-Id\` (о заголовках — следующий урок).`,
      tags: ['curl'],
    },
    {
      id: 'redirect',
      prompt: 'Клиент открывает старую ссылку `https://shopflow.kz/pricing-old`. Какой **код** возвращает сервер? Введи число.',
      answer: { accept: [], normalize: 'keywords', keywords: [['301']], label: 'Код:' },
      hints: ['`curl -I URL` — только заголовки, код в первой строке.', '`curl -I https://shopflow.kz/pricing-old`'],
      solution: 'curl -I https://shopflow.kz/pricing-old',
      explanation: '**301 Moved Permanently** — это не ошибка, а перенаправление: страница переехала. Браузер сам перейдёт по новому адресу из заголовка `Location`.',
      tags: ['curl'],
    },
  ],
  quiz: [
    {
      id: 'q-class',
      type: 'choice',
      prompt: 'Коды какого класса означают ошибку **на стороне сервера** (наша проблема)?',
      options: ['3xx', '4xx', '5xx'],
      correct: 2,
      explanation: '5xx — ошибка сервера. 4xx — ошибка в запросе клиента. 3xx — перенаправление.',
    },
    {
      id: 'q-401',
      type: 'text',
      prompt: 'Интеграция клиента отправила запрос **без токена** (не представилась). Какой код вернёт API? (число)',
      answer: { accept: [], normalize: 'keywords', keywords: [['401']] },
      explanation: '**401 Unauthorized** — «кто ты?». **403 Forbidden** — «знаю, кто ты, но нельзя».',
    },
    {
      id: 'q-429',
      type: 'text',
      prompt: 'Какой код означает, что клиент превысил лимит запросов (rate limit)? (число)',
      answer: { accept: [], normalize: 'keywords', keywords: [['429']] },
      explanation: '**429 Too Many Requests**. Обычно с заголовком `Retry-After` — через сколько секунд повторить.',
    },
    {
      id: 'q-code',
      type: 'command',
      prompt: 'Выведи только HTTP-код ответа `https://shopflow.kz/pricing`.',
      scenario,
      solution: 'curl -s -o /dev/null -w "%{http_code}\\n" https://shopflow.kz/pricing',
      check: { type: 'outputMatches', pattern: '^\\s*(HTTP/[\\d.]+\\s+)?200(\\s+OK)?\\s*$', flags: 'i' },
      explanation: '`curl -s -o /dev/null -w "%{http_code}\\n" URL` → `200`.',
    },
  ],
  glossary: [
    { ru: 'Код состояния', en: 'HTTP status code', def: 'Трёхзначный код результата: 2xx успех, 3xx перенаправление, 4xx ошибка запроса, 5xx ошибка сервера.' },
    { ru: 'Тело ответа', en: 'response body', def: 'Содержимое ответа: HTML-страница или JSON с данными/ошибкой.' },
    { ru: 'Ошибка сервера', en: 'server error (5xx)', def: 'Сервер не смог обработать корректный запрос.' },
    { ru: 'Ошибка клиента', en: 'client error (4xx)', def: 'Запрос неверный: адрес, данные, авторизация, лимит.' },
    { ru: 'Перенаправление', en: 'redirect (3xx)', def: 'Сервер говорит: ресурс по другому адресу (заголовок Location).' },
  ],
};
export default lesson;
