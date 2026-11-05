import type { LessonDef } from '../../../../../src/content/types';

const pad = (n: number) => String(n).padStart(2, '0');
const at = (sec: number) => `2026-11-04 ${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}`;

// лог магазина: 10:00 → 10:30, в конце — ошибка платёжного шлюза
const msgs = [
  (i: number) => `INFO  User u-${300 + (i % 9)} logged in`,
  (i: number) => `INFO  GET /api/products 200 (${40 + (i % 7) * 5} ms)`,
  (i: number) => `INFO  Cart updated for user u-${300 + (i % 9)}`,
  (i: number) => `INFO  Order ORD-${1040 + i} created`,
  (i: number) => (i % 4 === 0 ? `WARN  Slow response from inventory service: ${1500 + i * 10} ms` : `INFO  GET /api/cart 200 (${30 + (i % 5) * 4} ms)`),
];
const lines: string[] = [];
for (let i = 0; i < 47; i++) lines.push(`${at(10 * 3600 + i * 37)} ${msgs[i % msgs.length](i)}`);
const lastLine = `${at(10 * 3600 + 47 * 37 + 12)} ERROR Payment gateway timeout: no response from api.paybox.kz after 30 seconds`;
lines.push(lastLine);
const log = lines.join('\n') + '\n';

const conf = `# Shop application config
app_name=shop
port=8080
db_host=db-prod-01
log_dir=/var/log/shop
support_email=support@shop.example
`;

const lesson: LessonDef = {
  id: 'viewing',
  title: 'Читаем файлы: cat, less, head, tail, wc',
  minutes: 20,
  commands: ['cat', 'less', 'head', 'tail', 'wc'],
  scenario: { host: 'shop-web-01', files: { '/etc/shop/app.conf': conf, '/var/log/shop/app.log': log } },
  tasks: [
    {
      id: 'conf',
      prompt: 'Клиент спрашивает, на каком порту работает приложение. Посмотри конфиг `/etc/shop/app.conf` целиком и введи значение `port`.',
      answer: { accept: ['8080'], normalize: 'number', label: 'Порт:' },
      hints: ['Файл маленький — его удобно показать целиком командой `cat`.', '`cat /etc/shop/app.conf`'],
      solution: 'cat /etc/shop/app.conf',
      explanation: '`port=8080`. Строка с `#` в начале — комментарий.',
      tags: ['cat'],
    },
    {
      id: 'head',
      prompt: 'Выведи **первые 5 строк** лога `/var/log/shop/app.log` — посмотри, с чего начинается файл.',
      check: { type: 'all', checks: [{ type: 'outputLines', value: 5 }, { type: 'outputContains', value: [lines[0], lines[4]] }] },
      hints: ['Начало файла показывает `head`, количество строк — флаг `-n`.', '`head -n 5 /var/log/shop/app.log`'],
      solution: 'head -n 5 /var/log/shop/app.log',
      explanation: '`head -n 5` (или короче `head -5`) — первые 5 строк. Без флага `head` показал бы 10.',
      tags: ['head'],
    },
    {
      id: 'wc',
      prompt: 'Сколько всего строк (событий) в логе `/var/log/shop/app.log`? Выведи число командой.',
      check: { type: 'outputNumber', value: lines.length },
      hints: ['Строки считает `wc` с флагом `-l`.', '`wc -l /var/log/shop/app.log`'],
      solution: 'wc -l /var/log/shop/app.log',
      explanation: `В логе ${lines.length} строк. \`wc -l\` печатает число и имя файла; через пайп (\`cat файл | wc -l\`) — только число.`,
      tags: ['wc'],
    },
    {
      id: 'tail',
      prompt: 'Новые события дописываются в конец лога. Выведи **последние 3 строки** `/var/log/shop/app.log`.',
      check: { type: 'all', checks: [{ type: 'outputLines', value: 3 }, { type: 'outputContains', value: [lines[lines.length - 3], lastLine] }] },
      hints: ['Конец файла показывает `tail`.', '`tail -n 3 /var/log/shop/app.log`'],
      solution: 'tail -n 3 /var/log/shop/app.log',
      tags: ['tail'],
    },
    {
      id: 'english',
      prompt:
        'Последняя строка лога — ошибка на английском. Прочитай её. **Что не ответило** и **через сколько секунд** приложение перестало ждать? Ответь по-русски или по-английски.',
      answer: {
        accept: [],
        normalize: 'keywords',
        keywords: [
          ['плат', 'оплат', 'payment', 'gateway', 'шлюз', 'paybox'],
          ['30', 'тридцат'],
        ],
        label: 'Ответ:',
        placeholder: 'например: … не ответил за … секунд',
      },
      hints: ['Если последней строки уже не видно — `tail -n 1 /var/log/shop/app.log`.', '*Payment gateway* — платёжный шлюз, *no response … after N seconds* — нет ответа за N секунд.'],
      solution: 'tail -n 1 /var/log/shop/app.log',
      explanation: '*Payment gateway timeout: no response from api.paybox.kz after 30 seconds* — платёжный шлюз (api.paybox.kz) не ответил за 30 секунд. Проблема у внешнего провайдера оплаты — это важная деталь для эскалации.',
      tags: ['tail'],
    },
  ],
  quiz: [
    {
      id: 'q-tail20',
      type: 'command',
      prompt: 'Покажи последние 20 строк файла `/var/log/shop/app.log`.',
      scenario: { files: { '/var/log/shop/app.log': log } },
      solution: 'tail -n 20 /var/log/shop/app.log',
      explanation: '`tail -n 20 файл` или короче `tail -20 файл`.',
    },
    {
      id: 'q-less-quit',
      type: 'text',
      prompt: 'Ты открыл файл в `less`. Какой клавишей выйти?',
      answer: { accept: ['q', 'клавиша q', 'кнопка q', 'клавишей q', ':q'] },
      explanation: '`q` — quit. Поиск внутри less — `/слово`.',
    },
    {
      id: 'q-wc',
      type: 'text',
      prompt: 'Какая команда с флагом считает **строки** в файле?',
      answer: { accept: ['wc -l', 'wc --lines', 'wc -l файл', 'wc'] },
      explanation: '`wc -l` — word count, флаг `-l` — lines (строки).',
    },
    {
      id: 'q-big',
      type: 'choice',
      prompt: 'Лог весит 3 ГБ. Ты хочешь увидеть, что случилось **последним**. Что выбрать?',
      options: ['cat app.log', 'tail -n 50 app.log', 'head -n 50 app.log'],
      correct: 1,
      explanation: 'Новые записи — в конце файла, поэтому `tail`. `cat` вывалит весь файл, `head` покажет самое старое.',
    },
  ],
  glossary: [
    { ru: 'Лог, журнал', en: 'log', def: 'Файл, куда программа записывает события: что и когда произошло.' },
    { ru: 'Конфиг, файл настроек', en: 'config file', def: 'Файл с параметрами программы: порт, адрес базы и т. д.' },
    { ru: 'Флаг, опция', en: 'flag, option', def: 'Настройка команды, начинается с минуса: `-n 5`.' },
    { ru: 'Пайп', en: 'pipe', def: 'Знак `|`: вывод одной команды передаётся на вход следующей.' },
    { ru: 'Превышено время ожидания', en: 'timeout', def: 'Ответ не пришёл за отведённое время.' },
  ],
};
export default lesson;
