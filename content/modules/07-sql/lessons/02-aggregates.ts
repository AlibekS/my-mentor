import type { LessonDef } from '../../../../src/content/types';
import { dataset, facts } from '../data';

const lesson: LessonDef = {
  id: 'aggregates',
  title: 'COUNT, SUM, GROUP BY, HAVING',
  minutes: 30,
  scenario: {},
  sql: { dataset },
  tasks: [
    {
      id: 'by-status',
      prompt: 'Посчитай заказы по статусам: столбцы `status` и количество.',
      hints: ['`GROUP BY status`', '`SELECT status, COUNT(*) FROM orders GROUP BY status;`'],
      solution: 'SELECT status, COUNT(*) FROM orders GROUP BY status;',
    },
    {
      id: 'revenue-day',
      prompt: 'Выручка по дням: `day` (дата без времени) и сумма `total` (округли до 2 знаков) **только по оплаченным** заказам (`paid` и `shipped`), по возрастанию даты.',
      sqlOrdered: true,
      hints: ['Дата без времени — `date(created_at)`.', "`WHERE status IN ('paid', 'shipped')`, затем `GROUP BY day ORDER BY day`.", "`SELECT date(created_at) AS day, ROUND(SUM(total), 2) FROM orders WHERE status IN ('paid','shipped') GROUP BY day ORDER BY day;`"],
      solution: "SELECT date(created_at) AS day, ROUND(SUM(total), 2) FROM orders WHERE status IN ('paid','shipped') GROUP BY day ORDER BY day;",
    },
    {
      id: 'loyal',
      prompt: 'Найди клиентов, у которых **10 и больше** заказов: `customer_id` и количество.',
      hints: ['Группировка по клиенту, фильтр по группе — HAVING.', '`... GROUP BY customer_id HAVING COUNT(*) >= 10`'],
      solution: 'SELECT customer_id, COUNT(*) FROM orders GROUP BY customer_id HAVING COUNT(*) >= 10;',
    },
    {
      id: 'unique',
      prompt: 'Сколько **разных клиентов** делали заказы? Введи число.',
      answer: { accept: [String(48 - facts.noOrderCustomers)], normalize: 'number', label: 'Клиентов:' },
      hints: ['`COUNT(DISTINCT customer_id)`'],
      solution: 'SELECT COUNT(DISTINCT customer_id) FROM orders;',
    },
  ],
  quiz: [
    { id: 'q-having', type: 'choice', prompt: 'Чем HAVING отличается от WHERE?', options: ['Ничем, это синонимы', 'WHERE фильтрует строки до группировки, HAVING — группы после', 'HAVING работает только с JOIN'], correct: 1, explanation: 'Условие на агрегат (`COUNT(*) > 1`) — только в HAVING.' },
    { id: 'q-count-col', type: 'text', prompt: 'Что посчитает `COUNT(country)`, если у части строк country = NULL? (ответь: все строки или только не-NULL)', answer: { accept: [], normalize: 'keywords', keywords: [['не null', 'не-null', 'not null', 'непуст', 'заполнен', 'только']] }, explanation: '`COUNT(столбец)` пропускает NULL; `COUNT(*)` считает все строки.' },
    { id: 'q-provider', type: 'sql', prompt: 'Посчитай платежи по паре `provider, status` (три столбца: provider, status, количество).', solution: 'SELECT provider, status, COUNT(*) FROM payments GROUP BY provider, status;', explanation: 'Группировать можно по нескольким столбцам.' },
    { id: 'q-avg', type: 'sql', prompt: 'Средний чек (`AVG(total)`, округли до 2 знаков) по каждому тарифу клиента `plan`. Подсказка: тариф в `customers`, заказы в `orders` — понадобится JOIN (забегаем вперёд) или подзапрос.', solution: 'SELECT c.plan, ROUND(AVG(o.total), 2) FROM orders o JOIN customers c ON c.id = o.customer_id GROUP BY c.plan;', explanation: '`SELECT c.plan, ROUND(AVG(o.total),2) FROM orders o JOIN customers c ON c.id = o.customer_id GROUP BY c.plan;` — подробно JOIN в следующем уроке.' },
  ],
  glossary: [
    { ru: 'Агрегатная функция', en: 'aggregate function', def: 'COUNT, SUM, AVG, MIN, MAX — сворачивают много строк в одно значение.' },
    { ru: 'Группировка', en: 'GROUP BY', def: 'Разбиение строк на группы с одинаковыми значениями.' },
  ],
};
export default lesson;
