import type { LessonDef } from '../../../../src/content/types';
import { dataset, facts } from '../data';

const lesson: LessonDef = {
  id: 'anomalies',
  title: 'Аномалии: дубли, зависшие статусы, расхождения',
  minutes: 35,
  scenario: {},
  sql: { dataset },
  tasks: [
    {
      id: 'stuck',
      prompt: 'Тикет: «Заказ оплачен, но висит в статусе ожидания». Найди **все** такие заказы: `order id`, `created_at` заказа — у которых `orders.status = \'pending\'`, но есть успешный (`succeeded`) платёж.',
      hints: ['JOIN orders и payments по order_id.', "`WHERE o.status = 'pending' AND p.status = 'succeeded'`"],
      solution: "SELECT o.id, o.created_at FROM orders o JOIN payments p ON p.order_id = o.id WHERE o.status = 'pending' AND p.status = 'succeeded';",
      explanation: `${facts.stuckCount} заказов — все 4 ноября: похоже на потерянные webhook от провайдера за этот день.`,
    },
    {
      id: 'stuck-count',
      prompt: 'Сколько таких зависших заказов? Введи число.',
      answer: { accept: [String(facts.stuckCount)], normalize: 'number', label: 'Заказов:' },
      hints: ['Оберни предыдущий запрос в `COUNT(*)` или посчитай строки результата.'],
      solution: "SELECT COUNT(*) FROM orders o JOIN payments p ON p.order_id = o.id WHERE o.status = 'pending' AND p.status = 'succeeded';",
    },
    {
      id: 'mismatch',
      prompt: 'Тикет: «Сумма в заказе меньше, чем в корзине». Найди заказы, где `orders.total` отличается от суммы `qty * price` позиций больше чем на 0.01: `id, total, calc` (calc округли до 2 знаков).',
      hints: ['Сначала посчитай сумму позиций по заказу (CTE или подзапрос).', 'Сравни с допуском: `ABS(o.total - s.calc) > 0.01`.', 'WITH s AS (SELECT order_id, ROUND(SUM(qty*price),2) AS calc FROM order_items GROUP BY order_id) SELECT o.id, o.total, s.calc FROM orders o JOIN s ON s.order_id = o.id WHERE ABS(o.total - s.calc) > 0.01;'],
      solution: 'WITH s AS (SELECT order_id, ROUND(SUM(qty*price),2) AS calc FROM order_items GROUP BY order_id) SELECT o.id, o.total, s.calc FROM orders o JOIN s ON s.order_id = o.id WHERE ABS(o.total - s.calc) > 0.01;',
      explanation: 'У всех расхождений total ровно на 10% меньше — похоже на скидку, применённую к итогу, но не к позициям.',
    },
    {
      id: 'dups',
      prompt: 'Найди заказы с **больше чем одним успешным** платежом: `order_id` и количество успешных платежей.',
      hints: ["`WHERE status = 'succeeded' GROUP BY order_id`", '`HAVING COUNT(*) > 1`'],
      solution: "SELECT order_id, COUNT(*) FROM payments WHERE status = 'succeeded' GROUP BY order_id HAVING COUNT(*) > 1;",
    },
  ],
  quiz: [
    { id: 'q-cte', type: 'text', prompt: 'Каким ключевым словом начинается CTE — именованный подзапрос перед основным SELECT?', answer: { accept: ['WITH'] }, explanation: '`WITH name AS (SELECT …) SELECT … FROM name`.' },
    { id: 'q-float', type: 'choice', prompt: 'Почему суммы денег в REAL сравнивают через `ABS(a - b) > 0.01`, а не `a <> b`?', options: ['Так быстрее', 'Числа с плавающей точкой дают погрешности (0.1 + 0.2 ≠ 0.3)', 'Оператор <> не работает с числами'], correct: 1, explanation: 'В проде деньги хранят в DECIMAL/NUMERIC или в копейках (INTEGER).' },
    { id: 'q-hourly', type: 'sql', prompt: 'Посчитай **успешные** платежи по часам 3 ноября: `hour` (формат `ЧЧ`, через `strftime(\'%H\', created_at)`) и количество, по возрастанию часа.', solution: "SELECT strftime('%H', created_at) AS hour, COUNT(*) FROM payments WHERE status = 'succeeded' AND date(created_at) = '2026-11-03' GROUP BY hour ORDER BY hour;", ordered: true, explanation: 'Видно, что в 14 часов платежей заметно больше, чем обычно, — это следствие дублей (тема босса).' },
    { id: 'q-dup-email', type: 'sql', prompt: 'Проверь, нет ли дублей email в `customers` без учёта регистра: выведи `lower(email)` и количество для повторяющихся (результат может быть пустым — это тоже ответ).', solution: 'SELECT lower(email), COUNT(*) FROM customers GROUP BY lower(email) HAVING COUNT(*) > 1;', explanation: 'Пустой результат — хорошая новость: дублей нет. Проверять гипотезы и получать «нет» — нормальная часть расследования.' },
  ],
  glossary: [
    { ru: 'Общее табличное выражение', en: 'CTE, common table expression', def: 'Именованный подзапрос WITH … AS (…).' },
    { ru: 'Вебхук', en: 'webhook', def: 'HTTP-уведомление от внешнего сервиса о событии (например, «платёж прошёл»).' },
    { ru: 'Рассинхронизация', en: 'data inconsistency / drift', def: 'Состояния связанных данных противоречат друг другу.' },
  ],
};
export default lesson;
