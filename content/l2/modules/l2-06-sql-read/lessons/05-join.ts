import type { LessonDef } from '../../../../../src/content/types';
import { dataset, facts } from '../data';

const lesson: LessonDef = {
  id: 'join',
  title: 'JOIN: заказы вместе с клиентами',
  minutes: 25,
  scenario: {},
  sql: { dataset },
  tasks: [
    {
      id: 'today-emails',
      prompt: 'Выведи **сегодняшние** (5 ноября) заказы вместе с email клиента: `id` заказа, `email`, `status`, `total`.',
      hints: [
        'Соедини orders и customers: `JOIN customers c ON c.id = o.customer_id`.',
        "Сегодня — `o.created_at LIKE '2026-11-05%'`.",
        "`SELECT o.id, c.email, o.status, o.total FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.created_at LIKE '2026-11-05%';`",
      ],
      solution: "SELECT o.id, c.email, o.status, o.total FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.created_at LIKE '2026-11-05%';",
    },
    {
      id: 'by-email-join',
      prompt: 'Тикет: *«Hi, my email is madina.seitkali@mail.kz, where are my orders?»* Одним запросом (через JOIN, фильтр по email) выведи её заказы: `id, status, total, created_at` заказа.',
      hints: ['FROM orders o JOIN customers c ON c.id = o.customer_id, а условие — на `c.email`.', "`SELECT o.id, o.status, o.total, o.created_at FROM orders o JOIN customers c ON c.id = o.customer_id WHERE c.email = 'madina.seitkali@mail.kz';`"],
      solution: "SELECT o.id, o.status, o.total, o.created_at FROM orders o JOIN customers c ON c.id = o.customer_id WHERE c.email = 'madina.seitkali@mail.kz';",
      explanation: 'Можно и в два шага (найти id клиента, потом заказы) — результат тот же. JOIN просто экономит шаг.',
    },
    {
      id: 'whose-order',
      prompt: `Коллега спрашивает в чате: *«Whose order is ${facts.refundOrder}?»* (чей это заказ?). Выведи \`name, email\` клиента, который сделал заказ **${facts.refundOrder}**.`,
      hints: ['Тот же JOIN, но условие — на номер заказа `o.id`.', `\`SELECT c.name, c.email FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ${facts.refundOrder};\``],
      solution: `SELECT c.name, c.email FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ${facts.refundOrder};`,
    },
    {
      id: 'de-orders',
      prompt: 'Сколько **заказов** сделали клиенты из **Германии** (`country = \'DE\'`)? Введи число.',
      answer: { accept: [String(facts.deOrders)], normalize: 'number', label: 'Заказов из DE:' },
      hints: ['Страна — в customers, заказы — в orders: нужен JOIN.', "`SELECT COUNT(*) FROM orders o JOIN customers c ON c.id = o.customer_id WHERE c.country = 'DE';`"],
      solution: "SELECT COUNT(*) FROM orders o JOIN customers c ON c.id = o.customer_id WHERE c.country = 'DE';",
    },
  ],
  quiz: [
    {
      id: 'q-sql-pay-order',
      type: 'sql',
      prompt: 'Для заказа **1041** выведи рядом: `id` платежа, `status` платежа и `status` заказа (соедини `payments` и `orders`).',
      solution: 'SELECT p.id, p.status, o.status FROM payments p JOIN orders o ON o.id = p.order_id WHERE o.id = 1041;',
      explanation: '`payments p JOIN orders o ON o.id = p.order_id` — платёж ссылается на заказ через order_id.',
    },
    {
      id: 'q-key',
      type: 'text',
      prompt: 'Какой столбец таблицы `orders` ссылается на клиента (по нему делают JOIN с `customers`)?',
      answer: { accept: ['customer_id', 'orders.customer_id', 'o.customer_id'], normalize: 'keywords', keywords: [['customer_id', 'customer id']] },
      explanation: '`orders.customer_id = customers.id`.',
    },
    {
      id: 'q-en-join',
      type: 'text',
      prompt: 'Переведи сообщение коллеги: *«Can you join orders with customers and send me the emails?»*',
      answer: { accept: ['соедини заказы с клиентами и пришли email'], normalize: 'keywords', keywords: [['соедин', 'join', 'объедин', 'джойн', 'связ', 'склей'], ['email', 'почт', 'адрес', 'имейл', 'емейл']] },
      explanation: '«Можешь соединить заказы с клиентами и прислать мне email-ы?»',
    },
    {
      id: 'q-on',
      type: 'choice',
      prompt: 'Какое условие склейки orders и customers правильное?',
      options: ['ON c.id = o.id', 'ON c.id = o.customer_id', 'ON c.email = o.customer_id'],
      correct: 1,
      explanation: 'Ссылка заказа (`customer_id`) = id клиента. `c.id = o.id` склеит клиента №1057 с заказом №1057 — бессмыслица.',
    },
  ],
  glossary: [
    { ru: 'Соединение таблиц', en: 'JOIN', def: 'Склеить строки двух таблиц по правилу ON.' },
    { ru: 'Внешний ключ', en: 'foreign key', def: 'Столбец-ссылка на id строки в другой таблице (orders.customer_id → customers.id).' },
    { ru: 'Псевдоним таблицы', en: 'table alias', def: 'Короткое имя таблицы в запросе: orders o.' },
  ],
};
export default lesson;
