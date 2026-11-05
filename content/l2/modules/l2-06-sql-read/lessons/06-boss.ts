import type { LessonDef } from '../../../../../src/content/types';
import { dataset, facts } from '../data';

const STUCK = "SELECT o.id, c.email, o.total, p.created_at FROM orders o JOIN payments p ON p.order_id = o.id JOIN customers c ON c.id = o.customer_id WHERE o.status = 'unpaid' AND p.status = 'succeeded';";

const lesson: LessonDef = {
  id: 'boss',
  kind: 'boss',
  title: 'Деньги списали, а заказ не оплачен',
  minutes: 40,
  incident: { ticket: 'ZD-4821: «I was charged but my order shows unpaid»', severity: 'SEV3', customer: 'Emily Carter (US, тариф pro), emily.carter@outlook.com' },
  scenario: {},
  sql: { dataset },
  tasks: [
    {
      id: 'customer',
      prompt: 'Тикет пришёл с адреса `emily.carter@outlook.com`. Найди клиентку в `customers`: выведи `id, name, plan`.',
      hints: ["`WHERE email = 'emily.carter@outlook.com'`", "`SELECT id, name, plan FROM customers WHERE email = 'emily.carter@outlook.com';`"],
      solution: "SELECT id, name, plan FROM customers WHERE email = 'emily.carter@outlook.com';",
    },
    {
      id: 'orders',
      prompt: 'Выведи **все заказы** Emily: `id, status, total, created_at`. Какой из них сегодняшний и «неоплаченный»?',
      hints: ['Её id ты нашёл в прошлом задании — используй `customer_id`. Или JOIN с customers по email.', `\`SELECT id, status, total, created_at FROM orders WHERE customer_id = ${facts.emilyId};\``],
      solution: `SELECT id, status, total, created_at FROM orders WHERE customer_id = ${facts.emilyId};`,
      explanation: `Сегодняшний заказ **${facts.emilyOrder}** на ${facts.emilyTotal} — в статусе unpaid. Старый заказ оплачен нормально.`,
    },
    {
      id: 'payment',
      prompt: `Посмотри платежи по заказу **${facts.emilyOrder}**. Введи **id платежа и его статус** (например: \`5000 failed\`).`,
      answer: { accept: [`${facts.emilyPay} succeeded`], normalize: 'keywords', keywords: [[String(facts.emilyPay)], ['succeeded', 'success', 'успеш', 'прош']], label: 'Платёж и статус:' },
      hints: [`\`WHERE order_id = ${facts.emilyOrder}\``, `\`SELECT id, status, amount, method, created_at FROM payments WHERE order_id = ${facts.emilyOrder};\``],
      solution: `SELECT id, status, amount, method, created_at FROM payments WHERE order_id = ${facts.emilyOrder};`,
      explanation: `Платёж ${facts.emilyPay} — succeeded, сумма ${facts.emilyTotal} совпадает с заказом, ${facts.emilyPayTime.slice(11, 16)} UTC. Клиентка права: деньги списаны, а заказ остался unpaid. Платить второй раз не нужно.`,
    },
    {
      id: 'others',
      prompt: 'Это только у Emily? Найди **все** заказы в статусе `unpaid`, по которым есть **успешный** (`succeeded`) платёж. Выведи: `id` заказа, `email` клиента, `total` заказа, время платежа (`created_at` из payments).',
      hints: [
        'Соедини три таблицы: orders → payments (`p.order_id = o.id`) → customers (`c.id = o.customer_id`).',
        "Условия: `o.status = 'unpaid' AND p.status = 'succeeded'`.",
        `\`${STUCK}\``,
      ],
      solution: STUCK,
      explanation: `Затронуто заказов: ${facts.stuckCount}, все сегодня, оплата картой, платежи с ${facts.stuckFirst.slice(11, 16)} UTC. Это не ошибка одной клиентки, а системная проблема: магазин не получил подтверждение оплаты. Повод эскалировать в L3 с повышенным приоритетом.`,
    },
    {
      id: 'scale',
      prompt: 'Для эскалации: **сколько заказов** затронуто (unpaid при успешном платеже)? Введи число.',
      answer: { accept: [String(facts.stuckCount)], normalize: 'number', label: 'Заказов:' },
      hints: ["Посчитай строки прошлого запроса или оберни в COUNT: `SELECT COUNT(*) FROM orders o JOIN payments p ON p.order_id = o.id WHERE o.status = 'unpaid' AND p.status = 'succeeded';`"],
      solution: "SELECT COUNT(*) FROM orders o JOIN payments p ON p.order_id = o.id WHERE o.status = 'unpaid' AND p.status = 'succeeded';",
    },
    {
      id: 'escalation',
      prompt: `Напиши **эскалацию в L3** (по-русски или по-английски), 5–8 строк. Обязательно: номер заказа Emily (${facts.emilyOrder}) и что видит клиент; статус платежа и заказа в базе; **масштаб** (сколько заказов затронуто, время); какие запросы ты выполнил; что нужно от L3. Без лишних эмоций и догадок.`,
      write: {
        lang: 'ru',
        minWords: 35,
        rows: 10,
        template: 'Тикет: ZD-4821, Emily Carter (emily.carter@outlook.com)\nЧто видит клиент: \nЧто в базе: \nМасштаб: \nЧто проверено: \nЧто нужно от L3: ',
        rubric: [
          { label: `номер заказа Emily (${facts.emilyOrder})`, any: [`\\b${facts.emilyOrder}\\b`] },
          { label: 'платёж прошёл (succeeded / списан)', any: ['succeeded', 'успеш', 'прош[её]л', 'списа', 'charged', 'went through'] },
          { label: 'заказ в статусе unpaid', any: ['unpaid', 'не ?оплачен', 'not paid'] },
          { label: `масштаб: другие заказы (${facts.stuckCount} шт. или их номера)`, any: [`\\b${facts.stuckCount}\\b\\s*(заказ|order|шт)`, `(заказ|order)[^\\n]{0,25}\\b${facts.stuckCount}\\b`, 'три заказ', '\\bthree\\b', ...facts.stuckIds.slice(1).map((n) => `\\b${n}\\b`)] },
          { label: 'время (ЧЧ:ММ)', any: ['\\b\\d{1,2}:\\d{2}\\b'] },
          { label: 'что проверено (запросы / таблицы)', any: ['провер', 'запрос', '\\bsql\\b', 'select', 'payments', 'checked', 'query'] },
          { label: 'что нужно от L3', any: ['прошу', 'просьба', 'нужно', 'надо', 'проверьте', 'исправ', 'обнов', 'синхрон', 'please', 'need', 'investigate', 'fix'] },
        ],
      },
      hints: [
        'Иди по шаблону: что видит клиент → что в базе → масштаб → что проверено → что нужно от L3.',
        `Факты: заказ ${facts.emilyOrder} — unpaid; платёж ${facts.emilyPay} — succeeded, ${facts.emilyTotal}, ${facts.emilyPayTime.slice(11, 16)} UTC; таких заказов ${facts.stuckCount}.`,
        'От L3: найти причину (почему не обновился статус), обновить статусы затронутых заказов, проверить, не продолжается ли проблема.',
      ],
      solution: `Тикет: ZD-4821, Emily Carter (emily.carter@outlook.com), приоритет high.
Что видит клиент: деньги списаны, а заказ ${facts.emilyOrder} на сайте в статусе unpaid.
Что в базе: заказ ${facts.emilyOrder} — unpaid, total ${facts.emilyTotal}; платёж ${facts.emilyPay} — succeeded, ${facts.emilyTotal}, card, ${facts.emilyPayTime.slice(11, 16)} UTC.
Масштаб: ${facts.stuckCount} заказа сегодня (${facts.stuckIds.join(', ')}) в статусе unpaid при успешном платеже, платежи с ${facts.stuckFirst.slice(11, 16)} UTC, все по карте.
Что проверено: запросы к customers, orders и payments (JOIN orders и payments, status = unpaid и succeeded).
Что нужно от L3: найти причину, почему статус заказов не обновился после оплаты, обновить статусы затронутых заказов и проверить, не продолжается ли проблема. Клиентке ответил, что платить второй раз не нужно.`,
    },
  ],
  quiz: [
    {
      id: 'q-sum',
      type: 'sql',
      prompt: 'Одним запросом посчитай **общую сумму** (`total`) всех затронутых заказов (unpaid при успешном платеже).',
      solution: "SELECT SUM(o.total) FROM orders o JOIN payments p ON p.order_id = o.id WHERE o.status = 'unpaid' AND p.status = 'succeeded';",
      explanation: `Сумма — ${facts.stuckSum}. Финансам и L3 полезно знать масштаб и в деньгах.`,
    },
    {
      id: 'q-en-reply',
      type: 'text',
      prompt: 'Как по-английски сказать Emily: «Мы видим ваш платёж. Платить второй раз не нужно»? (ключевые слова: payment, see/received, twice/again)',
      answer: { accept: ['We can see your payment. You do not need to pay twice.'], normalize: 'keywords', keywords: [['payment'], ['see', 'receiv', 'confirm', 'found', 'went through'], ['twice', 'again', 'second']] },
      explanation: '*We can see your payment. You don\'t need to pay again.* — коротко и снимает главный страх клиента.',
    },
    {
      id: 'q-update',
      type: 'choice',
      prompt: "Можно ли L2 самому выполнить `UPDATE orders SET status = 'paid' WHERE id = 1057`, чтобы клиентка была довольна?",
      options: ['Да, это быстрее всего', 'Нет: у L2 доступ только на чтение, а причина системная — эскалировать в L3 с фактами', 'Да, если потом написать об этом в тикете'],
      correct: 1,
      explanation: 'Ручные правки данных на проде делает L3/разработка по процессу. К тому же проблема у нескольких заказов — нужна причина, а не заплатка.',
    },
    {
      id: 'q-time',
      type: 'text',
      prompt: 'Во сколько (UTC) прошёл платёж Emily? Формат ЧЧ:ММ.',
      answer: { accept: [facts.emilyPayTime.slice(11, 16)], normalize: 'keywords', keywords: [[facts.emilyPayTime.slice(11, 16)]] },
      explanation: `${facts.emilyPayTime.slice(11, 16)} UTC — время всегда указывай с часовым поясом.`,
    },
  ],
  glossary: [
    { ru: 'Списать деньги', en: 'to charge', def: '*I was charged* — с меня списали деньги.' },
    { ru: 'Платёж прошёл', en: 'payment went through / succeeded', def: 'Платёжная система подтвердила списание.' },
    { ru: 'Уведомление о событии', en: 'webhook', def: 'Автоматическое сообщение от одной системы другой («платёж прошёл»).' },
    { ru: 'Масштаб', en: 'scope / impact', def: 'Сколько клиентов и заказов затронуто и с какого времени.' },
  ],
};
export default lesson;
