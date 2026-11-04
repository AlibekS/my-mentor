import type { LessonDef } from '../../../../src/content/types';
import { scenario } from '../data';

const lesson: LessonDef = {
  id: 'triage',
  title: 'Триаж: severity, роли, объявление инцидента',
  minutes: 25,
  commands: ['cat', 'grep'],
  scenario,
  tasks: [
    {
      id: 'alerts',
      prompt: 'Посмотри сработавшие алерты в `~/incident/alerts.log`. Какой процент ошибок у **payments** в алерте? Введи число.',
      answer: { accept: ['42.6', '42,6', '43'], normalize: 'number', label: 'Ошибок, %:' },
      hints: ['`grep FIRING ~/incident/alerts.log`'],
      solution: 'grep payments ~/incident/alerts.log',
    },
    {
      id: 'sev',
      prompt: 'По матрице `~/incident/severity.md` определи severity: ключевая функция (оплата) деградировала, ошибки 40%+, но сайт открывается. Введи SEV1–SEV4.',
      answer: { accept: ['SEV2', 'sev2', '2'], label: 'Severity:' },
      hints: ['`cat ~/incident/severity.md`', 'Ошибки > 10% у ключевой функции, но не полная недоступность.'],
      solution: 'cat ~/incident/severity.md',
      explanation: '**SEV2**: заметная часть клиентов не может оплатить. Если бы падали 100% оплат — SEV1.',
    },
    {
      id: 'declare',
      prompt: 'Напиши **объявление инцидента** для канала `#incidents` на английском. Обязательно: severity, что сломано и влияние (impact), время начала **в UTC**, кто IC, канал инцидента и время следующего апдейта.',
      write: {
        lang: 'en',
        minWords: 25,
        template: 'SEV? declared: \nImpact: \nIC: \nChannel: \nNext update: ',
        rubric: [
          { label: 'severity (SEV1–SEV4)', any: ['\\bSEV\\s?[1-4]\\b', 'severity\\s*[:-]?\\s*[1-4]'] },
          { label: 'impact: что и у кого', any: ['impact[ \\t]*:[ \\t]*\\S.{8,}', '\\d+\\s?%.{0,40}(fail|error|payment|checkout)', '(customers|users).{0,40}(cannot|can\'t|unable|fail)'] },
          { label: 'время начала в UTC', any: ['\\d{1,2}:\\d{2}\\s?UTC', 'UTC\\s?\\d{1,2}:\\d{2}'] },
          { label: 'IC (incident commander)', any: ['\\bIC[ \\t]*[:\\-]?[ \\t]*@?\\w+', 'incident commander[ \\t]*[:\\-]?[ \\t]*@?\\w+'] },
          { label: 'канал инцидента', any: ['#[\\w-]+', 'channel[ \\t]*:[ \\t]*\\S+'] },
          { label: 'следующий апдейт (время)', any: ['next update.{0,30}\\d{1,2}:\\d{2}', 'next update.{0,20}(in|within)\\s+\\d+\\s*(min|minutes)'] },
        ],
      },
      hints: ['Используй шаблон в редакторе, заполни каждую строку.', 'Пример влияния: `~40% of payment attempts fail since 14:04 UTC`.', 'Следующий апдейт — через 30 минут для SEV2.'],
      solution: 'SEV2 declared: payment failures on checkout\nImpact: ~40% of payment attempts fail since 14:04 UTC, customers cannot complete orders.\nIC: @alibek\nChannel: #inc-8104\nNext update: 14:48 UTC',
      tags: ['write'],
    },
  ],
  quiz: [
    { id: 'q-ic', type: 'choice', prompt: 'Что делает Incident Commander?', options: ['Сам чинит самое сложное', 'Координирует: роли, решения, ритм апдейтов — и не уходит в отладку сам', 'Пишет постмортем через неделю'], correct: 1, explanation: 'IC держит картину целиком; «руки» — другие люди.' },
    { id: 'q-doubt', type: 'text', prompt: 'Сомневаешься между SEV2 и SEV3. Какую ставить? (номер)', answer: { accept: ['SEV2', '2', 'sev2'] }, explanation: 'Ставь выше: понизить легко, опоздать с реакцией — дорого.' },
    { id: 'q-scribe', type: 'text', prompt: 'Как называется роль, которая ведёт хронологию инцидента? (англ., одно слово)', answer: { accept: ['scribe'] }, explanation: 'Scribe — его записи станут таймлайном постмортема.' },
    { id: 'q-utc', type: 'text', prompt: 'В какой временной зоне указывают время в сообщениях об инциденте международной команды?', answer: { accept: ['UTC'] }, explanation: 'UTC — без путаницы между Алматы, Берлином и Сан-Франциско.' },
  ],
  glossary: [
    { ru: 'Уровень серьёзности', en: 'severity (SEV)', def: 'Оценка влияния инцидента на клиентов и бизнес.' },
    { ru: 'Руководитель инцидента', en: 'incident commander (IC)', def: 'Координирует работу над инцидентом.' },
    { ru: 'Объявить инцидент', en: 'declare an incident', def: 'Официально запустить процесс: severity, IC, канал.' },
  ],
};
export default lesson;
