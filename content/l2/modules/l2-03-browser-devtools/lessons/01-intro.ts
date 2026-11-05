import type { LessonDef } from '../../../../../src/content/types';
import type { DevtoolsDataset } from '../../../../../src/devtools/types';
import { APP, api, appShell, doc, img, js } from '../data';

const devtools: DevtoolsDataset = {
  page: `${APP}/dashboard`,
  screen: 'Панель магазина открылась, но вместо графика «Продажи за неделю» — серый блок с надписью «Something went wrong. Please try again later.»',
  requests: [
    doc(`${APP}/dashboard`, 18_420, 132),
    ...appShell(140),
    api('GET', `${APP}/api/v2/me`, 200, { start: 360, time: 88, response: { id: 'u_4412', email: 'dana@green-tea.kz', role: 'owner', store_id: 'st_2231' } }),
    api('GET', `${APP}/api/v2/stores/st_2231`, 200, { start: 372, time: 104, response: { id: 'st_2231', name: 'Green Tea House', currency: 'KZT', plan: 'growth' } }),
    api('GET', `${APP}/api/v2/notifications?unread=1`, 200, { start: 380, time: 76, response: { unread: 2 } }),
    api('GET', `${APP}/api/v2/reports/sales?period=7d`, 500, {
      start: 455,
      time: 1210,
      reqId: 'req_7Hq2LbX',
      response: { error: 'internal_error', message: 'Report service failed to build the report', request_id: 'req_7Hq2LbX' },
    }),
    api('GET', `${APP}/api/v2/orders/recent?limit=5`, 200, { start: 460, time: 142, response: { items: [{ id: 'ord_99812', total: 18500 }, { id: 'ord_99811', total: 7200 }] } }),
    api('GET', `${APP}/api/v2/products/top?limit=5`, 200, { start: 466, time: 131, response: { items: [{ sku: 'TEA-GRN-100', sold: 41 }] } }),
    img('https://cdn.shopflow.io/u/st_2231/avatar.webp', 9_810, 520, 38),
    js('https://widget.helpdesk.io/loader.js', 22_400, 600, 210),
    api('POST', 'https://events.shopflow.io/v1/collect', 204, { start: 900, time: 45, payload: { event: 'page_view', page: '/dashboard' }, auth: null, type: 'xhr', size: 0 }),
  ],
};

const failed = devtools.requests.filter((r) => r.status >= 400 || r.status === 0);

const lesson: LessonDef = {
  id: 'intro',
  title: 'Что такое DevTools и как попросить о нём клиента',
  minutes: 20,
  scenario: {},
  devtools,
  tasks: [
    {
      id: 'open',
      prompt:
        'Тикет от клиента:\n\n> *Hi! The Sales chart on my dashboard is empty, I only see "Something went wrong". I use Chrome on Windows 11.*\n\n' +
        '(*empty* — пустой, *chart* — график.) Какое сочетание клавиш ты подскажешь клиенту, чтобы он открыл DevTools?',
      answer: { accept: ['F12'], normalize: 'keywords', keywords: [['f12', 'ctrl+shift+i', 'ctrl + shift + i', 'ctrl shift i', 'ctrl-shift-i', 'ctrl+shift+j', 'ctrl+shift+c']], label: 'Клавиши:' },
      hints: ['В Chrome, Edge и Firefox на Windows работает одна и та же клавиша из верхнего ряда F1…F12.', 'F12 (или Ctrl+Shift+I).'],
      solution: '# F12 или Ctrl+Shift+I',
      explanation: 'F12 или Ctrl+Shift+I в Chrome/Edge/Firefox на Windows. На Mac — Cmd+Option+I.',
    },
    {
      id: 'count',
      prompt: 'Клиент прислал DevTools (справа). Сколько всего запросов сделал браузер при загрузке страницы? Число есть внизу таблицы Network.',
      answer: { accept: [String(devtools.requests.length)], normalize: 'number', label: 'Запросов:' },
      hints: ['Под таблицей написано «N из N запросов».'],
      solution: `# внизу таблицы: ${devtools.requests.length} из ${devtools.requests.length} запросов`,
      explanation: 'Обычная страница SaaS-приложения делает 10–100 запросов: HTML, стили, скрипты, шрифты, картинки и запросы к API.',
    },
    {
      id: 'doc',
      prompt: 'Посмотри на **самый первый** запрос — тот, что загрузил саму страницу `dashboard`. Какой у него тип (колонка Type)?',
      answer: { accept: ['document', 'doc', 'документ', 'html', 'text/html', 'document (html)'], label: 'Type:' },
      hints: ['Колонка Type, первая строка таблицы.'],
      solution: '# первая строка: dashboard — Type: document',
      explanation: '`document` — HTML-страница. Её браузер грузит первой, а уже из неё узнаёт, какие скрипты, стили и картинки нужны.',
    },
    {
      id: 'failed',
      prompt: 'Найди запрос, который завершился ошибкой (красная строка или фильтр «Ошибки»). Введи его имя или путь из адреса.',
      answer: { accept: ['sales'], normalize: 'keywords', keywords: [['sales', 'reports/sales']], label: 'Запрос:' },
      hints: ['Нажми кнопку «Ошибки» над таблицей.', 'Остался один запрос — его имя в колонке Name.'],
      solution: `# фильтр «Ошибки» → ${failed[0].url}`,
      explanation: 'Именно этот запрос строит график продаж. Остальные запросы к API успешны — значит, сломан один отчёт, а не весь сайт.',
    },
    {
      id: 'status',
      prompt: 'Какой статус вернул этот запрос? Введи число.',
      answer: { accept: [String(failed[0].status)], normalize: 'number', label: 'Статус:' },
      hints: ['Колонка Status или вкладка Headers → Status Code.'],
      solution: `# Status: ${failed[0].status}`,
      explanation: '500 Internal Server Error — ошибка на стороне сервера. Клиент тут ничего не исправит: это эскалация в L3 с адресом запроса и request_id из ответа.',
    },
  ],
  quiz: [
    { id: 'q-tab', type: 'text', prompt: 'Как по-английски называется вкладка DevTools со списком всех запросов страницы?', answer: { accept: ['Network', 'network tab', 'вкладка network', 'нетворк'] }, explanation: 'Network (в русском интерфейсе — «Сеть»).' },
    { id: 'q-reload', type: 'text', prompt: 'Клиент открыл DevTools на уже загруженной странице — в Network пусто. Что ему нужно сделать, чтобы запросы появились?', answer: { accept: [], normalize: 'keywords', keywords: [['обнов', 'перезагруз', 'f5', 'reload', 'refresh', 'ctrl+r', 'повтор']] }, explanation: 'Network записывает только при открытом DevTools. Нужно обновить страницу (F5) или повторить действие.' },
    { id: 'q-codes', type: 'choice', prompt: 'Какие коды ответа означают ошибку на стороне сервера?', options: ['2xx', '3xx', '4xx', '5xx'], correct: 3, explanation: '5xx — сервер сломался. 4xx — проблема с запросом (нет прав, не найдено, неверные данные). 2xx — успех.' },
    { id: 'q-failed', type: 'text', prompt: 'В колонке Status написано `(failed)`. Получил ли браузер ответ от сервера? (да/нет)', answer: { accept: [], normalize: 'keywords', keywords: [['нет', 'no', 'не получ', 'не дош']] }, explanation: '`(failed)` — ответа не было вовсе: обрыв сети, блокировка расширением, CORS, таймаут. Код ответа появляется, только если сервер ответил.' },
  ],
  glossary: [
    { ru: 'Инструменты разработчика', en: 'DevTools (developer tools)', def: 'Встроенная в браузер панель: запросы, консоль, хранилище сайта.' },
    { ru: 'Запрос / ответ', en: 'request / response', def: 'Браузер отправляет запрос серверу, сервер присылает ответ со статусом.' },
    { ru: 'Код ответа', en: 'status code', def: 'Число в ответе сервера: 2xx — успех, 4xx — ошибка запроса, 5xx — ошибка сервера.' },
    { ru: 'Эндпоинт', en: 'endpoint', def: 'Адрес API, который выполняет одно действие: например, /api/v2/reports/sales.' },
    { ru: 'Упавший запрос', en: 'failed request', def: 'Запрос с ошибкой (4xx/5xx) или без ответа вовсе (failed).' },
  ],
};
export default lesson;
