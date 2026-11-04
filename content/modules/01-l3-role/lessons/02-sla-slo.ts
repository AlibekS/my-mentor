import type { LessonDef } from '../../../../src/content/types';

const metrics = [
  '# date       requests  errors',
  '2026-11-01   120000    60',
  '2026-11-02   118500    40',
  '2026-11-03   121200    1900',
  '2026-11-04   119800    70',
].join('\n') + '\n';

const lesson: LessonDef = {
  id: 'sla-slo',
  title: 'SLA, SLO, SLI и приоритеты',
  minutes: 25,
  commands: ['cat', 'grep', 'head', 'tail'],
  scenario: {
    files: {
      '/home/alibek/sla/policy.txt': {
        owner: 'alibek',
        content: `SLA policy — L3 Quest SaaS
P1 Critical: response 15m, resolve 4h
P2 High: response 1h, resolve 8h
P3 Medium: response 4h, resolve 3d
P4 Low: response 1d, resolve planned
Availability SLA: 99.9% monthly
Internal SLO: 99.95% monthly
`,
      },
      '/home/alibek/sla/availability.txt': { owner: 'alibek', content: metrics },
    },
  },
  tasks: [
    {
      id: 'p2-response',
      prompt: 'В файле `~/sla/policy.txt` описана политика SLA. Выведи только строку с условиями для **P2**.',
      check: { type: 'all', checks: [{ type: 'outputContains', value: 'P2 High' }, { type: 'outputNotContains', value: 'P1' }] },
      hints: ['Нужна одна строка — фильтруем `grep`.', '`grep P2 ~/sla/policy.txt`'],
      solution: 'grep P2 ~/sla/policy.txt',
      tags: ['grep'],
    },
    {
      id: 'bad-day',
      prompt: 'В `~/sla/availability.txt` — запросы и ошибки по дням. В какой день было больше всего ошибок? Введи дату в формате `2026-11-0X`.',
      answer: { accept: ['2026-11-03', '03.11.2026', '3 ноября'], label: 'Дата:' },
      hints: ['Открой файл командой `cat` и сравни колонку errors.', 'Если строк будет много — пригодится `sort -k3 -n` (сортировка по 3-й колонке как числа). Разберём в модуле «Логи».'],
      solution: 'cat ~/sla/availability.txt',
      explanation: '1900 ошибок 3 ноября — это ≈1,6% запросов за день. Для SLO 99,95% такой день почти целиком съедает месячный бюджет ошибок.',
    },
    {
      id: 'budget',
      prompt: 'SLA доступности — 99,9% в месяц (30 дней). Сколько **минут** простоя допускает такой SLA? Посчитай и введи число (округли до целого).',
      answer: { accept: ['43', '43.2'], normalize: 'number', label: 'Минут:' },
      hints: ['Формула: (1 − 0,999) × 30 × 24 × 60.', '0,001 × 43 200 минут = ?'],
      solution: '# 0.001 * 30 * 24 * 60 = 43.2 минуты',
      explanation: '«Три девятки» — это около **43 минут** простоя в месяц.',
    },
  ],
  quiz: [
    {
      id: 'q-sli',
      type: 'text',
      prompt: 'Как называется *измеряемый показатель* качества сервиса, например «доля успешных запросов»? (аббревиатура)',
      answer: { accept: ['SLI', 'service level indicator'] },
      explanation: '**SLI** — индикатор; SLO — цель по нему; SLA — договор.',
    },
    {
      id: 'q-penalty',
      type: 'choice',
      prompt: 'Нарушение какого из показателей обычно приводит к компенсации клиенту?',
      options: ['SLI', 'SLO', 'SLA'],
      correct: 2,
      explanation: 'Компенсации прописаны в **SLA** — договоре. SLO — внутренняя цель команды.',
    },
    {
      id: 'q-priority',
      type: 'text',
      prompt: 'Checkout недоступен у всех клиентов, деньги не принимаются. Какой приоритет поставишь? (P1–P4)',
      answer: { accept: ['P1', 'p1', 'critical', '1'] },
      explanation: 'Массовая недоступность ключевой функции — **P1 / Critical**.',
    },
    {
      id: 'q-9999',
      type: 'text',
      prompt: 'Сколько примерно минут простоя в месяц допускает доступность 99,99%? (число, можно с десятыми)',
      answer: { accept: ['4.3', '4.32', '4'], normalize: 'number' },
      explanation: '0,0001 × 43 200 = **4,32 минуты**. Каждая «девятка» уменьшает бюджет в 10 раз.',
    },
    {
      id: 'q-budget-term',
      type: 'text',
      prompt: 'Как по-английски называется «бюджет ошибок» — допустимая доля сбоев при заданном SLO? (два слова)',
      answer: { accept: ['error budget'] },
      explanation: '**Error budget** = 100% − SLO.',
    },
  ],
  glossary: [
    { ru: 'Индикатор уровня сервиса', en: 'SLI, Service Level Indicator', def: 'Измеряемая метрика качества: доступность, задержка, доля ошибок.' },
    { ru: 'Цель уровня сервиса', en: 'SLO, Service Level Objective', def: 'Внутренняя целевая величина SLI за период.' },
    { ru: 'Соглашение об уровне сервиса', en: 'SLA, Service Level Agreement', def: 'Договорные обязательства перед клиентом с последствиями при нарушении.' },
    { ru: 'Бюджет ошибок', en: 'error budget', def: 'Допустимая доля неуспеха: 100% − SLO.' },
    { ru: 'Нарушение SLA', en: 'SLA breach', def: 'Таймер реакции или решения истёк до выполнения.' },
  ],
};
export default lesson;
