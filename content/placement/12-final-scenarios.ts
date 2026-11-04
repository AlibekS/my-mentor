import type { PlacementTopic } from '../../src/content/types';

const t: PlacementTopic = {
  moduleId: '12-final-scenarios',
  questions: [
    {
      id: 'pl-fin-1',
      difficulty: 1,
      lessons: ['method'],
      prompt: 'Клиент: «сайт отдаёт 502». Какой первый шаг из перечисленных разумнее всего?',
      options: ['Перезагрузить все серверы', 'Проверить error.log прокси и статус бэкенда', 'Сразу писать разработчикам'],
      correct: 1,
    },
    {
      id: 'pl-fin-2',
      difficulty: 2,
      lessons: ['method'],
      prompt: 'После релиза 502. Исследуй сервер: какой сервис упал? Введи имя сервиса.',
      scenario: {
        services: [
          { name: 'nginx', description: 'nginx', active: 'active', enabled: true, logs: [] },
          { name: 'orders-api', description: 'Orders API', active: 'failed', enabled: true, logs: [{ time: '2026-11-04 14:01:00', priority: 'err', message: 'Error: Cannot find module "./config/prod.json"' }] },
        ],
      },
      answer: { accept: ['orders-api', 'orders-api.service'] },
    },
    { id: 'pl-fin-3', difficulty: 3, lessons: ['method', 'interview'], prompt: 'На собеседовании L3 спрашивают: «Как ты отличишь проблему на стороне клиента от проблемы на нашей стороне, если жалуется один клиент?» Назови один ключевой признак (ключевые слова: другие клиенты/только у него/воспроизвести).', answer: { accept: [], normalize: 'keywords', keywords: [['другие клиент', 'другим клиент', 'остальные', 'только у', 'воспроизв', 'reproduce', 'other customers', 'only one', 'мониторинг', 'метрик']] } },
  ],
};
export default t;
