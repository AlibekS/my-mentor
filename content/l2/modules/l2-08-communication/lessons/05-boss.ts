import type { LessonDef } from '../../../../../src/content/types';
import { BOSS, bossDataset, bossScenario, CLOSING, EMPATHY, GREETING, NO_BLAME } from '../data';

const REFUND_SQL = `SELECT id, type, status, amount, created_at FROM payments WHERE order_id = ${BOSS.refundOrder};`;

const lesson: LessonDef = {
  id: 'boss',
  kind: 'boss',
  title: 'Смена дежурного L2',
  minutes: 50,
  incident: { ticket: 'Очередь L2: ZD-6101…ZD-6104 (RU/EN)', severity: 'SEV3', customer: '4 клиента, среди них бизнес-аккаунт на 40 пользователей' },
  tools: ['terminal', 'sql'],
  commands: ['cat', 'head', 'grep'],
  scenario: bossScenario,
  sql: { dataset: bossDataset },
  tasks: [
    {
      id: 'triage',
      prompt: '⌨ Прочитай очередь `~/queue/`. Какой тикет — **массовая проблема у бизнес-клиента**, которую нужно как можно раньше эскалировать в L3? Введи номер тикета.',
      tool: 'terminal',
      answer: { accept: ['ZD-6103'], normalize: 'keywords', keywords: [['6103']], label: 'Тикет:' },
      hints: ['`head -n 5 ~/queue/*` — шапки всех тикетов: тема, клиент, приоритет.', 'Ищи: business, много пользователей, «for all our users», priority high.'],
      solution: 'head -n 5 ~/queue/*',
      explanation: 'ZD-6103: бизнес-клиент, 40 пользователей, у всех ошибка — и дедлайн сегодня. Собираем факты и эскалируем первым делом; остальное разбираем, пока L3 работает.',
    },
    {
      id: 'login',
      prompt: '⌨ ZD-6101 (Марат, `marat.ivanov@mail.kz`): «не могу войти, пароль правильный». Найди его записи в `/var/log/app/auth.log`. **Почему он не может войти?** Ответь коротко (RU или EN).',
      tool: 'terminal',
      answer: { accept: ['account locked'], normalize: 'keywords', keywords: [['lock', 'блок', 'too_many', 'too many', 'много попыт', 'попыток']], label: 'Причина:' },
      hints: ['`grep marat.ivanov@mail.kz /var/log/app/auth.log`', 'Что случилось после пяти неудачных попыток подряд?'],
      solution: 'grep marat.ivanov@mail.kz /var/log/app/auth.log',
      explanation: 'Пять неверных паролей подряд (возможно, старый пароль сохранён в браузере) → аккаунт заблокирован до 07:03 UTC. Сейчас блокировка уже снята: ответить, что можно войти снова, проверить сохранённый пароль, а если не помнит — сбросить через «Forgot password». Эскалация не нужна.',
    },
    {
      id: 'refund-sql',
      prompt: `🗄 ZD-6102 (Laura): *«I returned my order ${BOSS.refundOrder} last week. Where is my refund?»* Выведи **все платежи** по заказу ${BOSS.refundOrder}: \`id, type, status, amount, created_at\`.`,
      tool: 'sql',
      hints: [`\`WHERE order_id = ${BOSS.refundOrder}\``, `\`${REFUND_SQL}\``],
      solution: REFUND_SQL,
      explanation: `Есть списание (charge) и возврат (refund) на ${BOSS.refundAmount}, статус succeeded, ${BOSS.refundDate}. С нашей стороны деньги вернули; на карте они появятся, когда банк обработает возврат.`,
    },
    {
      id: 'refund-reply',
      prompt: `Ответь Laura **на английском**: приветствие, сочувствие, что ты проверил (возврат **${BOSS.refundAmount}** оформлен **3 ноября**), сколько обычно ждать (банкам нужно **5–10 рабочих дней**), что делать, если денег не будет, вежливое завершение.`,
      write: {
        lang: 'en',
        minWords: 25,
        rows: 9,
        template: 'Hi Laura,\n\n\n\nBest regards,\n',
        rubric: [
          { label: 'приветствие', any: GREETING },
          { label: 'благодарность или сочувствие', any: EMPATHY },
          { label: 'возврат оформлен (refund processed / sent)', any: ['refund[a-z]*[^\\n]{0,40}\\b(processed|sent|issued|completed|done|succeeded|made|returned)', '\\b(processed|sent|issued|completed|made)[^\\n]{0,40}refund', '\\bwe (have )?(refunded|returned|sent back)', 'refunded (you|your|the)', 'money (was|has been) (sent|returned)'] },
          { label: 'дата возврата (3 ноября)', any: ['nov(ember)?\\.?\\s*0?3(rd)?\\b', '\\b0?3(rd)?\\s*(of\\s*)?nov', '2026-11-03', '\\b0?3\\.11\\b', '\\b11/0?3\\b', '\\b0?3/11\\b'] },
          { label: `сумма (${BOSS.refundAmount})`, any: [`\\b${BOSS.refundAmount}\\b`] },
          { label: 'сколько ждать: рабочие дни / банк', any: ['business days?', 'working days?', '\\d+\\s*(-|–|to)\\s*\\d+\\s*days'] },
          { label: 'вежливое завершение', any: CLOSING },
          { label: 'без обвинения клиента', none: NO_BLAME },
        ],
      },
      hints: [
        `Факты из базы: refund succeeded, ${BOSS.refundAmount}, ${BOSS.refundDate}.`,
        '*I checked your order: we processed the refund of 59 USD on November 3.*',
        '*Banks usually need 5–10 business days to show the money on your card. If you don\'t see it by November 17, please let us know.*',
      ],
      solution: `Hi Laura,

Thank you for your patience.
I checked your order ${BOSS.refundOrder}: we processed the refund of ${BOSS.refundAmount} USD on November 3.
Banks usually need 5-10 business days to show the money on your card.
If you don't see it by November 17, please reply to this email and we will help.

Best regards,
Alibek, Tulpar Store Support`,
    },
    {
      id: 'pdf-request',
      prompt: `⌨ ZD-6103 (Chloe, бизнес-аккаунт): ошибка 502 при скачивании счетов (PDF). Найди в \`/var/log/app/api.log\` **первую** такую ошибку и введи её **request_id**.`,
      tool: 'terminal',
      answer: { accept: [BOSS.pdfFirst], normalize: 'keywords', keywords: [[BOSS.pdfFirst]], label: 'request_id:', placeholder: 'req-…' },
      hints: ['Скачивание счёта — запросы `/api/invoices/…/pdf`; ошибка — status=502.', '`grep 502 /var/log/app/api.log | head -n 1`'],
      solution: 'grep 502 /var/log/app/api.log | head -n 1',
      explanation: `Первая ошибка ${BOSS.pdfFirst} в ${BOSS.pdfFirstTime} UTC (у клиентки «около 10:00 CET» = 09:00 UTC — сходится). Все запросы PDF после этого — 502 с \`upstream pdf-renderer timeout\`, длительность 30 секунд. Остальные запросы — 200. Это проблема сервиса генерации PDF — работа L3.`,
    },
    {
      id: 'pdf-escalation',
      prompt: 'Напиши **эскалацию в L3 на английском** по ZD-6103: Summary, Impact, Steps / Expected / Actual, Evidence (request_id, время в UTC, текст ошибки), What I checked, Priority (и почему).',
      write: {
        lang: 'en',
        minWords: 45,
        rows: 14,
        template: 'Summary: \nImpact: \nSteps to reproduce:\n1. \n2. \nExpected: \nActual: \nEvidence: \nWhat I checked: \nPriority: \n',
        rubric: [
          { label: 'что сломано: invoice PDF', any: ['invoice', '\\bpdf\\b'] },
          { label: 'влияние: бизнес-клиент, все / 40 пользователей', any: ['\\ball (users|customers|requests|downloads)', 'nobody', 'no one', '\\b40\\b', '\\b\\d+\\s+(users|customers|people|requests|errors)', 'business (customer|account|client)', 'every (user|request)'] },
          { label: 'ошибка 502', any: ['\\b502\\b'] },
          { label: 'request_id из лога (req-…)', any: ['req-[0-9a-f]{5}'] },
          { label: 'время в UTC', any: ['\\d{1,2}:\\d{2}[^\\n]{0,15}utc', 'utc[^\\n]{0,15}\\d{1,2}:\\d{2}'] },
          { label: 'текст ошибки (pdf-renderer timeout)', any: ['pdf-renderer', 'timeout', 'timed out', 'upstream'] },
          { label: 'приоритет и причина (сегодня, бухгалтерия)', any: ['\\bhigh\\b', 'urgent', 'critical', 'today', 'accounting', 'deadline'] },
          { label: 'без поиска виноватых', none: ['developers? broke', 'someone broke', 'devs? broke', "(devs?|developers?)['’]?s? fault", '\\bstupid\\b', '\\bidiots?\\b'] },
        ],
      },
      hints: [
        `Факты: первая ошибка ${BOSS.pdfFirst} в ${BOSS.pdfFirstTime} UTC, status=502, error="upstream pdf-renderer timeout"; другие запросы — 200.`,
        `Impact: *Business customer (Chloe Martin), 40 users, nobody can download invoice PDFs since ${BOSS.pdfFirstTime} UTC.*`,
        'Priority: *High — the customer needs the invoices for accounting today.*',
      ],
      solution: `Summary: Invoice PDF download fails with error 502 for a business customer (Chloe Martin, chloe.martin@orange.fr).
Impact: business account, 40 users. All invoice PDF requests fail since ${BOSS.pdfFirstTime} UTC (${BOSS.pdfErrors} errors in api.log). Other API requests work (200).
Steps to reproduce:
1. Log in as a user of the account.
2. Open an invoice and click "Download PDF".
Expected: the PDF is downloaded.
Actual: long loading, then "Error 502".
Evidence: first error ${BOSS.pdfFirst} at ${BOSS.pdfFirstTime} UTC, GET /api/invoices/.../pdf status=502, duration 30 s, error="upstream pdf-renderer timeout".
What I checked: only PDF requests fail, orders and cart work normally.
Priority: high, the customer needs the invoices for accounting today.`,
    },
  ],
  quiz: [
    {
      id: 'q-order',
      type: 'choice',
      prompt: 'В каком порядке разумно разобрать очередь смены?',
      options: [
        'По времени создания: 6101 → 6102 → 6103 → 6104',
        'Сначала собрать факты и эскалировать 6103 (массовая проблема, бизнес), затем быстро закрыть 6104 статьёй, потом разобрать 6101 и 6102',
        'Сначала самые простые: 6104 → 6101 → 6102, а 6103 — в конце смены',
      ],
      correct: 1,
      explanation: 'Первым — наибольшее влияние: чем раньше L3 получит эскалацию, тем раньше клиенты смогут работать. Быстрые победы — между делом.',
    },
    {
      id: 'q-business-days',
      type: 'text',
      prompt: 'Переведи: *5–10 business days*.',
      answer: { accept: ['5–10 рабочих дней'], normalize: 'keywords', keywords: [['рабоч', 'будн']] },
      explanation: '«5–10 рабочих дней» — выходные не считаются.',
    },
    {
      id: 'q-refunds',
      type: 'sql',
      prompt: 'Выведи `id, customer_email, total` всех заказов в статусе `refunded`.',
      solution: "SELECT id, customer_email, total FROM orders WHERE status = 'refunded';",
      explanation: "`WHERE status = 'refunded'`.",
    },
    {
      id: 'q-kb',
      type: 'text',
      prompt: 'ZD-6104 (Зарина: «Как сменить email?») — какую статью из `~/kb/` ей отправить? Введи имя файла.',
      answer: { accept: ['change-email.md'], normalize: 'keywords', keywords: [['change-email']] },
      explanation: '`~/kb/change-email.md` — Profile → Account → новый email → подтвердить по ссылке. Ответить по-русски, со ссылкой на статью.',
    },
  ],
  glossary: [
    { ru: 'Очередь', en: 'queue', def: 'Список тикетов, ожидающих разбора.' },
    { ru: 'Разбор очереди', en: 'triage', def: 'Решить, что делать с каждым тикетом и в каком порядке.' },
    { ru: 'Возврат', en: 'refund', def: 'Деньги вернули клиенту; банку нужно время, чтобы показать их на карте.' },
    { ru: 'Рабочие дни', en: 'business days', def: 'Дни без выходных и праздников.' },
    { ru: 'Блокировка аккаунта', en: 'account lock', def: 'Временный запрет входа после многих неверных паролей.' },
  ],
};
export default lesson;
