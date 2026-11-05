import type { LessonDef } from '../../../../../src/content/types';
import { HOME, PRIORITY_MD, prioAccept, ticketFiles, type TicketSpec } from '../data';

const queue: TicketSpec[] = [
  {
    id: 'ZD-2101',
    created: '2026-11-04 09:12',
    customer: 'Nomad Outdoor',
    plan: 'Business',
    requester: 'aidar@nomad-outdoor.kz',
    subject: 'Оплата картой не проходит',
    status: 'New',
    assignee: 'L2',
    category: 'payments',
    extra: { Affected: 'все покупатели магазина; ещё 2 магазина написали то же самое (ZD-2105, ZD-2106)', Workaround: 'нет' },
    body: 'С 09:05 ни один покупатель не может оплатить заказ картой: «Платёж отклонён». Мы теряем продажи!',
  },
  {
    id: 'ZD-2102',
    created: '2026-11-04 09:20',
    customer: 'Berlin Coffee GmbH',
    plan: 'Business',
    requester: 'anna.k@berlin-coffee.de',
    subject: 'Экспорт заказов в CSV за год падает с ошибкой',
    status: 'New',
    assignee: 'L2',
    category: 'reports',
    extra: { Affected: 'один пользователь клиента (бухгалтер)', Workaround: 'выгружать по месяцам — работает' },
    body: 'Нужна выгрузка за 2026 год для бухгалтерии. За весь год — ошибка, по месяцам выгружается.',
  },
  {
    id: 'ZD-2103',
    created: '2026-11-04 09:31',
    customer: 'Lisbon Surf Shop',
    plan: 'Standard',
    requester: 'joao@lisbonsurf.pt',
    subject: 'СРОЧНО!!! Логотип в письме размыт!!!',
    status: 'New',
    assignee: 'L2',
    category: 'notifications',
    extra: { Affected: 'внешний вид писем покупателям, письма доходят', Workaround: 'загрузить логотип в PNG 2x — выглядит чётко' },
    body: 'ЛОГОТИП В ПИСЬМЕ «ЗАКАЗ ПРИНЯТ» РАЗМЫТЫЙ!!! ИСПРАВЬТЕ СРОЧНО!!!',
  },
  {
    id: 'ZD-2104',
    created: '2026-11-04 09:40',
    customer: 'Warsaw Bikes',
    plan: 'Enterprise',
    requester: 'piotr@warsawbikes.pl',
    subject: 'Администратор не может войти в админку',
    status: 'New',
    assignee: 'L2',
    category: 'access',
    extra: { Affected: 'один клиент: главный администратор; витрина и оплата у покупателей работают', Workaround: 'нет — второго администратора у клиента нет, заказы не обрабатываются' },
    body: 'Добрый день. При входе в админку — «Ошибка 500». Сброс пароля не помог. Заказы копятся, отгрузить не можем.',
  },
];

const scenario = {
  files: {
    ...ticketFiles('queue', queue),
    [`${HOME}/kb/priority.md`]: { content: PRIORITY_MD, owner: 'alibek' },
  },
};

const lesson: LessonDef = {
  id: 'triage-priority',
  title: 'Triage: приоритет по impact и urgency',
  minutes: 20,
  commands: ['cat', 'grep'],
  scenario,
  tasks: [
    {
      id: 'workarounds',
      prompt: 'Для приоритета важно, есть ли обходной путь. Выведи строки `Workaround:` **из всех тикетов** в `~/queue` одной командой (без остальных строк тикетов).',
      check: {
        type: 'all',
        checks: [
          { type: 'outputContains', value: queue.map((t) => `Workaround: ${t.extra!.Workaround}`) },
          { type: 'outputNotContains', value: ['Subject:', 'Customer:'] },
        ],
      },
      hints: ['Нужен поиск строки сразу по многим файлам — это `grep`.', 'Звёздочка подставит все файлы: `grep "Workaround:" ~/queue/*`'],
      solution: 'grep "Workaround:" ~/queue/*',
      explanation: 'grep печатает имя файла перед каждой строкой, поэтому видно, в каком тикете какой обход. У ZD-2101 и ZD-2104 обхода нет — они пойдут первыми.',
      tags: ['grep'],
    },
    {
      id: 'p-payments',
      prompt: 'Открой тикет **ZD-2101** и матрицу `~/kb/priority.md`. Какой приоритет у этого тикета? Введи P1–P4.',
      answer: { accept: prioAccept(1), label: 'Приоритет:', placeholder: 'P1–P4' },
      hints: ['`cat ~/queue/ZD-2101.txt` и `cat ~/kb/priority.md`.', 'Оплата — ключевая функция, затронуто несколько магазинов, обхода нет.'],
      solution: 'cat ~/queue/ZD-2101.txt\ncat ~/kb/priority.md\n# Impact High × Urgency High = P1',
      explanation: 'Impact High (оплата + несколько магазинов) × Urgency High (нет обхода, теряются продажи) = **P1**.',
    },
    {
      id: 'p-login',
      prompt: 'Теперь тикет **ZD-2104** (администратор не может войти). Какой у него приоритет?',
      answer: { accept: prioAccept(2), label: 'Приоритет:', placeholder: 'P1–P4' },
      hints: ['`cat ~/queue/ZD-2104.txt`', 'Затронут один клиент (Medium), но обхода нет (High). Посмотри пересечение в матрице.'],
      solution: 'cat ~/queue/ZD-2104.txt\n# Impact Medium × Urgency High = P2',
      explanation: 'Impact Medium (один клиент, у покупателей всё работает) × Urgency High (нет второго администратора, заказы копятся) = **P2**. Тариф Enterprise не делает тикет P1 — он влияет на SLA.',
    },
    {
      id: 'p-export',
      prompt: 'И тикет **ZD-2102** (экспорт заказов за год). Какой приоритет?',
      answer: { accept: prioAccept(3), label: 'Приоритет:', placeholder: 'P1–P4' },
      hints: ['`cat ~/queue/ZD-2102.txt`', 'Один пользователь, неключевая функция, и есть обходной путь.'],
      solution: 'cat ~/queue/ZD-2102.txt\n# Impact Medium × Urgency Low = P3',
      explanation: 'Impact Medium × Urgency Low (выгрузка по месяцам работает) = **P3**.',
    },
  ],
  quiz: [
    {
      id: 'q-caps',
      type: 'text',
      prompt: 'Тикет ZD-2103: «СРОЧНО!!! Логотип в письме размыт!!!» — письма доходят, есть обходной путь. Какой приоритет по матрице? (P1–P4)',
      answer: { accept: prioAccept(4) },
      explanation: 'Косметика (Low) и есть обход (Low) → **P4**. Капслок и восклицательные знаки на приоритет не влияют — вежливо ответим и всё равно поможем.',
    },
    {
      id: 'q-workaround',
      type: 'text',
      prompt: 'Как по-английски называется временный способ продолжать работу, пока проблему не исправили? (одно слово)',
      answer: { accept: ['workaround', 'work-around', 'work around'] },
      explanation: '**Workaround** — обходной путь. Его наличие снижает срочность (urgency).',
    },
    {
      id: 'q-doubt',
      type: 'choice',
      prompt: 'Сомневаешься, P1 это или P2. Что делать?',
      options: ['Поставить P2 — вдруг ложная тревога', 'Поставить P1 и в заметке объяснить почему; понизить можно позже', 'Оставить без приоритета, пока не станет ясно'],
      correct: 1,
      explanation: 'Повысить и объяснить. Понизить приоритет легко, а опоздать с реакцией на настоящую аварию — дорого.',
    },
    {
      id: 'q-two',
      type: 'text',
      prompt: 'Приоритет считается из двух факторов: urgency и … (по-английски, одно слово)',
      answer: { accept: ['impact', 'business impact'] },
      explanation: 'Priority = **impact** × urgency.',
    },
  ],
  glossary: [
    { ru: 'Приоритет', en: 'priority', def: 'Очерёдность работы над тикетом: P1 (наивысший) — P4 (низкий).' },
    { ru: 'Влияние', en: 'impact', def: 'Насколько велик ущерб: сколько клиентов затронуто и какая функция.' },
    { ru: 'Срочность', en: 'urgency', def: 'Как быстро растёт ущерб; есть ли обходной путь.' },
    { ru: 'Обходной путь', en: 'workaround', def: 'Временный способ продолжить работу, пока причина не устранена.' },
    { ru: 'Дубликат', en: 'duplicate', def: 'Тикет о той же проблеме, что уже есть в очереди; тикеты связывают.' },
  ],
};
export default lesson;
