import type { LessonDef } from '../../../../../src/content/types';
import type { DevtoolsDataset } from '../../../../../src/devtools/types';
import { APP, api, css, doc, font, img, js, svg } from '../data';

const cached = { fromCache: true };

const devtools: DevtoolsDataset = {
  page: `${APP}/products`,
  screen: 'Вчера вышло обновление v5.12. У клиента на странице «Товары» пустой список (у коллег клиента всё в порядке), внизу вместо карты складов — серый прямоугольник.',
  requests: [
    doc(`${APP}/products`, 17_300, 4, { ...cached, timing: {}, responseHeaders: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'max-age=86400' } }),
    css(`${APP}/assets/app.3c9e1f.css`, 48_210, 8, 3, cached),
    js(`${APP}/assets/vendor.81aa2d.js`, 412_880, 9, 6, cached),
    js(`${APP}/assets/main.a81f3c.js`, 271_060, 10, 5, cached),
    font('https://fonts.gstatic.com/s/inter/v13/inter-latin.woff2', 31_120, 30, 2, cached),
    svg(`${APP}/assets/logo.svg`, 3_950, 32, 1, cached),
    api('GET', `${APP}/api/v2/me`, 200, { start: 120, time: 84, response: { id: 'u_7781', email: 'buyer@nomad-gear.kz', role: 'admin' } }),
    api('GET', `${APP}/api/v2/catalog/items?page=1`, 404, {
      start: 140,
      time: 61,
      reqId: 'req_Cx04Np',
      response: { error: 'not_found', message: 'This endpoint was removed in v5.12. Please reload the page to get the latest version of the app.', request_id: 'req_Cx04Np' },
    }),
    api('GET', `${APP}/api/v2/categories`, 200, { start: 145, time: 92, response: { items: [{ id: 'c1', name: 'Tents' }, { id: 'c2', name: 'Backpacks' }] } }),
    api('GET', `${APP}/api/v2/notifications`, 200, { start: 150, time: 70, response: { unread: 0 } }),
    {
      method: 'GET',
      url: 'https://geo.mapbridge.io/v1/warehouses?store=st_4410',
      status: 0,
      error: 'net::ERR_FAILED',
      type: 'fetch',
      timeMs: 140,
      startMs: 260,
      requestHeaders: { accept: 'application/json', origin: APP },
    },
    { method: 'GET', url: 'https://cdn.trackly.io/t.js', status: 0, error: 'net::ERR_BLOCKED_BY_CLIENT', type: 'script', timeMs: 0, startMs: 270 },
    img('https://cdn.shopflow.io/u/st_4410/hero.webp', 64_200, 300, 120),
    img('https://cdn.shopflow.io/u/st_4410/banner-sale.webp', 38_900, 305, 96),
    api('POST', 'https://events.shopflow.io/v1/collect', 204, { start: 420, time: 39, payload: { event: 'page_view', page: '/products', app_version: '5.11.3' }, auth: null, type: 'xhr', size: 0 }),
  ],
  console: [
    { level: 'info', text: 'ShopFlow app v5.11.3 (build a81f3c) started', source: 'main.a81f3c.js:1' },
    { level: 'error', text: `GET ${APP}/api/v2/catalog/items?page=1 404 (Not Found)`, source: 'main.a81f3c.js:1876' },
    {
      level: 'error',
      text: "Uncaught (in promise) TypeError: Cannot read properties of undefined (reading 'map')",
      source: 'main.a81f3c.js:2210',
      stack: ['renderProducts (main.a81f3c.js:2210:31)', 'ProductList.load (main.a81f3c.js:2188:12)', 'async loadPage (main.a81f3c.js:1990:5)'],
    },
    {
      level: 'error',
      text: `Access to fetch at 'https://geo.mapbridge.io/v1/warehouses?store=st_4410' from origin '${APP}' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.`,
      source: 'products:1',
    },
    { level: 'error', text: 'GET https://cdn.trackly.io/t.js net::ERR_BLOCKED_BY_CLIENT', source: 'products:14' },
    { level: 'warn', text: 'Warehouse map: failed to load warehouses, retry in 30 s', source: 'main.a81f3c.js:3302' },
  ],
};

const lesson: LessonDef = {
  id: 'console-cache',
  title: 'Console и кэш: ошибки JS, CORS, блокировщики',
  minutes: 25,
  scenario: {},
  devtools,
  tasks: [
    {
      id: 'function',
      prompt: 'Список товаров пустой. Открой вкладку **Console** и найди ошибку `TypeError`. В какой функции упал код? (первая строка стека, слово перед скобкой)',
      answer: { accept: ['renderProducts'], normalize: 'keywords', keywords: [['renderproducts', 'render products']], label: 'Функция:' },
      hints: ['Console → «Только ошибки».', 'Под текстом ошибки стек: `at <функция> (<файл>:<строка>)`.'],
      solution: '# at renderProducts (main.a81f3c.js:2210:31)',
      explanation: 'Функция рисует список товаров. Ей нечего рисовать: запрос за товарами перед этим вернул 404.',
    },
    {
      id: 'server-hint',
      prompt: 'Перед ошибкой JS запрос за товарами вернул **404**. Найди его в Network и прочитай `message` в Response (на английском). Что сервер советует сделать?',
      answer: { accept: ['перезагрузить страницу'], normalize: 'keywords', keywords: [['перезагруз', 'обнов', 'reload', 'refresh', 'f5', 'ctrl+f5', 'ctrl+shift+r']], label: 'Совет:' },
      hints: ['Фильтр «Ошибки» → запрос `items` → Response.', '*Please reload the page* — пожалуйста, перезагрузите страницу.'],
      solution: '# message: This endpoint was removed in v5.12. Please reload the page… — перезагрузить страницу',
      explanation: 'Эндпоинт удалили в новой версии, а браузер клиента всё ещё выполняет старый скрипт. Нужна жёсткая перезагрузка, чтобы скачать новую версию.',
    },
    {
      id: 'version',
      prompt: 'Почему у клиента старый скрипт? Посмотри колонку Size в Network — скрипты взяты из кэша. А в Console сайт пишет свою версию (сообщение уровня info). Какая версия приложения у клиента?',
      answer: { accept: ['5.11.3'], normalize: 'keywords', keywords: [['5.11']], label: 'Версия:' },
      hints: ['Первая строка в Console (режим «Все уровни»).'],
      solution: '# ShopFlow app v5.11.3 (build a81f3c) — старая версия из кэша (актуальная — 5.12)',
      explanation: 'Size = `(disk cache)` и версия 5.11.3 при актуальной 5.12 — браузер показывает старую копию. Совет: Ctrl+Shift+R (Ctrl+F5).',
    },
    {
      id: 'cors',
      prompt: 'Карта складов не загрузилась. Запрос к какому **домену** заблокирован политикой CORS?',
      answer: { accept: ['geo.mapbridge.io'], normalize: 'keywords', keywords: [['mapbridge']], label: 'Домен:' },
      hints: ['Ищи в Console слово `CORS`.', 'Домен — часть адреса после `https://` и до следующего `/`.'],
      solution: "# Access to fetch at 'https://geo.mapbridge.io/…' … blocked by CORS policy",
      explanation: 'Сервер карт не разрешил запросы с app.shopflow.io (нет заголовка Access-Control-Allow-Origin). Жёсткая перезагрузка это не исправит — отдельная задача для L3.',
    },
    {
      id: 'adblock',
      prompt: 'Ещё одна красная строка — `net::ERR_BLOCKED_BY_CLIENT`. Запрос к какому домену заблокировало расширение-блокировщик у клиента?',
      answer: { accept: ['cdn.trackly.io'], normalize: 'keywords', keywords: [['trackly']], label: 'Домен:' },
      hints: ['Фильтр «Ошибки» в Network или Console → «Только ошибки».'],
      solution: '# GET https://cdn.trackly.io/t.js net::ERR_BLOCKED_BY_CLIENT',
      explanation: 'Блокировщик рекламы отрезал скрипт аналитики. На работу магазина это не влияет — шум, в эскалацию не включаем.',
    },
  ],
  quiz: [
    { id: 'q-hard', type: 'text', prompt: 'Какое сочетание клавиш делает **жёсткую перезагрузку** (без кэша) в Chrome на Windows?', answer: { accept: [], normalize: 'keywords', keywords: [['ctrl+shift+r', 'ctrl + shift + r', 'ctrl shift r', 'ctrl-shift-r', 'ctrl+f5', 'ctrl + f5', 'ctrl f5', 'shift+f5', 'shift + f5']] }, explanation: 'Ctrl+Shift+R или Ctrl+F5 (Mac — Cmd+Shift+R).' },
    { id: 'q-blocked', type: 'text', prompt: '`net::ERR_BLOCKED_BY_CLIENT` — кто чаще всего блокирует запрос: наш сервер или расширение в браузере клиента?', answer: { accept: [], normalize: 'keywords', keywords: [['расшир', 'блокиров', 'adblock', 'ublock', 'extension', 'браузер', 'антивирус']] }, explanation: 'Расширение (AdBlock, uBlock) или антивирус на компьютере клиента. Сервер тут ни при чём.' },
    { id: 'q-stack', type: 'text', prompt: 'Как по-английски называется список функций под ошибкой JavaScript?', answer: { accept: ['stack trace', 'stacktrace', 'stack', 'call stack', 'стек', 'стек вызовов', 'стектрейс'] }, explanation: 'Stack trace (стек вызовов). Верхняя строка — место, где упал код.' },
    { id: 'q-cors', type: 'choice', prompt: 'В Console: «…blocked by CORS policy». Что верно?', options: ['Клиенту нужно отключить антивирус', 'Сервер другого домена не разрешил нашей странице читать ответ — это настройка сервера, вопрос к L3/разработке', 'Нужно очистить кэш, и всё пройдёт'], correct: 1, explanation: 'CORS настраивается на сервере, к которому идёт запрос. Клиент ничего не исправит.' },
  ],
  glossary: [
    { ru: 'Консоль', en: 'Console', def: 'Вкладка DevTools с ошибками JavaScript и сообщениями сайта.' },
    { ru: 'Стек вызовов', en: 'stack trace', def: 'Цепочка функций, которая привела к ошибке; верхняя строка — место падения.' },
    { ru: 'Кэш браузера', en: 'browser cache', def: 'Сохранённые копии файлов сайта, чтобы не скачивать их заново.' },
    { ru: 'Жёсткая перезагрузка', en: 'hard reload / hard refresh', def: 'Загрузка страницы без кэша: Ctrl+Shift+R или Ctrl+F5.' },
    { ru: 'Политика CORS', en: 'CORS (Cross-Origin Resource Sharing)', def: 'Правило браузера: страница может читать ответы другого домена, только если тот разрешил.' },
    { ru: 'Расширение браузера', en: 'browser extension', def: 'Дополнение к браузеру (блокировщик рекламы и т. п.); может блокировать запросы.' },
  ],
};
export default lesson;
