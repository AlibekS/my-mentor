import type { LessonDef } from '../../../../src/content/types';
import { dataset, facts, DUP_WINDOW } from '../data';

const DUPS = "SELECT order_id FROM payments WHERE status = 'succeeded' GROUP BY order_id HAVING COUNT(*) > 1";

const lesson: LessonDef = {
  id: 'boss',
  kind: 'boss',
  title: 'Двойные списания',
  minutes: 45,
  incident: { ticket: 'INC-5120: «Клиентам списывают оплату дважды»', severity: 'SEV2', customer: 'клиенты, оплачивавшие 3 ноября' },
  scenario: {},
  sql: { dataset },
  tasks: [
    {
      id: 'confirm',
      prompt: 'Тикет №1 в `support_tickets` — от клиента с `customer_id = 7`. Выведи все его **платежи** 3 ноября: `order_id, provider, status, amount, idempotency_key, created_at`.',
      hints: ['payments JOIN orders по order_id; фильтр по клиенту и дате.', "`WHERE o.customer_id = 7 AND date(p.created_at) = '2026-11-03'`"],
      solution: "SELECT p.order_id, p.provider, p.status, p.amount, p.idempotency_key, p.created_at FROM payments p JOIN orders o ON o.id = p.order_id WHERE o.customer_id = 7 AND date(p.created_at) = '2026-11-03';",
    },
    {
      id: 'all-dups',
      prompt: 'Найди **все** заказы с двумя и более успешными платежами: `order_id`, количество успешных платежей, сумма списаний (`SUM(amount)`).',
      hints: ["`WHERE status = 'succeeded' GROUP BY order_id HAVING COUNT(*) > 1`"],
      solution: "SELECT order_id, COUNT(*), SUM(amount) FROM payments WHERE status = 'succeeded' GROUP BY order_id HAVING COUNT(*) > 1;",
    },
    {
      id: 'window',
      prompt: 'Когда началось? Введи время (`ЧЧ:ММ`) самого раннего **повторного** списания — минимальный `created_at` среди «лишних» платежей (вторых по заказу).',
      answer: { accept: [facts.firstDup.slice(11, 16)], label: 'Время (ЧЧ:ММ):' },
      hints: [
        'Платежи по заказам-дублям с порядком внутри заказа — оконная функция `ROW_NUMBER() OVER (PARTITION BY order_id ORDER BY created_at)`.',
        'Или проще: для каждого заказа-дубля `MAX(created_at)` — время второго списания; потом MIN по ним.',
        `SELECT MIN(t) FROM (SELECT MAX(created_at) AS t FROM payments WHERE status = 'succeeded' GROUP BY order_id HAVING COUNT(*) > 1);`,
      ],
      solution: "SELECT MIN(t) FROM (SELECT MAX(created_at) AS t FROM payments WHERE status = 'succeeded' GROUP BY order_id HAVING COUNT(*) > 1);",
    },
    {
      id: 'provider',
      prompt: 'Какой **провайдер** и какой признак у всех лишних платежей? Выведи для платежей заказов-дублей распределение: `provider`, `idempotency_key IS NULL` (0/1) и количество.',
      hints: [`Ограничь платежи заказами-дублями: \`WHERE order_id IN (${DUPS})\`.`, '`GROUP BY provider, idempotency_key IS NULL`'],
      solution: `SELECT provider, idempotency_key IS NULL, COUNT(*) FROM payments WHERE status = 'succeeded' AND order_id IN (${DUPS}) GROUP BY provider, idempotency_key IS NULL;`,
      explanation: 'Все платежи по заказам-дублям — через stripe и **без ключа идемпотентности**. Сервис повторял запрос на списание при таймауте провайдера, а без idempotency key провайдер считал повтор новым платежом.',
    },
    {
      id: 'scale',
      prompt: 'Масштаб для финдиректора: **сколько клиентов** затронуто? Введи число.',
      answer: { accept: [String(facts.dupCustomers)], normalize: 'number', label: 'Клиентов:' },
      hints: [`\`SELECT COUNT(DISTINCT customer_id) FROM orders WHERE id IN (${DUPS});\``],
      solution: `SELECT COUNT(DISTINCT customer_id) FROM orders WHERE id IN (${DUPS});`,
    },
    {
      id: 'refund',
      prompt: 'Список на возврат для финансов: `email` клиента, `order_id`, сумма к возврату (`SUM(amount)` минус один платёж, т.е. лишние списания). Отсортируй по `order_id`.',
      sqlOrdered: true,
      hints: [
        'Сумма лишнего = `SUM(p.amount) - MAX(p.amount)` (все платежи заказа одной суммы) или `(COUNT(*) - 1) * o.total`.',
        "JOIN payments → orders → customers, `WHERE p.status = 'succeeded'`, `GROUP BY o.id HAVING COUNT(*) > 1 ORDER BY o.id`.",
      ],
      solution: "SELECT c.email, o.id, ROUND(SUM(p.amount) - MAX(p.amount), 2) FROM payments p JOIN orders o ON o.id = p.order_id JOIN customers c ON c.id = o.customer_id WHERE p.status = 'succeeded' GROUP BY o.id HAVING COUNT(*) > 1 ORDER BY o.id;",
      explanation: `Итого к возврату: ${facts.dupRefund}. Окно — ${DUP_WINDOW.from.slice(11, 16)}–${DUP_WINDOW.to.slice(11, 16)} 3 ноября. Список с email — только в защищённый канал финансов, не в общий чат.`,
    },
  ],
  quiz: [
    { id: 'q-rca', type: 'text', prompt: 'RCA одной фразой (ключевые слова: повтор/retry/таймаут и идемпотентность/idempotency key).', answer: { accept: [], normalize: 'keywords', keywords: [['повтор', 'retry', 'ретра', 'таймаут', 'timeout'], ['идемпотент', 'idempotency']] }, explanation: 'Сервис платежей при таймауте stripe повторял списание без idempotency key → провайдер создавал второй платёж.' },
    { id: 'q-fix', type: 'choice', prompt: 'Какое исправление закрывает первопричину?', options: ['Увеличить таймаут до 5 минут', 'Передавать idempotency key при каждом запросе на списание (один ключ на заказ) + алерт на дубли', 'Отключить stripe'], correct: 1, explanation: 'Идемпотентность делает повтор безопасным. Алерт на «>1 успешного платежа на заказ» сократит время обнаружения.' },
    { id: 'q-total', type: 'sql', prompt: 'Одним запросом посчитай общую сумму к возврату (одно число, округли до 2 знаков).', solution: "SELECT ROUND(SUM(extra), 2) FROM (SELECT SUM(amount) - MAX(amount) AS extra FROM payments WHERE status = 'succeeded' GROUP BY order_id HAVING COUNT(*) > 1);", explanation: 'Подзапрос считает лишнее по каждому заказу, внешний — суммирует.' },
  ],
  glossary: [
    { ru: 'Идемпотентность', en: 'idempotency', def: 'Повтор операции даёт тот же результат, что и одно выполнение.' },
    { ru: 'Ключ идемпотентности', en: 'idempotency key', def: 'Уникальный ключ запроса, по которому провайдер распознаёт повтор.' },
    { ru: 'Оконная функция', en: 'window function', def: 'Функция по «окну» строк: ROW_NUMBER() OVER (PARTITION BY …).' },
  ],
};
export default lesson;
