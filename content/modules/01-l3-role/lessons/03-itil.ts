import type { LessonDef } from '../../../../src/content/types';

const records = `INC-501 | incident | 2026-11-03 14:05 | 502 on checkout | resolved | problem=PRB-77
INC-502 | incident | 2026-11-03 18:40 | 502 on checkout | resolved | problem=PRB-77
REQ-310 | request  | 2026-11-04 09:00 | access to Grafana for new L2 | done |
INC-503 | incident | 2026-11-04 08:15 | slow reports for ACME | in progress |
PRB-77  | problem  | 2026-11-03 20:00 | app crashes on empty address field | known error | workaround=restart app
CHG-120 | change   | 2026-11-03 14:12 | rollback release 2.14 | emergency | done
CHG-121 | change   | 2026-11-05 02:00 | release 2.14.1 with fix for PRB-77 | normal | scheduled
`;

const lesson: LessonDef = {
  id: 'itil',
  title: 'Инцидент vs проблема vs изменение (ITIL)',
  minutes: 25,
  commands: ['grep', 'wc', 'cat'],
  scenario: { files: { '/home/alibek/itsm/records.txt': { owner: 'alibek', content: records } } },
  tasks: [
    {
      id: 'incidents',
      prompt: 'Сколько записей типа **incident** в файле `~/itsm/records.txt`? Выведи число одной командой (или пайпом).',
      check: { type: 'outputNumber', value: 3 },
      hints: ['Нужно отфильтровать строки со словом `incident` и посчитать их.', '`grep -c` считает совпавшие строки. Или `grep ... | wc -l`.', '`grep -c "| incident" ~/itsm/records.txt`'],
      solution: 'grep -c "| incident" ~/itsm/records.txt',
      explanation: 'Аккуратно с шаблоном: просто `incident` совпадёт и с другими словами. Здесь безопасно искать `| incident` с разделителем. Оба способа — `grep -c` и `grep | wc -l` — верны.',
      tags: ['grep'],
    },
    {
      id: 'problem',
      prompt: 'Инциденты INC-501 и INC-502 связаны с одной **проблемой**. Найди запись этой проблемы и введи её текущий статус (как в файле).',
      answer: { accept: ['known error', 'known-error', 'известная ошибка'], label: 'Статус проблемы:' },
      hints: ['В строках инцидентов есть `problem=...`. Найди этот номер.', 'Потом `grep PRB-77 ~/itsm/records.txt` и посмотри статус в строке с типом problem.'],
      solution: 'grep "^PRB-77" ~/itsm/records.txt',
      explanation: 'Статус **known error**: причина известна, есть workaround (restart app), фикс запланирован изменением CHG-121.',
      tags: ['grep'],
    },
    {
      id: 'emergency',
      prompt: 'Выведи строку **экстренного изменения (emergency change)**, которым восстанавливали сервис.',
      check: { type: 'all', checks: [{ type: 'outputContains', value: 'CHG-120' }, { type: 'outputNotContains', value: 'CHG-121' }] },
      hints: ['Ищи слово `emergency`.'],
      solution: 'grep emergency ~/itsm/records.txt',
      tags: ['grep'],
    },
  ],
  quiz: [
    {
      id: 'q-incident-goal',
      type: 'text',
      prompt: 'Главная цель работы с **инцидентом** одним словом-глаголом: как можно быстрее … сервис.',
      answer: { accept: ['восстановить', 'восстановление', 'restore', 'вернуть', 'поднять', 'восстановить сервис', 'восстановить работу', 'восстановить работу сервиса', 'restore service', 'restore the service'] },
      explanation: 'Инцидент = **восстановить** сервис (restore service). Поиск первопричины — задача управления проблемами.',
    },
    {
      id: 'q-known-error',
      type: 'text',
      prompt: 'Как в ITIL называется проблема, у которой причина установлена и есть задокументированный обходной путь, но фикса ещё нет? (два слова на английском)',
      answer: { accept: ['known error'] },
      explanation: '**Known error** — известная ошибка; хранится в KEDB.',
    },
    {
      id: 'q-request',
      type: 'choice',
      prompt: 'Клиент просит выдать доступ к Grafana новому сотруднику. Что это в терминах ITIL?',
      options: ['Incident', 'Service request', 'Problem'],
      correct: 1,
      explanation: 'Ничего не сломано — это **service request** (запрос на обслуживание).',
    },
    {
      id: 'q-change-type',
      type: 'text',
      prompt: 'Ночью откатили релиз, чтобы остановить массовые 502. Какой это тип изменения? (одно слово, англ.)',
      answer: { accept: ['emergency', 'emergency change', 'экстренное'] },
      explanation: 'Срочное изменение для устранения инцидента — **emergency change**: одобряется ускоренно, документируется после.',
    },
  ],
  glossary: [
    { ru: 'Инцидент', en: 'incident', def: 'Незапланированное прерывание или ухудшение сервиса.' },
    { ru: 'Проблема', en: 'problem', def: 'Причина одного или нескольких инцидентов.' },
    { ru: 'Известная ошибка', en: 'known error', def: 'Проблема с известной причиной и обходным решением.' },
    { ru: 'Изменение', en: 'change', def: 'Добавление, модификация или удаление того, что влияет на сервис.' },
    { ru: 'Запрос на обслуживание', en: 'service request', def: 'Стандартный запрос пользователя, не связанный со сбоем.' },
    { ru: 'Среднее время восстановления', en: 'MTTR, mean time to restore', def: 'Сколько в среднем длится восстановление после инцидента.' },
  ],
};
export default lesson;
