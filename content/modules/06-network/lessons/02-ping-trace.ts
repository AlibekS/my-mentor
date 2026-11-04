import type { LessonDef } from '../../../../src/content/types';

const scenario = {
  network: {
    hosts: {
      'db-prod-01': { ip: '10.0.1.20', latencyMs: 0.4 },
      'api.partner.com': { ip: '203.0.113.50', latencyMs: 182, hops: ['10.0.1.1', '100.64.0.1', '195.12.4.1', '*', '80.81.192.77', '203.0.113.50'] },
      'pay.bank.kz': { ip: '198.51.100.10', reachable: false, latencyMs: 30, hops: ['10.0.1.1', '100.64.0.1', '*', '*', '*'] },
    },
    http: { 'https://pay.bank.kz/status': { status: 200, body: '{"status":"ok"}' } },
  },
};

const lesson: LessonDef = {
  id: 'ping-trace',
  title: 'ping, traceroute: доступность и путь',
  minutes: 20,
  commands: ['ping', 'traceroute', 'curl'],
  scenario,
  tasks: [
    {
      id: 'db',
      prompt: 'Проверь доступность `db-prod-01` **ровно 3 пакетами**.',
      check: { type: 'all', checks: [{ type: 'outputContains', value: '10.0.1.20' }, { type: 'outputMatches', pattern: '(^|\\n)3 packets transmitted, 3 received, 0% packet loss' }] },
      hints: ['`ping -c 3 db-prod-01`'],
      solution: 'ping -c 3 db-prod-01',
      tags: ['ping'],
    },
    {
      id: 'latency',
      prompt: 'Партнёрский API `api.partner.com` медленно отвечает. Сколько примерно миллисекунд занимает пинг до него? Введи число (округли до целого).',
      answer: { accept: ['182', '180'], normalize: 'number', label: 'RTT, мс:' },
      hints: ['`ping -c 4 api.partner.com`, строка `rtt min/avg/max`.'],
      solution: 'ping -c 4 api.partner.com',
    },
    {
      id: 'trace',
      prompt: 'Построй маршрут до `api.partner.com`. Сколько хопов в трассе (включая конечный узел)? Введи число.',
      answer: { accept: ['6'], normalize: 'number', label: 'Хопов:' },
      hints: ['`traceroute api.partner.com`'],
      solution: 'traceroute api.partner.com',
      tags: ['traceroute'],
    },
    {
      id: 'icmp',
      prompt: '`pay.bank.kz` не отвечает на ping (100% loss). Проверь, работает ли **сам сервис** — запроси `https://pay.bank.kz/status` и выведи ответ.',
      check: { type: 'all', checks: [{ type: 'outputMatches', pattern: '"status":\\s*"ok"' }, { type: 'commandUsed', name: 'curl' }] },
      hints: ['`curl -s https://pay.bank.kz/status`'],
      solution: 'curl -s https://pay.bank.kz/status',
      explanation: 'Сервис работает — просто ICMP закрыт фаерволом банка. Поэтому вывод «узел недоступен» по ping неверен.',
      tags: ['curl'],
    },
  ],
  quiz: [
    { id: 'q-icmp', type: 'choice', prompt: 'ping до сервера: 100% packet loss, но сайт на нём открывается. Почему?', options: ['ping врёт', 'ICMP заблокирован фаерволом, а TCP 443 разрешён', 'Сайт открывается из кэша браузера всегда'], correct: 1, explanation: 'ICMP и TCP — разные протоколы, фаервол может пропускать одно и резать другое.' },
    { id: 'q-c', type: 'text', prompt: 'Каким флагом ограничить количество пакетов ping?', answer: { accept: ['-c', 'c', '-c N', '-c 4', '-c <N>', '-c <число>'] }, explanation: '`ping -c 4 host`.' },
    { id: 'q-stars', type: 'text', prompt: 'Что обычно значат `* * *` на промежуточном хопе traceroute, если дальше хопы отвечают? (кратко: проблема или норма)', answer: { accept: [], normalize: 'keywords', keywords: [['норм', 'не отвечает', 'не страшно', 'ничего страш', 'не проблем', 'игнор', 'фильтр', 'блок', 'icmp']] }, explanation: 'Маршрутизатор просто не отвечает на пробы — это норма, если дальше путь продолжается.' },
    { id: 'q-mtr', type: 'text', prompt: 'Какая утилита совмещает ping и traceroute и обновляется в реальном времени? (3 буквы)', answer: { accept: ['mtr'] }, explanation: '`mtr host` — удобно для отчёта провайдеру о потерях на конкретном хопе.' },
  ],
  glossary: [
    { ru: 'Время приёма-передачи', en: 'RTT, round-trip time', def: 'Время от отправки пакета до получения ответа.' },
    { ru: 'Потеря пакетов', en: 'packet loss', def: 'Доля пакетов, не получивших ответа.' },
    { ru: 'Хоп', en: 'hop', def: 'Промежуточный маршрутизатор на пути пакета.' },
  ],
};
export default lesson;
