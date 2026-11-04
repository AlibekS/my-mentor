import type { LessonDef } from '../../../../src/content/types';
import { dataset, facts } from '../data';

const lesson: LessonDef = {
  id: 'select',
  title: 'SELECT, WHERE, ORDER BY, LIMIT',
  minutes: 25,
  scenario: {},
  sql: { dataset },
  tasks: [
    {
      id: 'find-customer',
      prompt: 'Клиент пишет с адреса `aigerim.s@mail.kz`. Найди его в `customers`: выведи **id, name, plan**.',
      hints: ['Фильтр по email: `WHERE email = \'...\'`.', "`SELECT id, name, plan FROM customers WHERE email = 'aigerim.s@mail.kz';`"],
      solution: "SELECT id, name, plan FROM customers WHERE email = 'aigerim.s@mail.kz';",
    },
    {
      id: 'last-orders',
      prompt: 'Выведи **5 последних заказов** этого клиента (id клиента = 7): столбцы `id, status, total, created_at`, новые сверху.',
      sqlOrdered: true,
      hints: ['`WHERE customer_id = 7`', 'Новые сверху — `ORDER BY created_at DESC`, пять — `LIMIT 5`.'],
      solution: 'SELECT id, status, total, created_at FROM orders WHERE customer_id = 7 ORDER BY created_at DESC LIMIT 5;',
    },
    {
      id: 'pending',
      prompt: 'Выведи все заказы в статусе **pending** (`id, customer_id, total, created_at`).',
      hints: ["`WHERE status = 'pending'`"],
      solution: "SELECT id, customer_id, total, created_at FROM orders WHERE status = 'pending';",
    },
    {
      id: 'null-country',
      prompt: 'У части клиентов не заполнена страна. Выведи `id, email` клиентов, у которых `country` пустой (NULL).',
      hints: ['`= NULL` не работает.', '`WHERE country IS NULL`'],
      solution: 'SELECT id, email FROM customers WHERE country IS NULL;',
      explanation: `Таких клиентов ${facts.nullCountry}. Сравнение с NULL через \`=\` всегда даёт «неизвестно», поэтому только \`IS NULL\` / \`IS NOT NULL\`.`,
    },
  ],
  quiz: [
    { id: 'q-order', type: 'text', prompt: 'Какое ключевое слово ограничивает количество возвращаемых строк (в PostgreSQL, MySQL, SQLite)?', answer: { accept: ['LIMIT'] }, explanation: '`LIMIT 10`. В MS SQL — `SELECT TOP 10`.' },
    { id: 'q-null', type: 'text', prompt: 'Как правильно написать условие «email не пустой (не NULL)»? (без WHERE)', answer: { accept: ['email IS NOT NULL'], normalize: 'exact' }, explanation: '`email IS NOT NULL`.' },
    { id: 'q-sql-window', type: 'sql', prompt: 'Выведи `id, status, total` всех заказов, созданных **3 ноября 2026 с 14:00 до 15:00** (14:00 включительно, 15:00 — нет).', solution: "SELECT id, status, total FROM orders WHERE created_at >= '2026-11-03 14:00:00' AND created_at < '2026-11-03 15:00:00';", explanation: "`WHERE created_at >= '2026-11-03 14:00:00' AND created_at < '2026-11-03 15:00:00'` — полуоткрытый интервал, без пропусков и двойного счёта." },
    { id: 'q-like', type: 'sql', prompt: 'Выведи `id, email` клиентов с почтой на домене **company.de**.', solution: "SELECT id, email FROM customers WHERE email LIKE '%@company.de';", explanation: "`LIKE '%@company.de'` — `%` означает любую последовательность символов." },
  ],
  glossary: [
    { ru: 'Реплика для чтения', en: 'read replica', def: 'Копия БД, на которой безопасно выполнять тяжёлые SELECT.' },
    { ru: 'Пустое значение', en: 'NULL', def: '«Нет данных»; сравнивается только через IS NULL / IS NOT NULL.' },
  ],
};
export default lesson;
