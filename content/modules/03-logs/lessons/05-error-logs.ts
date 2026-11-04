import type { LessonDef } from '../../../../src/content/types';

const errorLog = `2026/11/04 13:58:40 [warn] 1234#0: *5120 an upstream response is buffered to a temporary file
2026/11/04 14:02:11 [error] 1234#0: *5390 upstream timed out (110: Connection timed out) while reading response header from upstream, client: 91.204.8.33, request: "GET /api/reports/2026 HTTP/1.1", upstream: "http://127.0.0.1:8081/api/reports/2026"
2026/11/04 14:05:12 [error] 1234#0: *5531 connect() failed (111: Connection refused) while connecting to upstream, client: 185.12.40.7, request: "POST /api/checkout HTTP/1.1", upstream: "http://127.0.0.1:8081/api/checkout"
2026/11/04 14:05:19 [error] 1234#0: *5540 connect() failed (111: Connection refused) while connecting to upstream, client: 37.150.2.11, request: "GET /api/cart HTTP/1.1", upstream: "http://127.0.0.1:8081/api/cart"
2026/11/04 14:06:02 [error] 1234#0: *5561 connect() failed (111: Connection refused) while connecting to upstream, client: 10.20.1.14, request: "POST /api/checkout HTTP/1.1", upstream: "http://127.0.0.1:8081/api/checkout"
2026/11/04 14:07:30 [error] 1234#0: *5602 client intended to send too large body: 15728640 bytes, client: 2.133.91.4, request: "POST /api/upload HTTP/1.1"
`;

const appLog = `2026-11-04 14:04:51 INFO  [req=8f2c] POST /api/checkout user=771 ok 120ms
2026-11-04 14:04:58 ERROR [req=8f3a] Unhandled exception in POST /api/checkout user=902
java.lang.NullPointerException: Cannot invoke "kz.shop.model.Address.getCity()" because "address" is null
    at kz.shop.checkout.TaxService.calc(TaxService.java:42)
    at kz.shop.checkout.CheckoutController.submit(CheckoutController.java:88)
    at org.springframework.web.servlet.FrameworkServlet.service(FrameworkServlet.java:897)
    at java.base/java.lang.Thread.run(Thread.java:1583)
2026-11-04 14:05:00 ERROR [req=8f3b] java.lang.OutOfMemoryError: Java heap space
2026-11-04 14:05:01 INFO  shutting down: fatal error
`;

const accessLines = `185.12.40.7 - - [04/Nov/2026:14:04:58 +0500] "POST /api/checkout HTTP/1.1" 500 98 "-" "Mozilla/5.0" req=8f3a
37.150.2.11 - - [04/Nov/2026:14:05:19 +0500] "GET /api/cart HTTP/1.1" 502 157 "-" "Mozilla/5.0" req=8f40
`;

const lesson: LessonDef = {
  id: 'error-logs',
  title: 'Error-логи, стек-трейсы и request id',
  minutes: 30,
  commands: ['grep'],
  scenario: { files: { '/var/log/nginx/error.log': errorLog, '/var/log/shop/app.log': appLog, '/var/log/nginx/access.log': accessLines } },
  tasks: [
    {
      id: 'refused',
      prompt: 'Сколько раз в `/var/log/nginx/error.log` nginx не смог подключиться к приложению (**Connection refused**)? Выведи число.',
      check: { type: 'outputNumber', value: 3 },
      hints: ['`grep -c`'],
      solution: 'grep -c "Connection refused" /var/log/nginx/error.log',
      tags: ['grep'],
    },
    {
      id: 'upstream',
      prompt: 'На какой **порт** nginx проксирует запросы к приложению (upstream)? Введи номер порта.',
      answer: { accept: ['8081'], normalize: 'number', label: 'Порт:' },
      hints: ['Смотри поле `upstream: "http://..."` в строках error.log.'],
      solution: 'grep -o "upstream: \\"[^\\"]*" /var/log/nginx/error.log | head -1',
      tags: ['grep'],
    },
    {
      id: 'trace',
      prompt: 'Клиент прислал **Request ID 8f3a**. Найди этот запрос в логе приложения `/var/log/shop/app.log` и выведи строку **вместе со стек-трейсом** (5 строк после).',
      check: { type: 'all', checks: [{ type: 'outputContains', value: ['req=8f3a', 'NullPointerException', 'TaxService.calc'] }] },
      hints: ['Контекст после совпадения — `-A`.', '`grep -A 5 8f3a /var/log/shop/app.log`'],
      solution: 'grep -A 5 8f3a /var/log/shop/app.log',
      tags: ['grep'],
    },
    {
      id: 'everywhere',
      prompt: 'Найди request id `8f3a` **во всех логах** в `/var/log` сразу (рекурсивно).',
      check: { type: 'all', checks: [{ type: 'outputContains', value: ['/var/log/nginx/access.log:', '/var/log/shop/app.log:'] }] },
      hints: ['Рекурсивный поиск — `-r`.'],
      solution: 'grep -r 8f3a /var/log',
      tags: ['grep'],
    },
  ],
  quiz: [
    {
      id: 'q-111',
      type: 'choice',
      prompt: 'В error.log nginx: `connect() failed (111: Connection refused) while connecting to upstream`. Что, скорее всего, случилось?',
      options: ['Приложение отвечает медленно', 'На порту upstream никто не слушает — приложение упало или не запущено', 'У клиента плохой интернет'],
      correct: 1,
      explanation: '`Connection refused` — порт закрыт. Медленный ответ дал бы `upstream timed out` и 504.',
    },
    {
      id: 'q-504',
      type: 'text',
      prompt: 'Какой HTTP-код обычно отдаёт nginx при `upstream timed out`? (число)',
      answer: { accept: ['504'], normalize: 'number' },
      explanation: '**504 Gateway Timeout** — бэкенд не ответил вовремя. 502 Bad Gateway — бэкенд недоступен или ответил некорректно.',
    },
    {
      id: 'q-where',
      type: 'text',
      prompt: 'По стек-трейсу из задания: в каком **классе и методе** кода магазина упало? (формат Класс.метод)',
      answer: { accept: ['TaxService.calc', 'kz.shop.checkout.TaxService.calc'] },
      explanation: 'Первый кадр с кодом компании (`kz.shop...`) — `TaxService.calc` (TaxService.java:42). Причина — пустой address.',
    },
    {
      id: 'q-413',
      type: 'text',
      prompt: 'Сообщение nginx `client intended to send too large body` — какой код получит клиент? (число)',
      answer: { accept: ['413'], normalize: 'number' },
      explanation: '**413 Payload Too Large**; лечится настройкой `client_max_body_size` (если загрузка легитимна).',
    },
  ],
  glossary: [
    { ru: 'Стек вызовов', en: 'stack trace', def: 'Цепочка вызовов функций в момент исключения.' },
    { ru: 'Идентификатор корреляции', en: 'correlation id / request id', def: 'Общий id, по которому запрос находится во всех логах.' },
    { ru: 'Вышестоящий сервер (для nginx)', en: 'upstream', def: 'Бэкенд, к которому проксирует nginx.' },
  ],
};
export default lesson;
