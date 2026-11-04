import type { LessonDef } from '../../../../src/content/types';
import { scenario } from '../data';

const UTC_TIME = ['\\d{1,2}:\\d{2}\\s?UTC', 'UTC\\s?\\d{1,2}:\\d{2}'];
const NEXT = ['next update.{0,40}\\d{1,2}:\\d{2}', 'update.{0,30}(within|in)\\s+\\d+\\s*(min|minutes)', 'next update by'];

const lesson: LessonDef = {
  id: 'comms',
  title: 'Статус-апдейты для клиентов (EN)',
  minutes: 30,
  commands: ['cat', 'grep'],
  scenario,
  tasks: [
    {
      id: 'investigating',
      prompt: 'Напиши апдейт для статус-страницы на стадии **Investigating** (англ.). Обязательно: что затронуто глазами клиента, что вы делаете, обход (если есть), время следующего апдейта в UTC. **Без внутренних деталей** (имён серверов, пулов, сервисов вроде «payments-db»).',
      write: {
        lang: 'en',
        minWords: 25,
        rubric: [
          { label: 'investigating / aware', any: ['investigat', 'we are aware', 'looking into'] },
          { label: 'что затронуто (payments / checkout / orders)', any: ['payment', 'checkout', 'order'] },
          { label: 'влияние на клиентов', any: ['(some|many)\\s+(customers|users)', 'unable to', 'may (fail|not)', 'cannot', "can't", 'errors?'] },
          { label: 'следующий апдейт с временем', any: NEXT },
          { label: 'без внутренних деталей (pool, 5xx, имена серверов)', none: ['hikari', '\\bpool\\b', '5xx', 'payments-db', 'db-0', 'kubernetes', '\\bpods?\\b', 'reconcile', 'stack ?trace'] },
        ],
      },
      hints: ['Формула: что затронуто → что делаем → обход → следующий апдейт.', 'Пример влияния: «Some customers may be unable to complete card payments».', 'Внутренние термины (pool, 5xx, имена сервисов) — убери.'],
      solution: 'We are investigating elevated error rates affecting card payments at checkout. Some customers may be unable to complete their orders. Retrying the payment may succeed. Next update by 14:55 UTC.',
    },
    {
      id: 'times',
      prompt: 'Для финального сообщения нужно окно инцидента. По `~/incident/timeline.md` введи **время окончания влияния** на клиентов (когда ошибки вернулись к норме), `ЧЧ:ММ`.',
      answer: { accept: ['14:41'], label: 'Время UTC:' },
      hints: ['`cat ~/incident/timeline.md`'],
      solution: 'grep норм ~/incident/timeline.md',
    },
    {
      id: 'resolved',
      prompt: 'Напиши сообщение **Resolved** (англ.): окно влияния «between … and … UTC», что было (просто, без деталей), что сейчас всё работает, что с затронутыми заказами (деньги не списаны), извинение.',
      write: {
        lang: 'en',
        minWords: 30,
        rubric: [
          { label: 'resolved / back to normal', any: ['resolved', 'back to normal', 'processing normally', 'fully operational'] },
          { label: 'окно: between … and … UTC', any: ['between\\s+\\d{1,2}:\\d{2}.{0,15}and\\s+\\d{1,2}:\\d{2}', 'from\\s+\\d{1,2}:\\d{2}.{0,15}(to|until)\\s+\\d{1,2}:\\d{2}'] },
          { label: 'время в UTC', any: UTC_TIME },
          { label: 'причина простыми словами', any: ['due to', 'caused by', 'because of'] },
          { label: 'что с заказами/деньгами', any: ['not (been )?charged', 'no (customers were )?charge', 'were not billed', 'refund'] },
          { label: 'извинение', any: ['apologi[sz]e', 'sorry'] },
        ],
      },
      hints: ['Окно: 14:04–14:41 UTC.', 'Причина простыми словами: «a database capacity issue caused by a background job».', 'Обязательно скажи, что неуспешные оплаты не были списаны.'],
      solution: 'Between 14:04 and 14:41 UTC, some card payments failed due to a database capacity issue caused by a background job. The issue is resolved and all payments are processing normally. Affected orders were not charged. We apologize for the inconvenience.',
    },
  ],
  quiz: [
    { id: 'q-stages', type: 'text', prompt: 'Назови 4 стадии статус-страницы по порядку (англ., через запятую).', answer: { accept: [], normalize: 'keywords', keywords: [['investigating'], ['identified'], ['monitoring'], ['resolved']] }, explanation: 'Investigating → Identified → Monitoring → Resolved.' },
    { id: 'q-nonews', type: 'choice', prompt: 'Обещал апдейт в 14:55, новостей нет. Что делать?', options: ['Подождать новостей', 'Всё равно написать в 14:55: «still investigating», и следующий срок', 'Удалить предыдущий апдейт'], correct: 1, explanation: 'Регулярность важнее содержания: молчание пугает больше, чем «пока без изменений».' },
    { id: 'q-jargon', type: 'text', prompt: 'Перепиши для клиента: «5xx on /v1/charge due to Hikari pool exhaustion». (ключевые слова: payments/checkout и errors/fail)', answer: { accept: [], normalize: 'keywords', keywords: [['payment', 'checkout', 'order'], ['error', 'fail', 'unable', 'issue']] }, explanation: 'Например: «Some card payments are failing at checkout».' },
    { id: 'q-phrase', type: 'text', prompt: 'Как по-английски вежливо закончить сообщение об инциденте извинением? (фраза)', answer: { accept: [], normalize: 'keywords', keywords: [['apologi', 'sorry']] }, explanation: '«We apologize for the inconvenience.»' },
  ],
  glossary: [
    { ru: 'Статус-страница', en: 'status page', def: 'Публичная страница с текущим состоянием сервиса и инцидентами.' },
    { ru: 'Обходное решение', en: 'workaround', def: 'Что клиент может сделать, пока проблема не решена.' },
  ],
};
export default lesson;
