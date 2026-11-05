import { rng } from '../../../shared/logs';

/**
 * Маленькая БД интернет-магазина «Tulpar Store» (SaaS) для модуля «SQL на чтение» (диалект SQLite).
 * Время — UTC, «сегодня» — 2026-11-05. Генерация детерминированная (rng с фиксированным seed).
 *
 * Таблицы: customers (30), orders (~65), payments (~70), support_tickets (14).
 * Намеренная «аномалия» для босса: сегодня 3 заказа по карте остались в статусе unpaid,
 * хотя платёж по ним прошёл (succeeded) — магазин не получил подтверждение от платёжной системы.
 * Один из этих заказов — у Emily Carter (тикет «I was charged but my order shows unpaid»).
 */
const r = rng(606);
const pad = (n: number) => String(n).padStart(2, '0');
const q = (s: string | null) => (s === null ? 'NULL' : `'${s.replace(/'/g, "''")}'`);
const money = (n: number) => Math.round(n * 100) / 100;

export const TODAY = '2026-11-05';

export interface Customer { id: number; email: string; name: string; country: string; plan: string; created_at: string }
export interface Order { id: number; customer_id: number; status: string; total: number; created_at: string }
export interface Payment { id: number; order_id: number; status: string; amount: number; method: string; error_code: string | null; created_at: string }
export interface Ticket { id: number; customer_id: number; subject: string; status: string; priority: string; assignee: string | null; created_at: string }

const people: [string, string, string, string][] = [
  ['Aigerim Nurlanova', 'aigerim.nurlanova@mail.kz', 'KZ', 'pro'],
  ['Dias Bekov', 'dias.bekov@gmail.com', 'KZ', 'free'],
  ['Anna Schmidt', 'anna.schmidt@web.de', 'DE', 'business'],
  ['Timur Akhmetov', 'timur.akhmetov@mail.kz', 'KZ', 'free'],
  ['Emily Carter', 'emily.carter@outlook.com', 'US', 'pro'],
  ['Lukas Muller', 'lukas.muller@gmx.de', 'DE', 'free'],
  ['Madina Seitkali', 'madina.seitkali@mail.kz', 'KZ', 'pro'],
  ['Ewa Kowalska', 'ewa.kowalska@wp.pl', 'PL', 'free'],
  ['Omar Haddad', 'omar.haddad@gmail.com', 'AE', 'business'],
  ['Sofia Rossi', 'sofia.rossi@libero.it', 'IT', 'free'],
  ['Arman Zhaksylyk', 'arman.zh@mail.kz', 'KZ', 'free'],
  ['James Wilson', 'james.wilson@gmail.com', 'GB', 'pro'],
  ['Zarina Abenova', 'zarina.abenova@gmail.com', 'KZ', 'free'],
  ['Jonas Novak', 'jonas.novak@seznam.cz', 'CZ', 'pro'],
  ['Laura Garcia', 'laura.garcia@gmail.com', 'ES', 'free'],
  ['Nurlan Kassymov', 'nurlan.kassymov@mail.kz', 'KZ', 'business'],
  ['Mehmet Yilmaz', 'mehmet.yilmaz@gmail.com', 'TR', 'free'],
  ['Kamila Ospanova', 'kamila.ospanova@mail.kz', 'KZ', 'pro'],
  ['Max Weber', 'max.weber@web.de', 'DE', 'free'],
  ['Aliya Tulegenova', 'aliya.t@gmail.com', 'KZ', 'free'],
  ['Olivia Brown', 'olivia.brown@yahoo.com', 'US', 'free'],
  ['Yerlan Dzhaksybekov', 'yerlan.dz@mail.kz', 'KZ', 'pro'],
  ['Piotr Zielinski', 'piotr.zielinski@wp.pl', 'PL', 'free'],
  ['Sara Ahmed', 'sara.ahmed@gmail.com', 'AE', 'pro'],
  ['Daniyar Omarov', 'daniyar.omarov@mail.kz', 'KZ', 'free'],
  ['Chloe Martin', 'chloe.martin@orange.fr', 'FR', 'business'],
  ['Askar Ibraimov', 'askar.ibraimov@gmail.com', 'KZ', 'free'],
  ['Hannah Fischer', 'hannah.fischer@gmx.de', 'DE', 'pro'],
  ['Bekzat Sultanov', 'bekzat.sultanov@mail.kz', 'KZ', 'free'],
  ['Noah Davis', 'noah.davis@gmail.com', 'US', 'free'],
];

export const customers: Customer[] = people.map(([name, email, country, plan], i) => ({
  id: i + 1,
  name,
  email,
  country,
  plan,
  created_at: `2026-${pad(1 + (i % 10))}-${pad(1 + ((i * 7) % 27))} 09:${pad((i * 13) % 60)}:00`,
}));

export const EMILY = 5;

// ---- заказы: 1–5 ноября, по времени
const prices = [9.9, 14.5, 19, 24.9, 29, 39.9, 49, 59, 79, 99, 129, 149, 199];
const perDay = [12, 13, 13, 13, 14];
export const orders: Order[] = [];
const methods = new Map<number, string>();
let oid = 1001;
for (let d = 1; d <= 5; d++) {
  let min = 8 * 60 + Math.floor(r() * 20);
  for (let k = 0; k < perDay[d - 1]; k++) {
    const x = r();
    let status = x < 0.6 ? 'paid' : x < 0.8 ? 'unpaid' : x < 0.92 ? 'cancelled' : 'refunded';
    if (d === 5 && status === 'refunded') status = 'paid';
    const cust = 1 + Math.floor(r() * customers.length);
    orders.push({
      id: oid,
      customer_id: cust === EMILY ? 6 : cust, // заказы Emily задаём явно ниже
      status,
      total: prices[Math.floor(r() * prices.length)],
      created_at: `2026-11-${pad(d)} ${pad(Math.floor(min / 60))}:${pad(min % 60)}:${pad(Math.floor(r() * 60))}`,
    });
    const m = r();
    methods.set(oid, m < 0.7 ? 'card' : m < 0.9 ? 'paypal' : 'apple_pay');
    oid++;
    min += d === 5 ? 18 + Math.floor(r() * 18) : 30 + Math.floor(r() * 40);
  }
}

// ---- «зависшие» заказы сегодня: оплачены картой, но статус unpaid
const todayPaidCard = orders.filter((o) => o.created_at.startsWith(TODAY) && o.created_at.slice(11) >= '10:00' && o.status === 'paid');
export const stuckOrders: Order[] = todayPaidCard.slice(0, 3);
for (const o of stuckOrders) {
  o.status = 'unpaid';
  methods.set(o.id, 'card');
}
stuckOrders[0].customer_id = EMILY;
stuckOrders[0].total = 129;
// у Emily есть и старый нормальный заказ
const emilyOld = orders.find((o) => o.created_at.startsWith('2026-11-02') && o.status === 'paid')!;
emilyOld.customer_id = EMILY;
// чтобы у других клиентов с зависшими заказами не было путаницы с Emily
for (const o of stuckOrders.slice(1)) if (o.customer_id === EMILY) o.customer_id = 9;

// ---- платежи
const errors = ['card_declined', 'insufficient_funds', 'expired_card'];
const addMin = (t: string, m: number, s = 0) => {
  const [date, time] = t.split(' ');
  const [hh, mm, ss] = time.split(':').map(Number);
  const total = hh * 3600 + mm * 60 + ss + m * 60 + s;
  return `${date} ${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
};
const pays: Omit<Payment, 'id'>[] = [];
const stuckIds = new Set(stuckOrders.map((o) => o.id));
for (const o of orders) {
  const method = methods.get(o.id)!;
  const t0 = addMin(o.created_at, 1, 10);
  const err = () => errors[Math.floor(r() * errors.length)];
  if (stuckIds.has(o.id)) {
    pays.push({ order_id: o.id, status: 'succeeded', amount: o.total, method, error_code: null, created_at: t0 });
  } else if (o.status === 'paid') {
    if (r() < 0.25) {
      pays.push({ order_id: o.id, status: 'failed', amount: o.total, method, error_code: err(), created_at: t0 });
      pays.push({ order_id: o.id, status: 'succeeded', amount: o.total, method, error_code: null, created_at: addMin(t0, 3) });
    } else pays.push({ order_id: o.id, status: 'succeeded', amount: o.total, method, error_code: null, created_at: t0 });
  } else if (o.status === 'refunded') {
    pays.push({ order_id: o.id, status: 'refunded', amount: o.total, method, error_code: null, created_at: t0 });
  } else if (o.status === 'unpaid') {
    const x = r();
    if (x < 0.55) pays.push({ order_id: o.id, status: 'failed', amount: o.total, method, error_code: err(), created_at: t0 });
    else if (x < 0.75) pays.push({ order_id: o.id, status: 'pending', amount: o.total, method, error_code: null, created_at: t0 });
  } else if (o.status === 'cancelled' && r() < 0.5) {
    pays.push({ order_id: o.id, status: 'failed', amount: o.total, method, error_code: err(), created_at: t0 });
  }
}
pays.sort((a, b) => a.created_at.localeCompare(b.created_at));
export const payments: Payment[] = pays.map((p, i) => ({ id: 5001 + i, ...p }));

// ---- тикеты поддержки (часть — на английском)
const custOf = (orderId: number) => orders.find((o) => o.id === orderId)!.customer_id;
const failedPay = payments.find((p) => p.status === 'failed' && p.error_code === 'insufficient_funds' && orders.find((o) => o.id === p.order_id)!.status === 'unpaid')
  ?? payments.find((p) => p.status === 'failed')!;
export const FAILED_ORDER = failedPay.order_id;
export const FAILED_CODE = failedPay.error_code!;
const refunded = orders.find((o) => o.status === 'refunded')!;
export const REFUND_ORDER = refunded.id;

const t = (id: number, customer_id: number, subject: string, status: string, priority: string, assignee: string | null, created_at: string): Ticket => ({ id, customer_id, subject, status, priority, assignee, created_at });
export const tickets: Ticket[] = [
  t(1, 2, 'Не приходит письмо для сброса пароля', 'solved', 'normal', 'dana', '2026-11-01 09:12:00'),
  t(2, 12, 'How do I change my delivery address?', 'solved', 'low', 'alex', '2026-11-01 13:40:00'),
  t(3, 7, 'Промокод не применяется в корзине', 'solved', 'normal', 'marat', '2026-11-02 10:05:00'),
  t(4, custOf(REFUND_ORDER), 'Where is my refund?', 'pending', 'normal', 'alex', '2026-11-02 16:22:00'),
  t(5, 16, 'Нужен счёт с НДС для бухгалтерии', 'solved', 'low', 'dana', '2026-11-03 08:50:00'),
  t(6, 3, 'Cannot download invoice PDF', 'open', 'normal', 'marat', '2026-11-03 11:31:00'),
  t(7, custOf(FAILED_ORDER), 'Payment failed, why?', 'open', 'normal', null, '2026-11-03 18:07:00'),
  t(8, 21, 'Wrong item in my order', 'pending', 'high', 'alex', '2026-11-04 09:15:00'),
  t(9, 18, 'Двойное списание? Проверьте, пожалуйста', 'solved', 'high', 'dana', '2026-11-04 12:44:00'),
  t(10, 26, 'Account locked after password change', 'open', 'high', null, '2026-11-04 15:58:00'),
  t(11, 11, 'Как удалить аккаунт?', 'open', 'low', null, '2026-11-05 08:20:00'),
  t(12, 24, 'Order confirmation email not received', 'open', 'normal', 'marat', '2026-11-05 09:47:00'),
  t(13, 29, 'Не могу добавить вторую карту', 'pending', 'low', 'dana', '2026-11-05 10:30:00'),
  t(14, EMILY, 'I was charged but my order shows unpaid', 'open', 'high', null, '2026-11-05 11:02:00'),
];

function sql(): string {
  const out: string[] = [
    'CREATE TABLE customers (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT, country TEXT, plan TEXT, created_at TEXT);',
    'CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES customers(id), status TEXT, total REAL, created_at TEXT);',
    'CREATE TABLE payments (id INTEGER PRIMARY KEY, order_id INTEGER REFERENCES orders(id), status TEXT, amount REAL, method TEXT, error_code TEXT, created_at TEXT);',
    'CREATE TABLE support_tickets (id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES customers(id), subject TEXT, status TEXT, priority TEXT, assignee TEXT, created_at TEXT);',
  ];
  out.push('INSERT INTO customers VALUES ' + customers.map((c) => `(${c.id},${q(c.email)},${q(c.name)},${q(c.country)},${q(c.plan)},${q(c.created_at)})`).join(',') + ';');
  out.push('INSERT INTO orders VALUES ' + orders.map((o) => `(${o.id},${o.customer_id},${q(o.status)},${o.total},${q(o.created_at)})`).join(',') + ';');
  out.push('INSERT INTO payments VALUES ' + payments.map((p) => `(${p.id},${p.order_id},${q(p.status)},${p.amount},${q(p.method)},${q(p.error_code)},${q(p.created_at)})`).join(',') + ';');
  out.push('INSERT INTO support_tickets VALUES ' + tickets.map((x) => `(${x.id},${x.customer_id},${q(x.subject)},${q(x.status)},${q(x.priority)},${q(x.assignee)},${q(x.created_at)})`).join(',') + ';');
  return out.join('\n');
}

export const dataset = sql();

// ---- ответы для заданий (вычисляются из тех же данных)
const custById = new Map(customers.map((c) => [c.id, c]));
const emilyOrder = stuckOrders[0];
const emilyPay = payments.find((p) => p.order_id === emilyOrder.id)!;
const today = orders.filter((o) => o.created_at.startsWith(TODAY));
export const facts = {
  customers: customers.length,
  orders: orders.length,
  payments: payments.length,
  tickets: tickets.length,
  kzCustomers: customers.filter((c) => c.country === 'KZ').length,
  unassignedOpen: tickets.filter((x) => x.assignee === null && x.status === 'open').length,
  unpaidToday: today.filter((o) => o.status === 'unpaid').length,
  ordersToday: today.length,
  paidSumToday: money(today.filter((o) => o.status === 'paid').reduce((s, o) => s + o.total, 0)),
  failedPayments: payments.filter((p) => p.status === 'failed').length,
  oldestOpenTicket: [...tickets].filter((x) => x.status === 'open').sort((a, b) => a.created_at.localeCompare(b.created_at))[0].id,
  deOrders: orders.filter((o) => custById.get(o.customer_id)!.country === 'DE').length,
  failedOrder: FAILED_ORDER,
  failedCode: FAILED_CODE,
  failedEmail: custById.get(custOf(FAILED_ORDER))!.email,
  refundOrder: REFUND_ORDER,
  emilyOrder: emilyOrder.id,
  emilyTotal: emilyOrder.total,
  emilyOrderTime: emilyOrder.created_at,
  emilyPay: emilyPay.id,
  emilyPayTime: emilyPay.created_at,
  emilyId: EMILY,
  stuckIds: stuckOrders.map((o) => o.id),
  stuckCount: stuckOrders.length,
  stuckFirst: stuckOrders.map((o) => payments.find((p) => p.order_id === o.id)!.created_at).sort()[0],
  stuckSum: money(stuckOrders.reduce((s, o) => s + o.total, 0)),
};
