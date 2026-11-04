import type { LessonDef } from '../../../../src/content/types';

const scenario = {
  network: {
    hosts: { 'shop.kz': { ip: '10.0.2.5' }, 'api.shop.kz': { ip: '10.0.2.7' }, 'old.shop.kz': { ip: '10.0.2.5' }, 'reports.shop.kz': { ip: '10.0.2.9' } },
    http: {
      'https://shop.kz/': { status: 200, body: '<html>Shop</html>\n', headers: { 'Content-Type': 'text/html', 'Cache-Control': 'max-age=60' } },
      'https://old.shop.kz/': { status: 301, headers: { Location: 'https://shop.kz/' }, body: '' },
      'https://api.shop.kz/health': { status: 503, headers: { 'Content-Type': 'application/json', 'Retry-After': '120' }, body: '{"status":"maintenance","until":"15:00 UTC"}\n' },
      'https://reports.shop.kz/api/report/2026': { status: 504, body: '<html>504 Gateway Time-out</html>\n', timeMs: 60000 },
      'https://shop.kz/api/cart': { status: 200, body: '{"items":[]}\n', timeMs: 2350 },
    },
  },
};

const lesson: LessonDef = {
  id: 'http',
  title: 'HTTP-коды и curl -v / -I',
  minutes: 30,
  commands: ['curl'],
  scenario,
  tasks: [
    {
      id: 'code',
      prompt: 'Выведи **только HTTP-код** ответа `https://api.shop.kz/health` (без тела и заголовков).',
      check: { type: 'all', checks: [{ type: 'outputMatches', pattern: '^503\\s*$' }] },
      hints: ['`-s -o /dev/null -w "%{http_code}"`'],
      solution: 'curl -s -o /dev/null -w "%{http_code}" https://api.shop.kz/health',
      tags: ['curl'],
    },
    {
      id: 'retry',
      prompt: 'Посмотри **заголовки** ответа того же URL. Через сколько секунд сервис просит повторить запрос (`Retry-After`)? Введи число.',
      answer: { accept: ['120'], normalize: 'number', label: 'Секунд:' },
      hints: ['`curl -I https://api.shop.kz/health`'],
      solution: 'curl -I https://api.shop.kz/health',
      tags: ['curl'],
    },
    {
      id: 'redirect',
      prompt: 'Куда перенаправляет `https://old.shop.kz/`? Введи URL из заголовка `Location`.',
      answer: { accept: ['https://shop.kz/', 'https://shop.kz', 'shop.kz'], label: 'Location:' },
      hints: ['`curl -I https://old.shop.kz/`'],
      solution: 'curl -I https://old.shop.kz/',
      tags: ['curl'],
    },
    {
      id: 'slow',
      prompt: 'Клиенты жалуются на медленную корзину. Измерь **общее время ответа** `https://shop.kz/api/cart` в секундах (`%{time_total}`) и введи значение (можно округлить до десятых).',
      answer: { accept: ['2.35', '2.4', '2.3'], normalize: 'number', label: 'Секунд:' },
      hints: ['`curl -s -o /dev/null -w "%{time_total}" URL`'],
      solution: 'curl -s -o /dev/null -w "%{time_total}" https://shop.kz/api/cart',
      tags: ['curl'],
    },
  ],
  quiz: [
    { id: 'q-504', type: 'text', prompt: 'Прокси не дождался ответа от бэкенда. Какой код получит клиент? (число)', answer: { accept: ['504'], normalize: 'number' }, explanation: '504 Gateway Timeout. 502 — бэкенд недоступен/ответил мусором.' },
    { id: 'q-401-403', type: 'choice', prompt: 'Токен клиента корректный, но у его роли нет доступа к ресурсу. Какой код правильный?', options: ['401 Unauthorized', '403 Forbidden', '404 Not Found'], correct: 1, explanation: '401 — не аутентифицирован; 403 — аутентифицирован, но нет прав.' },
    { id: 'q-429', type: 'text', prompt: 'Какой код означает, что клиент превысил лимит запросов (rate limit)? (число)', answer: { accept: ['429'], normalize: 'number' }, explanation: '429 Too Many Requests, часто с заголовком Retry-After.' },
    { id: 'q-head', type: 'command', prompt: 'Получи только заголовки ответа `https://shop.kz/`.', scenario, solution: 'curl -I https://shop.kz/', explanation: '`curl -I` (HEAD-запрос).' },
  ],
  glossary: [
    { ru: 'Код состояния', en: 'HTTP status code', def: 'Трёхзначный код результата: 2xx успех, 4xx ошибка клиента, 5xx ошибка сервера.' },
    { ru: 'Заголовок', en: 'header', def: 'Метаданные запроса/ответа: Content-Type, Location, Retry-After.' },
    { ru: 'Перенаправление', en: 'redirect', def: 'Ответ 3xx с адресом в Location.' },
  ],
};
export default lesson;
