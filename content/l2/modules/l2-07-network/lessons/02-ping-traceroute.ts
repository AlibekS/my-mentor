import type { LessonDef } from '../../../../../src/content/types';
import type { Scenario } from '../../../../../src/shell/types';

const erpHops = ['10.0.1.1', '100.64.0.1', '95.56.0.1', '*', '*', '*', '*'];
const lastAnswered = erpHops.reduce((n, h, i) => (h === '*' ? n : i + 1), 0);
const apiLatency = 38;

const scenario: Scenario = {
  host: 'support-01',
  network: {
    hosts: {
      'api.shopflow.io': { ip: '203.0.113.80', latencyMs: apiLatency, hops: ['10.0.1.1', '100.64.0.1', '195.12.4.1', '80.81.192.10', '203.0.113.80'] },
      'erp.kazmart.kz': { ip: '91.215.40.12', reachable: false, latencyMs: 9, hops: erpHops },
      'pay.paystream.com': { ip: '198.51.100.40', reachable: false, latencyMs: 61, hops: ['10.0.1.1', '100.64.0.1', '*', '80.81.194.2', '198.51.100.40'] },
    },
    http: {
      'https://api.shopflow.io/health': { status: 200, headers: { 'Content-Type': 'application/json' }, body: '{"status":"ok"}\n' },
      'https://pay.paystream.com/health': { status: 200, headers: { 'Content-Type': 'application/json' }, body: '{"status":"ok","service":"paystream-checkout"}\n' },
    },
  },
};

const lesson: LessonDef = {
  id: 'ping-traceroute',
  title: 'ping и traceroute: жив ли узел и где обрывается путь',
  minutes: 20,
  commands: ['ping', 'traceroute', 'curl'],
  scenario,
  tasks: [
    {
      id: 'ping4',
      prompt: 'Проверь, отвечает ли наш API `api.shopflow.io`: отправь **ровно 4 пакета** ping.',
      check: { type: 'all', checks: [{ type: 'outputContains', value: '203.0.113.80' }, { type: 'outputMatches', pattern: '(^|\\n)4 packets transmitted, 4 received, 0% packet loss' }] },
      hints: ['Флаг `-c` задаёт количество пакетов.', '`ping -c 4 api.shopflow.io`'],
      solution: 'ping -c 4 api.shopflow.io',
      tags: ['ping'],
    },
    {
      id: 'avg',
      prompt: 'Какое **среднее** время ответа (avg RTT) до `api.shopflow.io` в миллисекундах? Введи число (можно округлить до целого).',
      answer: { accept: [String(apiLatency), apiLatency.toFixed(3), apiLatency.toFixed(1)], normalize: 'number', label: 'avg, мс:' },
      hints: ['Последняя строка вывода ping: `rtt min/avg/max/mdev = …` — второе число.'],
      solution: 'ping -c 4 api.shopflow.io',
      explanation: '~38 мс — нормальная задержка до сервера в соседней стране.',
    },
    {
      id: 'trace',
      prompt: 'Система клиента Kazmart (`erp.kazmart.kz`) перестала присылать нам заказы. Построй маршрут до неё. **Номер какого хопа** — последний, который ответил (дальше только `* * *`)?',
      answer: { accept: [String(lastAnswered)], normalize: 'number', label: 'Хоп №:' },
      hints: ['`traceroute erp.kazmart.kz`', 'Найди последнюю строку с IP-адресом перед звёздочками и посмотри её номер слева.'],
      solution: 'traceroute erp.kazmart.kz',
      explanation: `Путь доходит до хопа ${lastAnswered} (${erpHops[lastAnswered - 1]}) и дальше обрывается. Это сеть провайдера клиента — аргумент, что проблема на их стороне (или их фаервол режет пакеты).`,
      tags: ['traceroute'],
    },
    {
      id: 'icmp',
      prompt:
        'Тикет:\n\n> *Your payment page is down! I pinged pay.paystream.com and got 100% packet loss.*\n\n' +
        '(*down* — не работает, *packet loss* — потеря пакетов.) Не верь ping на слово — проверь **сам сервис**: запроси `https://pay.paystream.com/health` и выведи ответ.',
      check: { type: 'all', checks: [{ type: 'outputMatches', pattern: '"status":\\s*"ok"' }, { type: 'commandUsed', name: 'curl' }] },
      hints: ['`curl https://pay.paystream.com/health`'],
      solution: 'curl -s https://pay.paystream.com/health',
      explanation: 'Сервис отвечает `status: ok`, хотя ping не проходит: PayStream блокирует ICMP. Отвечаем клиенту: «платёжная страница работает, ping на этот адрес закрыт специально; давайте посмотрим, что именно видите вы».',
      tags: ['curl'],
    },
  ],
  quiz: [
    { id: 'q-loss', type: 'text', prompt: 'What does *packet loss* mean? (ответь по-русски)', answer: { accept: [], normalize: 'keywords', keywords: [['потер', 'не вернул', 'не дош', 'пропа', 'теря']] }, explanation: 'Потеря пакетов — доля пакетов, на которые не пришёл ответ.' },
    { id: 'q-c', type: 'text', prompt: 'Каким флагом в Linux задать количество пакетов ping?', answer: { accept: ['-c', 'c', '-c 4', '-c N', 'ping -c', 'ping -c 4'] }, explanation: '`ping -c 4 host`. В Windows — `-n 4`.' },
    { id: 'q-stars', type: 'choice', prompt: 'В traceroute на хопе 4 `* * *`, а хопы 5 и 6 снова отвечают и цель достигнута. Что это значит?', options: ['Связь оборвана на хопе 4', 'Маршрутизатор 4 просто не отвечает на пробы — это норма', 'Цель недоступна'], correct: 1, explanation: 'Если путь продолжается, звёздочки на промежуточном хопе — не проблема.' },
    { id: 'q-icmp', type: 'text', prompt: 'По какому протоколу работает ping (4 буквы)?', answer: { accept: ['ICMP'] }, explanation: 'ICMP. Веб работает по TCP (порты 80/443) — поэтому ping может не проходить, а сайт открываться.' },
  ],
  glossary: [
    { ru: 'Время приёма-передачи', en: 'RTT, round-trip time', def: 'Сколько пакет идёт до узла и обратно.' },
    { ru: 'Потеря пакетов', en: 'packet loss', def: 'Доля пакетов без ответа.' },
    { ru: 'Хоп', en: 'hop', def: 'Промежуточный маршрутизатор на пути к цели.' },
    { ru: 'Доступен / недоступен', en: 'reachable / unreachable', def: 'Отвечает ли узел по сети.' },
    { ru: 'Задержка', en: 'latency', def: 'Время прохождения сигнала; на практике — RTT.' },
  ],
};
export default lesson;
