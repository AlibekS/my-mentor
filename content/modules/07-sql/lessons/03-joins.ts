import type { LessonDef } from '../../../../src/content/types';
import { dataset, facts } from '../data';

const lesson: LessonDef = {
  id: 'joins',
  title: 'JOIN: INNER, LEFT и поиск «сирот»',
  minutes: 30,
  scenario: {},
  sql: { dataset },
  tasks: [
    {
      id: 'enterprise',
      prompt: 'Выведи заказы **enterprise**-клиентов: `order id`, `email` клиента, `status`, `total`.',
      hints: ['`orders o JOIN customers c ON c.id = o.customer_id`', "`WHERE c.plan = 'enterprise'`"],
      solution: "SELECT o.id, c.email, o.status, o.total FROM orders o JOIN customers c ON c.id = o.customer_id WHERE c.plan = 'enterprise';",
    },
    {
      id: 'no-orders',
      prompt: 'Найди клиентов **без единого заказа**: `id, email`.',
      hints: ['LEFT JOIN orders и оставить строки без пары.', '`WHERE o.id IS NULL`'],
      solution: 'SELECT c.id, c.email FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL;',
      explanation: `Таких клиентов ${facts.noOrderCustomers}. Тот же ответ даёт \`NOT EXISTS\`.`,
    },
    {
      id: 'orphans',
      prompt: 'Проверь целостность: есть ли **платежи на несуществующие заказы**? Выведи `id, order_id, amount` таких платежей.',
      hints: ['payments LEFT JOIN orders ON o.id = p.order_id', '`WHERE o.id IS NULL`'],
      solution: 'SELECT p.id, p.order_id, p.amount FROM payments p LEFT JOIN orders o ON o.id = p.order_id WHERE o.id IS NULL;',
    },
    {
      id: 'customer-payments',
      prompt: 'Все **платежи** клиента `aigerim.s@mail.kz`: `order_id, provider, status, amount, created_at`.',
      hints: ['Цепочка: payments → orders → customers.', '`FROM payments p JOIN orders o ON o.id = p.order_id JOIN customers c ON c.id = o.customer_id`'],
      solution: "SELECT p.order_id, p.provider, p.status, p.amount, p.created_at FROM payments p JOIN orders o ON o.id = p.order_id JOIN customers c ON c.id = o.customer_id WHERE c.email = 'aigerim.s@mail.kz';",
    },
  ],
  quiz: [
    { id: 'q-left', type: 'choice', prompt: 'Какой JOIN оставит всех клиентов, даже без заказов?', options: ['INNER JOIN orders', 'customers LEFT JOIN orders', 'orders LEFT JOIN customers'], correct: 1, explanation: 'Таблица, из которой нужны все строки, — слева от LEFT JOIN.' },
    { id: 'q-cross', type: 'text', prompt: 'Что получится, если соединить таблицы без условия связи (без ON)? (англ. термин из двух слов или по-русски)', answer: { accept: [], normalize: 'keywords', keywords: [['декартов', 'cartesian', 'cross', 'перекрест', 'с каждой', 'со всеми', 'все комбинации']] }, explanation: 'Декартово произведение (cartesian product): 10 000 × 10 000 = 100 млн строк.' },
    { id: 'q-count-orders', type: 'sql', prompt: 'Выведи для **каждого** клиента `email` и число его заказов (у клиентов без заказов — 0).', solution: 'SELECT c.email, COUNT(o.id) FROM customers c LEFT JOIN orders o ON o.customer_id = c.id GROUP BY c.id;', explanation: '`COUNT(o.id)`, а не `COUNT(*)` — иначе клиенты без заказов получат 1.' },
    { id: 'q-tickets', type: 'sql', prompt: 'Выведи открытые (`status = \'open\'`) тикеты поддержки с email клиента: `ticket id, email, subject, priority`.', solution: "SELECT t.id, c.email, t.subject, t.priority FROM support_tickets t JOIN customers c ON c.id = t.customer_id WHERE t.status = 'open';", explanation: 'JOIN support_tickets → customers по customer_id.' },
  ],
  glossary: [
    { ru: 'Внешний ключ', en: 'foreign key', def: 'Столбец, ссылающийся на первичный ключ другой таблицы.' },
    { ru: 'Псевдоним', en: 'alias', def: 'Короткое имя таблицы/столбца в запросе: orders o, COUNT(*) AS cnt.' },
    { ru: 'Строка-сирота', en: 'orphan row', def: 'Запись, ссылающаяся на несуществующую связанную запись.' },
  ],
};
export default lesson;
