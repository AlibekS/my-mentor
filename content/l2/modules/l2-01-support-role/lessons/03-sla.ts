import type { LessonDef } from '../../../../../src/content/types';
import { HOME, SLA_FIRST_RESPONSE_MIN, SLA_MD, hm, ticketAccept, ticketFiles, timeAccept, timeKeywords, toMin, type TicketSpec } from '../data';

const NOW = '14:30';

const queue: TicketSpec[] = [
  {
    id: 'ZD-2201',
    created: '2026-11-04 09:40',
    customer: 'Berlin Coffee GmbH',
    plan: 'Business',
    requester: 'anna.k@berlin-coffee.de',
    subject: 'Письма о заказах уходят с задержкой 3–4 часа',
    status: 'Open',
    priority: 'P2',
    assignee: 'L2',
    body: 'Покупатели получают письмо «Заказ принят» через несколько часов после оплаты.',
  },
  {
    id: 'ZD-2202',
    created: '2026-11-04 14:05',
    customer: 'Warsaw Bikes',
    plan: 'Enterprise',
    requester: 'piotr@warsawbikes.pl',
    subject: 'Покупатели не могут оформить заказ — ошибка на шаге доставки',
    status: 'New',
    priority: 'P1',
    assignee: 'L2',
    body: 'После выбора доставки — белый экран. Заказов нет уже 20 минут.',
  },
  {
    id: 'ZD-2203',
    created: '2026-11-04 11:02',
    customer: 'Berlin Coffee GmbH',
    plan: 'Business',
    requester: 'anna.k@berlin-coffee.de',
    subject: 'Прошу созвониться по настройке доставки',
    status: 'Open',
    priority: 'P3',
    assignee: 'L2',
    body: 'Позвоните мне, пожалуйста, завтра в 16:00 по берлинскому времени. Анна.',
  },
];

const t1 = queue[0];
const t1Deadline = hm(toMin(t1.created.slice(11)) + SLA_FIRST_RESPONSE_MIN[2]);
const t2 = queue[1];
const t2Left = toMin(t2.created.slice(11)) + SLA_FIRST_RESPONSE_MIN[1] - toMin(NOW);

/** Отчёт по первым ответам: ticket,priority,created_utc,first_reply_utc */
const replies: [string, number, string, string][] = [
  ['ZD-2210', 1, '08:00', '08:20'],
  ['ZD-2211', 2, '08:15', '10:40'],
  ['ZD-2212', 3, '09:00', '13:30'],
  ['ZD-2213', 1, '10:10', '10:35'],
  ['ZD-2214', 4, '07:00', '12:00'],
];
const breached = replies.filter(([, p, c, r]) => toMin(r) - toMin(c) > SLA_FIRST_RESPONSE_MIN[p]).map(([id]) => id);
if (breached.length !== 1) throw new Error('first-reply.csv: ожидается ровно одно нарушение SLA');
const csv = 'ticket,priority,created_utc,first_reply_utc\n' + replies.map(([id, p, c, r]) => `${id},P${p},${c},${r}`).join('\n') + '\n';

// Берлин в ноябре — UTC+1 (зимнее время)
const CALL_BERLIN = '16:00';
const callUtc = hm(toMin(CALL_BERLIN) - 60);

const scenario = {
  files: {
    ...ticketFiles('queue', queue),
    [`${HOME}/kb/sla.md`]: { content: SLA_MD, owner: 'alibek' },
    [`${HOME}/reports/first-reply.csv`]: { content: csv, owner: 'alibek' },
  },
};

const lesson: LessonDef = {
  id: 'sla',
  title: 'SLA: первый ответ, решение, часовые пояса',
  minutes: 25,
  commands: ['cat', 'grep'],
  scenario,
  tasks: [
    {
      id: 'deadline',
      prompt: `Тикет **${t1.id}** — тариф Business, приоритет P2. Посмотри время создания в тикете и таблицу в \`~/kb/sla.md\`. До какого времени (UTC) нужно дать **первый ответ**? Введи время в формате ЧЧ:ММ.`,
      answer: { accept: timeAccept(t1Deadline), label: 'Дедлайн (UTC):', placeholder: 'ЧЧ:ММ' },
      hints: [`\`cat ~/queue/${t1.id}.txt\` — строка \`Created:\`.`, '`cat ~/kb/sla.md` — у P2 первый ответ за 2 часа.', `Сложи: ${t1.created.slice(11)} + 2:00.`],
      solution: `cat ~/queue/${t1.id}.txt\ncat ~/kb/sla.md\n# ${t1.created.slice(11)} + 2:00 = ${t1Deadline} UTC`,
      explanation: `Создан в ${t1.created.slice(11)} UTC, P2 — 2 часа на первый ответ: **${t1Deadline} UTC**.`,
    },
    {
      id: 'left',
      prompt: `Сейчас **${NOW} UTC**. Тикет **${t2.id}** (P1) ещё без ответа. Сколько **минут** осталось до нарушения SLA по первому ответу? Введи число.`,
      answer: { accept: [String(t2Left)], normalize: 'number', label: 'Минут:' },
      hints: [`\`cat ~/queue/${t2.id}.txt\` — когда создан?`, 'P1 — первый ответ за 30 минут. Найди дедлайн и вычти текущее время.'],
      solution: `cat ~/queue/${t2.id}.txt\n# ${t2.created.slice(11)} + 0:30 = ${hm(toMin(t2.created.slice(11)) + 30)}; ${hm(toMin(t2.created.slice(11)) + 30)} − ${NOW} = ${t2Left} мин`,
      explanation: `Дедлайн ${hm(toMin(t2.created.slice(11)) + 30)} UTC, сейчас ${NOW} — осталось **${t2Left} минут**. Отвечать нужно прямо сейчас, даже если решения ещё нет: «Мы разбираемся, следующее обновление в …».`,
    },
    {
      id: 'breach',
      prompt: 'В отчёте `~/reports/first-reply.csv` — время создания и время первого ответа по пяти тикетам (всё в UTC). У какого тикета SLA по первому ответу **нарушен**? Введи номер.',
      answer: { accept: ticketAccept(breached[0]), label: 'Номер тикета:', placeholder: 'ZD-....' },
      hints: ['`cat ~/reports/first-reply.csv`', 'Для каждой строки посчитай, сколько минут прошло, и сравни с таблицей: P1 — 30, P2 — 120, P3 — 480, P4 — 1440.'],
      solution: 'cat ~/reports/first-reply.csv',
      explanation: `${breached[0]}: P2, ответ дан через 145 минут при норме 120 — нарушение (breach). Остальные уложились.`,
    },
    {
      id: 'timezone',
      prompt: `Клиентка в тикете **ZD-2203** просит позвонить «завтра в ${CALL_BERLIN} по берлинскому времени». Сейчас ноябрь: Берлин живёт по UTC+1. Во сколько это **по UTC**? Введи время ЧЧ:ММ.`,
      answer: { accept: timeAccept(callUtc), label: 'Время (UTC):', placeholder: 'ЧЧ:ММ' },
      hints: ['`cat ~/queue/ZD-2203.txt`', 'UTC+1 значит «на час впереди UTC» — чтобы получить UTC, отними 1 час.'],
      solution: `cat ~/queue/ZD-2203.txt\n# ${CALL_BERLIN} (UTC+1) − 1 ч = ${callUtc} UTC`,
      explanation: `${CALL_BERLIN} по Берлину = **${callUtc} UTC** = ${hm(toMin(callUtc) + 300)} по Астане (UTC+5). В тикете пиши время с поясом: «${callUtc} UTC (${CALL_BERLIN} Berlin)».`,
    },
  ],
  quiz: [
    {
      id: 'q-business-hours',
      type: 'text',
      prompt: 'Тариф Standard: SLA считается только в рабочие часы клиента (пн–пт, 09:00–18:00). Тикет P3 (8 рабочих часов на первый ответ) создан в **пятницу в 16:00** по времени клиента. Когда дедлайн? (день и время)',
      answer: { accept: [], normalize: 'keywords', keywords: [['понедельник', 'пн', 'monday', 'mon'], timeKeywords('15:00')] },
      explanation: 'Пятница 16:00–18:00 — 2 часа, выходные не считаются, остальные 6 часов — с понедельника 09:00. Дедлайн: **понедельник 15:00**.',
    },
    {
      id: 'q-first-response',
      type: 'text',
      prompt: 'Как по-английски называется таймер «первый ответ клиенту»? (два слова)',
      answer: { accept: ['first response', 'first reply', 'first response time', 'first reply time', 'FRT'] },
      explanation: '**First response** (first reply) — первый ответ человека, не автоответ.',
    },
    {
      id: 'q-pause',
      type: 'choice',
      prompt: 'Тикет передан в L3, ждём их анализа. Клиенту делать ничего не нужно. Какой статус поставить, чтобы честно учитывать SLA?',
      options: ['Pending — таймер встанет на паузу', 'On-hold — ждём другую команду, таймер идёт', 'Solved — L3 потом переоткроет'],
      correct: 1,
      explanation: 'Pending — только когда ждём **клиента**. Если ждём L3, это On-hold, и SLA продолжает идти: «спрятать» тикет в Pending — нечестно.',
    },
    {
      id: 'q-almaty',
      type: 'text',
      prompt: 'Клиент из Алматы пишет: «проблема началась в 10:30 по нашему времени» (UTC+5). Сколько это по UTC? (ЧЧ:ММ)',
      answer: { accept: timeAccept('05:30') },
      explanation: 'UTC+5 → отнимаем 5 часов: 10:30 − 5:00 = **05:30 UTC**.',
    },
  ],
  glossary: [
    { ru: 'Соглашение об уровне сервиса', en: 'SLA, service level agreement', def: 'Обещанные клиенту сроки ответа и решения.' },
    { ru: 'Первый ответ', en: 'first response', def: 'Первое сообщение человека клиенту по тикету.' },
    { ru: 'Решение', en: 'resolution', def: 'Проблема решена или дан рабочий обходной путь.' },
    { ru: 'Нарушение SLA', en: 'SLA breach', def: 'Срок из SLA прошёл, а нужного действия не было.' },
    { ru: 'Рабочие часы', en: 'business hours', def: 'Часы, в которые идёт SLA на тарифах без 24/7.' },
    { ru: 'Следующее обновление', en: 'next update', def: 'Обещанное клиенту время, когда он получит новости.' },
  ],
};
export default lesson;
