import type { LessonDef } from '../../../../../src/content/types';
import { dataset, facts } from '../data';

const lesson: LessonDef = {
  id: 'tables',
  title: 'Таблица, строка, столбец: первый SELECT',
  minutes: 20,
  scenario: {},
  sql: { dataset },
  tasks: [
    {
      id: 'all-customers',
      prompt: 'Посмотри на таблицу клиентов целиком: выведи **все столбцы и все строки** таблицы `customers`.',
      hints: ['Все столбцы — звёздочка `*`.', '`SELECT * FROM customers;`'],
      solution: 'SELECT * FROM customers;',
      explanation: `В таблице ${facts.customers} строк (клиентов) и 6 столбцов. Каждая строка — один клиент, каждый столбец — одно его свойство.`,
    },
    {
      id: 'columns',
      prompt: 'Для рассылки нужны только **email и страна** клиентов. Выведи из `customers` два столбца: `email`, `country` (в таком порядке).',
      hints: ['Перечисли нужные столбцы через запятую после SELECT.', '`SELECT email, country FROM customers;`'],
      solution: 'SELECT email, country FROM customers;',
      explanation: 'Столбцы в ответе идут в том порядке, в котором ты их перечислил после SELECT.',
    },
    {
      id: 'limit',
      prompt: 'Таблица `payments` незнакомая. Посмотри **первые 5 строк** (все столбцы), чтобы понять, что в ней хранится.',
      hints: ['Ограничение количества строк — `LIMIT` в конце запроса.', '`SELECT * FROM payments LIMIT 5;`'],
      solution: 'SELECT * FROM payments LIMIT 5;',
      explanation: 'Видно столбцы платежа: `order_id` (к какому заказу), `status`, `amount`, `method`, `error_code` (почему не прошёл) и время. LIMIT — привычка, которая бережёт прод.',
    },
    {
      id: 'count-tickets',
      prompt: 'Посмотри таблицу `support_tickets` целиком. **Сколько в ней тикетов** (строк)? Введи число.',
      answer: { accept: [String(facts.tickets)], normalize: 'number', label: 'Тикетов:' },
      hints: ['`SELECT * FROM support_tickets;` — и посчитай строки (или посмотри на последний id).', 'Количество строк видно и в схеме под консолью.'],
      solution: 'SELECT * FROM support_tickets;',
      explanation: `Тикетов ${facts.tickets}. Считать строки «глазами» удобно, пока их мало; в уроке 4 научимся считать функцией COUNT.`,
    },
  ],
  quiz: [
    {
      id: 'q-row',
      type: 'text',
      prompt: 'Как называется одна запись таблицы — например, один клиент в `customers`?',
      answer: { accept: ['строка'], normalize: 'keywords', keywords: [['строк', 'row', 'запис', 'record']] },
      explanation: 'Строка (row), или запись. Свойства записи — столбцы (columns).',
    },
    {
      id: 'q-sql-cols',
      type: 'sql',
      prompt: 'Выведи из `support_tickets` три столбца: `id`, `subject`, `status` (в таком порядке).',
      solution: 'SELECT id, subject, status FROM support_tickets;',
      explanation: '`SELECT id, subject, status FROM support_tickets;`',
    },
    {
      id: 'q-en-limit',
      type: 'text',
      prompt: 'English: what does `SELECT * FROM orders LIMIT 10;` return? (можно ответить по-русски)',
      answer: { accept: ['10 rows from orders'], normalize: 'keywords', keywords: [['10', 'ten', 'десять'], ['row', 'строк', 'order', 'заказ', 'запис']] },
      explanation: 'It returns the first 10 rows of the table *orders*, all columns. — Первые 10 строк таблицы orders, все столбцы.',
    },
    {
      id: 'q-order',
      type: 'choice',
      prompt: 'Какой запрос написан правильно?',
      options: ['FROM customers SELECT email;', 'SELECT email FROM customers;', 'SELECT FROM customers email;'],
      correct: 1,
      explanation: 'Сначала SELECT (какие столбцы), потом FROM (из какой таблицы).',
    },
  ],
  glossary: [
    { ru: 'База данных', en: 'database', def: 'Хранилище данных продукта: набор связанных таблиц.' },
    { ru: 'Таблица', en: 'table', def: 'Данные одного вида (клиенты, заказы) в виде строк и столбцов.' },
    { ru: 'Строка (запись)', en: 'row (record)', def: 'Один объект: один клиент, один заказ.' },
    { ru: 'Столбец (поле)', en: 'column (field)', def: 'Одно свойство объекта: email, статус, сумма.' },
    { ru: 'Первичный ключ', en: 'primary key', def: 'Уникальный номер строки (обычно id).' },
    { ru: 'Запрос', en: 'query', def: 'Команда на языке SQL, например SELECT * FROM orders LIMIT 10.' },
  ],
};
export default lesson;
