import type { LessonDef } from '../../../../../src/content/types';
import { HOME, PRIORITY_MD, SLA_FIRST_RESPONSE_MIN, SLA_MD, hm, prioAccept, ticketFiles, timeAccept, toMin, type TicketSpec } from '../data';

const queue: TicketSpec[] = [
  {
    id: 'ZD-2501',
    created: '2026-11-04 08:55',
    customer: 'Lisbon Surf Shop',
    plan: 'Standard',
    requester: 'joao@lisbonsurf.pt',
    subject: 'Как поменять валюту витрины на EUR?',
    status: 'New',
    assignee: 'L2',
    category: 'how-to',
    body: 'Подскажите, где переключить валюту магазина.',
  },
  {
    id: 'ZD-2502',
    created: '2026-11-04 09:12',
    customer: 'Nomad Outdoor',
    plan: 'Business',
    requester: 'aidar@nomad-outdoor.kz',
    subject: 'Покупатели не могут оплатить картой',
    status: 'New',
    assignee: 'L2',
    category: 'payments',
    body: 'С 9 утра по UTC оплата картой падает: «Платёж не прошёл, попробуйте позже». Наличные при получении работают.',
  },
  {
    id: 'ZD-2503',
    created: '2026-11-04 09:20',
    customer: 'Almaty Books',
    plan: 'Standard',
    requester: 'dana@almatybooks.kz',
    subject: 'Ошибка оплаты на сайте',
    status: 'New',
    assignee: 'L2',
    category: 'payments',
    body: 'Покупатели жалуются, что не проходит оплата. Пробовали разные карты.',
  },
  {
    id: 'ZD-2504',
    created: '2026-11-04 09:25',
    customer: 'Berlin Coffee GmbH',
    plan: 'Business',
    requester: 'anna.k@berlin-coffee.de',
    subject: 'Опечатка в шаблоне письма',
    status: 'New',
    assignee: 'L2',
    category: 'notifications',
    body: 'В письме «Заказ отправлен» написано «Здраствуйте». Поправьте, пожалуйста.',
  },
  {
    id: 'ZD-2505',
    created: '2026-11-04 09:31',
    customer: 'Warsaw Bikes',
    plan: 'Enterprise',
    requester: 'piotr@warsawbikes.pl',
    subject: 'URGENT: checkout payment failed',
    status: 'New',
    assignee: 'L2',
    category: 'payments',
    body: 'Оплата картой не проходит уже полчаса. Мы теряем заказы. Срочно!',
  },
];

const payments = queue.filter((t) => t.category === 'payments');
const PAY_COUNT = payments.length;
const earliest = [...payments].sort((a, b) => a.created.localeCompare(b.created))[0];
const DEADLINE = hm(toMin(earliest.created.slice(11)) + SLA_FIRST_RESPONSE_MIN[1]);

interface Pay {
  t: string;
  ok: boolean;
  req: string;
  store: string;
  provider: 'cardpay' | 'paybox';
  amount: string;
}
const pays: Pay[] = [
  { t: '09:00:12', ok: true, req: 'req_p0001', store: 'nomad-outdoor', provider: 'cardpay', amount: '45.00' },
  { t: '09:02:31', ok: true, req: 'req_p0042', store: 'warsaw-bikes', provider: 'cardpay', amount: '310.00' },
  { t: '09:04:05', ok: false, req: 'req_p0107', store: 'nomad-outdoor', provider: 'cardpay', amount: '89.90' },
  { t: '09:06:44', ok: false, req: 'req_p0131', store: 'almaty-books', provider: 'cardpay', amount: '12.50' },
  { t: '09:08:10', ok: true, req: 'req_p0150', store: 'berlin-coffee', provider: 'paybox', amount: '24.00' },
  { t: '09:11:57', ok: false, req: 'req_p0188', store: 'warsaw-bikes', provider: 'cardpay', amount: '540.00' },
  { t: '09:15:20', ok: false, req: 'req_p0203', store: 'nomad-outdoor', provider: 'cardpay', amount: '15.00' },
  { t: '09:19:02', ok: false, req: 'req_p0240', store: 'lisbon-surf', provider: 'cardpay', amount: '75.00' },
  { t: '09:22:48', ok: true, req: 'req_p0266', store: 'berlin-coffee', provider: 'paybox', amount: '18.50' },
  { t: '09:27:13', ok: false, req: 'req_p0291', store: 'almaty-books', provider: 'cardpay', amount: '33.00' },
  { t: '09:30:40', ok: false, req: 'req_p0315', store: 'warsaw-bikes', provider: 'cardpay', amount: '129.00' },
];
const ERR = 'ACQUIRER_TIMEOUT';
const payLog =
  pays
    .map((p) =>
      p.ok
        ? `2026-11-04T${p.t}Z INFO  request_id=${p.req} store=${p.store} provider=${p.provider} status=approved amount=${p.amount}`
        : `2026-11-04T${p.t}Z ERROR request_id=${p.req} store=${p.store} provider=${p.provider} status=failed amount=${p.amount} error=${ERR} msg="no response from acquirer in 30s"`,
    )
    .join('\n') + '\n';
const failed = pays.filter((p) => !p.ok);
const FAIL_COUNT = failed.length;
const FAIL_STORES = new Set(failed.map((p) => p.store)).size;
const FIRST_FAIL = failed[0].t.slice(0, 5);

const scenario = {
  files: {
    ...ticketFiles('queue', queue),
    [`${HOME}/kb/priority.md`]: { content: PRIORITY_MD, owner: 'alibek' },
    [`${HOME}/kb/sla.md`]: { content: SLA_MD, owner: 'alibek' },
    '/var/log/shopflow/payments.log': payLog,
  },
};

const lesson: LessonDef = {
  id: 'boss',
  kind: 'boss',
  title: 'Утренняя очередь L2',
  minutes: 35,
  incident: { ticket: 'Очередь L2: 5 новых тикетов, несколько магазинов не могут принять оплату картой', severity: 'SEV2', customer: 'магазины на ShopFlow (Nomad Outdoor, Almaty Books, Warsaw Bikes)' },
  commands: ['ls', 'cat', 'grep', 'wc', 'head'],
  scenario,
  tasks: [
    {
      id: 'triage',
      prompt: 'Разбери очередь `~/queue`. Сколько тикетов относятся к категории **payments** (оплата)? Введи число.',
      answer: { accept: [String(PAY_COUNT)], normalize: 'number', label: 'Тикетов про оплату:' },
      hints: ['В каждом тикете есть строка `Category:`.', '`grep "Category: payments" ~/queue/*` — или сразу число: `grep -l "Category: payments" ~/queue/* | wc -l`.'],
      solution: 'grep -l "Category: payments" ~/queue/* | wc -l',
      explanation: `${PAY_COUNT} магазина пишут об одном и том же — это один инцидент, а не ${PAY_COUNT} отдельные проблемы. Тикеты связываем (link) и отвечаем всем согласованно.`,
      tags: ['grep', 'pipes'],
    },
    {
      id: 'priority',
      prompt: 'Какой приоритет у проблемы с оплатой по матрице `~/kb/priority.md`? Введи P1–P4.',
      answer: { accept: prioAccept(1), label: 'Приоритет:', placeholder: 'P1–P4' },
      hints: ['`cat ~/kb/priority.md`', 'Оплата — ключевая функция, затронуто несколько магазинов. Есть ли у покупателей обход для оплаты картой?'],
      solution: 'cat ~/kb/priority.md\n# оплата + несколько магазинов (High) × нет обхода, теряются продажи (High) = P1',
      explanation: '**P1**: Impact High (ключевая функция, несколько клиентов) × Urgency High (магазины теряют продажи прямо сейчас). Наличные при получении — не полноценный обход для онлайн-магазина.',
    },
    {
      id: 'sla',
      prompt: 'Первый ответ по P1 — 30 минут. Считаем от **самого раннего** тикета про оплату. До какого времени (UTC) нужно ответить? Введи ЧЧ:ММ.',
      answer: { accept: timeAccept(DEADLINE), label: 'Дедлайн (UTC):', placeholder: 'ЧЧ:ММ' },
      hints: ['`grep Created ~/queue/*` — время создания всех тикетов сразу.', `Из тикетов про оплату самый ранний — ${earliest.id}? Проверь и прибавь 30 минут.`],
      solution: `grep Created ~/queue/*\n# самый ранний тикет про оплату — ${earliest.id} (${earliest.created.slice(11)}); + 0:30 = ${DEADLINE} UTC`,
      explanation: `${earliest.id} создан в ${earliest.created.slice(11)} UTC → первый ответ до **${DEADLINE} UTC**. Сейчас 09:35 — отвечать нужно немедленно (и всем трём магазинам одним согласованным текстом).`,
    },
    {
      id: 'error',
      prompt: 'Посмотри лог платёжного сервиса `/var/log/shopflow/payments.log`. Какой **код ошибки** (`error=`) у неудачных платежей? Введи его.',
      answer: { accept: [ERR, `error=${ERR}`, 'acquirer timeout', 'acquirer_timeout', 'таймаут эквайера', 'тайм-аут эквайера'], label: 'Код ошибки:' },
      hints: ['Неудачные платежи — строки с уровнем `ERROR`.', '`grep ERROR /var/log/shopflow/payments.log`'],
      solution: 'grep ERROR /var/log/shopflow/payments.log',
      explanation: `\`${ERR}\` — эквайер (банк, который обрабатывает карты) не отвечает 30 секунд. Ошибок ${FAIL_COUNT}, с ${FIRST_FAIL} UTC, у ${FAIL_STORES} магазинов, и все — через провайдера **cardpay**; платежи через paybox проходят. Это ключевые факты для L3.`,
      tags: ['grep'],
    },
    {
      id: 'escalate',
      prompt: 'Напиши эскалацию в L3 (на русском). Обязательно: **приоритет**, **что сломано**, **влияние** (сколько магазинов/ошибок), **когда началось** (время UTC), **ошибка и провайдер** из лога, хотя бы один **request id**.',
      write: {
        lang: 'ru',
        minWords: 35,
        rows: 12,
        template: 'Приоритет:\nЧто сломано:\nВлияние:\nКогда началось:\nОшибка в логах:\nRequest id:\nТикеты:\n',
        rubric: [
          { label: 'приоритет P1', any: ['(^|[^\\p{L}])[PР]-?1\\b', 'priority[ \\t]*:?[ \\t]*1\\b', 'приоритет[ \\t]*:?[ \\t]*1\\b', 'urgent'] },
          { label: 'что сломано (оплата)', any: ['оплат', 'плат[её]ж', 'payment', 'checkout'] },
          { label: 'влияние: сколько магазинов или ошибок', any: ['\\d+\\s*(магазин|клиент|тикет|плат[её]ж|ошиб|оплат|неудачн|транзакц)', 'влияние[ \\t]*:[ \\t]*\\S.{5,}', 'impact[ \\t]*:[ \\t]*\\S.{5,}'] },
          { label: 'когда началось (время)', any: ['\\b\\d{1,2}:\\d{2}\\b'] },
          { label: 'ошибка и провайдер (acquirer / cardpay)', any: ['acquirer', 'cardpay', 'эквайер'] },
          { label: 'request id', any: ['req_[0-9a-z]+'] },
        ],
      },
      hints: ['Заполни шаблон по строчке на пункт.', `Цифры для влияния: \`grep -c ERROR /var/log/shopflow/payments.log\`, магазины — в поле store=.`, 'Полезный факт для L3: через какой провайдер падают платежи, а через какой проходят.'],
      solution: `Приоритет: P1
Что сломано: покупатели не могут оплатить заказ картой, «Платёж не прошёл».
Влияние: ${PAY_COUNT} тикета (Nomad Outdoor, Almaty Books, Warsaw Bikes), в логе ${FAIL_COUNT} неудачных платежей у ${FAIL_STORES} магазинов за 30 минут; магазины теряют продажи.
Когда началось: с ${FIRST_FAIL} UTC.
Ошибка в логах: error=${ERR} (no response from acquirer in 30s), все ошибки через провайдера cardpay; платежи через paybox проходят.
Request id: ${failed[0].req}, ${failed[2].req}.
Тикеты: ${payments.map((t) => t.id).join(', ')} — связаны.`,
      tags: ['write'],
    },
  ],
  quiz: [
    {
      id: 'q-incident',
      type: 'choice',
      prompt: 'Три магазина пишут, что не проходит оплата. Как правильно работать с тикетами?',
      options: ['Разобрать каждый отдельно, по порядку поступления', 'Связать тикеты как одну проблему (инцидент), эскалировать один раз со всеми данными и ответить всем согласованно', 'Ответить только самому крупному клиенту'],
      correct: 1,
      explanation: 'Одна причина — одна эскалация. Связанные тикеты позволяют обновить всех клиентов разом, когда появятся новости.',
    },
    {
      id: 'q-count-errors',
      type: 'command',
      prompt: 'Напиши команду, которая выведет **количество** строк с `ACQUIRER_TIMEOUT` в `/var/log/shopflow/payments.log`.',
      scenario: { files: { '/var/log/shopflow/payments.log': payLog } },
      solution: 'grep -c ACQUIRER_TIMEOUT /var/log/shopflow/payments.log',
      explanation: 'Подойдёт и `grep ACQUIRER_TIMEOUT файл | wc -l` — проверка смотрит на результат.',
    },
    {
      id: 'q-public',
      type: 'text',
      prompt: 'Что обязательно написать клиенту в первом ответе по P1, даже если решения пока нет? (время чего?)',
      answer: { accept: [], normalize: 'keywords', keywords: [['следующ', 'next update', 'обновлен', 'апдейт', 'update', 'новост']] },
      explanation: 'Время **следующего обновления** (next update): «Мы разбираемся, следующее обновление — до 10:15 UTC».',
    },
  ],
  glossary: [
    { ru: 'Инцидент', en: 'incident', def: 'Сбой, который затронул клиентов; несколько тикетов об одном сбое связывают с ним.' },
    { ru: 'Эквайер', en: 'acquirer', def: 'Банк, который обрабатывает оплату картами для магазина.' },
    { ru: 'Платёжный провайдер', en: 'payment provider', def: 'Сервис, через который магазин принимает оплату (в тренажёре — cardpay, paybox).' },
    { ru: 'Дежурный инженер', en: 'on-call engineer', def: 'Инженер L3, который отвечает за срочные проблемы в своё дежурство.' },
  ],
};
export default lesson;
