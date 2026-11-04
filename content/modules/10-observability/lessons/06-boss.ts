import type { LessonDef } from '../../../../src/content/types';
import { DASHBOARD, obs } from '../data';

const lesson: LessonDef = {
  id: 'boss',
  kind: 'boss',
  title: 'Почему тормозит оформление заказа',
  minutes: 40,
  incident: { ticket: 'INC-8104: «Оплаты зависают на 30 с и падают с обеда»', severity: 'SEV2', customer: 'Mega Retail (Enterprise) и др.' },
  scenario: {},
  obs: { ...obs, dashboard: DASHBOARD },
  tasks: [
    {
      id: 'errors',
      prompt: 'Построй **долю 5xx по сервисам** (PromQL, окно `[5m]`, доля 0–1). Это первый график в любом расследовании.',
      obs: 'promql',
      hints: ['`sum by (service) (rate(http_requests_total{code=~"5.."}[5m])) / sum by (service) (rate(http_requests_total[5m]))`'],
      solution: 'sum by (service) (rate(http_requests_total{code=~"5.."}[5m])) / sum by (service) (rate(http_requests_total[5m]))',
    },
    {
      id: 'p99',
      prompt: 'Подтверди таймауты: построй **p99 задержки payments** (окно `[5m]`).',
      obs: 'promql',
      hints: ['`histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket{service="payments"}[5m])))`'],
      solution: 'histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket{service="payments"}[5m])))',
    },
    {
      id: 'saturation',
      prompt: 'Какой ресурс payments насыщен? Найди метрику, которая в инцидент упирается в максимум, и введи её **имя**.',
      answer: { accept: [], normalize: 'keywords', keywords: [['db_pool_connections_in_use', 'db_pool_wait_seconds']], label: 'Метрика:' },
      hints: ['Список метрик — кнопка «Метрики» под редактором.', 'Ищи db_pool_*.'],
      solution: 'db_pool_connections_in_use',
      obs: 'promql',
    },
    {
      id: 'logs',
      prompt: 'Найди в логах ошибки payments, связанные с соединениями (фраза `"Connection is not available"`).',
      obs: 'logs',
      hints: ['`service:payments AND "Connection is not available"`'],
      solution: 'service:payments AND "Connection is not available"',
    },
    {
      id: 'root',
      prompt: 'Найди первопричину в логах payments (предупреждения и события около 14:02). Какой **индекс отсутствует** по сообщению о медленном запросе? Введи `таблица.столбец`.',
      answer: { accept: [], normalize: 'keywords', keywords: [['refunds.payment_id', 'refunds(payment_id)', 'refunds (payment_id)']], label: 'Индекс на:' },
      hints: ['`service:payments AND level:warn`'],
      solution: 'service:payments AND level:warn',
      obs: 'logs',
      explanation: 'Новый ежедневный отчёт `reconcile-report` (релиз 3.7.0, запуск в 14:02) выполнял JOIN payments×refunds за 90 дней без индекса на `refunds.payment_id` — каждый запрос ~29 с, отчёт занял все 50 соединений пула. Обычные платежи ждали соединение 30 с и падали.',
    },
    {
      id: 'end',
      prompt: 'Когда инцидент закончился сам (ошибки payments вернулись к норме)? Введи `ЧЧ:ММ` (±3 минуты) — и сверь с логом завершения отчёта.',
      answer: { accept: [], normalize: 'keywords', keywords: [['14:40', '14:41', '14:42', '14:43', '14:44', '14:45', '14:46', '14:47']], label: 'Время:', placeholder: 'ЧЧ:ММ' },
      hints: ['Наведи курсор на график ошибок или пула.', 'Лог `reconcile-report job finished`.'],
      solution: 'reconcile-report AND finished',
      obs: 'logs',
    },
  ],
  quiz: [
    { id: 'q-rca', type: 'text', prompt: 'RCA одной фразой (ключевые слова: отчёт/reconcile, пул соединений, индекс).', answer: { accept: [], normalize: 'keywords', keywords: [['отчет', 'отчёт', 'reconcile', 'report', 'job'], ['пул', 'pool', 'соединен', 'connection'], ['индекс', 'index', 'медленн', 'slow']] }, explanation: 'Новый отчёт reconcile-report выполнял медленный запрос без индекса и занял весь пул соединений payments → платежи ждали 30 с и падали.' },
    { id: 'q-actions', type: 'text', prompt: 'Назови 2 action item: первый — про **индекс**, второй — на выбор: отдельный пул/реплика для отчётов, алерт на пул или таймаут запроса.', answer: { accept: [], normalize: 'keywords', keywords: [['индекс', 'index'], ['пул', 'pool', 'реплик', 'replica', 'алерт', 'alert', 'таймаут', 'timeout', 'statement_timeout', 'ночь', 'окно']] }, explanation: 'Индекс на refunds.payment_id; отчёты — на реплику или отдельный пул; statement_timeout; алерт на занятость пула > 90%.' },
    { id: 'q-chain', type: 'choice', prompt: 'Почему ошибки были и у checkout, хотя причина в payments?', options: ['checkout тоже упёрся в пул', 'checkout вызывает payments и получает от него ошибки/таймауты — каскад', 'Совпадение'], correct: 1, explanation: 'Каскадные отказы: зависимый сервис «краснеет» следом. Поэтому ищем первого и самого красного.' },
  ],
  glossary: [
    { ru: 'Каскадный отказ', en: 'cascading failure', def: 'Отказ одного сервиса вызывает ошибки у зависящих от него.' },
    { ru: 'Таймаут запроса к БД', en: 'statement_timeout', def: 'Ограничение времени выполнения SQL-запроса.' },
  ],
};
export default lesson;
