import { rng } from '../../../shared/logs';
import type { FileSpec, Scenario } from '../../../../src/shell/types';

/**
 * Модуль «Коммуникация и английский в поддержке»: тикеты, черновики, база знаний и логи
 * интернет-магазина Tulpar Store. Время — UTC, «сегодня» — 2026-11-05.
 */
const HOME = '/home/alibek';
const pad = (n: number) => String(n).padStart(2, '0');
const own = (content: string): FileSpec => ({ owner: 'alibek', content });

// ---------- общие куски рубрик (щадящие, английский B1) ----------
export const GREETING = ['\\b(hi|hello|hey|dear|greetings)\\b', '\\bgood (morning|afternoon|evening)\\b'];
export const EMPATHY = ['thank', 'sorry', 'apolog', 'understand', 'frustrat', 'inconvenien', 'appreciate', 'unfortunately'];
export const CLOSING = ['regards', '\\bbest\\b', 'sincerely', 'thank', 'cheers', '\\bhave a (nice|good|great)', 'let (us|me) know', 'feel free', 'happy to help', 'here to help', 'contact us'];
export const NEXT_STEP = ['\\bwe will\\b', "\\bwe['’]ll\\b", '\\bi will\\b', "\\bi['’]ll\\b", 'next step', 'going to', '\\bplease\\b', 'we are (checking|looking|working|investigating|fixing)', "we['’]re (checking|looking|working|investigating|fixing)", 'our (team|developers|engineers) (is|are|will)'];
export const ETA = [
  '\\b\\d{1,2}:\\d{2}\\b',
  '\\b\\d+\\s*(minutes?|mins?|hours?|days?)\\b',
  '\\b(business|working) days?\\b',
  '\\b(today|tomorrow|tonight|this week|next week)\\b',
  '\\bwithin\\b',
  '\\bby (the )?end of\\b',
  '\\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\b',
  '\\b(november|nov)\\s*\\d{1,2}\\b',
  '\\b\\d{1,2}\\s*(november|nov)\\b',
];
/** Анти-паттерны: обвинять клиента, грубить */
export const NO_BLAME = [
  'your fault',
  'not our (problem|fault)',
  'you did (it|something|this|everything) wrong',
  'you (made|entered|typed|used) (a |the )?(mistake|wrong)',
  'read the (manual|instructions|faq)',
  'it is your problem',
  "it['’]s your problem",
];

export const TICKET_LINE = (id: string, from: string, subject: string, priority: string, created: string, body: string) =>
  `Ticket: ${id}\nFrom: ${from}\nSubject: ${subject}\nPriority: ${priority}\nCreated: ${created}\n\n${body.trim()}\n`;

// ---------- урок 1: ответ клиенту ----------
export const replyScenario: Scenario = {
  files: {
    [`${HOME}/tickets/ZD-5101.txt`]: own(
      TICKET_LINE('ZD-5101', 'hannah.fischer@gmx.de (Hannah Fischer, plan: pro, Germany)', 'Cannot download my invoice', 'normal', '2026-11-05 08:40 UTC', `
Hello,
I need the invoice for my October order (order 1035) for my accountant.
When I click "Download PDF", nothing happens. I tried two times.
Can you help me? I need it this week.
Hannah`),
    ),
    [`${HOME}/tickets/ZD-5101.notes`]: own(`Internal notes (not visible to the customer)
- dana: known issue — "Download PDF" button is broken since release 4.1.3 (SUP-311).
- dana: fix is planned for tomorrow, 2026-11-06. Workaround: send the PDF to the customer by email.
`),
    [`${HOME}/drafts/reply-1.txt`]: own(`Hi Hannah,

Thank you for contacting us, and sorry for the trouble.
We know about this problem: the "Download PDF" button does not work right now. Our developers are working on a fix.
I attached your invoice for order 1035 to this message.

Best regards,
Dana, Tulpar Store Support
`),
    [`${HOME}/tickets/ZD-5102.txt`]: own(
      TICKET_LINE('ZD-5102', 'james.wilson@gmail.com (James Wilson, plan: pro, UK)', 'App crashes when I open my cart', 'normal', '2026-11-05 09:15 UTC', `
Hi,
Your mobile app closes every time I open my cart. iPhone 13, app version 3.8.0.
I want to buy a gift today. Please fix it!
James`),
    ),
    [`${HOME}/tickets/ZD-5102.notes`]: own(`Internal notes (not visible to the customer)
- marat: known bug in iOS app 3.8.0 — crash on the cart screen (MOB-77).
- marat: fixed in 3.8.1, release in App Store planned for Friday, November 7.
- marat: workaround — order on the website (tulpar.store) in a browser, the cart is the same.
`),
    [`${HOME}/tickets/ZD-5103.txt`]: own(
      TICKET_LINE('ZD-5103', 'mehmet.yilmaz@gmail.com (Mehmet Yilmaz, plan: free, Turkey)', 'Payment declined 3 times!!!', 'normal', '2026-11-05 10:05 UTC', `
I tried to pay 3 times and every time "Payment declined". Your shop is broken!
Mehmet`),
    ),
    [`${HOME}/tickets/ZD-5103.payments`]: own(`payment_id | status | error_code    | created_at
5101       | failed | card_declined | 2026-11-05 09:58:10
5102       | failed | card_declined | 2026-11-05 10:00:41
5103       | failed | card_declined | 2026-11-05 10:02:03
`),
    [`${HOME}/drafts/bad-reply.txt`]: own(`Our shop is not broken. It is not our problem, you used a wrong card.
Check your card.
`),
  },
};

// ---------- урок 2: запросить информацию ----------
export const askScenario: Scenario = {
  files: {
    [`${HOME}/tickets/ZD-5201.txt`]: own(
      TICKET_LINE('ZD-5201', 'noah.davis@gmail.com (Noah Davis, plan: free, USA)', 'NOTHING WORKS', 'normal', '2026-11-05 07:55 UTC', `
Your site doesn't work!!! I can't do anything. Fix it now.`),
    ),
    [`${HOME}/tickets/ZD-5202.txt`]: own(
      TICKET_LINE('ZD-5202', 'chloe.martin@orange.fr (Chloe Martin, plan: business, France)', 'Error at checkout', 'normal', '2026-11-05 08:30 UTC', `
Hi,
Yesterday around 3:15 PM CET I tried to pay for order 1062 and saw a red error "Something went wrong".
Browser: Firefox 132, Windows 11.
Chloe`),
    ),
    [`${HOME}/tickets/ZD-5203.txt`]: own(
      TICKET_LINE('ZD-5203', 'aliya.t@gmail.com (Aliya Tulegenova, plan: free, Kazakhstan)', 'Страница оплаты бесконечно грузится', 'normal', '2026-11-05 05:10 UTC', `
Здравствуйте! Сегодня около 09:40 по времени Астаны пыталась оплатить заказ — страница оплаты
бесконечно грузится, кнопка «Оплатить» крутится и ничего не происходит. Пробовала в Chrome и Safari.
Алия`),
    ),
    [`${HOME}/notes/timezones.txt`]: own(`Часовые пояса клиентов (ноябрь 2026, без летнего времени)
UTC        — время в наших логах и базе
CET        — UTC+1  (Франция, Германия, Польша зимой)
GMT        — UTC+0  (Великобритания зимой)
EST        — UTC-5  (Нью-Йорк зимой)
Astana/Almaty — UTC+5 (весь Казахстан)
`),
  },
};

// ---------- урок 3: база знаний ----------
export const kbScenario: Scenario = {
  files: {
    [`${HOME}/kb/payment-declined.md`]: own(`# Payment declined at checkout
Last reviewed: 2026-10-20

## Symptoms
The customer sees "Payment declined" at checkout.

## Cause
The bank of the customer declined the payment (card_declined, insufficient_funds, expired_card).

## Steps
1. Check the payment and its error_code in the admin panel.
2. Tell the customer that the bank declined the payment.
3. Suggest another card, PayPal, or a call to the bank.

## When to escalate
Many customers get "declined" at the same time — escalate to L3 (possible problem with the payment provider).
`),
    [`${HOME}/kb/reset-password.md`]: own(`# Password reset email not received
Last reviewed: 2026-09-02

## Symptoms
The customer clicks "Forgot password", but the email does not come.

## Steps
1. Ask the customer to check the Spam folder.
2. Check the email address on the account (typos!).
3. Send the reset link again from the admin panel.

## When to escalate
The email is not delivered for 30+ minutes after a resend — escalate to L3 with the email address and time (UTC).
`),
    [`${HOME}/kb/invoice-download.md`]: own(`# How to download an invoice
Last reviewed: 2025-02-14

## Steps
1. Open "My orders".
2. Click "Invoice" next to the order.
`),
    [`${HOME}/kb/change-email.md`]: own(`# How to change the account email
Last reviewed: 2026-08-11

## Steps
1. Open "Profile" → "Account".
2. Enter the new email and click "Save".
3. Confirm the change from the link in the new mailbox.
`),
    [`${HOME}/tickets/ZD-5301.txt`]: own(
      TICKET_LINE('ZD-5301', 'olivia.brown@yahoo.com (Olivia Brown, plan: free, USA)', "I didn't get the password reset email", 'normal', '2026-11-05 11:20 UTC', `
Hi, I clicked "Forgot password" two times, but no email. What can I do?
Olivia`),
    ),
    [`${HOME}/notes/app-crash.txt`]: own(`Факты для новой статьи (iOS-приложение)
- приложение iOS версии 3.8.0 закрывается (crash) при открытии корзины
- причина: известный баг в 3.8.0 (MOB-77)
- исправление: версия 3.8.1, в App Store в пятницу, 7 ноября
- обход: оформить заказ на сайте tulpar.store в браузере (корзина та же)
- эскалировать в L3: если падает и в 3.8.1, или падает не в корзине
`),
  },
};

// ---------- урок 4: эскалация в L3 (логи API) ----------
const r4 = rng(808);
const api4: string[] = [];
const paths = ['GET /api/orders', 'GET /api/catalog', 'POST /api/cart', 'GET /api/profile', 'POST /api/reports/export'];
let firstExportError = '';
let exportErrors = 0;
let firstExportErrorTime = '';
for (let i = 0; i < 46; i++) {
  const sec = 7 * 3600 + 40 * 60 + i * 61 + Math.floor(r4() * 30);
  const time = `2026-11-05T${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}Z`;
  const p = i % 4 === 1 || i % 7 === 3 ? paths[4] : paths[Math.floor(r4() * 4)];
  const rid = `req-${Math.floor(r4() * 0xfffff).toString(16).padStart(5, '0')}`;
  const acc = `acc-${100 + Math.floor(r4() * 40)}`;
  const broken = p === paths[4] && sec >= 8 * 3600 + 12 * 60;
  if (broken) {
    exportErrors++;
    if (!firstExportError) {
      firstExportError = rid;
      firstExportErrorTime = time.slice(11, 16);
    }
    api4.push(`${time} ERROR ${rid} ${p} status=500 account=${acc} duration=${40 + Math.floor(r4() * 60)}ms error="column vat_id does not exist"`);
  } else api4.push(`${time} INFO  ${rid} ${p} status=200 account=${acc} duration=${30 + Math.floor(r4() * 300)}ms`);
}
export const L4 = { exportErrors, firstExportError, firstExportErrorTime, release: '4.2.0' };

export const escalationScenario: Scenario = {
  files: {
    [`${HOME}/tickets/ZD-5401.txt`]: own(
      TICKET_LINE('ZD-5401', 'anna.schmidt@web.de (Anna Schmidt, plan: business, Germany, 25 users)', 'CSV export is broken', 'high', '2026-11-05 09:02 UTC', `
Hello,
Since this morning nobody in our team can export reports to CSV.
We click "Export CSV" and get "Error 500". We tried Chrome and Edge, same result.
We need the reports for a meeting today at 15:00.
Anna`),
    ),
    '/var/log/app/api.log': api4.join('\n') + '\n',
    '/var/log/app/deploy.log': `2026-11-04T16:20:03Z deploy web-frontend 7.3.1 finished OK
2026-11-05T08:05:12Z deploy reports-service ${L4.release} started
2026-11-05T08:09:40Z deploy reports-service ${L4.release} finished OK (migration: add column vat_id — skipped)
`,
  },
};

// ---------- босс: смена дежурного L2 ----------
const r5 = rng(5150);
const api5: string[] = [];
let pdfFirst = '';
let pdfFirstTime = '';
let pdfErrors = 0;
for (let i = 0; i < 40; i++) {
  const sec = 8 * 3600 + 30 * 60 + i * 67 + Math.floor(r5() * 25);
  const time = `2026-11-05T${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}Z`;
  const isPdf = i % 2 === 0;
  const rid = `req-${Math.floor(r5() * 0xfffff).toString(16).padStart(5, '0')}`;
  const acc = `acc-${200 + Math.floor(r5() * 30)}`;
  if (isPdf) {
    const inv = 7000 + i;
    if (sec >= 9 * 3600 + 5 * 60) {
      pdfErrors++;
      if (!pdfFirst) {
        pdfFirst = rid;
        pdfFirstTime = time.slice(11, 16);
      }
      api5.push(`${time} ERROR ${rid} GET /api/invoices/${inv}/pdf status=502 account=${acc} duration=30001ms error="upstream pdf-renderer timeout"`);
    } else api5.push(`${time} INFO  ${rid} GET /api/invoices/${inv}/pdf status=200 account=${acc} duration=${400 + Math.floor(r5() * 500)}ms`);
  } else {
    const p = ['GET /api/orders', 'GET /api/catalog', 'POST /api/cart', 'GET /api/profile'][Math.floor(r5() * 4)];
    api5.push(`${time} INFO  ${rid} ${p} status=200 account=${acc} duration=${30 + Math.floor(r5() * 250)}ms`);
  }
}
export const BOSS = { pdfFirst, pdfFirstTime, pdfErrors, lockedUser: 'marat.ivanov@mail.kz', refundOrder: 2045, refundAmount: 59, refundDate: '2026-11-03' };

const auth: string[] = [
  '2026-11-05T05:58:12Z INFO  login ok user=dias.bekov@gmail.com ip=95.56.10.4',
  '2026-11-05T06:01:03Z WARN  login failed user=marat.ivanov@mail.kz reason=wrong_password ip=37.99.41.7',
  '2026-11-05T06:01:40Z WARN  login failed user=marat.ivanov@mail.kz reason=wrong_password ip=37.99.41.7',
  '2026-11-05T06:02:05Z INFO  login ok user=aliya.t@gmail.com ip=2.135.66.20',
  '2026-11-05T06:02:18Z WARN  login failed user=marat.ivanov@mail.kz reason=wrong_password ip=37.99.41.7',
  '2026-11-05T06:02:51Z WARN  login failed user=marat.ivanov@mail.kz reason=wrong_password ip=37.99.41.7',
  '2026-11-05T06:03:20Z WARN  login failed user=marat.ivanov@mail.kz reason=wrong_password ip=37.99.41.7',
  '2026-11-05T06:03:20Z WARN  account locked user=marat.ivanov@mail.kz reason=too_many_attempts locked_until=2026-11-05T07:03:20Z',
  '2026-11-05T06:15:44Z WARN  login failed user=marat.ivanov@mail.kz reason=account_locked ip=37.99.41.7',
  '2026-11-05T06:40:02Z INFO  login ok user=kamila.ospanova@mail.kz ip=178.89.3.15',
];

export const bossScenario: Scenario = {
  files: {
    [`${HOME}/queue/ZD-6101.txt`]: own(
      TICKET_LINE('ZD-6101', 'marat.ivanov@mail.kz (Марат Иванов, plan: free, Kazakhstan)', 'Не могу войти в аккаунт', 'normal', '2026-11-05 06:20 UTC', `
Здравствуйте! Не могу войти, пишет «Неверный пароль» или «Вход временно недоступен».
Пароль точно правильный, я его поменял вчера. Помогите, пожалуйста.`),
    ),
    [`${HOME}/queue/ZD-6102.txt`]: own(
      TICKET_LINE('ZD-6102', 'laura.garcia@gmail.com (Laura Garcia, plan: free, Spain)', 'Where is my refund?', 'normal', '2026-11-05 08:10 UTC', `
Hi,
I returned my order ${BOSS.refundOrder} last week. Where is my refund? I still don't see the money on my card.
Laura`),
    ),
    [`${HOME}/queue/ZD-6103.txt`]: own(
      TICKET_LINE('ZD-6103', 'chloe.martin@orange.fr (Chloe Martin, plan: business, France, 40 users)', 'Invoices: error 502 for all our users', 'high', '2026-11-05 09:25 UTC', `
Hello,
Since about 10:00 our time (CET) nobody in our company can download invoice PDFs.
The page loads for a long time and then shows "Error 502". We need the invoices for our accounting today.
Chloe`),
    ),
    [`${HOME}/queue/ZD-6104.txt`]: own(
      TICKET_LINE('ZD-6104', 'zarina.abenova@gmail.com (Зарина Абенова, plan: free, Kazakhstan)', 'Как сменить email в аккаунте?', 'low', '2026-11-05 09:40 UTC', `
Добрый день! Хочу указать другую почту в аккаунте. Где это сделать?`),
    ),
    [`${HOME}/kb/change-email.md`]: own(`# How to change the account email
Last reviewed: 2026-08-11

## Steps
1. Open "Profile" → "Account".
2. Enter the new email and click "Save".
3. Confirm the change from the link in the new mailbox.
`),
    '/var/log/app/auth.log': auth.join('\n') + '\n',
    '/var/log/app/api.log': api5.join('\n') + '\n',
  },
};

// БД для босса: заказы и платежи/возвраты
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const ord: string[] = [];
const pay: string[] = [];
const emails = ['laura.garcia@gmail.com', 'chloe.martin@orange.fr', 'marat.ivanov@mail.kz', 'zarina.abenova@gmail.com', 'dias.bekov@gmail.com', 'omar.haddad@gmail.com'];
let pid = 9001;
for (let i = 0; i < 18; i++) {
  const id = 2036 + i;
  const email = id === BOSS.refundOrder ? emails[0] : emails[1 + (i % (emails.length - 1))];
  const total = id === BOSS.refundOrder ? BOSS.refundAmount : [19, 24.9, 39.9, 49, 79, 99][i % 6];
  const day = 20 + Math.floor(i / 2);
  const created = `2026-10-${pad(day)} ${pad(9 + (i % 8))}:${pad((i * 17) % 60)}:00`;
  const refunded = id === BOSS.refundOrder || i % 7 === 2;
  ord.push(`(${id},${q(email)},${q(refunded ? 'refunded' : 'paid')},${total},${q(created)})`);
  pay.push(`(${pid++},${id},'charge','succeeded',${total},${q(created.replace(/:00$/, ':40'))})`);
  if (refunded) {
    const rdate = id === BOSS.refundOrder ? `${BOSS.refundDate} 12:14:05` : `2026-11-0${1 + (i % 3)} 10:0${i % 10}:00`;
    pay.push(`(${pid++},${id},'refund','succeeded',${total},${q(rdate)})`);
  }
}
export const bossDataset = `CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_email TEXT, status TEXT, total REAL, created_at TEXT);
CREATE TABLE payments (id INTEGER PRIMARY KEY, order_id INTEGER REFERENCES orders(id), type TEXT, status TEXT, amount REAL, created_at TEXT);
INSERT INTO orders VALUES ${ord.join(',')};
INSERT INTO payments VALUES ${pay.join(',')};`;
