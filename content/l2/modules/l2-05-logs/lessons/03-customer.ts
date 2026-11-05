import type { LessonDef } from '../../../../../src/content/types';
import { background, buildLog, hm, type LogEntry } from '../data';

const U = 'u-4418';
const O = 'ORD-60533';
const story: LogEntry[] = [
  { sec: hm(8, 5, 10), level: 'INFO', service: 'auth', requestId: 'req-5ab301', userId: U, email: 'marco.rossi@example.it', msg: 'User logged in' },
  { sec: hm(8, 5, 40), level: 'INFO', service: 'api', requestId: 'req-5ab302', userId: U, msg: 'GET /api/products 200' },
  { sec: hm(8, 5, 41), level: 'DEBUG', service: 'cart', requestId: 'req-5ab302', userId: U, msg: 'Cart recalculated items=2' },
  { sec: hm(8, 6, 15), level: 'DEBUG', service: 'cart', requestId: 'req-5ab310', userId: U, msg: 'Cart recalculated items=3' },
  // попытка 1
  { sec: hm(8, 7, 12), level: 'INFO', service: 'api', requestId: 'req-5ab3a9', userId: U, orderId: O, msg: 'POST /api/checkout' },
  { sec: hm(8, 7, 13), level: 'INFO', service: 'checkout', requestId: 'req-5ab3a9', userId: U, orderId: O, msg: 'Order created' },
  { sec: hm(8, 7, 43), level: 'ERROR', service: 'payment', requestId: 'req-5ab3a9', userId: U, orderId: O, msg: 'Payment provider timeout after 30000 ms, nothing charged' },
  // попытка 2
  { sec: hm(8, 9, 30), level: 'INFO', service: 'api', requestId: 'req-77d2e0', userId: U, orderId: O, msg: 'POST /api/checkout' },
  { sec: hm(8, 9, 31), level: 'DEBUG', service: 'checkout', requestId: 'req-77d2e0', userId: U, orderId: O, msg: 'Order already exists, retrying payment' },
  { sec: hm(8, 10, 1), level: 'ERROR', service: 'payment', requestId: 'req-77d2e0', userId: U, orderId: O, msg: 'Payment provider timeout after 30000 ms, nothing charged' },
  // попытка 3 — успешно
  { sec: hm(8, 12, 2), level: 'INFO', service: 'api', requestId: 'req-e81b44', userId: U, orderId: O, msg: 'POST /api/checkout' },
  { sec: hm(8, 12, 4), level: 'INFO', service: 'payment', requestId: 'req-e81b44', userId: U, orderId: O, msg: 'Payment captured' },
  { sec: hm(8, 12, 5), level: 'INFO', service: 'notify', requestId: 'req-e81b44', userId: U, orderId: O, msg: 'Order confirmation email sent' },
];
const { entries, text } = buildLog(background({ seed: 303, from: hm(7, 30), to: hm(9, 0) }), story);
const userEntries = entries.filter((e) => e.userId === U);
const userNoDebug = userEntries.filter((e) => e.level !== 'DEBUG').length;
const userErr = userEntries.filter((e) => e.level === 'ERROR').length;
const captured = userEntries.filter((e) => e.msg === 'Payment captured').length;

const ticket = `Ticket: ZD-8120
From: Marco Rossi <Marco.Rossi@Example.it>
Subject: Charged three times??

Hi,
this morning I tried to pay for my order ${O}.
The page showed "Something went wrong" two times,
the third time it worked.
Was my card charged three times? Please check!

Marco
`;

const lesson: LessonDef = {
  id: 'customer',
  title: 'Ошибки одного клиента: user_id, order_id, request_id',
  minutes: 25,
  commands: ['grep'],
  scenario: { host: 'shop-app-01', files: { '/var/log/shop/app.log': text, '/home/alibek/tickets/ZD-8120.txt': ticket } },
  tasks: [
    {
      id: 'email',
      prompt:
        'Тикет — в `~/tickets/ZD-8120.txt`. Клиент написал email **с большими буквами**, а в логе он может быть записан иначе. Найди в `/var/log/shop/app.log` строку с этим email и введи **user_id** клиента.',
      answer: { accept: [U, `user_id=${U}`], label: 'user_id:' },
      hints: ['`cat ~/tickets/ZD-8120.txt` — email в строке From.', 'Без учёта регистра — флаг `-i`: `grep -i marco.rossi@example.it /var/log/shop/app.log`.'],
      solution: 'cat ~/tickets/ZD-8120.txt\ngrep -i Marco.Rossi@Example.it /var/log/shop/app.log',
      explanation: `В логе email записан маленькими буквами, поэтому без \`-i\` grep ничего бы не нашёл. user_id клиента — \`${U}\`.`,
      tags: ['grep'],
    },
    {
      id: 'no-debug',
      prompt: `Выведи **все строки клиента** \`${U}\`, **кроме** отладочных (\`DEBUG\`) — они только мешают читать.`,
      check: {
        type: 'custom',
        fn: (_sh, last) => {
          if (!last) return false;
          const out = last.stdout.split('\n').filter((l) => l.trim());
          return out.length === userNoDebug && out.every((l) => l.includes(U) && !l.includes('DEBUG'));
        },
      },
      hints: [`Сначала строки клиента: \`grep user_id=${U} файл\`.`, 'Убрать строки со словом — `grep -v`. Соедини пайпом.', `\`grep user_id=${U} /var/log/shop/app.log | grep -v DEBUG\``],
      solution: `grep user_id=${U} /var/log/shop/app.log | grep -v DEBUG`,
      explanation: `Осталось ${userNoDebug} строк: вход, просмотр товаров и три попытки оплаты. Читать стало намного проще.`,
      tags: ['grep', 'pipes'],
    },
    {
      id: 'count-errors',
      prompt: `Сколько строк уровня **ERROR** у клиента \`${U}\`? Выведи число командой.`,
      check: { type: 'outputNumber', value: userErr },
      hints: ['Сначала фильтр по клиенту, потом подсчёт ошибок.', `\`grep user_id=${U} /var/log/shop/app.log | grep -c ERROR\``],
      solution: `grep user_id=${U} /var/log/shop/app.log | grep -c ERROR`,
      explanation: `У клиента ${userErr} ошибки. Если посчитать \`grep -c ERROR\` по всему файлу — получишь ошибки всех клиентов, это не то.`,
      tags: ['grep', 'pipes'],
    },
    {
      id: 'charged',
      prompt:
        'Клиент спрашивает по-английски: *«Was my card charged three times?»* Прочитай сообщения его попыток оплаты в логе. **Сколько раз деньги действительно списались?** Введи число.',
      answer: { accept: [String(captured)], normalize: 'number', label: 'Списаний:' },
      hints: [`Посмотри строки сервиса оплаты клиента: \`grep user_id=${U} /var/log/shop/app.log | grep payment\`.`, '*Payment captured* — оплата списана; *nothing charged* — ничего не списано.'],
      solution: `grep user_id=${U} /var/log/shop/app.log | grep payment`,
      explanation: `Две попытки закончились *Payment provider timeout … nothing charged* — провайдер не ответил, деньги не списаны. Третья — *Payment captured*. Итого списание одно. Ответ клиенту: «Your card was charged only once».`,
      tags: ['grep'],
    },
  ],
  quiz: [
    {
      id: 'q-v',
      type: 'text',
      prompt: 'Какой флаг grep показывает строки, где шаблона **нет**?',
      answer: { accept: ['-v', 'v', '--invert-match'] },
      explanation: '`-v` — invert match. Например, `grep -v DEBUG`.',
    },
    {
      id: 'q-count-cmd',
      type: 'command',
      prompt: `Посчитай, сколько строк в \`/var/log/shop/app.log\` относится к клиенту \`${U}\`.`,
      scenario: { files: { '/var/log/shop/app.log': text } },
      solution: `grep -c user_id=${U} /var/log/shop/app.log`,
      explanation: `\`grep -c user_id=${U} файл\` или \`grep … | wc -l\` — результат одинаковый.`,
    },
    {
      id: 'q-order',
      type: 'choice',
      prompt: 'Клиент пишет: «ваш сайт не работает» — без деталей. С чего начать?',
      options: ['Сразу искать в логе слово ERROR за весь день', 'Попросить номер заказа или email и время проблемы', 'Закрыть тикет: мало информации'],
      correct: 1,
      explanation: 'Без зацепки (order_id, email, время) ошибку одного клиента среди тысяч строк не найти. Вежливо попроси детали.',
    },
    {
      id: 'q-why-id',
      type: 'text',
      prompt: 'Ты нашёл строку с ошибкой клиента. По какому идентификатору лучше всего собрать **всю цепочку** этого запроса через разные сервисы?',
      answer: { accept: ['request_id', 'request id', 'requestid', 'реквест айди', 'trace_id', 'trace id', 'correlation_id', 'correlation id', 'req'] },
      explanation: '`request_id` одинаковый у всех строк одного запроса, в каком бы сервисе они ни были записаны.',
    },
  ],
  glossary: [
    { ru: 'Без учёта регистра', en: 'case-insensitive (-i)', def: 'Marco и marco считаются одинаковыми.' },
    { ru: 'Инвертировать поиск', en: 'invert match (-v)', def: 'Показать строки, где шаблона нет.' },
    { ru: 'Списание', en: 'charge / capture', def: 'Деньги действительно сняты с карты клиента.' },
    { ru: 'Повторная попытка', en: 'retry', def: 'Клиент или система повторяет действие после ошибки.' },
  ],
};
export default lesson;
