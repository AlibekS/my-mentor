import type { LessonDef } from '../../../../src/content/types';
import { obs } from '../data';

const lesson: LessonDef = {
  id: 'promql',
  title: 'PromQL: селекторы, rate, sum by, доля ошибок',
  minutes: 35,
  scenario: {},
  obs,
  tasks: [
    {
      id: 'rps',
      prompt: 'Вкладка «Метрики». Построй **общее число запросов в секунду** (RPS) по всем сервисам — один ряд. Используй окно `[5m]`.',
      obs: 'promql',
      hints: ['Счётчик → `rate(http_requests_total[5m])`.', 'Сложить всё в один ряд — `sum(...)`.'],
      solution: 'sum(rate(http_requests_total[5m]))',
    },
    {
      id: 'by-service',
      prompt: 'Теперь RPS **по сервисам** (по ряду на каждый `service`), окно `[5m]`.',
      obs: 'promql',
      hints: ['`sum by (service) (...)`'],
      solution: 'sum by (service) (rate(http_requests_total[5m]))',
    },
    {
      id: 'checkout-codes',
      prompt: 'Клиент жалуется на `/api/checkout`. Построй RPS этого маршрута **по кодам ответа** (`code`), окно `[5m]`.',
      obs: 'promql',
      hints: ['Фильтр по метке: `{route="/api/checkout"}`.', '`sum by (code) (rate(http_requests_total{route="/api/checkout"}[5m]))`'],
      solution: 'sum by (code) (rate(http_requests_total{route="/api/checkout"}[5m]))',
    },
    {
      id: 'error-ratio',
      prompt: 'Построй **долю ошибок 5xx по сервисам**: 5xx-RPS делённое на весь RPS, с разбивкой `by (service)`, окно `[5m]`. Именно долю (0–1), без умножения на 100.',
      obs: 'promql',
      hints: ['Числитель: `sum by (service) (rate(http_requests_total{code=~"5.."}[5m]))`.', 'Знаменатель — то же без фильтра по коду. Между ними `/`.'],
      solution: 'sum by (service) (rate(http_requests_total{code=~"5.."}[5m])) / sum by (service) (rate(http_requests_total[5m]))',
    },
  ],
  quiz: [
    { id: 'q-counter', type: 'choice', prompt: 'Почему график `http_requests_total` без функций почти бесполезен?', options: ['Prometheus его не хранит', 'Это счётчик — он только растёт; нужна скорость роста через rate()', 'В нём нет меток'], correct: 1, explanation: 'Для counter смотрят `rate()` или `increase()`.' },
    { id: 'q-regex', type: 'promql', prompt: 'Выбери все коды 5xx **регулярным выражением** в селекторе и построй общий RPS ошибок 5xx одним рядом (окно `[5m]`).', solution: 'sum(rate(http_requests_total{code=~"5.."}[5m]))', explanation: '`sum(rate(http_requests_total{code=~"5.."}[5m]))` — матчер `=~` с регуляркой `5..` выбирает 500–599.', hint: 'Матчер с регуляркой: `{code=~"…"}`, снаружи — `sum(rate(…[5m]))`.' },
    { id: 'q-pay', type: 'promql', prompt: 'Напиши запрос: RPS сервиса **payments** по кодам ответа (окно `[5m]`).', solution: 'sum by (code) (rate(http_requests_total{service="payments"}[5m]))', explanation: '`sum by (code) (rate(http_requests_total{service="payments"}[5m]))`.' },
    { id: 'q-order', type: 'text', prompt: 'Что правильно: `sum(rate(x[5m]))` или `rate(sum(x)[5m])`? (напиши первый вариант или второй)', answer: { accept: ['первый', 'первое', 'первый вариант', '1', '1-й', 'sum(rate(x[5m]))', 'first', 'the first'] }, explanation: 'Сначала `rate` по каждому ряду, потом `sum`. Иначе сбросы счётчиков отдельных подов исказят результат.' },
  ],
  glossary: [
    { ru: 'Счётчик', en: 'counter', def: 'Метрика, которая только растёт (сбрасывается при рестарте).' },
    { ru: 'Датчик', en: 'gauge', def: 'Метрика с текущим значением, может расти и падать.' },
    { ru: 'Скорость', en: 'rate()', def: 'Прирост счётчика в секунду за окно.' },
  ],
};
export default lesson;
