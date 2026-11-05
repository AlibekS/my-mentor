import type { LessonDef } from '../../../../../src/content/types';
import { dataset, facts } from '../data';

const lesson: LessonDef = {
  id: 'order-limit',
  title: 'ORDER BY и LIMIT: свежие сверху',
  minutes: 20,
  scenario: {},
  sql: { dataset },
  tasks: [
    {
      id: 'latest-orders',
      prompt: 'Что происходит в магазине прямо сейчас? Выведи **5 последних заказов**: `id, customer_id, status, created_at`, **новые сверху**.',
      sqlOrdered: true,
      hints: ['Новые сверху — сортировка по времени по убыванию: `ORDER BY created_at DESC`.', '`SELECT id, customer_id, status, created_at FROM orders ORDER BY created_at DESC LIMIT 5;`'],
      solution: 'SELECT id, customer_id, status, created_at FROM orders ORDER BY created_at DESC LIMIT 5;',
      explanation: 'Здесь важен порядок строк: сначала самый новый заказ.',
    },
    {
      id: 'customer-last',
      prompt: 'Клиент Jonas Novak (`customer_id = 14`) спрашивает про свой **последний** заказ. Выведи **одну строку**: `id, status, total` его самого нового заказа.',
      hints: ['WHERE по клиенту, затем сортировка «новые сверху» и одна строка.', '`SELECT id, status, total FROM orders WHERE customer_id = 14 ORDER BY created_at DESC LIMIT 1;`'],
      solution: 'SELECT id, status, total FROM orders WHERE customer_id = 14 ORDER BY created_at DESC LIMIT 1;',
    },
    {
      id: 'timeline',
      prompt: 'Клиент пишет: *«My card was declined, but the order is paid?»* (карту отклонили, но заказ оплачен?). Выведи платежи заказа **1064** по времени, **от раннего к позднему**: `id, status, error_code, created_at`.',
      sqlOrdered: true,
      hints: ['`WHERE order_id = 1064`', 'От раннего к позднему — `ORDER BY created_at` (ASC можно не писать).'],
      solution: 'SELECT id, status, error_code, created_at FROM payments WHERE order_id = 1064 ORDER BY created_at;',
      explanation: 'Первая попытка — failed (card_declined), вторая через три минуты — succeeded. Деньги списаны один раз, заказ оплачен — можно спокойно ответить клиенту.',
    },
    {
      id: 'oldest-open',
      prompt: 'Какой **открытый** тикет (`status = \'open\'`) ждёт ответа **дольше всех** (самый старый)? Введи его `id`.',
      answer: { accept: [String(facts.oldestOpenTicket)], normalize: 'number', label: 'id тикета:' },
      hints: ['Самый старый — сортировка по времени по возрастанию и первая строка.', "`SELECT id, subject, created_at FROM support_tickets WHERE status = 'open' ORDER BY created_at LIMIT 1;`"],
      solution: "SELECT id, subject, created_at FROM support_tickets WHERE status = 'open' ORDER BY created_at LIMIT 1;",
    },
  ],
  quiz: [
    {
      id: 'q-sql-newest-customers',
      type: 'sql',
      prompt: 'Выведи `email, created_at` **трёх самых новых** клиентов (по `created_at`, новые сверху).',
      solution: 'SELECT email, created_at FROM customers ORDER BY created_at DESC LIMIT 3;',
      ordered: true,
      explanation: '`ORDER BY created_at DESC LIMIT 3`.',
    },
    {
      id: 'q-desc',
      type: 'text',
      prompt: 'Какое слово после `ORDER BY столбец` сортирует **по убыванию** (новые/большие сверху)?',
      answer: { accept: ['DESC'], normalize: 'keywords', keywords: [['desc']] },
      explanation: '`DESC` (descending). По возрастанию — `ASC`, он по умолчанию.',
    },
    {
      id: 'q-en-latest',
      type: 'text',
      prompt: 'English: what do you get with `ORDER BY created_at DESC LIMIT 1`? (можно по-русски)',
      answer: { accept: ['the latest row'], normalize: 'keywords', keywords: [['latest', 'newest', 'most recent', 'last', 'последн', 'самый нов', 'самую нов', 'свеж']] },
      explanation: 'The latest (newest) row — самую последнюю по времени строку.',
    },
    {
      id: 'q-parts',
      type: 'choice',
      prompt: 'В каком порядке идут части запроса?',
      options: ['SELECT → FROM → ORDER BY → WHERE → LIMIT', 'SELECT → FROM → WHERE → ORDER BY → LIMIT', 'SELECT → LIMIT → FROM → WHERE → ORDER BY'],
      correct: 1,
      explanation: 'SELECT → FROM → WHERE → ORDER BY → LIMIT. Части можно пропускать, но не переставлять.',
    },
  ],
  glossary: [
    { ru: 'Сортировка', en: 'ORDER BY', def: 'Упорядочить строки по столбцу.' },
    { ru: 'По возрастанию', en: 'ascending (ASC)', def: 'От меньшего к большему, от старого к новому (по умолчанию).' },
    { ru: 'По убыванию', en: 'descending (DESC)', def: 'От большего к меньшему, новые сверху.' },
    { ru: 'Хронология', en: 'timeline', def: 'События по порядку времени — основа любого разбора.' },
  ],
};
export default lesson;
