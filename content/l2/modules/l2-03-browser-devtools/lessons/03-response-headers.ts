import type { LessonDef } from '../../../../../src/content/types';
import type { DevtoolsDataset } from '../../../../../src/devtools/types';
import { APP, api, appShell, doc, js, status4xx } from '../data';

const devtools: DevtoolsDataset = {
  page: `${APP}/settings/team`,
  screen:
    'Страница «Настройки → Команда». Клиент нажимает «Пригласить сотрудника» — появляется красная плашка «Action failed». Блок «Счета» в настройках пустой. При сохранении профиля — «Please check the form».',
  requests: [
    doc(`${APP}/settings/team`, 16_870, 124),
    ...appShell(132),
    js(`${APP}/assets/settings.e41a07.js`, 58_220, 290, 77),
    api('GET', `${APP}/api/v2/me`, 200, { start: 400, time: 82, response: { id: 'u_4413', name: 'Dana S.', email: 'dana.s@green-tea.kz', role: 'viewer', store_id: 'st_2231' } }),
    api('GET', `${APP}/api/v2/team/members`, 200, {
      start: 410,
      time: 118,
      response: { items: [{ name: 'Aigerim K.', role: 'owner' }, { name: 'Dana S.', role: 'viewer' }, { name: 'Timur B.', role: 'manager' }] },
    }),
    api('GET', `${APP}/api/v2/roles`, 200, { start: 415, time: 64, response: { items: ['owner', 'admin', 'manager', 'viewer'] } }),
    api('GET', `${APP}/api/v2/billing/invoices`, 401, {
      start: 420,
      time: 58,
      auth: null,
      reqId: 'req_Bv71Kq',
      response: { error: 'unauthorized', message: 'Missing Authorization header', request_id: 'req_Bv71Kq' },
      extra: { responseHeaders: { 'content-type': 'application/json', 'www-authenticate': 'Bearer', 'x-request-id': 'req_Bv71Kq', date: 'Thu, 05 Nov 2026 06:15:42 GMT' } },
    }),
    api('GET', `${APP}/api/v2/notifications`, 200, { start: 430, time: 71, response: { unread: 1 } }),
    js('https://widget.helpdesk.io/loader.js', 22_400, 600, 205),
    api('POST', 'https://events.shopflow.io/v1/collect', 204, { start: 900, time: 40, payload: { event: 'page_view', page: '/settings/team' }, auth: null, type: 'xhr', size: 0 }),
    api('POST', `${APP}/api/v2/team/invites`, 403, {
      start: 4200,
      time: 96,
      reqId: 'req_Lm28Xc',
      payload: { email: 'arman@green-tea.kz', role: 'manager' },
      response: { error: 'forbidden', message: "Your role 'viewer' cannot invite team members. Ask the account owner to invite them or to change your role.", request_id: 'req_Lm28Xc' },
    }),
    api('PATCH', `${APP}/api/v2/me/profile`, 422, {
      start: 9800,
      time: 88,
      reqId: 'req_Pz90Tt',
      payload: { name: 'Dana S.', phone: '8 701 123 45 67', timezone: 'Asia/Almaty' },
      response: { error: 'validation_failed', errors: [{ field: 'phone', message: 'Phone must be in international format, e.g. +77011234567' }], request_id: 'req_Pz90Tt' },
    }),
  ],
};

const invite = devtools.requests.find((r) => r.url.endsWith('/team/invites'))!;

const lesson: LessonDef = {
  id: 'response-headers',
  title: 'Ответ сервера и заголовки: 401, 403, 422',
  minutes: 25,
  scenario: {},
  devtools,
  tasks: [
    {
      id: 'invite-status',
      prompt: 'Клиент нажал «Пригласить сотрудника». Найди этот запрос (метод `POST`, в адресе `invites`). Какой статус он вернул?',
      answer: { accept: [String(invite.status)], normalize: 'number', label: 'Статус:' },
      hints: ['Введи `invites` в фильтр над таблицей.'],
      solution: `# POST /api/v2/team/invites → ${invite.status}`,
    },
    {
      id: 'invite-why',
      prompt:
        'Открой **Response** этого запроса и прочитай `message` (на английском). Какая роль у пользователя и кто может пригласить сотрудника? Ответь коротко, например: «роль …, может …».',
      answer: { accept: ['viewer, owner'], normalize: 'keywords', keywords: [['viewer', 'вьювер', 'наблюдат', 'просмотр', 'читател'], ['owner', 'владел', 'хозя']], label: 'Ответ:' },
      hints: ["*Your role 'viewer'…* — ваша роль…", '*Ask the account owner* — попросите владельца аккаунта.'],
      solution: "# message: Your role 'viewer' cannot invite… Ask the account owner — роль viewer, пригласить может владелец (owner)",
      explanation: '403 — сервер знает пользователя, но прав не хватает. Это не баг: ответ клиенту — «приглашать сотрудников может владелец аккаунта (Aigerim K.) или он может повысить вашу роль».',
    },
    {
      id: 'missing-header',
      prompt: 'Блок «Счета» пустой: запрос `invoices` вернул **401**. Сравни его **Request Headers** с успешным запросом `me`. Какого заголовка не хватает?',
      answer: { accept: ['Authorization'], normalize: 'keywords', keywords: [['authorization', 'авторизац', 'bearer', 'токен', 'token']], label: 'Заголовок:' },
      hints: ['Кликни `me` → Headers → Request Headers. Потом то же для `invoices`.', 'У `me` два заголовка запроса, у `invoices` — один.'],
      solution: '# у me есть authorization: Bearer …, у invoices — нет',
      explanation: 'Браузер не приложил токен только к одному запросу — это баг фронтенда, а не проблема клиента. Эскалация в L3 с request_id `req_Bv71Kq`.',
    },
    {
      id: 'field',
      prompt: 'При сохранении профиля `PATCH …/me/profile` вернул **422**. Посмотри Response и Payload. Какое поле сервер отклонил?',
      answer: { accept: ['phone'], normalize: 'keywords', keywords: [['phone', 'телефон', 'номер']], label: 'Поле:' },
      hints: ['В Response — массив `errors`, у каждой ошибки есть `field`.'],
      solution: '# errors[0].field: phone — "8 701 123 45 67" вместо +77011234567',
      explanation: 'Клиент ввёл номер в местном формате. Ответ: «введите номер в международном формате: +77011234567». Эскалация не нужна.',
    },
    {
      id: 'count-4xx',
      prompt: 'Сколько запросов на этой странице вернули статус из группы **4xx**?',
      answer: { accept: [String(status4xx(devtools))], normalize: 'number', label: 'Запросов:' },
      hints: ['Фильтр «Ошибки» показывает и 4xx, и 5xx — посмотри на колонку Status.'],
      solution: `# 401, 403, 422 — ${status4xx(devtools)}`,
      explanation: 'Три разных 4xx — три разные истории: нет токена (баг), нет прав (объяснить клиенту), неверные данные (подсказать формат).',
    },
  ],
  quiz: [
    { id: 'q-403', type: 'text', prompt: '401 означает «сервер не знает, **кто** ты». А что означает 403?', answer: { accept: [], normalize: 'keywords', keywords: [['прав', 'доступ', 'запрещ', 'forbidden', 'permission', 'нельзя', 'роль', 'разреш']] }, explanation: '403 Forbidden — пользователь известен, но прав на действие нет.' },
    { id: 'q-reqid', type: 'text', prompt: 'Какое поле из ответа сервера обязательно передать в эскалацию L3, чтобы инженер нашёл запрос в логах?', answer: { accept: ['request_id', 'request id', 'requestid', 'x-request-id', 'id запроса', 'reqid', 'req id'] }, explanation: '`request_id` (он же заголовок `X-Request-Id`) — по нему находят запрос в логах.' },
    { id: 'q-422', type: 'text', prompt: 'Какой код обычно возвращает API, если поле формы не прошло проверку? (один из двух: 400 или …)', answer: { accept: ['422'], normalize: 'number' }, explanation: '422 Unprocessable Entity (или 400 Bad Request) — неверные данные.' },
    { id: 'q-reply', type: 'choice', prompt: 'Клиент с ролью viewer получает 403 при приглашении сотрудника. Что ответить?', options: ['Передать в L3 как срочный баг', 'Объяснить, что приглашать может владелец аккаунта, и предложить попросить его о приглашении или о смене роли', 'Попросить очистить кэш'], correct: 1, explanation: 'Система работает как задумано: права есть только у владельца/админа.' },
  ],
  glossary: [
    { ru: 'Заголовок', en: 'header', def: 'Служебная строка «имя: значение» в запросе или ответе.' },
    { ru: 'Токен доступа', en: 'access token (Bearer)', def: 'Строка-пропуск в заголовке Authorization, по которой API узнаёт пользователя.' },
    { ru: 'Не авторизован / запрещено', en: 'unauthorized (401) / forbidden (403)', def: '401 — «кто ты?», 403 — «знаю тебя, но нельзя».' },
    { ru: 'Проверка данных', en: 'validation', def: 'Сервер проверяет поля формы; при ошибке — 400/422 и список полей.' },
    { ru: 'Идентификатор запроса', en: 'request ID', def: 'Уникальный номер запроса в логах сервера — главное для эскалации.' },
  ],
};
export default lesson;
