import type { LessonDef } from '../../../../src/content/types';
import { FAILED_CUSTOMERS, FAILED_ORDERS, scenario } from '../data';

const lesson: LessonDef = {
  id: 'postmortem',
  title: 'Постмортем: impact, timeline, MTTD/MTTA/MTTR, action items',
  minutes: 35,
  commands: ['grep', 'wc', 'cut', 'sort'],
  scenario,
  tasks: [
    {
      id: 'failed-orders',
      prompt: 'Цифры влияния: посчитай по `~/incident/orders.log`, сколько заказов **не оплачено** из-за инцидента (`status=failed`). Выведи число командой.',
      check: { type: 'outputNumber', value: FAILED_ORDERS },
      hints: ['`grep -c status=failed ~/incident/orders.log`'],
      solution: 'grep -c status=failed ~/incident/orders.log',
      tags: ['grep'],
    },
    {
      id: 'customers',
      prompt: 'Сколько **разных клиентов** затронуто (поле `customer=`)? Выведи число одним пайпом.',
      check: { type: 'outputNumber', value: FAILED_CUSTOMERS },
      hints: ['Отфильтруй failed, достань поле customer: `grep -o "customer=C[0-9]*"`.', 'Потом `sort -u | wc -l`.'],
      solution: 'grep status=failed ~/incident/orders.log | grep -o "customer=C[0-9]*" | sort -u | wc -l',
      tags: ['grep', 'pipes'],
    },
    {
      id: 'mttr',
      prompt: 'Посчитай **MTTR** (от начала влияния до восстановления) по `~/incident/timeline.md` в минутах.',
      answer: { accept: ['37'], normalize: 'number', label: 'MTTR, мин:' },
      hints: ['Начало — рост 5xx, восстановление — ошибки вернулись к норме.', '14:41 − 14:04.'],
      solution: 'cat ~/incident/timeline.md\n# 14:41 − 14:04 = 37 минут',
    },
    {
      id: 'actions',
      prompt: 'Напиши **3+ action items** в формате списка: каждая строка — `- [P1|P2] действие — owner: @кто — due: ГГГГ-ММ-ДД`. Должны быть: индекс, изоляция отчётов от платежей (реплика/отдельный пул) и алерт на пул.',
      write: {
        lang: 'ru',
        minWords: 25,
        template: '- [P1]  — owner: @ — due: 2026-11-\n- [P2]  — owner: @ — due: 2026-11-\n- [P2]  — owner: @ — due: 2026-11-',
        rubric: [
          { label: '3+ строк с owner и due', any: ['^-[^\\n]*owner:[ \\t]*@\\w+[^\\n]*due:[ \\t]*\\d{4}-\\d{2}-\\d{2}'], minMatches: 3 },
          { label: 'приоритеты [P1]/[P2]', any: ['\\[P[0-3]\\]'] },
          { label: 'индекс', any: ['индекс', 'index'] },
          { label: 'изоляция отчётов: реплика / отдельный пул', any: ['реплик', 'replica', 'отдельн\\S* пул', 'separate pool', 'изолир'] },
          { label: 'алерт на пул', any: ['алерт', 'alert'] },
        ],
      },
      hints: ['Скопируй формат из теории и подставь свои действия.', 'owner — команда или человек через @, due — дата в формате 2026-11-10.'],
      solution: '- [P1] Добавить индекс на refunds.payment_id — owner: @payments-team — due: 2026-11-06\n- [P1] Перенести отчёты на read-replica с отдельным пулом — owner: @dias — due: 2026-11-20\n- [P2] Алерт на занятость пула > 90% 2 минуты, severity page — owner: @alibek — due: 2026-11-10',
    },
  ],
  quiz: [
    { id: 'q-mttd', type: 'text', prompt: 'Что такое MTTD? Расшифруй (англ.).', answer: { accept: [], normalize: 'keywords', keywords: [['time'], ['detect']] }, explanation: 'Mean Time To Detect — от начала проблемы до обнаружения (алерта).' },
    { id: 'q-mtta', type: 'text', prompt: 'Алерт в 03:10, дежурный подтвердил в 03:24. Чему равен MTTA (минут)?', answer: { accept: ['14'], normalize: 'number' }, explanation: 'Time to acknowledge = 03:24 − 03:10 = 14 мин.' },
    { id: 'q-ai', type: 'choice', prompt: 'Какой action item сформулирован правильно?', options: ['Улучшить мониторинг', 'Добавить алерт «db pool > 90% 2m» (page) — owner: @alibek — due: 2026-11-10', 'Быть внимательнее при релизах'], correct: 1, explanation: 'Конкретное действие + владелец + срок.' },
    { id: 'q-rfo', type: 'text', prompt: 'Как называется упрощённая версия постмортема для клиента? (аббревиатура из 3 букв, англ.)', answer: { accept: ['RFO'] }, explanation: 'RFO — reason for outage.' },
  ],
  glossary: [
    { ru: 'Постмортем', en: 'postmortem / post-incident review', def: 'Документ-разбор инцидента с выводами и задачами.' },
    { ru: 'Время до восстановления', en: 'MTTR', def: 'От начала влияния до восстановления сервиса.' },
    { ru: 'Задача по итогам', en: 'action item', def: 'Конкретное действие с владельцем и сроком.' },
  ],
};
export default lesson;
