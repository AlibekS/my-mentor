import type { LessonDef } from '../../../../../src/content/types';
import type { DevtoolsDataset, NetRequest } from '../../../../../src/devtools/types';
import { api, css, doc, errorCount, font, img, js, svg } from '../data';

const SHOP = 'https://brewandleaf.shopflow.store';
const REQ_ID = 'req_9KX2M7QA';
const DATE = 'Thu, 05 Nov 2026 07:42:13 GMT';

/** запросы витрины: без Bearer-токена, корзина в куке */
const sf = (extra: Partial<NetRequest> = {}) => ({ auth: null, extra: { requestHeaders: { accept: 'application/json', cookie: 'sf_cart=crt_51e0b2; _ga=GA1.2.4410.1730790000' }, ...extra } });

const intent = api('POST', `${SHOP}/api/storefront/v1/payments/intent`, 502, {
  start: 14_200,
  time: 1240,
  reqId: REQ_ID,
  payload: { cart_id: 'crt_51e0b2', amount: 4250, currency: 'EUR', method: 'card' },
  response: { error: 'bad_gateway', message: 'Payment provider PayStream returned an invalid response. Please try again later.', request_id: REQ_ID },
  ...sf({
    responseHeaders: { 'content-type': 'application/json', 'x-request-id': REQ_ID, date: DATE, server: 'shopflow-gateway' },
    timing: { dns: 0, connect: 0, ssl: 0, waiting: 1228, download: 12 },
    requestHeaders: { accept: 'application/json', 'content-type': 'application/json', cookie: 'sf_cart=crt_51e0b2; _ga=GA1.2.4410.1730790000' },
  }),
});

const devtools: DevtoolsDataset = {
  page: `${SHOP}/checkout`,
  screen: 'Страница оформления заказа: корзина (2 товара, 42,50 €), адрес доставки в Гамбурге, способ оплаты — карта. Кнопка «Place order» нажимается, но ничего не происходит: ни ошибки, ни перехода к оплате.',
  requests: [
    doc(`${SHOP}/checkout`, 21_400, 146),
    css(`${SHOP}/s/theme.f02a11.css`, 39_800, 150, 58),
    js(`${SHOP}/s/vendor.1a2b3c.js`, 301_200, 152, 160),
    js(`${SHOP}/s/checkout.7b2e91.js`, 88_640, 154, 97),
    font('https://fonts.gstatic.com/s/lora/v32/lora-latin.woff2', 28_400, 220, 44),
    svg(`${SHOP}/s/logo-brewandleaf.svg`, 5_120, 230, 20),
    img('https://cdn.shopflow.io/u/st_8802/p/earl-grey-100g.webp', 41_300, 240, 72),
    img('https://cdn.shopflow.io/u/st_8802/p/sencha-50g.webp', 36_900, 242, 69),
    api('GET', `${SHOP}/api/storefront/v1/store`, 200, { start: 330, time: 66, response: { id: 'st_8802', name: 'Brew & Leaf', country: 'DE', currency: 'EUR' }, ...sf() }),
    api('GET', `${SHOP}/api/storefront/v1/cart`, 200, {
      start: 335,
      time: 91,
      response: { id: 'crt_51e0b2', items: [{ sku: 'EARL-GREY-100', qty: 1, price: 2450 }, { sku: 'SENCHA-50', qty: 1, price: 1800 }], total: 4250, currency: 'EUR' },
      ...sf(),
    }),
    api('GET', `${SHOP}/api/storefront/v1/shipping/rates?country=DE&zip=20095`, 200, { start: 440, time: 118, response: { rates: [{ id: 'dhl_std', price: 0, days: '2-3' }] }, ...sf() }),
    js('https://js.paystream.com/v3/paystream.js', 64_800, 460, 140),
    { method: 'GET', url: `${SHOP}/favicon.ico`, status: 404, type: 'other', size: 180, timeMs: 31, startMs: 480, response: 'Not Found' },
    { method: 'GET', url: 'https://cdn.trackly.io/t.js', status: 0, error: 'net::ERR_BLOCKED_BY_CLIENT', type: 'script', timeMs: 0, startMs: 490 },
    api('POST', 'https://events.shopflow.io/v1/collect', 204, { start: 900, time: 40, payload: { event: 'checkout_view' }, auth: null, type: 'xhr', size: 0 }),
    api('POST', `${SHOP}/api/storefront/v1/checkout/validate`, 200, {
      start: 14_050,
      time: 112,
      payload: { cart_id: 'crt_51e0b2', shipping_rate: 'dhl_std', email: 'l.schmidt@brewandleaf.de' },
      response: { ok: true },
      ...sf(),
    }),
    intent,
    api('POST', 'https://events.shopflow.io/v1/collect', 204, { start: 15_500, time: 38, payload: { event: 'place_order_click' }, auth: null, type: 'xhr', size: 0 }),
  ],
  console: [
    { level: 'info', text: 'Brew & Leaf storefront — checkout v3.8.2', source: 'checkout.7b2e91.js:1' },
    { level: 'error', text: `GET ${SHOP}/favicon.ico 404 (Not Found)`, source: 'checkout:1' },
    { level: 'error', text: 'GET https://cdn.trackly.io/t.js net::ERR_BLOCKED_BY_CLIENT', source: 'checkout:22' },
    { level: 'error', text: `POST ${SHOP}/api/storefront/v1/payments/intent 502 (Bad Gateway)`, source: 'checkout.7b2e91.js:401' },
    {
      level: 'error',
      text: "Uncaught (in promise) TypeError: Cannot read properties of undefined (reading 'client_secret')",
      source: 'checkout.7b2e91.js:412',
      stack: ['startPayment (checkout.7b2e91.js:412:38)', 'async HTMLButtonElement.onPlaceOrder (checkout.7b2e91.js:377:7)'],
    },
  ],
  cookies: [
    { name: 'sf_cart', value: 'crt_51e0b2', domain: 'brewandleaf.shopflow.store', expires: '2026-11-12 07:30:02 UTC', secure: true },
    { name: '_ga', value: 'GA1.2.4410.1730790000', domain: '.shopflow.store', expires: '2027-12-10 07:30:02 UTC' },
  ],
  storage: { 'sf.checkout.lastStep': 'payment', 'sf.consent': 'analytics=false' },
};

const lesson: LessonDef = {
  id: 'boss',
  kind: 'boss',
  title: 'Checkout button does nothing',
  minutes: 40,
  incident: { ticket: 'ZD-48213: «Checkout button does nothing» (Brew & Leaf GmbH)', severity: 'SEV2', customer: 'Brew & Leaf GmbH (Германия), интернет-магазин чая' },
  scenario: {},
  devtools,
  tasks: [
    {
      id: 'noise',
      prompt: 'Начни с общей картины. Сколько запросов в HAR завершились ошибкой (статус 4xx/5xx или `(failed)`)?',
      answer: { accept: [String(errorCount(devtools))], normalize: 'number', label: 'Ошибок:' },
      hints: ['Network → фильтр «Ошибки».'],
      solution: `# фильтр «Ошибки»: favicon.ico 404, t.js (failed), payments/intent 502 — ${errorCount(devtools)}`,
      explanation: 'Три красные строки, но к жалобе относится одна. favicon.ico — иконка вкладки, trackly — скрипт аналитики, его отрезал блокировщик Лены.',
    },
    {
      id: 'endpoint',
      prompt: 'Какой из упавших запросов отправляется при нажатии **Place order** и объясняет жалобу? Введи путь эндпоинта.',
      answer: { accept: ['/api/storefront/v1/payments/intent'], normalize: 'keywords', keywords: [['payments/intent', 'intent']], label: 'Эндпоинт:' },
      hints: ['Нажатие кнопки происходит позже загрузки страницы — смотри на запросы в конце списка.', 'Метод POST, в адресе есть слово payments.'],
      solution: '# POST /api/storefront/v1/payments/intent → 502',
      explanation: 'Сначала `checkout/validate` — 200 (данные заказа в порядке), затем `payments/intent` — создание платежа — падает.',
    },
    {
      id: 'status',
      prompt: 'Какой статус вернул этот запрос? Прочитай и `message` в Response (на английском): кто вернул плохой ответ?',
      answer: { accept: [String(intent.status)], normalize: 'number', label: 'Статус:' },
      hints: ['Колонка Status.', '*Payment provider PayStream returned an invalid response* — платёжный провайдер PayStream вернул некорректный ответ.'],
      solution: `# Status: ${intent.status} Bad Gateway — PayStream returned an invalid response`,
      explanation: '502 — наш шлюз не получил нормального ответа от платёжного провайдера PayStream. Проблема на стороне сервера/провайдера, не у Лены.',
    },
    {
      id: 'request-id',
      prompt: 'Для эскалации нужен `request_id` этого запроса. Введи его (он есть и в Response, и в заголовке ответа `x-request-id`).',
      answer: { accept: [REQ_ID], normalize: 'keywords', keywords: [[REQ_ID]], label: 'request_id:' },
      hints: ['Headers → Response Headers → x-request-id.'],
      solution: `# x-request-id: ${REQ_ID}`,
    },
    {
      id: 'frontend',
      prompt: 'Почему покупатель не видит никакой ошибки? Открой **Console**: после 502 код упал с `TypeError`. Какое поле он пытался прочитать из ответа?',
      answer: { accept: ['client_secret'], normalize: 'keywords', keywords: [['client_secret', 'client secret', 'clientsecret']], label: 'Поле:' },
      hints: ["Текст ошибки: *Cannot read properties of undefined (reading '…')* — в кавычках имя поля."],
      solution: "# TypeError: Cannot read properties of undefined (reading 'client_secret') at startPayment",
      explanation: 'Код ждал в ответе `client_secret` для оплаты, а получил ошибку 502 — и упал молча. Покупатель видит «ничего не происходит». Это второй баг: фронтенд должен показывать сообщение об ошибке.',
    },
    {
      id: 'escalation',
      prompt:
        'Напиши эскалацию в L3 (по-русски, термины можно по-английски). Обязательно: **эндпоинт**, **статус**, **request_id**, **время в UTC** (из заголовка ответа `date`), что видно во **фронтенде** (Console), и какие ошибки — **шум**.',
      write: {
        lang: 'ru',
        minWords: 35,
        rows: 10,
        template: 'Кратко:\nЗапрос:\nСтатус:\nrequest_id:\nВремя (UTC):\nФронтенд (Console):\nШум:\nВлияние:\n',
        rubric: [
          { label: 'Эндпоинт payments/intent', any: ['payments/intent'] },
          { label: 'Статус 502', any: ['502'] },
          { label: `request_id ${REQ_ID}`, any: [REQ_ID] },
          { label: 'Время 07:42 UTC', any: ['0?7:42', '0?8:42 ?(cet|по гамбургу|местн)'] },
          { label: 'Фронтенд: TypeError / client_secret / ошибка не показывается', any: ['client_secret', 'typeerror', 'не показыва', 'не отобража', 'молча', 'nothing happens'] },
          { label: 'Шум: favicon / блокировщик не связаны', any: ['favicon', 'trackly', 'blocked_by_client', 'блокировщик', 'adblock'] },
          { label: 'Провайдер PayStream / влияние на магазин', any: ['paystream', 'провайдер', 'provider', 'заказ', 'оплат'] },
        ],
      },
      hints: ['Заполни заготовку фактами из DevTools.', `Время — из Response Headers → date: «${DATE}».`, 'Шум — favicon.ico 404 и trackly ERR_BLOCKED_BY_CLIENT.'],
      solution:
        `Кратко: на витрине brewandleaf.shopflow.store не проходит оплата — кнопка Place order ничего не делает, магазин с утра не принимает заказы.\n` +
        `Запрос: POST /api/storefront/v1/payments/intent\nСтатус: 502 Bad Gateway, message: Payment provider PayStream returned an invalid response\n` +
        `request_id: ${REQ_ID}\nВремя (UTC): 2026-11-05 07:42:13\n` +
        `Фронтенд (Console): после 502 — TypeError: Cannot read properties of undefined (reading 'client_secret') в startPayment, ошибка не показывается покупателю.\n` +
        `Шум: favicon.ico 404 и trackly ERR_BLOCKED_BY_CLIENT — не связаны.\nВлияние: магазин Brew & Leaf GmbH теряет заказы. HAR приложен, куки удалены.`,
    },
  ],
  quiz: [
    { id: 'q-502', type: 'text', prompt: '502 Bad Gateway в этом кейсе: наш сервер получил плохой ответ от кого? (по Response)', answer: { accept: [], normalize: 'keywords', keywords: [['paystream', 'платёж', 'платеж', 'провайдер', 'provider', 'upstream', 'вышестоящ']] }, explanation: 'От платёжного провайдера PayStream. 502 — «шлюз получил плохой ответ от следующего сервиса».' },
    { id: 'q-noise', type: 'text', prompt: 'Нужно ли указывать favicon.ico 404 и ERR_BLOCKED_BY_CLIENT как причину проблемы? (да/нет)', answer: { accept: [], normalize: 'keywords', keywords: [['нет', 'no', 'не нужно', 'не относ', 'шум']] }, explanation: 'Нет — это шум. Их можно упомянуть в эскалации отдельной строкой «не связано», чтобы L3 не тратил на них время.' },
    { id: 'q-reply', type: 'choice', prompt: 'Что ответить Лене сразу после эскалации?', options: ['«Очистите кэш и куки, должно помочь»', '«Спасибо за HAR — он показал ошибку на нашей стороне при создании платежа. Мы передали её инженерам с высоким приоритетом и сообщим новости в течение часа»', '«У нас всё работает, проверьте интернет»'], correct: 1, explanation: 'Честно и по делу: проблема найдена, на нашей стороне, эскалирована, есть срок следующего обновления.' },
    { id: 'q-two-bugs', type: 'text', prompt: 'В кейсе две проблемы: 502 на сервере и ещё одна — во фронтенде. Какая? (кратко)', answer: { accept: [], normalize: 'keywords', keywords: [['не показ', 'не отображ', 'нет сообщ', 'молча', 'ошибку не', 'обработ', 'client_secret', 'typeerror', 'падает', 'упал']] }, explanation: 'Фронтенд не обрабатывает ошибку сервера: падает с TypeError и ничего не показывает покупателю.' },
  ],
  glossary: [
    { ru: 'Ошибка шлюза', en: '502 Bad Gateway', def: 'Сервер-посредник получил плохой ответ от следующего сервиса.' },
    { ru: 'Платёжный провайдер', en: 'payment provider (PSP)', def: 'Внешний сервис, который проводит оплату картой.' },
    { ru: 'Оформление заказа', en: 'checkout', def: 'Шаги от корзины до оплаты.' },
    { ru: 'Обработка ошибок', en: 'error handling', def: 'Что делает код, если запрос не удался: показать сообщение, повторить.' },
  ],
};
export default lesson;
