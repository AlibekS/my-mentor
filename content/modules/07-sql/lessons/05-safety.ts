import type { LessonDef } from '../../../../src/content/types';
import { dataset } from '../data';

const lesson: LessonDef = {
  id: 'safety',
  title: 'Безопасно на проде: транзакции, EXPLAIN, только чтение',
  minutes: 25,
  scenario: {},
  sql: { dataset },
  tasks: [
    {
      id: 'count-before',
      prompt: 'Разработчик просит «перевести в `paid` зависшие заказы — те, что `pending`, но с успешным платежом». Перед UPDATE **посчитай**, сколько строк это затронет (один SELECT с COUNT).',
      hints: ['Это запрос из прошлого урока, обёрнутый в COUNT.', "`SELECT COUNT(*) FROM orders o JOIN payments p ON p.order_id = o.id WHERE o.status = 'pending' AND p.status = 'succeeded';`"],
      solution: "SELECT COUNT(*) FROM orders o JOIN payments p ON p.order_id = o.id WHERE o.status = 'pending' AND p.status = 'succeeded';",
    },
    {
      id: 'tx',
      prompt: 'Отрепетируй исправление в **транзакции**: `BEGIN`, UPDATE этих заказов в `paid`, затем `SELECT COUNT(*)` заказов в статусе `pending` (чтобы увидеть эффект), затем `ROLLBACK`. Пиши всё одним скриптом через `;` — проверка смотрит на результат последнего SELECT.',
      hints: [
        "UPDATE с подзапросом: `UPDATE orders SET status = 'paid' WHERE status = 'pending' AND id IN (SELECT order_id FROM payments WHERE status = 'succeeded');`",
        "Потом `SELECT COUNT(*) FROM orders WHERE status = 'pending';` и `ROLLBACK;`",
      ],
      solution: "BEGIN; UPDATE orders SET status = 'paid' WHERE status = 'pending' AND id IN (SELECT order_id FROM payments WHERE status = 'succeeded'); SELECT COUNT(*) FROM orders WHERE status = 'pending'; ROLLBACK;",
      explanation: 'После ROLLBACK база вернулась в исходное состояние — проверь это отдельным SELECT. В реальности следующий шаг — change-тикет с этим скриптом и COMMIT после согласования.',
    },
    {
      id: 'explain',
      prompt: 'Посмотри план запроса `SELECT * FROM orders WHERE customer_id = 7` через `EXPLAIN QUERY PLAN`. Какой **индекс** использует SQLite? Введи его имя.',
      answer: { accept: ['idx_orders_customer'], label: 'Индекс:' },
      hints: ['`EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 7;`'],
      solution: 'EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 7;',
    },
  ],
  quiz: [
    { id: 'q-first', type: 'text', prompt: 'Что нужно выполнить **перед** UPDATE/DELETE на проде, чтобы увидеть затрагиваемые строки? (одно ключевое слово SQL)', answer: { accept: ['SELECT'] }, explanation: 'SELECT с тем же WHERE — посмотреть и посчитать.' },
    { id: 'q-rollback', type: 'text', prompt: 'Какой командой отменить изменения внутри транзакции?', answer: { accept: ['ROLLBACK', 'ROLLBACK;'] }, explanation: '`ROLLBACK` — откат; `COMMIT` — зафиксировать.' },
    { id: 'q-scan', type: 'choice', prompt: '`EXPLAIN` показывает `SCAN orders` (PostgreSQL: Seq Scan) для запроса по таблице на 50 млн строк. Что это значит?', options: ['Запрос использует индекс', 'БД перебирает всю таблицу — вероятно, нет подходящего индекса', 'Таблица повреждена'], correct: 1, explanation: 'Полный перебор большой таблицы — частая причина медленных отчётов и таймаутов.' },
    { id: 'q-plan', type: 'sql', prompt: 'Выполни `EXPLAIN QUERY PLAN` для запроса заказов в статусе `pending` и посмотри, есть ли индекс.', solution: "EXPLAIN QUERY PLAN SELECT * FROM orders WHERE status = 'pending';", explanation: '`SCAN orders` — индекса по status нет. Для частого запроса «зависших» заказов разработчикам можно предложить индекс.' },
  ],
  glossary: [
    { ru: 'Транзакция', en: 'transaction', def: 'Группа операций, которые применяются целиком (COMMIT) или откатываются (ROLLBACK).' },
    { ru: 'Индекс', en: 'index', def: 'Структура для быстрого поиска строк без полного перебора.' },
    { ru: 'План запроса', en: 'query plan / EXPLAIN', def: 'Как БД собирается выполнять запрос.' },
    { ru: 'Персональные данные', en: 'PII, personally identifiable information', def: 'Email, телефон, адрес и т.п. — требуют осторожности.' },
  ],
};
export default lesson;
