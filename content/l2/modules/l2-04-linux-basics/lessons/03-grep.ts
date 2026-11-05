import type { LessonDef } from '../../../../../src/content/types';

const pad = (n: number) => String(n).padStart(2, '0');
const at = (sec: number) => `2026-11-04 ${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}`;

// обычный поток событий магазина (заказы ORD-1050…, чтобы не пересекаться с ORD-1042)
const filler = [
  (i: number) => `INFO  order=ORD-${1050 + i} user=u-${320 + (i % 11)} Order created`,
  (i: number) => `INFO  user=u-${320 + (i % 11)} GET /api/products 200`,
  (i: number) => `INFO  order=ORD-${1049 + i} user=u-${319 + (i % 11)} Payment page opened`,
  (i: number) => `INFO  order=ORD-${1048 + i} user=u-${318 + (i % 11)} Payment succeeded`,
  (i: number) => `INFO  user=u-${320 + (i % 11)} Cart updated`,
];
// «сюжет»: заказ ORD-1042 клиентки u-311 и таймауты, записанные по-разному
const story: Record<number, string> = {
  4: 'INFO  order=ORD-1042 user=u-311 Order created',
  6: 'INFO  order=ORD-1042 user=u-311 Payment page opened',
  9: 'ERROR order=ORD-1042 user=u-311 Payment failed: card declined by bank',
  12: 'WARN  Timeout while calling inventory service, retrying',
  17: 'ERROR order=ORD-1042 user=u-311 Payment failed: card declined by bank',
  21: 'INFO  Inventory service answered after retry (previous timeout)',
  26: 'ERROR order=ORD-1063 user=u-325 Payment failed: insufficient funds',
  30: 'ERROR order=ORD-1042 user=u-311 Payment failed: card declined by bank',
  34: 'WARN  order=ORD-1042 user=u-311 Customer opened support chat',
  38: 'ERROR DELIVERY API TIMEOUT: no answer in 10 s',
  43: 'WARN  Slow response from delivery API (timeout soon): 9500 ms',
  51: 'ERROR order=ORD-1077 user=u-329 Payment failed: card expired',
};
const lines: string[] = [];
for (let i = 0; i < 60; i++) lines.push(`${at(11 * 3600 + i * 31)} ${story[i] ?? filler[i % filler.length](i)}`);
const log = lines.join('\n') + '\n';

const errLines = lines.filter((l) => l.includes(' ERROR '));
const orderLines = lines.filter((l) => l.includes('ORD-1042'));
const timeoutLines = lines.filter((l) => /timeout/i.test(l));

const ticket = `Ticket: ZD-5120
From: Emma Wilson <emma.wilson@example.co.uk>
Subject: Can't pay for my order

Hi,
I tried to pay for my order ORD-1042 three times today,
but every time I see "Payment failed".
My card works in other shops. What is wrong?

Thanks,
Emma
`;

const lesson: LessonDef = {
  id: 'grep',
  title: 'grep: найти нужные строки',
  minutes: 20,
  commands: ['grep'],
  scenario: { host: 'shop-web-01', files: { '/var/log/shop/app.log': log, '/home/alibek/tickets/ZD-5120.txt': ticket } },
  tasks: [
    {
      id: 'errors',
      prompt: 'Выведи из лога `/var/log/shop/app.log` **только строки с ошибками** — со словом `ERROR`.',
      check: { type: 'all', checks: [{ type: 'outputContains', value: errLines }, { type: 'outputNotContains', value: [' INFO ', ' WARN '] }] },
      hints: ['Формат: `grep ЧТО_ИСКАТЬ ФАЙЛ`.', '`grep ERROR /var/log/shop/app.log`'],
      solution: 'grep ERROR /var/log/shop/app.log',
      explanation: '`grep` оставил только строки со словом ERROR. Файл при этом не изменился.',
      tags: ['grep'],
    },
    {
      id: 'count',
      prompt: 'А теперь не показывай строки, а **посчитай**, сколько в логе строк с `ERROR`. Выведи число.',
      check: { type: 'outputNumber', value: errLines.length },
      hints: ['Посчитать совпадения — флаг `-c` (count).', '`grep -c ERROR /var/log/shop/app.log` (или `grep ERROR файл | wc -l`).'],
      solution: 'grep -c ERROR /var/log/shop/app.log',
      explanation: `Ошибок — ${errLines.length}. \`grep -c\` и \`grep … | wc -l\` дают одинаковый результат.`,
      tags: ['grep'],
    },
    {
      id: 'order',
      prompt:
        'Пришёл тикет на английском — он лежит в `~/tickets/ZD-5120.txt`. Прочитай его, найди **номер заказа** и выведи из лога `/var/log/shop/app.log` **все строки про этот заказ**.',
      check: {
        type: 'custom',
        fn: (_sh, last) => {
          if (!last) return false;
          const out = last.stdout.split('\n').filter((l) => l.trim());
          return out.length === orderLines.length && out.every((l) => l.includes('ORD-1042'));
        },
      },
      hints: ['Тикет маленький: `cat ~/tickets/ZD-5120.txt`. Номер заказа начинается с `ORD-`.', 'Потом ищи номер в логе: `grep НОМЕР /var/log/shop/app.log`.'],
      solution: 'cat ~/tickets/ZD-5120.txt\ngrep ORD-1042 /var/log/shop/app.log',
      explanation: `По заказу ORD-1042 в логе ${orderLines.length} строк: заказ создан, три раза «Payment failed: card declined by bank» (банк отклонил карту), потом клиентка открыла чат поддержки. Значит, проблема на стороне банка карты, а не магазина.`,
      tags: ['grep', 'cat'],
    },
    {
      id: 'ignore-case',
      prompt:
        'Слово «таймаут» в логе записано по-разному: `Timeout`, `timeout`, `TIMEOUT`. Посчитай **все** строки, где оно встречается в любом регистре. Выведи число.',
      check: { type: 'outputNumber', value: timeoutLines.length },
      hints: ['Без учёта регистра — флаг `-i`, посчитать — `-c`.', 'Флаги можно склеить: `grep -ic timeout /var/log/shop/app.log`.'],
      solution: 'grep -ic timeout /var/log/shop/app.log',
      explanation: `Строк с таймаутом — ${timeoutLines.length}. Без \`-i\` grep нашёл бы только точное написание и часть строк потерялась бы.`,
      tags: ['grep'],
    },
  ],
  quiz: [
    {
      id: 'q-user',
      type: 'command',
      prompt: 'Выведи все строки лога `/var/log/shop/app.log`, где встречается пользователь `user=u-311`.',
      scenario: { files: { '/var/log/shop/app.log': log } },
      solution: 'grep user=u-311 /var/log/shop/app.log',
      explanation: 'Подойдёт и `grep u-311 файл` — проверяется результат.',
    },
    {
      id: 'q-i',
      type: 'text',
      prompt: 'Какой флаг grep ищет **без учёта регистра** (ERROR = error)?',
      answer: { accept: ['-i', 'i', '--ignore-case'] },
      explanation: '`-i` — ignore case.',
    },
    {
      id: 'q-c',
      type: 'text',
      prompt: 'Какой флаг grep **считает** найденные строки вместо того, чтобы их показывать?',
      answer: { accept: ['-c', 'c', '--count'] },
      explanation: '`-c` — count. Альтернатива — `grep … | wc -l`.',
    },
    {
      id: 'q-empty',
      type: 'choice',
      prompt: '`grep error app.log` ничего не вывел. Что это значит?',
      options: ['grep сломался, нужно перезагрузить сервер', 'Строк с точно таким словом нет — попробуй другое слово или флаг -i', 'Файл app.log пустой'],
      correct: 1,
      explanation: 'Пустой вывод — это «совпадений нет». Возможно, в логе пишут `ERROR` заглавными: `grep -i error app.log`.',
    },
  ],
  glossary: [
    { ru: 'Шаблон поиска', en: 'pattern', def: 'То, что ищет grep: слово, номер, фраза.' },
    { ru: 'Регистр букв', en: 'case (upper/lower)', def: 'Большие и маленькие буквы; `-i` — без учёта регистра.' },
    { ru: 'Совпадение', en: 'match', def: 'Строка, в которой нашёлся шаблон.' },
    { ru: 'Отклонено', en: 'declined', def: 'Банк отказал в оплате картой.' },
  ],
};
export default lesson;
