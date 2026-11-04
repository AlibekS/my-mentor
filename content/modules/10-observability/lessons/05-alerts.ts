import type { LessonDef } from '../../../../src/content/types';
import { obs } from '../data';

const lesson: LessonDef = {
  id: 'alerts',
  title: 'Алерты: симптомы, пороги, SLO и burn rate',
  minutes: 25,
  scenario: {},
  obs,
  tasks: [
    {
      id: 'expr-errors',
      prompt: 'Напиши выражение алерта: доля 5xx **сервиса checkout** больше **5%** (`> 0.05`). Окно `[5m]`. На графике должен остаться ряд только в минуты, когда условие истинно.',
      obs: 'promql',
      hints: [
        'Доля: `sum(rate(...{service="checkout",code=~"5.."}[5m])) / sum(rate(...{service="checkout"}[5m]))`.',
        'В конце `> 0.05` — сравнение фильтрует точки.',
      ],
      solution: 'sum(rate(http_requests_total{service="checkout",code=~"5.."}[5m])) / sum(rate(http_requests_total{service="checkout"}[5m])) > 0.05',
    },
    {
      id: 'when-fires',
      prompt: 'Во сколько впервые сработало бы это условие (без учёта `for`)? Введи `ЧЧ:ММ` первой точки на графике.',
      answer: { accept: ['14:07', '14:06', '14:08'], label: 'Время:' },
      hints: ['Наведи курсор на начало ряда.', 'Обрати внимание: из‑за окна [5m] условие срабатывает на пару минут позже реального начала (14:04).'],
      solution: 'sum(rate(http_requests_total{service="checkout",code=~"5.."}[5m])) / sum(rate(http_requests_total{service="checkout"}[5m])) > 0.05',
      obs: 'promql',
    },
    {
      id: 'expr-pool',
      prompt: 'USE-алерт из постмортема: **занятость пула** payments больше **90%** — `db_pool_connections_in_use / db_pool_connections_max > 0.9`.',
      obs: 'promql',
      hints: ['Деление двух gauge с одинаковыми метками сопоставляет ряды автоматически.'],
      solution: 'db_pool_connections_in_use / db_pool_connections_max > 0.9',
    },
    {
      id: 'leak',
      prompt: 'USE-проверка памяти: какой **под** catalog растёт по памяти без остановки (утечка)? Построй `container_memory_working_set_bytes` и введи имя пода.',
      answer: { accept: ['catalog-6f7d9c-abcde'], label: 'Под:' },
      hints: ['Запрос: `container_memory_working_set_bytes` — два ряда, один растёт линейно.'],
      solution: 'container_memory_working_set_bytes',
      obs: 'promql',
      explanation: 'Рост на ~6,5 МиБ/мин: к лимиту 1 ГиБ дойдёт через ~1,5 часа → OOMKilled. Хороший кандидат на алерт «память > 90% лимита» и задачу разработке.',
    },
  ],
  quiz: [
    { id: 'q-symptom', type: 'choice', prompt: 'Какой алерт лучше будить дежурного ночью?', options: ['CPU > 80% на любой ноде', 'Доля 5xx на оформлении заказа > 5% в течение 5 минут', 'Число логов выросло'], correct: 1, explanation: 'Алерт на симптом, который чувствует клиент, + длительность.' },
    { id: 'q-for', type: 'text', prompt: 'Какое поле правила Prometheus задаёт, сколько условие должно держаться перед срабатыванием? (одно слово)', answer: { accept: ['for', 'for:'] }, explanation: '`for: 5m` — защита от флаппинга.' },
    { id: 'q-fatigue', type: 'text', prompt: 'Как называется «усталость от алертов», когда их слишком много и их начинают игнорировать? (англ., два слова)', answer: { accept: ['alert fatigue'] }, explanation: 'Alert fatigue — лечится удалением бесполезных алертов и группировкой.' },
    { id: 'q-slo', type: 'promql', prompt: 'Напиши выражение: доля 5xx **payments** больше 1% (`> 0.01`).', solution: 'sum(rate(http_requests_total{service="payments",code=~"5.."}[5m])) / sum(rate(http_requests_total{service="payments"}[5m])) > 0.01', explanation: 'Тот же шаблон для payments.' },
  ],
  glossary: [
    { ru: 'Усталость от алертов', en: 'alert fatigue', def: 'Привыкание к частым ложным алертам и их игнорирование.' },
    { ru: 'Скорость сжигания бюджета', en: 'burn rate', def: 'Во сколько раз быстрее нормы тратится бюджет ошибок SLO.' },
    { ru: 'Регламент', en: 'runbook', def: 'Инструкция, что делать при срабатывании алерта.' },
  ],
};
export default lesson;
