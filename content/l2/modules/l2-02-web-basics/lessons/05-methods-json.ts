import type { LessonDef } from '../../../../../src/content/types';
import { JSON_H, baseHosts, json } from '../data';

const API = 'https://api.shopflow.kz';

const order1043 = {
  id: 1043,
  status: 'failed',
  total: 279.0,
  currency: 'EUR',
  customer: { email: 'lukas@cafe-mitte.de', country: 'DE' },
  payment: { provider: 'cardpay', error: 'card_declined' },
};

const orders = {
  items: [
    { id: 1040, status: 'paid', total: 45.0, payment: { provider: 'cardpay', error: null } },
    { id: 1041, status: 'paid', total: 18.5, payment: { provider: 'paybox', error: null } },
    { id: 1042, status: 'refunded', total: 89.0, payment: { provider: 'cardpay', error: null } },
    order1043,
    { id: 1044, status: 'paid', total: 34.9, payment: { provider: 'cardpay', error: null } },
    { id: 1045, status: 'failed', total: 12.5, payment: { provider: 'cardpay', error: 'provider_timeout' } },
    { id: 1046, status: 'failed', total: 99.0, payment: { provider: 'cardpay', error: 'provider_timeout' } },
    { id: 1047, status: 'paid', total: 59.0, payment: { provider: 'paybox', error: null } },
  ],
  next: null,
};
const FAILED = orders.items.filter((o) => o.status === 'failed').length;
const RETRY_STATUS = 'retry_scheduled';

const scenario = {
  network: {
    hosts: baseHosts,
    http: {
      [`${API}/v1/orders/1043`]: { status: 200, headers: JSON_H, body: json(order1043) },
      [`${API}/v1/orders`]: { status: 200, headers: JSON_H, body: json(orders) },
      [`POST ${API}/v1/orders/1043/retry`]: { status: 202, reason: 'Accepted', headers: JSON_H, body: json({ order_id: 1043, status: RETRY_STATUS, message: 'Payment retry scheduled' }) },
      [`${API}/v1/orders/1043/retry`]: { status: 405, reason: 'Method Not Allowed', headers: { ...JSON_H, Allow: 'POST' }, body: json({ error: 'method_not_allowed', message: 'Use POST' }) },
    },
  },
};

const lesson: LessonDef = {
  id: 'methods-json',
  title: 'Методы GET/POST, JSON и jq',
  minutes: 30,
  commands: ['curl', 'jq'],
  scenario,
  tasks: [
    {
      id: 'payment-error',
      prompt: `Клиент: «заказ 1043 не оплачен, повторите оплату!». Запроси \`${API}/v1/orders/1043\` и найди, какую **ошибку платежа** (\`payment.error\`) вернул провайдер.`,
      answer: { accept: ['card_declined', 'card declined', '"card_declined"', 'error: card_declined', 'карта отклонена', 'отклонена карта'], label: 'payment.error:' },
      hints: [`\`curl ${API}/v1/orders/1043\` — ответ в одну строку.`, `Читаемо: \`curl -s ${API}/v1/orders/1043 | jq .\` или сразу поле: \`… | jq .payment\`.`],
      solution: `curl -s ${API}/v1/orders/1043 | jq .payment`,
      explanation: '`card_declined` — банк покупателя отклонил карту. Это не ошибка ShopFlow: покупателю нужно связаться с банком или оплатить другой картой.',
      tags: ['curl', 'jq'],
    },
    {
      id: 'status-only',
      prompt: 'Выведи с помощью `jq` **только значение** поля `status` заказа 1043 — одно слово, без остального JSON.',
      check: { type: 'outputMatches', pattern: '^\\s*"?failed"?\\s*$', flags: '' },
      hints: ['Вывод curl передай в jq через `|`.', `\`curl -s ${API}/v1/orders/1043 | jq .status\` (с \`-r\` — без кавычек).`],
      solution: `curl -s ${API}/v1/orders/1043 | jq -r .status`,
      explanation: '`jq .status` печатает `"failed"`, `jq -r .status` — `failed` без кавычек (raw). Так поле удобно вставлять в тикет или скрипт.',
      tags: ['jq'],
    },
    {
      id: 'post-retry',
      prompt: `Клиент договорился с покупателем, и тот готов оплатить снова. Повтори оплату: отправь **POST**-запрос на \`${API}/v1/orders/1043/retry\` и введи значение \`status\` из ответа. (Если получишь 405 — значит, ушёл GET: посмотри на метод.)`,
      answer: { accept: [RETRY_STATUS, 'retry scheduled', `"${RETRY_STATUS}"`, `status: ${RETRY_STATUS}`], label: 'status:' },
      hints: ['Метод задаётся флагом `-X`.', `\`curl -X POST ${API}/v1/orders/1043/retry\``],
      solution: `curl -X POST ${API}/v1/orders/1043/retry`,
      explanation: `Сервер ответил **202 Accepted** и \`status: ${RETRY_STATUS}\` — повтор оплаты поставлен в очередь. GET на тот же адрес вернул бы **405 Method Not Allowed** с заголовком \`Allow: POST\`.`,
      tags: ['curl'],
    },
    {
      id: 'count-failed',
      prompt: `Оценим масштаб: запроси список заказов \`${API}/v1/orders\` и посчитай с помощью \`jq\`, **сколько** заказов в статусе \`failed\`. Введи число.`,
      answer: { accept: [String(FAILED)], normalize: 'number', label: 'Заказов failed:' },
      hints: [`Посмотри структуру: \`curl -s ${API}/v1/orders | jq .\` — заказы лежат в массиве \`items\`.`, `\`curl -s ${API}/v1/orders | jq '[.items[] | select(.status == "failed")] | length'\``],
      solution: `curl -s ${API}/v1/orders | jq '[.items[] | select(.status == "failed")] | length'`,
      explanation: `${FAILED} заказа в статусе failed: один — card_declined (проблема покупателя), два — provider_timeout у cardpay. Если таких таймаутов станет много — это повод для эскалации.`,
      tags: ['jq'],
    },
  ],
  quiz: [
    {
      id: 'q-405',
      type: 'text',
      prompt: 'Ты отправил GET на адрес, который принимает только POST. Какой код вернёт сервер? (число)',
      answer: { accept: [], normalize: 'keywords', keywords: [['405']] },
      explanation: '**405 Method Not Allowed**; допустимые методы — в заголовке `Allow`.',
    },
    {
      id: 'q-get',
      type: 'choice',
      prompt: 'Какой метод безопасно повторять сколько угодно раз — он только читает данные и ничего не меняет?',
      options: ['GET', 'POST', 'DELETE'],
      correct: 0,
      explanation: 'GET только читает. POST создаёт или запускает действие (повтор может создать дубль), DELETE удаляет.',
    },
    {
      id: 'q-raw',
      type: 'text',
      prompt: 'Какой флаг jq выводит строки **без кавычек**?',
      answer: { accept: ['-r', '--raw-output'] },
      explanation: '`jq -r` — raw output: `failed` вместо `"failed"`.',
    },
    {
      id: 'q-jq',
      type: 'command',
      prompt: 'Выведи email покупателя заказа 1043 (поле `customer.email`) из файла `/tmp/order.json`.',
      scenario: { files: { '/tmp/order.json': json(order1043) } },
      solution: 'jq -r .customer.email /tmp/order.json',
      check: { type: 'outputContains', value: order1043.customer.email },
      explanation: "Вложенное поле — через точку: `jq -r .customer.email /tmp/order.json` (или `cat файл | jq …`).",
    },
  ],
  glossary: [
    { ru: 'Метод запроса', en: 'HTTP method', def: 'Что хочет сделать запрос: GET читать, POST создать, PATCH/PUT изменить, DELETE удалить.' },
    { ru: 'Тело запроса', en: 'request body / payload', def: 'Данные, которые клиент отправляет серверу (часто JSON).' },
    { ru: 'Адрес API', en: 'endpoint', def: 'Конкретный URL API, например /v1/orders/1043.' },
    { ru: 'Формат данных JSON', en: 'JSON', def: 'Текстовый формат: объекты { }, массивы [ ], строки, числа, true/false, null.' },
    { ru: 'Фильтр JSON', en: 'jq', def: 'Утилита командной строки: форматирует JSON и достаёт поля.' },
  ],
};
export default lesson;
