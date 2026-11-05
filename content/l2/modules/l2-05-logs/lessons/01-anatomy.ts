import type { LessonDef } from '../../../../../src/content/types';
import { background, buildLog, hm, type LogEntry } from '../data';

const RID = 'req-a71c3e';
const story: LogEntry[] = [
  { sec: hm(9, 31, 10), level: 'INFO', service: 'api', requestId: RID, userId: 'u-2310', orderId: 'ORD-60318', msg: 'POST /api/checkout' },
  { sec: hm(9, 31, 11), level: 'INFO', service: 'checkout', requestId: RID, userId: 'u-2310', orderId: 'ORD-60318', msg: 'Order created' },
  { sec: hm(9, 31, 12), level: 'ERROR', service: 'payment', requestId: RID, userId: 'u-2310', orderId: 'ORD-60318', msg: 'Payment rejected: card is blocked by the bank (reported lost)' },
  { sec: hm(9, 33, 40), level: 'INFO', service: 'support', requestId: 'req-55e0b9', userId: 'u-2310', orderId: 'ORD-60318', msg: 'Support chat opened' },
];
const { lines, text } = buildLog(background({ seed: 101, from: hm(9, 0), to: hm(10, 0) }), story);
const firstService = /\[(\w+)\]/.exec(lines[0])![1];
const ridLines = lines.filter((l) => l.includes(RID));

const lesson: LessonDef = {
  id: 'anatomy',
  title: 'Из чего состоит строка лога',
  minutes: 20,
  commands: ['head', 'grep'],
  scenario: { host: 'shop-app-01', files: { '/var/log/shop/app.log': text } },
  tasks: [
    {
      id: 'service',
      prompt: 'Посмотри начало лога `/var/log/shop/app.log`. **Какой сервис** написал самую первую строку? (Сервис — слово в квадратных скобках.)',
      answer: { accept: [firstService, `[${firstService}]`], label: 'Сервис:' },
      hints: ['Начало файла — `head`.', '`head -n 3 /var/log/shop/app.log` — после времени и уровня идёт `[сервис]`.'],
      solution: 'head -n 3 /var/log/shop/app.log',
      explanation: `Первую строку написал сервис \`${firstService}\`. Порядок частей: время → уровень → [сервис] → идентификаторы → msg.`,
      tags: ['head'],
    },
    {
      id: 'request-id',
      prompt:
        'Клиент пишет в тикете: *«Order ORD-60318 — payment failed»*. Найди в логе строку с ошибкой (`ERROR`) по этому заказу и введи её **request_id**.',
      answer: { accept: [RID, `request_id=${RID}`], label: 'request_id:' },
      hints: ['`grep ORD-60318 /var/log/shop/app.log`', 'В строке с `ERROR` найди `request_id=req-…` и скопируй значение.'],
      solution: 'grep ORD-60318 /var/log/shop/app.log',
      explanation: `Ошибка оплаты — в запросе \`${RID}\`. Строка «Support chat opened» тоже про этот заказ, но это **другой** запрос (клиент позже открыл чат).`,
      tags: ['grep'],
    },
    {
      id: 'chain',
      prompt: 'Теперь собери **всю цепочку этого запроса**: выведи все строки лога с найденным request_id (из всех сервисов).',
      check: {
        type: 'custom',
        fn: (_sh, last) => {
          if (!last) return false;
          const out = last.stdout.split('\n').filter((l) => l.trim());
          return out.length === ridLines.length && out.every((l) => l.includes(RID));
        },
      },
      hints: ['Ищи по самому request_id, а не по номеру заказа.', `\`grep ${RID} /var/log/shop/app.log\``],
      solution: `grep ${RID} /var/log/shop/app.log`,
      explanation: `${ridLines.length} строки одного запроса: [api] принял оформление, [checkout] создал заказ, [payment] отклонил оплату. Поиск по order_id дал бы ещё и строку из чата поддержки — другой запрос.`,
      tags: ['grep'],
    },
    {
      id: 'english',
      prompt: 'Прочитай сообщение (`msg`) в строке с ошибкой — оно на английском. **Что случилось** с оплатой? Ответь своими словами по-русски или по-английски.',
      answer: {
        accept: [],
        normalize: 'keywords',
        keywords: [
          ['карт', 'card'],
          ['блок', 'block', 'утер', 'потер', 'lost'],
        ],
        label: 'Что случилось:',
        placeholder: 'например: банк …',
      },
      hints: [`\`grep ${RID} /var/log/shop/app.log | grep ERROR\``, '*card is blocked by the bank* — карта заблокирована банком; *reported lost* — заявлена как утерянная.'],
      solution: `grep ${RID} /var/log/shop/app.log | grep ERROR`,
      explanation: '*Payment rejected: card is blocked by the bank (reported lost)* — оплата отклонена: банк заблокировал карту, её заявили утерянной. Магазин тут ни при чём — клиенту нужна другая карта или звонок в банк.',
      tags: ['grep'],
    },
  ],
  quiz: [
    {
      id: 'q-parts',
      type: 'text',
      prompt: 'Строка: `2026-11-04T10:05:44Z WARN  [cart] request_id=req-0b11aa user_id=u-777 msg="Price changed"`. Какой у неё **уровень**?',
      answer: { accept: ['WARN', 'warning', 'предупреждение'] },
      explanation: 'После времени идёт уровень — `WARN` (предупреждение). `[cart]` — сервис.',
    },
    {
      id: 'q-rid',
      type: 'choice',
      prompt: 'Зачем нужен **request_id**?',
      options: ['Это номер заказа для бухгалтерии', 'Он связывает строки разных сервисов, относящиеся к одному запросу клиента', 'Это пароль пользователя в зашифрованном виде'],
      correct: 1,
      explanation: 'Один запрос → один request_id → его пишут все сервисы, которые запрос обработали. По нему собирается цепочка.',
    },
    {
      id: 'q-user',
      type: 'command',
      prompt: 'Выведи все строки лога `/var/log/shop/app.log` про пользователя `u-2310`.',
      scenario: { files: { '/var/log/shop/app.log': text } },
      solution: 'grep user_id=u-2310 /var/log/shop/app.log',
      explanation: '`grep user_id=u-2310 файл` (или просто `grep u-2310 файл`) — вся активность клиента.',
    },
    {
      id: 'q-service',
      type: 'text',
      prompt: 'В строке `… ERROR [payment] … msg="Insufficient funds"` — какой сервис сообщил об ошибке?',
      answer: { accept: ['payment', '[payment]', 'платежный', 'платёжный', 'оплата', 'сервис оплаты', 'платежный сервис', 'payment service'] },
      explanation: 'Сервис — в квадратных скобках: `[payment]`, сервис оплаты. *Insufficient funds* — недостаточно средств.',
    },
  ],
  glossary: [
    { ru: 'Метка времени', en: 'timestamp', def: 'Дата и время события в начале строки лога.' },
    { ru: 'Уровень лога', en: 'log level', def: 'Насколько серьёзно событие: DEBUG, INFO, WARN, ERROR, FATAL.' },
    { ru: 'Идентификатор запроса', en: 'request id / trace id / correlation id', def: 'Общий id всех строк одного запроса клиента в разных сервисах.' },
    { ru: 'Сообщение', en: 'message (msg)', def: 'Текст события — обычно на английском.' },
    { ru: 'Банк-эмитент', en: 'issuing bank', def: 'Банк, который выпустил карту клиента.' },
  ],
};
export default lesson;
