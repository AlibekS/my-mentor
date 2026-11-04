import type { LessonDef } from '../../../../src/content/types';
import { DASHBOARD, obs } from '../data';

const lesson: LessonDef = {
  id: 'pillars',
  title: 'Метрики, логи, трейсы. RED и USE. Чтение дашборда',
  minutes: 25,
  scenario: {},
  obs: { ...obs, dashboard: DASHBOARD },
  tasks: [
    {
      id: 'when',
      prompt: 'Открой вкладку **Дашборд**. Наведи курсор на панель «Доля ошибок 5xx». Примерно во сколько начался рост ошибок? Введи время `ЧЧ:ММ` (с точностью до пары минут).',
      answer: { accept: ['14:03', '14:04', '14:05', '14:06', '14:07', '14:08'], label: 'Время:' },
      hints: ['Ищи момент, когда линии выходят выше пунктирного порога 5%.', 'Подсказка с точными значениями появляется при наведении.'],
      solution: 'Дашборд → панель «Доля ошибок 5xx» → излом около 14:04',
    },
    {
      id: 'who',
      prompt: 'У какого сервиса доля ошибок **выше всех** во время инцидента? Введи имя сервиса.',
      answer: { accept: ['payments'], label: 'Сервис:' },
      hints: ['Сравни линии на панели ошибок (или переключи панель в «Таблица» — там максимум).'],
      solution: 'Дашборд → «Доля ошибок 5xx» → Таблица → максимум у payments',
      explanation: 'payments — 40%+, checkout — ~11%: checkout ошибается **из‑за** payments (он его вызывает). Причина ближе к тому, кто «покраснел» сильнее и первым.',
    },
    {
      id: 'use',
      prompt: 'Что происходит с ресурсом payments в тот же момент? Посмотри панель пула БД и введи, **до какого значения** выросло число занятых соединений.',
      answer: { accept: ['50'], normalize: 'number', label: 'Соединений:' },
      hints: ['Панель «Пул соединений БД payments», порог-пунктир — максимум пула.'],
      solution: 'Дашборд → «Пул соединений БД payments» → 50/50',
      explanation: 'Utilization 100% пула — насыщение (saturation): новые запросы ждут соединение. Это USE-сигнал, объясняющий RED-симптомы.',
    },
  ],
  quiz: [
    { id: 'q-red', type: 'text', prompt: 'Расшифруй RED (три слова через запятую, англ.).', answer: { accept: [], normalize: 'keywords', keywords: [['rate'], ['error'], ['duration', 'latency']] }, explanation: 'Rate, Errors, Duration.' },
    { id: 'q-use', type: 'choice', prompt: 'Для чего методика USE?', options: ['Для пользовательских сценариев', 'Для ресурсов: CPU, память, диск, пулы — Utilization, Saturation, Errors', 'Для логов'], correct: 1, explanation: 'RED — для сервисов (запросы), USE — для ресурсов.' },
    { id: 'q-link', type: 'text', prompt: 'Какое поле связывает лог-запись с трейсом конкретного запроса? (англ., с подчёркиванием)', answer: { accept: ['trace_id', 'traceid', 'trace id'] }, explanation: '`trace_id` (и `span_id`) — по нему переходят из логов в трейс.' },
    { id: 'q-otel', type: 'text', prompt: 'Как называется открытый стандарт для сбора метрик, логов и трейсов (CNCF)?', answer: { accept: ['OpenTelemetry', 'otel', 'open telemetry'] }, explanation: 'OpenTelemetry — SDK, протокол OTLP и коллектор; не привязывает к вендору.' },
  ],
  glossary: [
    { ru: 'Наблюдаемость', en: 'observability', def: 'Способность по внешним сигналам понять внутреннее состояние системы.' },
    { ru: 'Метрика', en: 'metric', def: 'Числовой временной ряд с метками.' },
    { ru: 'Трейс', en: 'trace / span', def: 'Путь запроса через сервисы; спан — один шаг с длительностью.' },
    { ru: 'Золотые сигналы', en: 'golden signals', def: 'Latency, traffic, errors, saturation (Google SRE).' },
  ],
};
export default lesson;
