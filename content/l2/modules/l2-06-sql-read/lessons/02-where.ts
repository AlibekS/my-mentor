import type { LessonDef } from '../../../../../src/content/types';
import { dataset, facts } from '../data';

const lesson: LessonDef = {
  id: 'where',
  title: 'WHERE: найти нужные строки',
  minutes: 25,
  scenario: {},
  sql: { dataset },
  tasks: [
    {
      id: 'by-email',
      prompt: 'Тикет пришёл с адреса `lukas.muller@gmx.de`. Найди этого клиента в `customers`: выведи `id, name, plan`.',
      hints: ['Условие на email: `WHERE email = \'…\'` — текст в одинарных кавычках.', "`SELECT id, name, plan FROM customers WHERE email = 'lukas.muller@gmx.de';`"],
      solution: "SELECT id, name, plan FROM customers WHERE email = 'lukas.muller@gmx.de';",
    },
    {
      id: 'orders-of',
      prompt: 'У Lukas `id = 6`. Выведи все его заказы из `orders`: `id, status, total, created_at`.',
      hints: ['В заказах клиент указан в столбце `customer_id`.', '`SELECT id, status, total, created_at FROM orders WHERE customer_id = 6;`'],
      solution: 'SELECT id, status, total, created_at FROM orders WHERE customer_id = 6;',
      explanation: 'Число в условии пишется без кавычек.',
    },
    {
      id: 'failed-reason',
      prompt: `Тикет №7: *«Payment failed, why?»* — речь о заказе **${facts.failedOrder}**. Найди платежи этого заказа в \`payments\` и введи **код ошибки** (\`error_code\`).`,
      answer: { accept: [facts.failedCode], normalize: 'keywords', keywords: [[facts.failedCode, facts.failedCode.replace(/_/g, ' '), 'недостаточно', 'не хватает', 'не хватило']], label: 'error_code:' },
      hints: ['Платёж связан с заказом через столбец `order_id`.', `\`SELECT id, status, error_code FROM payments WHERE order_id = ${facts.failedOrder};\``],
      solution: `SELECT id, status, amount, error_code FROM payments WHERE order_id = ${facts.failedOrder};`,
      explanation: '`insufficient_funds` — на карте недостаточно средств, банк отклонил платёж. Это не ошибка магазина: клиенту отвечаем, что банк отклонил оплату, и предлагаем другую карту или способ оплаты.',
    },
    {
      id: 'unassigned',
      prompt: 'Какие **открытые** тикеты (`status = \'open\'`) ещё **без исполнителя** (`assignee` пустой)? Выведи `id, subject, priority`.',
      hints: ['Два условия сразу — через AND.', 'Пустое значение проверяется через `IS NULL`, а не `= NULL`.', "`SELECT id, subject, priority FROM support_tickets WHERE status = 'open' AND assignee IS NULL;`"],
      solution: "SELECT id, subject, priority FROM support_tickets WHERE status = 'open' AND assignee IS NULL;",
      explanation: `Таких тикетов ${facts.unassignedOpen} — их надо разобрать в первую очередь, особенно с приоритетом high.`,
    },
    {
      id: 'domain',
      prompt: 'Почтовый сервис mail.kz сообщил о сбое доставки писем. Найди клиентов с почтой на домене **mail.kz**: `id, name, email`.',
      hints: ['Часть значения ищут через LIKE и знак `%`.', "`SELECT id, name, email FROM customers WHERE email LIKE '%@mail.kz';`"],
      solution: "SELECT id, name, email FROM customers WHERE email LIKE '%@mail.kz';",
    },
  ],
  quiz: [
    {
      id: 'q-sql-unpaid',
      type: 'sql',
      prompt: 'Выведи `id, total, created_at` **неоплаченных** (`unpaid`) заказов **дороже 50**.',
      solution: "SELECT id, total, created_at FROM orders WHERE status = 'unpaid' AND total > 50;",
      explanation: "`WHERE status = 'unpaid' AND total > 50` — оба условия должны выполняться.",
    },
    {
      id: 'q-null',
      type: 'text',
      prompt: 'Напиши условие «исполнитель (`assignee`) не назначен» — без слова WHERE.',
      answer: { accept: ['assignee IS NULL', 'WHERE assignee IS NULL', 'assignee is null;'] },
      explanation: '`assignee IS NULL`. Сравнение `= NULL` не работает никогда.',
    },
    {
      id: 'q-en-plan',
      type: 'sql',
      prompt: 'Customer: *«Hi! My email is sara.ahmed@gmail.com. What plan am I on?»* Напиши запрос, который выводит **только столбец `plan`** этого клиента.',
      solution: "SELECT plan FROM customers WHERE email = 'sara.ahmed@gmail.com';",
      explanation: "`SELECT plan FROM customers WHERE email = 'sara.ahmed@gmail.com';` — *What plan am I on?* = «на каком я тарифе?».",
    },
    {
      id: 'q-or',
      type: 'choice',
      prompt: 'Нужны заказы в статусе `cancelled` **или** `refunded`. Какое условие верное?',
      options: ["status = 'cancelled' AND status = 'refunded'", "status = 'cancelled' OR status = 'refunded'", "status = 'cancelled, refunded'"],
      correct: 1,
      explanation: 'AND потребовал бы, чтобы у одной строки было сразу два статуса, — так не бывает, результат пустой. Нужен OR (или `status IN (\'cancelled\', \'refunded\')`).',
    },
  ],
  glossary: [
    { ru: 'Условие', en: 'condition (WHERE)', def: 'Правило, по которому база отбирает строки.' },
    { ru: 'Шаблон', en: 'pattern (LIKE)', def: '`%` — любые символы: `LIKE \'%@mail.kz\'`.' },
    { ru: 'Пустое значение', en: 'NULL', def: '«Нет данных»; проверяется только через IS NULL / IS NOT NULL.' },
    { ru: 'Недостаточно средств', en: 'insufficient funds', def: 'Банк отклонил платёж: на карте не хватает денег.' },
  ],
};
export default lesson;
