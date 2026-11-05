import type { LessonDef } from '../../../../../src/content/types';
import { dataset, facts } from '../data';

const lesson: LessonDef = {
  id: 'count',
  title: 'COUNT, SUM, GROUP BY: посчитать',
  minutes: 25,
  scenario: {},
  sql: { dataset },
  tasks: [
    {
      id: 'kz-count',
      prompt: 'Сколько клиентов из Казахстана (`country = \'KZ\'`)? Выведи **одно число** запросом.',
      hints: ['Количество строк — `COUNT(*)`.', "`SELECT COUNT(*) FROM customers WHERE country = 'KZ';`"],
      solution: "SELECT COUNT(*) FROM customers WHERE country = 'KZ';",
      explanation: `Клиентов из KZ: ${facts.kzCustomers}.`,
    },
    {
      id: 'unpaid-today',
      prompt: 'Руководитель смены: *«How many unpaid orders do we have today?»* Посчитай **неоплаченные** (`unpaid`) заказы за **сегодня** (5 ноября 2026) и введи число.',
      answer: { accept: [String(facts.unpaidToday)], normalize: 'number', label: 'Неоплаченных сегодня:' },
      hints: ['Два условия: статус и дата. Дата — `created_at LIKE \'2026-11-05%\'`.', "`SELECT COUNT(*) FROM orders WHERE status = 'unpaid' AND created_at LIKE '2026-11-05%';`"],
      solution: "SELECT COUNT(*) FROM orders WHERE status = 'unpaid' AND created_at LIKE '2026-11-05%';",
      explanation: `Сегодня ${facts.unpaidToday} неоплаченных из ${facts.ordersToday} заказов. Запомни это число — в боссе выяснится, что часть из них на самом деле оплачена.`,
    },
    {
      id: 'by-status',
      prompt: 'Сколько заказов **в каждом статусе**? Выведи `status` и количество заказов.',
      hints: ['Группировка по статусу — `GROUP BY status`.', '`SELECT status, COUNT(*) FROM orders GROUP BY status;`'],
      solution: 'SELECT status, COUNT(*) FROM orders GROUP BY status;',
    },
    {
      id: 'paid-sum',
      prompt: 'На какую **сумму** сегодня (5 ноября) оплачено заказов? Выведи одно число — сумму `total` заказов в статусе `paid` за сегодня.',
      hints: ['Сумма столбца — `SUM(total)`.', "`SELECT SUM(total) FROM orders WHERE status = 'paid' AND created_at LIKE '2026-11-05%';`"],
      solution: "SELECT SUM(total) FROM orders WHERE status = 'paid' AND created_at LIKE '2026-11-05%';",
      explanation: `Оплачено на ${facts.paidSumToday}.`,
    },
    {
      id: 'failed-codes',
      prompt: 'Почему не проходят оплаты? Для **неуспешных** платежей (`status = \'failed\'`) выведи `error_code` и количество платежей с этим кодом.',
      hints: ['Сначала WHERE (только failed), потом GROUP BY.', "`SELECT error_code, COUNT(*) FROM payments WHERE status = 'failed' GROUP BY error_code;`"],
      solution: "SELECT error_code, COUNT(*) FROM payments WHERE status = 'failed' GROUP BY error_code;",
      explanation: `Всего неуспешных платежей: ${facts.failedPayments}. Все коды — со стороны банка клиента (карта отклонена, просрочена, не хватает средств), а не ошибки магазина.`,
    },
  ],
  quiz: [
    {
      id: 'q-sql-assignee',
      type: 'sql',
      prompt: 'Сколько тикетов у каждого исполнителя? Выведи `assignee` и количество тикетов — **только тикеты, где исполнитель назначен**.',
      solution: 'SELECT assignee, COUNT(*) FROM support_tickets WHERE assignee IS NOT NULL GROUP BY assignee;',
      explanation: '`WHERE assignee IS NOT NULL GROUP BY assignee` — без WHERE появится лишняя группа NULL (тикеты без исполнителя).',
    },
    {
      id: 'q-group',
      type: 'text',
      prompt: 'Какие два слова раскладывают строки по группам, чтобы посчитать «по каждому статусу»?',
      answer: { accept: ['GROUP BY'], normalize: 'keywords', keywords: [['group by']] },
      explanation: '`GROUP BY status`.',
    },
    {
      id: 'q-en-count',
      type: 'text',
      prompt: 'English: your manager asks *«How many orders did we get today?»* Which SQL function do you need?',
      answer: { accept: ['COUNT'], normalize: 'keywords', keywords: [['count']] },
      explanation: '*How many* = «сколько штук» → `COUNT(*)`. *How much money* = «сколько денег» → `SUM(total)`.',
    },
    {
      id: 'q-zero',
      type: 'choice',
      prompt: "`SELECT COUNT(*) FROM orders WHERE status = 'Unpaid'` вернул 0, хотя неоплаченные заказы точно есть. Что, скорее всего, не так?",
      options: ['База сломалась — срочно эскалировать', "В таблице статус пишется маленькими буквами ('unpaid'), а сравнение = учитывает регистр", 'COUNT(*) не умеет считать текстовые столбцы'],
      correct: 1,
      explanation: "Значения сравниваются точно: 'Unpaid' ≠ 'unpaid'. Сначала посмотри реальные значения: `SELECT DISTINCT status FROM orders;`.",
    },
  ],
  glossary: [
    { ru: 'Агрегатная функция', en: 'aggregate function', def: 'COUNT, SUM, AVG, MIN, MAX: много строк → одно число.' },
    { ru: 'Группировка', en: 'GROUP BY', def: 'Разложить строки по одинаковым значениям и посчитать каждую группу.' },
    { ru: 'Псевдоним', en: 'alias (AS)', def: 'Имя для столбца или таблицы в запросе: COUNT(*) AS cnt.' },
  ],
};
export default lesson;
