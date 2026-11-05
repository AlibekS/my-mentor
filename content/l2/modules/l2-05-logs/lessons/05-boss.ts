import type { LessonDef } from '../../../../../src/content/types';
import { almaty, background, buildLog, hm, type LogEntry } from '../data';

// Клиент оплатил ORD-77120: провайдер списал деньги, но ответ payment → checkout не дошёл (таймаут),
// сайт показал «Payment failed», заказ остался PENDING_PAYMENT.
const RID = 'req-9b27e1';
const U = 'u-5521';
const O = 'ORD-77120';
const TX = 'PBX-3318842';
const ERR_AT = hm(10, 41, 35);

const apiStory: LogEntry[] = [
  { sec: hm(10, 41, 2), level: 'INFO', service: 'api', requestId: RID, userId: U, orderId: O, msg: 'POST /api/checkout' },
  { sec: hm(10, 41, 2), level: 'INFO', service: 'checkout', requestId: RID, userId: U, orderId: O, msg: 'Order created, status PENDING_PAYMENT' },
  { sec: ERR_AT, level: 'ERROR', service: 'api', requestId: RID, userId: U, orderId: O, msg: 'Payment step failed: upstream timeout after 30 s, returned 502 to client' },
  { sec: ERR_AT + 1, level: 'WARN', service: 'checkout', requestId: RID, userId: U, orderId: O, msg: 'Order left in status PENDING_PAYMENT' },
];
const payStory: LogEntry[] = [
  { sec: hm(10, 41, 3), level: 'INFO', service: 'payment', requestId: RID, userId: U, msg: 'Charging card: amount=45900 KZT provider=paybox' },
  { sec: hm(10, 41, 5), level: 'INFO', service: 'payment', requestId: RID, userId: U, msg: `Provider response: SUCCESS transaction_id=${TX}` },
  { sec: hm(10, 41, 5), level: 'INFO', service: 'payment', requestId: RID, userId: U, msg: 'Sending payment result to checkout service' },
  { sec: ERR_AT, level: 'ERROR', service: 'payment', requestId: RID, userId: U, msg: 'Callback to checkout service timed out after 30000 ms, result not delivered' },
];

const bg = background({ seed: 505, from: hm(10, 0), to: hm(11, 30) }).map((e) => (e.service === 'payment' ? { ...e, orderId: undefined } : e));
const api = buildLog(bg.filter((e) => e.service !== 'payment'), apiStory);
const pay = buildLog(bg.filter((e) => e.service === 'payment'), payStory);
const ridCount = [...api.lines, ...pay.lines].filter((l) => l.includes(RID)).length;

const ticket = `Ticket: ZD-8842   Priority: High
From: Daniyar S. <daniyar.s@example.kz>
Subject: Money taken but order NOT paid!!!

Hi,
yesterday at about 15:40 (Almaty time) I paid 45 900 KZT for order ${O}.
The money was taken from my card - I have an SMS from my bank.
But the website showed "Payment failed" and the order status is still
"Pending payment". Please fix it or refund my money.

Daniyar
`;

const lesson: LessonDef = {
  id: 'boss',
  kind: 'boss',
  title: 'Деньги списали, а заказ не оплачен',
  minutes: 40,
  incident: { ticket: `ZD-8842: «Money taken but order NOT paid» (${O})`, severity: 'SEV3', customer: 'Daniyar S., Казахстан' },
  commands: ['cat', 'grep'],
  scenario: {
    host: 'shop-app-01',
    files: {
      '/var/log/shop/api.log': api.text,
      '/var/log/shop/payment.log': pay.text,
      '/home/alibek/tickets/ZD-8842.txt': ticket,
    },
  },
  tasks: [
    {
      id: 'rid',
      prompt: 'Прочитай тикет `~/tickets/ZD-8842.txt` и найди заказ клиента в `/var/log/shop/api.log`. Введи **request_id** запроса оплаты.',
      answer: { accept: [RID, `request_id=${RID}`], label: 'request_id:' },
      hints: ['`cat ~/tickets/ZD-8842.txt` — номер заказа начинается с ORD-.', `\`grep ${O} /var/log/shop/api.log\``],
      solution: `cat ~/tickets/ZD-8842.txt\ngrep ${O} /var/log/shop/api.log`,
      explanation: `Все строки заказа в api.log — с одним request_id: \`${RID}\`.`,
      tags: ['grep'],
    },
    {
      id: 'both-logs',
      prompt: 'Выведи **все строки этого запроса из обоих логов** (`api.log` и `payment.log`) **одной командой** — получится полная цепочка.',
      check: {
        type: 'custom',
        fn: (_sh, last) => {
          if (!last) return false;
          const out = last.stdout.split('\n').filter((l) => l.trim());
          return out.length === ridCount && out.every((l) => l.includes(RID)) && last.stdout.includes(TX) && last.stdout.includes('Payment step failed');
        },
      },
      hints: ['grep может искать сразу в нескольких файлах: перечисли их через пробел.', `\`grep ${RID} /var/log/shop/api.log /var/log/shop/payment.log\``, `Короче — через звёздочку: \`grep ${RID} /var/log/shop/*.log\`.`],
      solution: `grep ${RID} /var/log/shop/api.log /var/log/shop/payment.log`,
      explanation: `${ridCount} строк одного запроса из двух сервисов. В начале каждой строки grep пишет имя файла — видно, кто что сообщил.`,
      tags: ['grep'],
    },
    {
      id: 'tx',
      prompt:
        'Прочитай английские сообщения `payment`. Ответил ли платёжный провайдер успехом? Введи **transaction_id** — номер транзакции у провайдера. Это доказательство списания для L3.',
      answer: { accept: [TX, `transaction_id=${TX}`], label: 'transaction_id:' },
      hints: [`\`grep ${RID} /var/log/shop/payment.log\``, '*Provider response: SUCCESS* — провайдер ответил «успешно»; рядом `transaction_id=…`.'],
      solution: `grep ${RID} /var/log/shop/payment.log`,
      explanation: `Провайдер списал деньги (*SUCCESS*, \`${TX}\`). Но потом *Callback to checkout service timed out … result not delivered* — сервис оплаты не смог за 30 секунд передать результат сервису заказов. Поэтому сайт показал ошибку, а заказ остался «Pending payment». Клиент прав.`,
      tags: ['grep'],
    },
    {
      id: 'almaty',
      prompt: 'Сверим с тикетом. Во сколько **по Алматы** (UTC+5) клиент получил ошибку? Возьми время строки `ERROR` из `api.log` и введи часы и минуты.',
      answer: { accept: [], normalize: 'keywords', keywords: [[almaty(ERR_AT)]], label: 'Время в Алматы:', placeholder: 'ЧЧ:ММ' },
      hints: [`\`grep ${RID} /var/log/shop/api.log | grep ERROR\``, 'Время в логе — UTC (буква Z). Прибавь 5 часов.'],
      solution: `grep ${RID} /var/log/shop/api.log | grep ERROR`,
      explanation: `10:41:35 UTC + 5 = ${almaty(ERR_AT)} по Алматы — совпадает с «about 15:40» из тикета. Значит, мы нашли именно его запрос.`,
    },
    {
      id: 'escalation',
      prompt:
        'Напиши **эскалацию в L3** (по-русски, английские сообщения из логов можно цитировать). Обязательно: заказ и клиент, **request_id**, **transaction_id** или факт успешного списания, **хронология с временем UTC** (минимум две строки), **где оборвалась цепочка** и **что нужно от L3**.',
      write: {
        lang: 'ru',
        minWords: 35,
        rows: 12,
        rubric: [
          { label: `Номер заказа ${O}`, any: [O] },
          { label: `request_id ${RID}`, any: [RID] },
          { label: 'Доказательство списания: transaction_id или ответ провайдера SUCCESS', any: [TX, 'success', 'списан', 'списал', 'успешн'] },
          { label: 'Хронология: минимум два события со временем 10:41 (UTC)', any: ['10:41'], minMatches: 2 },
          { label: 'Где оборвалось: callback / таймаут к checkout', any: ['timed? ?out', 'тайм-?аут', 'callback', 'колбэк', 'не дош[её]л', 'не доставлен', 'not delivered'] },
          { label: 'Что нужно от L3 (обновить статус, проверить, вернуть деньги…)', any: ['обнов', 'исправ', 'перевед', 'провер', 'подтверд', 'возврат', 'вернуть', 'refund', 'статус.*paid', 'отметить'] },
        ],
        template: `Тикет ZD-8842, клиент:
Заказ:
request_id:
Что видит клиент:

Хронология (UTC):
-
-

Где оборвалось:
Что прошу у L3: `,
      },
      hints: [
        'Хронология — это строки «время UTC — сервис — что произошло», в порядке времени. Возьми их из вывода grep по request_id.',
        'Доказательство — transaction_id из payment.log. Где оборвалось — последняя ERROR в payment.log.',
        'Что попросить: проверить платёж у провайдера по transaction_id и перевести заказ в «оплачен» (или вернуть деньги).',
      ],
      solution: `Тикет ZD-8842, клиент Daniyar S. (user_id ${U}).
Заказ: ${O}, сумма 45900 KZT.
request_id: ${RID}
Что видит клиент: деньги списаны, на сайте "Payment failed", заказ в статусе Pending payment.

Хронология (UTC):
- 10:41:02 api — POST /api/checkout, заказ создан (PENDING_PAYMENT)
- 10:41:05 payment — Provider response: SUCCESS, transaction_id=${TX} (деньги списаны)
- 10:41:35 payment — Callback to checkout service timed out after 30000 ms, result not delivered
- 10:41:35 api — Payment step failed, клиенту вернули 502 (15:41 по Алматы)

Где оборвалось: результат оплаты не дошёл от payment до checkout (таймаут callback).
Что прошу у L3: подтвердить платёж ${TX} у провайдера и перевести заказ в статус «оплачен»; если нельзя — оформить возврат.`,
      explanation: 'L3 получает всё сразу: какой заказ, какой запрос, доказательство списания, точное место сбоя и конкретную просьбу. Им не нужно заново искать по логам.',
      tags: ['escalation'],
    },
  ],
  quiz: [
    {
      id: 'q-break',
      type: 'text',
      prompt: 'Одной фразой: где оборвалась цепочка оплаты в этом тикете? (проверяются ключевые слова: что не дошло / таймаут)',
      answer: {
        accept: [],
        normalize: 'keywords',
        keywords: [
          ['callback', 'колбэк', 'checkout', 'чекаут', 'заказ', 'результат', 'ответ', 'payment', 'оплат'],
          ['тайм', 'timeout', 'timed out', 'не дош', 'не достав', 'не получ', 'не передал', 'not delivered'],
        ],
      },
      explanation: 'Провайдер списал деньги, но сервис оплаты не смог за 30 секунд передать результат сервису заказов (callback timed out) — заказ остался неоплаченным.',
    },
    {
      id: 'q-success',
      type: 'text',
      prompt: 'Что означает строка `Provider response: SUCCESS transaction_id=PBX-…` для клиента?',
      answer: { accept: [], normalize: 'keywords', keywords: [['успеш', 'прош', 'списан', 'списал', 'success', 'одобр', 'снят', 'charged']] },
      explanation: 'Провайдер успешно провёл платёж — деньги с карты списаны. transaction_id — номер этой операции у провайдера.',
    },
    {
      id: 'q-grep-both',
      type: 'command',
      prompt: 'Выведи строки с `ERROR` сразу из обоих логов: `/var/log/shop/api.log` и `/var/log/shop/payment.log`.',
      scenario: { files: { '/var/log/shop/api.log': api.text, '/var/log/shop/payment.log': pay.text } },
      solution: 'grep ERROR /var/log/shop/api.log /var/log/shop/payment.log',
      explanation: 'Перечисли файлы через пробел или используй `/var/log/shop/*.log` — grep подпишет каждую строку именем файла.',
    },
    {
      id: 'q-reply',
      type: 'choice',
      prompt: 'Что ответить клиенту, пока L3 работает над эскалацией?',
      options: [
        '«Ошибок в логах нет, проверьте свою карту»',
        '«Мы видим, что платёж прошёл, но заказ не обновился. Передали инженерам, вернёмся с ответом до конца дня»',
        'Ничего не отвечать, пока L3 не починит',
      ],
      correct: 1,
      explanation: 'Клиент прав, и мы это доказали. Честно подтверждаем проблему, говорим, что делаем, и называем срок ответа.',
    },
  ],
  glossary: [
    { ru: 'Хронология', en: 'timeline', def: 'События по порядку времени: что, где и когда произошло.' },
    { ru: 'Номер транзакции', en: 'transaction id', def: 'Идентификатор операции у платёжного провайдера — доказательство платежа.' },
    { ru: 'Обратный вызов', en: 'callback', def: 'Один сервис сообщает другому результат операции.' },
    { ru: 'Ожидает оплаты', en: 'pending payment', def: 'Статус заказа: оплата ещё не подтверждена.' },
    { ru: 'Возврат денег', en: 'refund', def: 'Возврат списанной суммы клиенту.' },
  ],
};
export default lesson;
