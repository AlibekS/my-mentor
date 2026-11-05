import type { LessonDef } from '../../../../../src/content/types';
import { escalationScenario, L4 } from '../data';

const lesson: LessonDef = {
  id: 'escalation',
  title: 'Эскалация в L3 на английском',
  minutes: 30,
  commands: ['cat', 'grep', 'head'],
  scenario: escalationScenario,
  tasks: [
    {
      id: 'count-errors',
      prompt: 'Тикет `~/tickets/ZD-5401.txt` (бизнес-клиент, «CSV export is broken»). Для раздела Impact посчитай в `/var/log/app/api.log`: **сколько запросов экспорта** (`/api/reports/export`) завершились ошибкой **500**? Введи число.',
      answer: { accept: [String(L4.exportErrors)], normalize: 'number', label: 'Ошибок экспорта:' },
      hints: ['Сначала отбери строки экспорта: `grep export /var/log/app/api.log`.', 'Потом посчитай среди них ошибки: `… | grep -c 500` (или `grep -c "status=500"`).'],
      solution: 'grep export /var/log/app/api.log | grep -c 500',
      explanation: `Все ${L4.exportErrors} запросов экспорта после ${L4.firstExportErrorTime} UTC — с ошибкой, а до этого экспорт работал (200). Другие запросы (orders, cart…) — 200: сломан именно экспорт.`,
    },
    {
      id: 'first-request',
      prompt: 'Главное доказательство для L3 — **request_id**. Найди **первую** ошибку экспорта и введи её request_id (вида `req-…`).',
      answer: { accept: [L4.firstExportError], normalize: 'keywords', keywords: [[L4.firstExportError]], label: 'request_id:', placeholder: 'req-…' },
      hints: ['Ошибки помечены словом ERROR: `grep ERROR /var/log/app/api.log`.', 'Первая — `… | head -n 1`; request_id идёт сразу после ERROR.'],
      solution: 'grep ERROR /var/log/app/api.log | head -n 1',
      explanation: `${L4.firstExportError} в ${L4.firstExportErrorTime} UTC, ошибка \`column vat_id does not exist\` — понятная зацепка для разработчиков.`,
    },
    {
      id: 'release',
      prompt: 'Что изменилось **прямо перед** первой ошибкой? Посмотри `/var/log/app/deploy.log` и введи **версию** релиза, который выкатили утром.',
      answer: { accept: [L4.release], normalize: 'keywords', keywords: [[L4.release, '4.2']], label: 'Версия:' },
      hints: ['`cat /var/log/app/deploy.log`', 'Сравни время деплоя со временем первой ошибки.'],
      solution: 'cat /var/log/app/deploy.log',
      explanation: `reports-service ${L4.release} закончил деплой в 08:09 UTC, а в строке миграции «add column vat_id — skipped»: столбец не добавился. Это факт для эскалации; чинить — L3.`,
    },
    {
      id: 'write-escalation',
      prompt: 'Напиши **эскалацию в L3 на английском** по шаблону (он уже в редакторе): Summary, Impact, Steps to reproduce, Expected / Actual, Evidence (request_id, время в UTC, ошибка, связь с релизом), What I tried, Priority. Только факты.',
      write: {
        lang: 'en',
        minWords: 45,
        rows: 16,
        template: 'Summary: \nImpact: \nSteps to reproduce:\n1. \n2. \nExpected: \nActual: \nEvidence: \nWhat I tried: \nPriority: \n',
        rubric: [
          { label: 'что сломано: CSV export', any: ['export', '\\bcsv\\b'] },
          { label: 'влияние: сколько пользователей / все запросы', any: ['\\ball (users|customers|exports|export requests|requests)', 'nobody', 'no one', '\\b\\d+\\s+(users|customers|people|requests|errors)', 'whole team', 'entire team', 'every (user|export|request)'] },
          { label: 'шаги воспроизведения (списком)', any: ['^[ \\t]*1[.)][ \\t]*\\S', 'click[^\\n]{0,30}export', 'open[^\\n]{0,30}report'] },
          { label: 'ошибка 500', any: ['\\b500\\b'] },
          { label: 'request_id из лога (req-…)', any: ['req-[0-9a-f]{5}'] },
          { label: 'время в UTC', any: ['\\d{1,2}:\\d{2}[^\\n]{0,15}utc', 'utc[^\\n]{0,15}\\d{1,2}:\\d{2}'] },
          { label: `связь с релизом ${L4.release} (deploy)`, any: ['4\\.2', 'deploy', 'release'] },
          { label: 'что проверено (браузеры, другие запросы…)', any: ['chrome', '\\bedge\\b', 'browser', 'checked', 'other (endpoints?|requests?|users?|accounts?|pages?)', 'same (error|result)', 'clear(ed)? (the )?cache', '\\b(can|could)(not| not)? reproduce', 'reproduced'] },
          { label: 'без поиска виноватых', none: ['developers? broke', 'someone broke', 'devs? broke', "(devs?|developers?)['’]?s? fault", '\\bstupid\\b', '\\bidiots?\\b'] },
        ],
      },
      hints: [
        'Факты: ошибок экспорта — из задания 1, request_id — из задания 2, релиз и время — из задания 3; браузеры — в тикете.',
        'Impact: *Business customer, 25 users. All export requests fail since 08:13 UTC.*',
        'Связь с релизом — как факт по времени: *reports-service 4.2.0 was deployed at 08:09 UTC.* Без «разработчики сломали».',
      ],
      solution: `Summary: CSV export fails with error 500 for all users of a business account (Anna Schmidt, anna.schmidt@web.de).
Impact: business customer, 25 users. All ${L4.exportErrors} export requests failed since ${L4.firstExportErrorTime} UTC. Other API requests work (200).
Steps to reproduce:
1. Log in as a user of the account.
2. Open Reports and click "Export CSV".
Expected: the CSV file is downloaded.
Actual: "Error 500".
Evidence: api.log, first error ${L4.firstExportError} at ${L4.firstExportErrorTime} UTC, error="column vat_id does not exist". reports-service ${L4.release} was deployed at 08:09 UTC, the migration "add column vat_id" was skipped.
What I tried: the customer tried Chrome and Edge, same error.
Priority: high, the customer needs the reports for a meeting today at 15:00.`,
    },
  ],
  quiz: [
    {
      id: 'q-cache',
      type: 'text',
      prompt: 'Переведи: *We tried clearing the cache, but the error is still there.*',
      answer: { accept: ['Мы попробовали очистить кэш, но ошибка осталась'], normalize: 'keywords', keywords: [['кэш', 'кеш', 'cache'], ['ошибк', 'проблем']] },
      explanation: '«Мы попробовали очистить кэш, но ошибка осталась». *still there* — «всё ещё есть».',
    },
    {
      id: 'q-expected',
      type: 'text',
      prompt: 'Переведи пару полей эскалации: *Expected* / *Actual*.',
      answer: { accept: ['ожидалось / на самом деле'], normalize: 'keywords', keywords: [['ожида'], ['факт', 'на самом деле', 'реальн', 'получ', 'произош', 'вышло', 'есть']] },
      explanation: 'Expected — что должно было произойти; Actual — что произошло на самом деле.',
    },
    {
      id: 'q-request-id',
      type: 'text',
      prompt: 'Зачем L3 нужен **request_id** из лога? (одной фразой)',
      answer: { accept: ['чтобы найти запрос в логах'], normalize: 'keywords', keywords: [['найти', 'поиск', 'отследить', 'найдёт', 'найдет', 'искать', 'trace', 'find', 'search']] },
      explanation: 'По request_id инженер за секунды найдёт этот запрос во всех сервисах и логах (трейсинг).',
    },
    {
      id: 'q-summary',
      type: 'choice',
      prompt: 'Какое Summary лучше?',
      options: ['Export doesn\'t work, please check ASAP!!!', 'CSV export fails with error 500 for all users of a business account since 08:13 UTC', 'Developers broke the export in the new release'],
      correct: 1,
      explanation: 'Что сломано, у кого, с какого времени — в одной строке. Без капса и без поиска виноватых.',
    },
  ],
  glossary: [
    { ru: 'Эскалация', en: 'escalation', def: 'Передача тикета на следующий уровень (L3, разработка) с фактами.' },
    { ru: 'Влияние', en: 'impact', def: 'Сколько клиентов затронуто, насколько серьёзно, с какого времени.' },
    { ru: 'Доказательства', en: 'evidence', def: 'request_id, строки логов, время UTC, номера заказов, запросы SQL.' },
    { ru: 'Идентификатор запроса', en: 'request ID', def: 'Уникальный номер запроса: по нему находят запрос во всех сервисах.' },
    { ru: 'Без поиска виноватых', en: 'blameless', def: 'Пишем факты и последствия, а не «кто виноват».' },
  ],
};
export default lesson;
