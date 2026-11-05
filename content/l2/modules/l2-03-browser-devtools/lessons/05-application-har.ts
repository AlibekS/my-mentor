import type { LessonDef } from '../../../../../src/content/types';
import type { DevtoolsDataset } from '../../../../../src/devtools/types';
import { APP, api, appShell, doc, js } from '../data';

const SESSION = 's%3A9f8c2e41b7d04a0c.Hq2xV8mPzL1tYw3';
const COOKIE_HEADER = `sf_session=${SESSION}; sf_csrf=7c1d90e2; sf_locale=en-GB; _ga=GA1.2.88123.1730700000`;
const expired = { error: 'session_expired', message: 'Your session expired on 2026-11-04 18:00 UTC. Please sign in again.' };

/** запрос с сессией в куке (без Bearer-токена) */
const withCookie = { auth: null, extra: { requestHeaders: { accept: 'application/json', cookie: COOKIE_HEADER, 'x-csrf-token': '7c1d90e2' } } } as const;

const devtools: DevtoolsDataset = {
  page: `${APP}/reports`,
  screen:
    'Клиент открыл «Отчёты» — видит «Your session has expired. Please sign in again.» и кнопку Sign in. Ещё он спрашивает, почему у него нет нового раздела «Отчёты 2.0», который вчера включили всем.',
  requests: [
    doc(`${APP}/reports`, 16_100, 118),
    ...appShell(126),
    js(`${APP}/assets/reports.4c2d18.js`, 96_400, 290, 88),
    api('GET', `${APP}/api/v2/me`, 401, { start: 390, time: 41, reqId: 'req_Ss01aa', response: { ...expired, request_id: 'req_Ss01aa' }, ...withCookie }),
    api('GET', `${APP}/api/v2/reports?period=30d`, 401, { start: 395, time: 39, reqId: 'req_Ss01ab', response: { ...expired, request_id: 'req_Ss01ab' }, ...withCookie }),
    api('GET', `${APP}/api/v2/notifications`, 401, { start: 398, time: 37, reqId: 'req_Ss01ac', response: { ...expired, request_id: 'req_Ss01ac' }, ...withCookie }),
    api('POST', `${APP}/api/v2/auth/refresh`, 401, {
      start: 450,
      time: 44,
      reqId: 'req_Ss01ad',
      payload: {},
      response: { error: 'refresh_failed', message: 'Refresh token is missing or expired', request_id: 'req_Ss01ad' },
      ...withCookie,
    }),
    api('POST', 'https://events.shopflow.io/v1/collect', 204, { start: 520, time: 41, payload: { event: 'page_view', page: '/reports' }, auth: null, type: 'xhr', size: 0 }),
  ],
  cookies: [
    { name: 'sf_session', value: SESSION, domain: 'app.shopflow.io', expires: '2026-11-04 18:00:00 UTC', httpOnly: true, secure: true },
    { name: 'sf_csrf', value: '7c1d90e2', domain: 'app.shopflow.io', secure: true },
    { name: 'sf_locale', value: 'en-GB', domain: 'app.shopflow.io', expires: '2027-11-04 09:12:40 UTC' },
    { name: '_ga', value: 'GA1.2.88123.1730700000', domain: '.shopflow.io', expires: '2027-12-09 09:12:40 UTC' },
  ],
  storage: {
    'sf.lastStore': 'st_2231',
    'sf.theme': 'dark',
    'sf.locale': 'en-GB',
    'sf.reportsV2.optOut': 'true',
    'sf.onboarding.done': 'true',
  },
};

const apiStatus = devtools.requests.find((r) => r.url.endsWith('/api/v2/me'))!.status;

const lesson: LessonDef = {
  id: 'application-har',
  title: 'Application и HAR: сессия, localStorage, приватность',
  minutes: 25,
  scenario: {},
  devtools,
  tasks: [
    {
      id: 'status',
      prompt: 'Клиент пишет: «Меня выкидывает из отчётов». Какой статус возвращают запросы к API (`me`, `reports`, `notifications`)?',
      answer: { accept: [String(apiStatus)], normalize: 'number', label: 'Статус:' },
      hints: ['Фильтр «Ошибки» в Network.'],
      solution: `# me, reports, notifications → ${apiStatus}`,
    },
    {
      id: 'reason',
      prompt: 'Прочитай Response запроса `me` (на английском). В чём причина ошибки? Ответь коротко.',
      answer: { accept: ['сессия истекла'], normalize: 'keywords', keywords: [['session', 'сесси', 'сеанс'], ['expired', 'истек', 'истекл', 'просроч', 'закончил', 'кончил', 'устарел']], label: 'Причина:' },
      hints: ['*Your session expired…* — ваша сессия истекла.'],
      solution: '# message: Your session expired on 2026-11-04 18:00 UTC — сессия истекла',
      explanation: 'Сервер больше не принимает сессию клиента. Попытка автоматически обновить её (`auth/refresh`) тоже не удалась — нужно войти заново.',
    },
    {
      id: 'cookie',
      prompt: 'Открой вкладку **Application** → Cookies. Когда истекла кука сессии `sf_session`? Введи дату.',
      answer: {
        accept: ['2026-11-04'],
        normalize: 'keywords',
        keywords: [['2026-11-04', '04.11', '4.11', '4 ноя', '04 ноя', 'nov 4', 'november 4', '4 nov', '04 nov', '11-04', '04-11', '11/04', '04/11', 'вчера', 'yesterday']],
        label: 'Дата:',
      },
      hints: ['Колонка Expires в таблице Cookies.'],
      solution: '# sf_session — Expires: 2026-11-04 18:00:00 UTC (вчера)',
      explanation: 'Сегодня 5 ноября — кука истекла вчера вечером. Это обычное окончание сессии: клиенту нужно просто войти снова.',
    },
    {
      id: 'flag',
      prompt: 'Второй вопрос клиента: «почему у меня нет новых отчётов 2.0?». Посмотри **Local Storage**. Как называется ключ, из-за которого у клиента старая версия отчётов?',
      answer: { accept: ['sf.reportsV2.optOut'], normalize: 'keywords', keywords: [['optout', 'opt-out', 'opt out']], label: 'Ключ:' },
      hints: ['Application → Local Storage. Ищи ключ со словом reportsV2.'],
      solution: '# sf.reportsV2.optOut = true — клиент отказался от новой версии',
      explanation: '*opt out* — «отказаться». Клиент когда-то нажал «вернуться к старой версии», выбор сохранился в браузере. Решение: переключить обратно в интерфейсе или очистить данные сайта.',
    },
    {
      id: 'har-secret',
      prompt: 'Ты хочешь попросить у клиента HAR-файл. Посмотри **Request Headers** запроса `me`: какой заголовок содержит секрет сессии и его нельзя публиковать?',
      answer: { accept: ['Cookie'], normalize: 'keywords', keywords: [['cookie', 'куки', 'кука', 'куку']], label: 'Заголовок:' },
      hints: ['В этом приложении сессия передаётся не токеном, а кукой.'],
      solution: '# Request Headers: cookie: sf_session=…',
      explanation: 'Заголовок `Cookie` содержит `sf_session` — с ним можно войти в аккаунт клиента. В HAR его нужно удалить или замаскировать, как и `Authorization`.',
    },
  ],
  quiz: [
    { id: 'q-har', type: 'text', prompt: 'Как расшифровывается HAR (по-английски)?', answer: { accept: ['HTTP Archive', 'HTTP Archive format', 'HTTP archive file'] }, explanation: 'HTTP Archive — JSON-файл со всеми запросами вкладки Network.' },
    { id: 'q-sanitize', type: 'text', prompt: 'Что нужно сделать с куками и токенами в HAR-файле, прежде чем передавать его дальше (в L3, в чат)?', answer: { accept: [], normalize: 'keywords', keywords: [['удал', 'вырез', 'скры', 'замен', 'замаскир', 'маскир', 'обезлич', 'санитиз', 'sanitiz', 'redact', 'убра', 'затере', 'стере']] }, explanation: 'Удалить или замаскировать (sanitize): Cookie, Authorization, личные данные. И не публиковать файл в открытых каналах.' },
    { id: 'q-sent', type: 'choice', prompt: 'Что браузер автоматически отправляет на сервер с каждым запросом к сайту?', options: ['Всё содержимое localStorage', 'Куки этого сайта (заголовок Cookie)', 'Историю браузера'], correct: 1, explanation: 'Куки уходят на сервер сами. localStorage читает только JavaScript страницы.' },
    { id: 'q-clear', type: 'text', prompt: 'Какой простой способ проверить, виноваты ли данные сайта в браузере (куки, localStorage, кэш), не удаляя их?', answer: { accept: [], normalize: 'keywords', keywords: [['инкогнито', 'incognito', 'приватн', 'private', 'другой браузер', 'другом браузере', 'другой профиль']] }, explanation: 'Открыть сайт в окне инкогнито (или в другом браузере): там чистые куки, localStorage и кэш.' },
  ],
  glossary: [
    { ru: 'Кука', en: 'cookie', def: 'Запись «имя = значение» от сервера; браузер отправляет её с каждым запросом к сайту.' },
    { ru: 'Сессия', en: 'session', def: 'Период, когда пользователь «вошёл»; обычно хранится в куке и имеет срок жизни.' },
    { ru: 'Локальное хранилище', en: 'localStorage', def: 'Хранилище сайта в браузере; читает только JavaScript, на сервер не уходит.' },
    { ru: 'Флаг функции', en: 'feature flag', def: 'Переключатель: показывать ли пользователю новую функцию.' },
    { ru: 'HAR-файл', en: 'HAR (HTTP Archive)', def: 'Файл со всеми запросами вкладки Network, включая заголовки и тела.' },
    { ru: 'Обезличить', en: 'sanitize / redact', def: 'Удалить из данных секреты и персональную информацию перед передачей.' },
  ],
};
export default lesson;
