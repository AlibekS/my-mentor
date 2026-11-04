import type { LessonDef } from '../../../../src/content/types';

const tickets = {
  '/home/alibek/tickets/TCK-1041.txt': {
    owner: 'alibek',
    content: `Ticket: TCK-1041
Customer: Kaspi Logistics
Created: 2026-11-04 09:12
Level: L2
Subject: Пользователь не может войти
Description: Пользователь ivanov@kl.kz получает "Invalid password". Пароль сбросили — вход работает.
Status: Resolved
`,
  },
  '/home/alibek/tickets/TCK-1042.txt': {
    owner: 'alibek',
    content: `Ticket: TCK-1042
Customer: Astana Retail Group
Created: 2026-11-04 10:47
Level: L2
Subject: Дублирующиеся платежи
Description: С утра 14 заказов оплачены дважды. Клиент видит 2 списания. В логах payment-service: "webhook timeout, retrying".
Checked by L2: настройки клиента корректны, проблема воспроизводится на тестовом заказе.
Status: Escalated to L3
`,
  },
  '/home/alibek/tickets/TCK-1043.txt': {
    owner: 'alibek',
    content: `Ticket: TCK-1043
Customer: Turan Media
Created: 2026-11-04 11:30
Level: L1
Subject: Как выгрузить отчёт в Excel?
Description: Клиент спрашивает, где кнопка экспорта. Отправлена ссылка на статью KB-221.
Status: Resolved
`,
  },
};

const lesson: LessonDef = {
  id: 'support-levels',
  title: 'Уровни поддержки L1/L2/L3 и эскалации',
  minutes: 20,
  commands: ['ls', 'cat', 'grep'],
  scenario: { files: tickets },
  tasks: [
    {
      id: 'list',
      prompt: 'Посмотри, какие тикеты лежат в каталоге `~/tickets`. Выведи список файлов.',
      check: { type: 'outputContains', value: ['TCK-1041.txt', 'TCK-1042.txt', 'TCK-1043.txt'] },
      hints: ['Команда для списка файлов — `ls`.', 'Укажи каталог: `ls ~/tickets` (тильда `~` — твой домашний каталог).'],
      solution: 'ls ~/tickets',
      explanation: '`ls` показывает содержимое каталога. `~` раскрывается в `/home/alibek`.',
      tags: ['ls'],
    },
    {
      id: 'escalated',
      prompt: 'Какой тикет эскалирован на L3? Найди его командой (не открывая файлы по одному) и введи номер тикета в поле ответа.',
      answer: { accept: ['TCK-1042', '1042', 'TCK-1042.txt'], label: 'Номер тикета:', placeholder: 'TCK-....' },
      hints: ['Ищи строку со словом `L3` во всех файлах сразу.', '`grep L3 ~/tickets/*` — звёздочка подставит все файлы каталога.'],
      solution: 'grep -l "Escalated to L3" ~/tickets/*',
      explanation: '`grep` ищет строки по шаблону; при нескольких файлах он печатает имя файла перед совпадением. Флаг `-l` выводит только имена файлов.',
      tags: ['grep'],
    },
    {
      id: 'checked',
      prompt: 'Хорошая эскалация говорит, что уже проверено. Выведи из тикета TCK-1042 строку с тем, что проверил L2 (`Checked by L2`).',
      check: { type: 'all', checks: [{ type: 'outputContains', value: 'Checked by L2' }, { type: 'outputNotContains', value: 'Customer:' }] },
      hints: ['Нужна одна строка, а не весь файл — подойдёт `grep`.', '`grep "Checked by L2" ~/tickets/TCK-1042.txt`'],
      solution: 'grep "Checked by L2" ~/tickets/TCK-1042.txt',
      tags: ['grep'],
    },
  ],
  quiz: [
    {
      id: 'q-root-cause',
      type: 'text',
      prompt: 'Как по-английски называется «первопричина» проблемы, которую ищет L3? (два слова)',
      answer: { accept: ['root cause', 'rootcause', 'root-cause'] },
      explanation: '**Root cause** — первопричина; **RCA (root cause analysis)** — анализ первопричины.',
    },
    {
      id: 'q-level',
      type: 'text',
      prompt: 'Клиент спрашивает, где в интерфейсе кнопка экспорта. Ответ есть в базе знаний. Какой уровень поддержки должен закрыть такое обращение? (L1/L2/L3)',
      answer: { accept: ['L1', 'л1', '1', 'first line'] },
      explanation: 'Вопрос «как сделать» с ответом в базе знаний — работа **L1 (service desk)**.',
    },
    {
      id: 'q-escalation-type',
      type: 'choice',
      prompt: 'L3 понимает, что проблема в коде и нужна правка разработчиков. Какой это вид эскалации?',
      options: ['Иерархическая (hierarchical)', 'Функциональная (functional)', 'Это не эскалация, а изменение (change)'],
      correct: 1,
      explanation: 'Передача по экспертизе (L3 → разработка) — **функциональная** эскалация. Иерархическая — когда нужно решение менеджмента.',
    },
    {
      id: 'q-impact',
      type: 'text',
      prompt: 'Как по-английски называется пункт эскалации «влияние на клиентов/бизнес» — сколько пользователей затронуто, какие функции, деньги? (одно слово)',
      answer: { accept: ['impact', 'business impact'] },
      explanation: '**Impact** — влияние. Вместе с **urgency** (срочностью) он определяет приоритет.',
    },
  ],
  glossary: [
    { ru: 'Первопричина', en: 'root cause', def: 'Исходная причина проблемы; если её устранить, проблема не повторится.' },
    { ru: 'Эскалация', en: 'escalation', def: 'Передача обращения на более компетентный уровень или руководству.' },
    { ru: 'Обходное решение', en: 'workaround', def: 'Временный способ вернуть работу клиенту, пока причина не устранена.' },
    { ru: 'Шаги воспроизведения', en: 'steps to reproduce', def: 'Последовательность действий, при которой ошибка повторяется.' },
    { ru: 'Влияние', en: 'impact', def: 'Насколько сильно проблема затрагивает клиентов и бизнес.' },
  ],
};
export default lesson;
