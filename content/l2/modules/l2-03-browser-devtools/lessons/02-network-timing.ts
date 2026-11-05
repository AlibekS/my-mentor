import type { LessonDef } from '../../../../../src/content/types';
import type { DevtoolsDataset } from '../../../../../src/devtools/types';
import { APP, api, appShell, doc, img, js, slowest } from '../data';

const devtools: DevtoolsDataset = {
  page: `${APP}/orders`,
  screen: 'Страница «Заказы» открывается, но таблица заказов около 9 секунд показывает крутящийся индикатор загрузки и только потом появляется.',
  requests: [
    doc(`${APP}/orders`, 17_960, 128),
    ...appShell(136),
    js(`${APP}/assets/orders.9b1d44.js`, 84_310, 300, 92),
    api('GET', `${APP}/api/v2/me`, 200, { start: 410, time: 95, response: { id: 'u_5120', email: 'ops@kazmart.kz', role: 'manager' } }),
    api('GET', `${APP}/api/v2/stores/st_3108`, 200, { start: 415, time: 110, response: { id: 'st_3108', name: 'Kazmart', plan: 'business' } }),
    api('POST', `${APP}/api/v2/orders/search`, 200, {
      start: 520,
      time: 8420,
      size: 61_240,
      reqId: 'req_Q81fz2',
      payload: { status: ['new', 'paid', 'shipped'], created_from: '2021-01-01', created_to: '2026-11-05', page: 1, per_page: 50 },
      response: {
        total: 48213,
        page: 1,
        items: [
          { id: 'ord_120931', status: 'paid', total: 23400, created_at: '2026-11-05T05:58:12Z' },
          { id: 'ord_120930', status: 'new', total: 8900, created_at: '2026-11-05T05:51:40Z' },
        ],
        warning: 'Slow query: 8.3 s. The date range is too wide. Try a shorter period, for example the last 30 days.',
      },
      extra: { timing: { dns: 0, connect: 0, ssl: 0, waiting: 8310, download: 110 } },
    }),
    api('GET', `${APP}/api/v2/orders/stats?period=30d`, 200, { start: 525, time: 240, response: { orders: 1830, revenue: 41200000 } }),
    api('GET', `${APP}/api/v2/carriers`, 200, { start: 530, time: 180, response: { items: ['kazpost', 'cdek', 'dhl'] } }),
    api('GET', `${APP}/api/v2/notifications`, 200, { start: 540, time: 70, response: { unread: 0 } }),
    img('https://cdn.shopflow.io/u/st_3108/avatar.webp', 0, 560, 41, { status: 404, size: 210, responseHeaders: { 'content-type': 'text/html' }, response: '<h1>404 Not Found</h1>' }),
    js('https://widget.helpdesk.io/loader.js', 22_400, 600, 750, { timing: { dns: 320, connect: 140, ssl: 160, waiting: 90, download: 40 } }),
    api('POST', 'https://events.shopflow.io/v1/collect', 204, { start: 1200, time: 44, payload: { event: 'page_view', page: '/orders' }, auth: null, type: 'xhr', size: 0 }),
  ],
};

const slow = slowest(devtools);
const sec = (slow.timeMs / 1000).toFixed(2);

const lesson: LessonDef = {
  id: 'network-timing',
  title: 'Network: медленный запрос, Timing и TTFB',
  minutes: 20,
  scenario: {},
  devtools,
  tasks: [
    {
      id: 'slowest',
      prompt: 'Клиент жалуется, что «заказы грузятся вечность». Какой запрос шёл дольше всех? Введи его имя или путь.',
      answer: { accept: ['search'], normalize: 'keywords', keywords: [['search', 'orders/search']], label: 'Запрос:' },
      hints: ['Колонка Time: ищи значение в секундах (s), а не в миллисекундах (ms).', 'Или посмотри на самую длинную полосу в Waterfall.'],
      solution: `# самый долгий: ${slow.method} ${slow.url} — ${sec} s`,
      explanation: 'Остальные запросы укладываются в доли секунды. Проблема не «весь сайт», а один поиск заказов.',
    },
    {
      id: 'seconds',
      prompt: 'Сколько секунд шёл этот запрос? Введи число (можно с дробной частью).',
      answer: { accept: [sec, (slow.timeMs / 1000).toFixed(1), String(Math.round(slow.timeMs / 1000)), String(Math.floor(slow.timeMs / 1000)), String(slow.timeMs)], normalize: 'number', label: 'Секунд:' },
      hints: ['Колонка Time у этого запроса.'],
      solution: `# Time: ${sec} s`,
    },
    {
      id: 'ttfb',
      prompt: 'Открой у этого запроса вкладку **Timing**. Где ушло почти всё время: на соединение (DNS / Initial connection / SSL), на **ожидание ответа сервера** (Waiting, TTFB) или на скачивание (Content Download)?',
      answer: { accept: ['Waiting (TTFB)'], normalize: 'keywords', keywords: [['waiting', 'ttfb', 'ожидан', 'сервер', 'server', 'бэкенд', 'backend', 'бекенд']], label: 'Этап:' },
      hints: ['Кликни по строке запроса → вкладка Timing.', 'Сравни строки: какая из них почти равна Total?'],
      solution: '# Timing: Waiting for server response (TTFB) — 8.31 s из 8.42 s',
      explanation: 'Большой TTFB — сервер долго готовил ответ. Сеть клиента ни при чём: соединение уже было открыто (0 ms), скачивание — 0.11 s.',
    },
    {
      id: 'warning',
      prompt: 'Посмотри **Response** этого запроса: сервер добавил поле `warning` на английском. Что сервер советует сделать? Ответь своими словами (можно по-русски).',
      answer: { accept: ['сузить период'], normalize: 'keywords', keywords: [['период', 'дат', 'date', 'range', 'диапазон', 'сузи', 'короче', 'shorter', 'short', '30', 'меньш', 'уменьш']], label: 'Совет:' },
      hints: ['Вкладка Response, последнее поле.', '*The date range is too wide* — диапазон дат слишком широкий.'],
      solution: '# warning: Try a shorter period, for example the last 30 days — выбрать период короче (например, 30 дней)',
      explanation: 'В Payload видно `created_from: 2021-01-01` — клиент ищет заказы за 5 лет. Совет клиенту: выбрать период короче. Если и за 30 дней поиск медленный — эскалация в L3.',
    },
    {
      id: 'noise',
      prompt: 'На странице есть и красная строка с кодом 404. Что именно не загрузилось? (это «шум» — к жалобе клиента не относится)',
      answer: { accept: ['avatar'], normalize: 'keywords', keywords: [['avatar', 'аватар', 'картин', 'изображ', 'image', 'img', 'webp', 'фото', 'иконк']], label: 'Что:' },
      hints: ['Фильтр «Ошибки».'],
      solution: '# 404: avatar.webp — картинка-аватар магазина',
      explanation: 'Не найдена аватарка магазина — косметика. Она не объясняет 8 секунд ожидания таблицы, в эскалацию её не тащим (максимум — отдельной заметкой).',
    },
  ],
  quiz: [
    { id: 'q-ttfb', type: 'text', prompt: 'Как расшифровывается TTFB (по-английски)?', answer: { accept: ['Time To First Byte', 'time-to-first-byte'] }, explanation: 'Time To First Byte — время от отправки запроса до первого байта ответа. Показывает, сколько «думал» сервер.' },
    { id: 'q-where', type: 'text', prompt: 'Запрос шёл 9 секунд, и почти всё время в Timing — Waiting (TTFB). Где проблема: в сети клиента или на сервере?', answer: { accept: [], normalize: 'keywords', keywords: [['сервер', 'server', 'бэкенд', 'backend', 'бекенд', 'нашей стороне', 'у нас']] }, explanation: 'Сервер долго готовил ответ. Если бы долгими были DNS/Initial connection/SSL — смотрели бы на сеть клиента, VPN, прокси.' },
    { id: 'q-wf', type: 'choice', prompt: 'Какая колонка Network наглядно показывает, когда начался каждый запрос и какие шли параллельно?', options: ['Size', 'Waterfall', 'Type'], correct: 1, explanation: 'Waterfall («водопад») — полосы по шкале времени загрузки страницы.' },
    { id: 'q-204', type: 'text', prompt: 'У запроса `POST /v1/collect` статус 204 No Content. Это ошибка? (да/нет)', answer: { accept: [], normalize: 'keywords', keywords: [['нет', 'no', 'не ошибка', 'успе', 'success', 'норм']] }, explanation: '204 — успех без тела ответа. Все 2xx — успешные ответы.' },
  ],
  glossary: [
    { ru: 'Время до первого байта', en: 'TTFB, Time To First Byte', def: 'Сколько сервер готовил ответ: от отправки запроса до первого байта ответа.' },
    { ru: 'Тело запроса', en: 'payload / request body', def: 'Данные, которые браузер отправил серверу (фильтры, поля формы).' },
    { ru: 'Водопад', en: 'waterfall', def: 'Диаграмма: когда стартовал и сколько шёл каждый запрос.' },
    { ru: 'Медленный запрос', en: 'slow query', def: 'Запрос к базе данных, который выполняется дольше нормы.' },
  ],
};
export default lesson;
