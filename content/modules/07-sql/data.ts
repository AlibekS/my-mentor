import { rng } from '../../shared/logs';

/**
 * БД магазина-SaaS для модуля «SQL для расследований» (диалект SQLite).
 * Детерминированная генерация + намеренные аномалии:
 *  - 3 ноября 14:05–15:05: повторные списания (дубли платежей без idempotency_key) — «босс»;
 *  - заказы «pending», у которых платёж уже succeeded (потерянный webhook);
 *  - заказы, где total не равен сумме позиций;
 *  - клиенты без заказов; платежи на несуществующие заказы; клиенты без страны (NULL).
 */
const r = rng(2026);
const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
const pad = (n: number) => String(n).padStart(2, '0');
const q = (s: string | null) => (s === null ? 'NULL' : `'${s.replace(/'/g, "''")}'`);
const ts = (d: number, h: number, m: number, s = 0) => `2026-11-${pad(d)} ${pad(h)}:${pad(m)}:${pad(s)}`;

const firstNames = ['Aigerim', 'Dias', 'Anna', 'Timur', 'Madina', 'Lukas', 'Sofia', 'Arman', 'Ewa', 'Omar', 'Daniyar', 'Zarina', 'Max', 'Laura', 'Nurlan', 'Emma', 'Yerlan', 'Kamila', 'Jonas', 'Aliya'];
const lastNames = ['Seitkali', 'Bekov', 'Schmidt', 'Kowalska', 'Nurlanov', 'Muller', 'Smith', 'Akhmetova', 'Novak', 'Haddad'];
const countries = ['KZ', 'KZ', 'KZ', 'DE', 'PL', 'US', 'AE'];

export interface Customer { id: number; email: string; name: string; plan: string; country: string | null; created_at: string }
export interface Order { id: number; customer_id: number; status: string; total: number; created_at: string; updated_at: string }
export interface Item { id: number; order_id: number; product_id: number; qty: number; price: number }
export interface Payment { id: number; order_id: number; provider: string; status: string; amount: number; idempotency_key: string | null; created_at: string }

export const products = [
  ['SKU-100', 'Wireless mouse', 12.5], ['SKU-101', 'Mechanical keyboard', 89.0], ['SKU-102', 'USB-C hub', 34.9], ['SKU-103', '27" monitor', 279.0],
  ['SKU-104', 'Laptop stand', 25.0], ['SKU-105', 'Webcam 1080p', 49.9], ['SKU-106', 'Headset', 59.0], ['SKU-107', 'SSD 1TB', 99.0],
  ['SKU-108', 'HDMI cable', 7.5], ['SKU-109', 'Desk lamp', 19.9], ['SKU-110', 'Ergonomic chair', 349.0], ['SKU-111', 'Mouse pad', 9.0],
] as const;

export const customers: Customer[] = [];
for (let i = 1; i <= 48; i++) {
  const fn = firstNames[i % firstNames.length];
  const ln = lastNames[(i * 7) % lastNames.length];
  customers.push({
    id: i,
    email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@${pick(['mail.kz', 'gmail.com', 'company.de', 'outlook.com'])}`,
    name: `${fn} ${ln}`,
    plan: i % 9 === 0 ? 'enterprise' : i % 3 === 0 ? 'pro' : 'free',
    country: i % 17 === 0 ? null : countries[i % countries.length],
    created_at: `2026-${pad(1 + (i % 10))}-${pad(1 + (i % 27))} 10:00:00`,
  });
}
// известный клиент для заданий
customers[6].email = 'aigerim.s@mail.kz';
customers[6].name = 'Aigerim Seitkali';
customers[6].plan = 'pro';
customers[6].country = 'KZ';

export const orders: Order[] = [];
export const items: Item[] = [];
export const payments: Payment[] = [];
let itemId = 1;
let payId = 1;
const noOrders = new Set([5, 13, 29, 41, 47]);
let orderId = 1000;
for (let d = 1; d <= 4; d++) {
  for (let k = 0; k < 70; k++) {
    let cust = 1 + Math.floor(r() * 48);
    while (noOrders.has(cust)) cust = 1 + Math.floor(r() * 48);
    const h = 8 + Math.floor(r() * 14);
    const m = Math.floor(r() * 60);
    if (d === 4 && h > 14) continue;
    orderId++;
    const created = ts(d, h, m, Math.floor(r() * 60));
    const n = 1 + Math.floor(r() * 3);
    let total = 0;
    for (let j = 0; j < n; j++) {
      const p = 1 + Math.floor(r() * products.length);
      const qty = 1 + Math.floor(r() * 2);
      const price = products[p - 1][2];
      items.push({ id: itemId++, order_id: orderId, product_id: p, qty, price });
      total += qty * price;
    }
    total = Math.round(total * 100) / 100;
    const roll = r();
    const status = roll < 0.62 ? 'paid' : roll < 0.8 ? 'shipped' : roll < 0.9 ? 'cancelled' : roll < 0.95 ? 'refunded' : 'pending';
    orders.push({ id: orderId, customer_id: cust, status, total, created_at: created, updated_at: created });
    const provider = r() < 0.6 ? 'kaspi' : 'stripe';
    if (status !== 'pending' && status !== 'cancelled') {
      if (r() < 0.08) payments.push({ id: payId++, order_id: orderId, provider, status: 'failed', amount: total, idempotency_key: `idem-${orderId}-0`, created_at: created });
      payments.push({ id: payId++, order_id: orderId, provider, status: 'succeeded', amount: total, idempotency_key: `idem-${orderId}-1`, created_at: created });
    }
  }
}

// --- аномалия 1 (босс): 3 ноября 14:05–15:05 провайдер stripe отвечал таймаутом, сервис повторял списание без ключа идемпотентности
export const DUP_WINDOW = { from: ts(3, 14, 5), to: ts(3, 15, 5) };
for (const o of orders.filter((o) => o.created_at >= DUP_WINDOW.from && o.created_at < DUP_WINDOW.to)) {
  const ps = payments.filter((p) => p.order_id === o.id && p.status === 'succeeded');
  if (!ps.length) continue;
  ps[0].provider = 'stripe';
  ps[0].idempotency_key = null;
  const t = o.created_at.replace(/:(\d\d)$/, (_m, s) => ':' + pad(Math.min(59, +s + 31)));
  payments.push({ id: payId++, order_id: o.id, provider: 'stripe', status: 'succeeded', amount: o.total, idempotency_key: null, created_at: t });
}

// --- аномалия 2: потерянные webhook — заказ pending, хотя платёж прошёл
const stuck = orders.filter((o) => o.status === 'paid' && o.created_at.startsWith('2026-11-04')).slice(0, 6);
for (const o of stuck) o.status = 'pending';

// --- аномалия 3: total не совпадает с суммой позиций (баг скидок)
const mism = orders.filter((o) => o.status === 'shipped').slice(2, 6);
for (const o of mism) o.total = Math.round((o.total * 0.9) * 100) / 100;

// --- аномалия 4: платежи на несуществующие заказы
payments.push({ id: payId++, order_id: 99001, provider: 'kaspi', status: 'succeeded', amount: 49.9, idempotency_key: 'idem-99001-1', created_at: ts(2, 11, 3) });
payments.push({ id: payId++, order_id: 99002, provider: 'kaspi', status: 'succeeded', amount: 12.5, idempotency_key: 'idem-99002-1', created_at: ts(2, 11, 9) });

payments.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);

export const tickets = [
  [1, 7, 'Списали деньги дважды за заказ', 'P2', 'open', ts(3, 15, 2)],
  [2, 12, 'Не приходит письмо с подтверждением', 'P3', 'closed', ts(2, 9, 40)],
  [3, 22, 'Double charge on my card', 'P2', 'open', ts(3, 15, 30)],
  [4, 9, 'Заказ оплачен, но висит в статусе «ожидает оплаты»', 'P3', 'open', ts(4, 13, 10)],
  [5, 31, 'Как изменить адрес доставки?', 'P4', 'closed', ts(1, 18, 0)],
  [6, 18, 'Charged twice, need refund', 'P2', 'open', ts(3, 16, 11)],
  [7, 36, 'Сумма в заказе меньше, чем в корзине', 'P3', 'open', ts(4, 10, 22)],
] as const;

function sql(): string {
  const out: string[] = [
    'CREATE TABLE customers (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT, plan TEXT, country TEXT, created_at TEXT);',
    'CREATE TABLE products (id INTEGER PRIMARY KEY, sku TEXT UNIQUE, name TEXT, price REAL);',
    'CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES customers(id), status TEXT, total REAL, created_at TEXT, updated_at TEXT);',
    'CREATE TABLE order_items (id INTEGER PRIMARY KEY, order_id INTEGER REFERENCES orders(id), product_id INTEGER REFERENCES products(id), qty INTEGER, price REAL);',
    'CREATE TABLE payments (id INTEGER PRIMARY KEY, order_id INTEGER, provider TEXT, status TEXT, amount REAL, idempotency_key TEXT, created_at TEXT);',
    'CREATE TABLE support_tickets (id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES customers(id), subject TEXT, priority TEXT, status TEXT, created_at TEXT);',
    'CREATE INDEX idx_orders_customer ON orders(customer_id);',
  ];
  out.push('INSERT INTO customers VALUES ' + customers.map((c) => `(${c.id},${q(c.email)},${q(c.name)},${q(c.plan)},${q(c.country)},${q(c.created_at)})`).join(',') + ';');
  out.push('INSERT INTO products VALUES ' + products.map((p, i) => `(${i + 1},${q(p[0])},${q(p[1])},${p[2]})`).join(',') + ';');
  out.push('INSERT INTO orders VALUES ' + orders.map((o) => `(${o.id},${o.customer_id},${q(o.status)},${o.total},${q(o.created_at)},${q(o.updated_at)})`).join(',') + ';');
  out.push('INSERT INTO order_items VALUES ' + items.map((i) => `(${i.id},${i.order_id},${i.product_id},${i.qty},${i.price})`).join(',') + ';');
  out.push('INSERT INTO payments VALUES ' + payments.map((p) => `(${p.id},${p.order_id},${q(p.provider)},${q(p.status)},${p.amount},${q(p.idempotency_key)},${q(p.created_at)})`).join(',') + ';');
  out.push('INSERT INTO support_tickets VALUES ' + tickets.map((t) => `(${t[0]},${t[1]},${q(t[2])},${q(t[3])},${q(t[4])},${q(t[5])})`).join(',') + ';');
  return out.join('\n');
}

export const dataset = sql();

// --- ответы для заданий (вычисляются из тех же данных)
const succeeded = payments.filter((p) => p.status === 'succeeded');
const byOrder = new Map<number, Payment[]>();
for (const p of succeeded) byOrder.set(p.order_id, [...(byOrder.get(p.order_id) ?? []), p]);
const dupOrders = [...byOrder.entries()].filter(([, ps]) => ps.length > 1);
const orderById = new Map(orders.map((o) => [o.id, o]));
export const facts = {
  aigerimId: 7,
  aigerimOrders: orders.filter((o) => o.customer_id === 7).length,
  ordersTotal: orders.length,
  pendingCount: orders.filter((o) => o.status === 'pending').length,
  dupOrders: dupOrders.length,
  dupCustomers: new Set(dupOrders.map(([oid]) => orderById.get(oid)!.customer_id)).size,
  dupRefund: Math.round(dupOrders.reduce((s, [, ps]) => s + ps.slice(1).reduce((x, p) => x + p.amount, 0), 0) * 100) / 100,
  firstDup: dupOrders.map(([, ps]) => ps[1].created_at).sort()[0],
  stuckCount: stuck.length,
  mismatchCount: mism.length,
  noOrderCustomers: customers.filter((c) => !orders.some((o) => o.customer_id === c.id)).length,
  orphanPayments: 2,
  nullCountry: customers.filter((c) => c.country === null).length,
};
