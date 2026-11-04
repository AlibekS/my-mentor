import type { PlacementTopic } from '../../src/content/types';

const t: PlacementTopic = {
  moduleId: '10-observability',
  questions: [
    { id: 'pl-obs-1', difficulty: 1, lessons: ['pillars'], prompt: 'Назови три «столпа» наблюдаемости (metrics, logs и …?) — одно слово, англ.', answer: { accept: ['traces', 'trace', 'tracing', 'трейсы', 'трассировки'] } },
    { id: 'pl-obs-2', difficulty: 2, lessons: ['pillars'], prompt: 'Методика RED для сервисов: Rate, Errors и …? (одно слово, англ.)', answer: { accept: ['Duration', 'latency'] } },
    { id: 'pl-obs-3', difficulty: 3, lessons: ['latency'], prompt: 'Что показывает p99 latency = 2 с? Ответь: какая доля запросов быстрее 2 секунд? (в процентах, число)', answer: { accept: ['99'], normalize: 'number' } },
    { id: 'pl-obs-4', difficulty: 2, lessons: ['pillars'], prompt: 'Как называется открытый стандарт/набор SDK для сбора метрик, логов и трейсов, поддерживаемый CNCF? (англ.)', answer: { accept: ['OpenTelemetry', 'otel', 'open telemetry'] } },
  ],
};
export default t;
