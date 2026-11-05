import type { LessonDef } from '../../../../../src/content/types';
import type { Scenario } from '../../../../../src/shell/types';

const PROXY_HOST = 'proxy.acme.corp';
const PROXY_PORT = 3128;

const scenario: Scenario = {
  host: 'acme-laptop-17',
  env: {
    HTTPS_PROXY: `http://${PROXY_HOST}:${PROXY_PORT}`,
    HTTP_PROXY: `http://${PROXY_HOST}:${PROXY_PORT}`,
    NO_PROXY: 'localhost,127.0.0.1,.acme.corp',
  },
  network: {
    hosts: {
      'app.shopflow.io': { ip: '203.0.113.80', latencyMs: 44 },
      'uploads.shopflow.io': { ip: '203.0.113.85', reachable: false, latencyMs: 44 },
      'legacy.acme-partner.com': { ip: '192.0.2.15', latencyMs: 70 },
      [PROXY_HOST]: { ip: '10.50.0.3', latencyMs: 2 },
    },
    http: {
      'https://app.shopflow.io/health': { status: 200, headers: { 'Content-Type': 'application/json' }, body: '{"status":"ok"}\n' },
      'https://uploads.shopflow.io/health': { status: 0, error: 'timeout', timeMs: 30000 },
      'https://legacy.acme-partner.com:8443/api': { status: 0, error: 'refused' },
    },
  },
  files: { '/etc/hostname': 'acme-laptop-17\n' },
};

const lesson: LessonDef = {
  id: 'vpn-proxy-firewall',
  title: 'VPN, прокси и фаервол: timeout, refused или NXDOMAIN',
  minutes: 25,
  commands: ['curl', 'nc', 'env', 'grep'],
  scenario,
  tasks: [
    {
      id: 'nxdomain',
      prompt:
        'Ты на ноутбуке сотрудника компании ACME (сеанс удалённой поддержки). Первый тикет:\n\n> *I can\'t open https://wiki.acme.corp from home. In the office it works.*\n\n' +
        'Попробуй: `curl https://wiki.acme.corp`. Какой это тип ошибки: NXDOMAIN (имя не найдено), timeout или refused?',
      answer: { accept: ['NXDOMAIN'], normalize: 'keywords', keywords: [['nxdomain', 'resolve', 'dns', 'днс', 'имя не', 'имени', 'не найд', 'разреш', '(6)']], label: 'Тип:' },
      hints: ['`curl https://wiki.acme.corp`', '*Could not resolve host* — не удалось найти IP по имени.'],
      solution: 'curl https://wiki.acme.corp\n# curl: (6) Could not resolve host',
      explanation: '`wiki.acme.corp` — внутреннее имя, его знает только DNS компании. Из дома без VPN имя не находится. Ответ: «подключитесь к корпоративному VPN».',
      tags: ['curl'],
    },
    {
      id: 'timeout',
      prompt:
        'Второй тикет:\n\n> *File upload hangs for a long time and then fails.*\n\n' +
        '(*hangs* — зависает.) Загрузка идёт через `uploads.shopflow.io`. Проверь: `curl https://uploads.shopflow.io/health`. Какой тип ошибки?',
      answer: { accept: ['timeout'], normalize: 'keywords', keywords: [['timeout', 'timed out', 'тайм', 'истек', 'не отвеч', 'нет ответа', '(28)']], label: 'Тип:' },
      hints: ['`curl https://uploads.shopflow.io/health`', '*Timeout was reached* — время ожидания истекло.'],
      solution: 'curl https://uploads.shopflow.io/health\n# curl: (28) … Timeout was reached',
      tags: ['curl'],
    },
    {
      id: 'app-ok',
      prompt: 'А основной сервис отвечает? Запроси `https://app.shopflow.io/health` и выведи ответ.',
      check: { type: 'all', checks: [{ type: 'outputMatches', pattern: '"status":\\s*"ok"' }, { type: 'commandUsed', name: 'curl' }] },
      hints: ['`curl https://app.shopflow.io/health`'],
      solution: 'curl -s https://app.shopflow.io/health',
      explanation: 'app отвечает, uploads — нет. Наш uploads у других клиентов работает — значит, его режет сеть ACME (прокси или фаервол) выборочно.',
      tags: ['curl'],
    },
    {
      id: 'proxy',
      prompt: 'Посмотри переменные окружения, связанные с прокси. Через какой прокси (адрес и порт) этот ноутбук ходит в интернет?',
      answer: { accept: [`${PROXY_HOST}:${PROXY_PORT}`], normalize: 'keywords', keywords: [[PROXY_HOST], [String(PROXY_PORT)]], label: 'Прокси:' },
      hints: ['`env | grep -i proxy`', 'Переменная `HTTPS_PROXY`.'],
      solution: 'env | grep -i proxy',
      explanation: `Весь трафик идёт через ${PROXY_HOST}:${PROXY_PORT}. В ответе клиенту: «попросите IT разрешить *.shopflow.io на прокси и фаерволе».`,
      tags: ['env', 'grep'],
    },
    {
      id: 'refused',
      prompt:
        'Третий тикет:\n\n> *Our old partner service legacy.acme-partner.com on port 8443 stopped working.*\n\n' +
        'Проверь порт: `nc -zv legacy.acme-partner.com 8443`. Какой результат: открыт, отказ (refused) или таймаут?',
      answer: { accept: ['refused'], normalize: 'keywords', keywords: [['refused', 'отказ', 'отклон', 'отверг']], label: 'Результат:' },
      hints: ['`nc -zv legacy.acme-partner.com 8443`'],
      solution: 'nc -zv legacy.acme-partner.com 8443',
      explanation: 'Connection refused: сервер партнёра доступен, но на порту 8443 никто не слушает — сервис остановлен или переехал на другой порт. Это вопрос к партнёру, а не к сети ACME.',
      tags: ['nc'],
    },
  ],
  quiz: [
    { id: 'q-resolve', type: 'text', prompt: "A user sees *Could not resolve host*. Is it a DNS problem? (yes/no — да/нет)", answer: { accept: ['yes', 'да', 'yes, dns', 'да, dns', 'да dns'] }, explanation: 'Да: имя не удалось перевести в IP — это DNS (опечатка, внутреннее имя без VPN, не настроенный домен).' },
    { id: 'q-wifi', type: 'text', prompt: "Customer: *It works on mobile data but not on the office Wi-Fi.* Какая причина наиболее вероятна? (по-русски)", answer: { accept: [], normalize: 'keywords', keywords: [['фаервол', 'файрвол', 'firewall', 'прокси', 'proxy', 'офисн', 'корпоратив', 'брандмауэр', 'межсетев', 'сеть компании', 'сети компании', 'блокир']] }, explanation: 'Корпоративная сеть: фаервол или прокси блокирует наш сервис. Решать будет IT клиента.' },
    { id: 'q-diff', type: 'choice', prompt: 'Чем `Connection refused` отличается от `Connection timed out`?', options: ['Ничем, это одно и то же', 'Refused — узел быстро ответил «никто не слушает»; timeout — ответа не было вовсе (часто фаервол)', 'Refused — ошибка DNS, timeout — ошибка сертификата'], correct: 1, explanation: 'Refused — быстрый отказ от узла; timeout — тишина до истечения времени ожидания.' },
    { id: 'q-env', type: 'text', prompt: 'Какую переменную окружения используют curl и многие программы для прокси HTTPS-запросов?', answer: { accept: ['HTTPS_PROXY', 'https_proxy', '$HTTPS_PROXY'] }, explanation: '`HTTPS_PROXY` (и `HTTP_PROXY` для http). `NO_PROXY` — исключения.' },
  ],
  glossary: [
    { ru: 'Виртуальная частная сеть', en: 'VPN (Virtual Private Network)', def: 'Защищённый туннель из ноутбука в сеть компании.' },
    { ru: 'Прокси-сервер', en: 'proxy server', def: 'Посредник, через который программы ходят в интернет; может фильтровать трафик.' },
    { ru: 'Межсетевой экран', en: 'firewall', def: 'Правила, какой трафик пропускать, а какой блокировать.' },
    { ru: 'Разрешённый список', en: 'allowlist', def: 'Перечень адресов, куда (или откуда) трафик разрешён; всё остальное — запрещено.' },
    { ru: 'Таймаут / отказ', en: 'timeout / connection refused', def: 'Нет ответа вовсе / быстрый ответ «порт никто не слушает».' },
  ],
};
export default lesson;
