import type { LessonDef } from '../../../../../src/content/types';
import { HOME, ticketFiles, type TicketSpec } from '../data';

const tickets: TicketSpec[] = [
  {
    id: 'ZD-2401',
    created: '2026-11-04 09:20',
    customer: 'Berlin Coffee GmbH',
    plan: 'Business',
    requester: 'anna.k@berlin-coffee.de',
    subject: 'Не скачиваются счета в PDF',
    status: 'Open',
    priority: 'P2',
    assignee: 'L2',
    body: `[Customer] С утра при нажатии «Скачать счёт» — «Ошибка 500». Вчера всё работало. Без счетов не можем отгрузить заказы.
[L2 internal note] Воспроизвёл на тестовом магазине test-l2: заказ #1001 → «Скачать счёт» → 500. В логе error=PDF_RENDER_TIMEOUT.`,
  },
  {
    id: 'ZD-2402',
    created: '2026-11-04 09:45',
    customer: 'Nomad Outdoor',
    plan: 'Business',
    requester: 'aidar@nomad-outdoor.kz',
    subject: 'Остатки с 1С не обновляются',
    status: 'Open',
    priority: 'P3',
    assignee: 'L2',
    body: `[Customer] Остатки на сайте не обновляются с ночи. В 1С всё хорошо, выгружаем 12 000 товаров.
[L2 internal note] В логе интеграции error=SYNC_TIMEOUT.`,
  },
];

const KNOWN = `# Known issues (известные проблемы) ShopFlow

## KI-03: письма покупателям попадают в спам
Симптом: письма «Заказ принят» не доходят или лежат в спаме
Причина: у домена магазина не настроены SPF/DKIM
Workaround: статья KB-118 «Настройка домена для писем»
Статус: не баг, настройка на стороне клиента

## KI-07: SYNC_TIMEOUT при выгрузке в 1С
Симптом: остатки не обновляются, в логе error=SYNC_TIMEOUT
Причина: слишком большой пакет товаров (больше 5000 за раз)
Workaround: в настройках интеграции уменьшить размер пакета до 1000
Статус: исправление запланировано в 4.13

## KI-11: отчёт «Продажи по дням» пустой для дат до 2024 года
Симптом: пустой отчёт за старые периоды
Причина: старые данные в архиве
Workaround: запросить выгрузку архива через поддержку
Статус: by design
`;

interface LogLine {
  time: string;
  level: 'INFO' | 'ERROR';
  req: string;
  store: string;
  rest: string;
}
const lines: LogLine[] = [
  { time: '08:30:00', level: 'INFO', req: 'req_9000a1', store: '-', rest: 'msg="release 4.12.0 deployed"' },
  { time: '09:02:11', level: 'ERROR', req: 'req_91aa03', store: 'berlin-coffee', rest: 'status=500 path=/admin/orders/3310/invoice.pdf error=PDF_RENDER_TIMEOUT' },
  { time: '09:05:40', level: 'INFO', req: 'req_91aa77', store: 'warsaw-bikes', rest: 'status=200 path=/admin/orders' },
  { time: '09:14:09', level: 'ERROR', req: 'req_91ab17', store: 'berlin-coffee', rest: 'status=500 path=/admin/orders/3312/invoice.pdf error=PDF_RENDER_TIMEOUT' },
  { time: '09:21:30', level: 'ERROR', req: 'req_91ac02', store: 'nomad-outdoor', rest: 'status=500 path=/admin/orders/7781/invoice.pdf error=PDF_RENDER_TIMEOUT' },
  { time: '09:30:02', level: 'ERROR', req: 'req_91ac90', store: 'nomad-outdoor', rest: 'status=504 path=/integrations/1c/sync error=SYNC_TIMEOUT' },
  { time: '09:33:51', level: 'ERROR', req: 'req_91ad45', store: 'test-l2', rest: 'status=500 path=/admin/orders/1001/invoice.pdf error=PDF_RENDER_TIMEOUT' },
  { time: '09:40:18', level: 'ERROR', req: 'req_91ae10', store: 'berlin-coffee', rest: 'status=500 path=/admin/orders/3315/invoice.pdf error=PDF_RENDER_TIMEOUT' },
  { time: '09:41:00', level: 'INFO', req: 'req_91ae55', store: 'berlin-coffee', rest: 'status=200 path=/admin/orders/3315' },
];
const log = lines.map((l) => `2026-11-04T${l.time}Z ${l.level.padEnd(5)} request_id=${l.req} store=${l.store} ${l.rest}`).join('\n') + '\n';
const pdf = lines.filter((l) => l.rest.includes('PDF_RENDER_TIMEOUT'));
const PDF_COUNT = pdf.length;

const ESC = `${HOME}/escalations/ZD-2401.md`;
const ESC_HEAD = '# Эскалация в L3: ZD-2401 — счета PDF, ошибка 500';
const escTemplate = `${ESC_HEAD}
Клиент: Berlin Coffee GmbH (Business)

## Логи
`;

const scenario = {
  files: {
    ...ticketFiles('tickets', tickets),
    [`${HOME}/kb/known-issues.md`]: { content: KNOWN, owner: 'alibek' },
    '/var/log/shopflow/app.log': log,
    [ESC]: { content: escTemplate, owner: 'alibek' },
  },
};

const lesson: LessonDef = {
  id: 'escalation',
  title: 'Эскалация в L3 и known issues',
  minutes: 25,
  commands: ['cat', 'grep'],
  scenario,
  tasks: [
    {
      id: 'known',
      prompt: 'Тикет **ZD-2402**: в логе интеграции `error=SYNC_TIMEOUT`. Прежде чем эскалировать, проверь базу известных проблем `~/kb/known-issues.md`. Есть ли там эта ошибка? Введи номер статьи (KI-..).',
      answer: { accept: ['KI-07', 'KI07', 'KI 07', 'KI-7', 'KI7', '07', '7', 'ki-07 sync_timeout'], label: 'Статья:', placeholder: 'KI-..' },
      hints: ['Ищи код ошибки в файле базы знаний.', '`grep -i sync_timeout ~/kb/known-issues.md` (`-i` — без учёта регистра).'],
      solution: 'grep -i sync_timeout ~/kb/known-issues.md',
      explanation: 'Известная проблема **KI-07** с готовым обходом: уменьшить пакет выгрузки до 1000 товаров (у клиента 12 000 за раз). Эскалировать не нужно — отвечаем клиенту с workaround и связываем тикет с KI-07.',
      tags: ['grep'],
    },
    {
      id: 'count',
      prompt: 'Тикет **ZD-2401**: `error=PDF_RENDER_TIMEOUT`. Этой ошибки в known issues нет — значит, будем эскалировать. Для пункта «влияние» посчитай: **сколько всего** строк с `PDF_RENDER_TIMEOUT` в `/var/log/shopflow/app.log`?',
      answer: { accept: [String(PDF_COUNT)], normalize: 'number', label: 'Ошибок:' },
      hints: ['Сначала можно убедиться, что в KB её нет: `grep -i pdf_render ~/kb/known-issues.md` — пусто.', '`grep -c PDF_RENDER_TIMEOUT /var/log/shopflow/app.log` (`-c` — посчитать совпадения).'],
      solution: 'grep -c PDF_RENDER_TIMEOUT /var/log/shopflow/app.log',
      explanation: `${PDF_COUNT} ошибок за ~40 минут, причём у разных магазинов (berlin-coffee, nomad-outdoor и наш тестовый test-l2) — это не настройка одного клиента, а проблема платформы. Первая — в 09:02, через полчаса после релиза 4.12.0 (08:30).`,
      tags: ['grep'],
    },
    {
      id: 'append-logs',
      prompt: 'Допиши **все строки** с `PDF_RENDER_TIMEOUT` из лога в конец черновика эскалации `~/escalations/ZD-2401.md`. Заголовок черновика должен остаться на месте!',
      check: { type: 'fileContains', path: ESC, value: [ESC_HEAD, '## Логи', ...pdf.map((l) => `request_id=${l.req}`)] },
      hints: ['`>` перезапишет файл, а `>>` допишет в конец.', '`grep PDF_RENDER_TIMEOUT /var/log/shopflow/app.log >> ~/escalations/ZD-2401.md`', 'Проверь результат: `cat ~/escalations/ZD-2401.md`'],
      solution: 'grep PDF_RENDER_TIMEOUT /var/log/shopflow/app.log >> ~/escalations/ZD-2401.md',
      explanation: 'Строки лога с request id — главный артефакт для L3. Если случайно стёр заголовок одиночным `>`, нажми «Сбросить окружение» и повтори с `>>`.',
      tags: ['grep'],
    },
    {
      id: 'write-escalation',
      prompt: 'Напиши текст эскалации ZD-2401 для L3 (на русском). Нужны все шесть пунктов: **что сломано**, **влияние**, **когда началось** (время UTC или связь с релизом), **что уже проверено**, **шаги воспроизведения**, **request id** хотя бы одного запроса. Данные — из тикета `~/tickets/ZD-2401.txt` и лога.',
      write: {
        lang: 'ru',
        minWords: 40,
        rows: 12,
        template: 'Что сломано:\nВлияние:\nКогда началось:\nЧто проверено:\nШаги воспроизведения:\nЛоги / request id:\n',
        rubric: [
          { label: 'что сломано (счета PDF)', any: ['pdf', 'сч[её]т', 'invoice'] },
          { label: 'влияние: сколько и кого', any: ['влияние[ \\t]*:[ \\t]*\\S.{5,}', 'impact[ \\t]*:[ \\t]*\\S.{5,}', '\\d+\\s*(магазин|клиент|ошиб|сч[её]т|запрос)', '(не могут|не может)'] },
          { label: 'когда началось (время или релиз)', any: ['\\b\\d{1,2}:\\d{2}\\b', 'релиз', 'release', '4\\.12'] },
          { label: 'что уже проверено', any: ['проверено[ \\t]*:[ \\t]*\\S.{5,}', 'провери(л|ли|ла)', 'checked', 'known issues?[ \\t]*(—|-|:)?[ \\t]*нет', 'нет в (базе|kb|known)', 'воспроизв[её]л', 'воспроизводится'] },
          { label: 'шаги воспроизведения', any: ['воспроизведения[ \\t]*:[ \\t]*\\S.{5,}', '^[ \\t]*1[.)][ \\t]+\\S', 'steps to reproduce[ \\t]*:[ \\t]*\\S', '(открыть|открой|нажать|нажми|скачать)'] },
          { label: 'request id', any: ['req_[0-9a-z]+'] },
        ],
      },
      hints: ['Заполни шаблон: по одной-две фразы на пункт.', 'Время первой ошибки и релиза — в логе (`cat /var/log/shopflow/app.log`).', 'Шаги — из internal note тикета: заказ #1001 на тестовом магазине.'],
      solution: `Что сломано: у Berlin Coffee не скачиваются счета PDF — «Ошибка 500».
Влияние: ${PDF_COUNT} ошибок за 40 минут у 2 магазинов клиентов (Berlin Coffee, Nomad Outdoor) и на тестовом магазине; без счетов клиенты не могут отгрузить заказы.
Когда началось: с 09:02 UTC, через полчаса после релиза 4.12.0 (08:30 UTC).
Что проверено: в known issues такой ошибки нет; воспроизвёл на тестовом магазине test-l2.
Шаги воспроизведения: 1. Админка test-l2 → Заказы → #1001. 2. Нажать «Скачать счёт». Ожидаемо: PDF. Фактически: ошибка 500.
Логи / request id: error=PDF_RENDER_TIMEOUT, req_91aa03, req_91ad45; все строки — в ~/escalations/ZD-2401.md.`,
      tags: ['write'],
    },
  ],
  quiz: [
    {
      id: 'q-known',
      type: 'choice',
      prompt: 'Ошибка клиента совпадает со статьёй known issues, где есть рабочий workaround. Что делает L2?',
      options: ['Эскалирует в L3 — пусть чинят', 'Даёт клиенту workaround и связывает тикет со статьёй KI', 'Закрывает тикет без ответа — проблема же известная'],
      correct: 1,
      explanation: 'Известная проблема с обходом решается на L2: клиент получает workaround, тикет связан с KI (когда выйдет фикс — клиенту сообщат).',
    },
    {
      id: 'q-append',
      type: 'text',
      prompt: 'Каким оператором дописать вывод команды в конец файла, не стирая содержимое?',
      answer: { accept: ['>>'], normalize: 'exact' },
      explanation: '`>>` — дописать (append). `>` — перезаписать файл целиком.',
    },
    {
      id: 'q-count',
      type: 'text',
      prompt: 'Какой флаг grep выводит **количество** совпавших строк вместо самих строк?',
      answer: { accept: ['-c', '--count'] },
      explanation: '`grep -c ERROR файл` — число строк с ERROR.',
    },
    {
      id: 'q-status',
      type: 'text',
      prompt: 'Тикет эскалирован в L3, ждём их анализа. Какой статус поставить тикету? (по-английски)',
      answer: { accept: ['On-hold', 'on hold', 'onhold', 'hold'] },
      explanation: '**On-hold** — ждём другую команду. Тикет при этом остаётся на тебе: обновляешь клиента и проверяешь фикс.',
    },
  ],
  glossary: [
    { ru: 'Эскалация', en: 'escalation', def: 'Передача тикета на следующий уровень (L2 → L3) с собранными данными.' },
    { ru: 'Известная проблема', en: 'known issue (KI)', def: 'Описанная в базе знаний проблема с причиной и обходом.' },
    { ru: 'Артефакты', en: 'artifacts / evidence', def: 'Логи, request id, скриншоты, приложенные к тикету.' },
    { ru: 'Релиз', en: 'release', def: 'Выкладка новой версии продукта; частая причина новых ошибок.' },
    { ru: 'Связать тикеты', en: 'link tickets', def: 'Отметить, что тикеты об одной проблеме или связаны с задачей в Jira.' },
  ],
};
export default lesson;
