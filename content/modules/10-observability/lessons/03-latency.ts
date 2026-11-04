import type { LessonDef } from '../../../../src/content/types';
import { obs } from '../data';

const P95 = 'histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket{service="checkout"}[5m])))';

const lesson: LessonDef = {
  id: 'latency',
  title: 'Перцентили p50/p95/p99 и histogram_quantile',
  minutes: 25,
  scenario: {},
  obs,
  tasks: [
    {
      id: 'p95',
      prompt: 'Построй **p95 задержки checkout** через `histogram_quantile` по метрике `http_request_duration_seconds_bucket`, окно `[5m]`.',
      obs: 'promql',
      hints: ['Шаблон: `histogram_quantile(0.95, sum by (le) (rate(<метрика>{service="checkout"}[5m])))`.'],
      solution: P95,
    },
    {
      id: 'p50',
      prompt: 'Теперь **медиану (p50)** checkout — и сравни: насколько хвост хуже медианы во время инцидента?',
      obs: 'promql',
      hints: ['Тот же запрос с `0.5`.'],
      solution: P95.replace('0.95', '0.5'),
    },
    {
      id: 'value',
      prompt: 'Какое значение показывает p95 checkout в 14:30 (в секундах)? Введи число.',
      answer: { accept: ['5'], normalize: 'number', label: 'p95, с:' },
      hints: ['Наведи курсор на график p95 в 14:30.'],
      solution: P95,
      obs: 'promql',
      explanation: 'p95 «упирается» в 5 с — это верхняя конечная граница бакетов. Реальные запросы ждут таймаута 30 с, но гистограмма точнее не умеет: важно знать её ограничения.',
    },
    {
      id: 'by-service',
      prompt: 'Построй p99 **по сервисам** (checkout и payments на одном графике).',
      obs: 'promql',
      hints: ['Сохрани метку service: `sum by (le, service) (...)`.'],
      solution: 'histogram_quantile(0.99, sum by (le, service) (rate(http_request_duration_seconds_bucket[5m])))',
    },
  ],
  quiz: [
    { id: 'q-p95', type: 'text', prompt: 'p95 = 800 мс. Какая доля запросов выполняется **дольше** 800 мс? (в процентах, число)', answer: { accept: ['5'], normalize: 'number' }, explanation: '95% быстрее, 5% медленнее.' },
    { id: 'q-avg', type: 'choice', prompt: 'Почему SLO задержки формулируют через перцентиль, а не среднее?', options: ['Среднее сложно посчитать', 'Среднее скрывает «хвост» медленных запросов, которые и видят недовольные клиенты', 'Так требует Prometheus'], correct: 1, explanation: 'Перцентили показывают опыт худших N% пользователей.' },
    { id: 'q-le', type: 'text', prompt: 'Какую метку обязательно сохранить в `sum by (…)` перед `histogram_quantile`?', answer: { accept: ['le'] }, explanation: '`le` — граница бакета.' },
    { id: 'q-pay', type: 'promql', prompt: 'Напиши запрос p95 задержки сервиса **payments**.', solution: 'histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket{service="payments"}[5m])))', explanation: 'Тот же шаблон с `{service="payments"}`.' },
  ],
  glossary: [
    { ru: 'Перцентиль', en: 'percentile (p95, p99)', def: 'Значение, быстрее которого выполняются N% запросов.' },
    { ru: 'Гистограмма', en: 'histogram', def: 'Счётчики попаданий в корзины по границам le.' },
    { ru: 'Хвост задержки', en: 'tail latency', def: 'Медленные запросы в верхних перцентилях.' },
  ],
};
export default lesson;
