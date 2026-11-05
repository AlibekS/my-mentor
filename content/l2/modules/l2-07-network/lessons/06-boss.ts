import type { LessonDef } from '../../../../../src/content/types';
import type { Scenario } from '../../../../../src/shell/types';

const NEW_IP = '203.0.113.80';
const OLD_IP = '198.51.100.24';
const FW_GW = '10.8.0.1';
const apiHops = [FW_GW, '*', '*', '*', '*', '*'];
const lastHop = apiHops.filter((h) => h !== '*').pop()!;

const nft = `#!/usr/sbin/nft -f
# Brew & Leaf GmbH - Hamburg warehouse - outbound allowlist
# owner: IT (j.weber), last change: 2025-03-12

table inet filter {
  chain output {
    type filter hook output priority 0; policy drop;

    oif "lo" accept
    ct state established,related accept

    udp dport 53 accept                              # DNS
    ip daddr 10.8.0.0/16 accept                      # warehouse LAN
    ip daddr ${OLD_IP} tcp dport 443 accept       # ShopFlow API (api.shopflow.io)
    ip daddr 151.101.1.10 tcp dport 443 accept       # status.shopflow.io (CDN)
    ip daddr 185.199.108.153 tcp dport 443 accept    # scanner firmware updates
  }
}
`;

const notice = `ShopFlow - Scheduled maintenance, Nov 4, 2026, 22:00-23:30 UTC

What changes: api.shopflow.io moves to a new load balancer.
New IP address: ${NEW_IP} (old address ${OLD_IP} is switched off).

Action required: if your firewall uses an IP allowlist, please add the new
address before the maintenance. We recommend allowing the domain name
api.shopflow.io instead of a fixed IP address.
`;

const scenario: Scenario = {
  user: 'support',
  host: 'wh-hamburg-01',
  network: {
    interfaces: [
      { name: 'lo', ip: '127.0.0.1/8', state: 'UP' },
      { name: 'eth0', ip: '10.8.2.15/16', mac: '02:42:0a:08:02:0f', state: 'UP' },
    ],
    hosts: {
      'api.shopflow.io': { ip: NEW_IP, reachable: false, latencyMs: 22, hops: apiHops },
      'status.shopflow.io': { ip: '151.101.1.10', latencyMs: 9 },
    },
    http: {
      'https://api.shopflow.io/v1/health': { status: 0, error: 'timeout', timeMs: 30000 },
      'https://api.shopflow.io/v1/orders': { status: 0, error: 'timeout', timeMs: 30000 },
      'https://status.shopflow.io/': { status: 200, headers: { 'Content-Type': 'application/json' }, body: '{"status":"all systems operational","updated":"2026-11-05T09:00:00Z"}\n' },
    },
  },
  files: {
    '/etc/hostname': 'wh-hamburg-01\n',
    '/etc/hosts': '127.0.0.1 localhost\n10.8.2.15 wh-hamburg-01\n',
    '/etc/nftables.conf': { content: nft, mode: 0o644 },
    '/home/support/maintenance-notice.txt': { content: notice, owner: 'support' },
    '/var/log/wms/integration.log': {
      content:
        '2026-11-04 21:58:01 INFO  sync orders: 12 sent to https://api.shopflow.io/v1/orders\n' +
        '2026-11-04 23:15:00 ERROR sync orders: connect ETIMEDOUT api.shopflow.io:443\n' +
        '2026-11-05 08:00:00 ERROR sync orders: connect ETIMEDOUT api.shopflow.io:443\n' +
        '2026-11-05 09:00:00 ERROR sync orders: connect ETIMEDOUT api.shopflow.io:443\n',
    },
  },
};

const lesson: LessonDef = {
  id: 'boss',
  kind: 'boss',
  title: 'Hamburg warehouse can’t reach your API',
  minutes: 40,
  incident: { ticket: 'ZD-48377: «API not reachable from our Hamburg warehouse since last night»', severity: 'SEV3', customer: 'Brew & Leaf GmbH (Германия), склад в Гамбурге' },
  commands: ['curl', 'dig', 'traceroute', 'cat', 'nc'],
  scenario,
  tasks: [
    {
      id: 'repro',
      prompt: 'Воспроизведи ошибку с сервера склада: запроси `https://api.shopflow.io/v1/health`. Какой тип ошибки: NXDOMAIN, refused или timeout?',
      answer: { accept: ['timeout'], normalize: 'keywords', keywords: [['timeout', 'timed out', 'тайм', 'истек', 'не отвеч', 'нет ответа', 'etimedout', '(28)']], label: 'Тип:' },
      hints: ['`curl https://api.shopflow.io/v1/health`', '*Timeout was reached* — время ожидания истекло.'],
      solution: 'curl https://api.shopflow.io/v1/health\n# curl: (28) … Timeout was reached',
      explanation: 'Совпадает с ошибкой клиента (ETIMEDOUT): имя находится, соединение уходит в пустоту.',
      tags: ['curl'],
    },
    {
      id: 'dns',
      prompt: 'Какой IP-адрес у `api.shopflow.io` в DNS сейчас?',
      answer: { accept: [NEW_IP], normalize: 'keywords', keywords: [[NEW_IP]], label: 'IP:' },
      hints: ['`dig +short api.shopflow.io` или `nslookup api.shopflow.io`.'],
      solution: 'dig +short api.shopflow.io',
      explanation: `DNS уже отдаёт новый адрес ${NEW_IP} — после работ это правильно.`,
      tags: ['dig'],
    },
    {
      id: 'internet',
      prompt: 'Работает ли с этого сервера HTTPS вообще? Запроси нашу статус-страницу `https://status.shopflow.io` и выведи ответ.',
      check: { type: 'all', checks: [{ type: 'outputContains', value: 'operational' }, { type: 'commandUsed', name: 'curl' }] },
      hints: ['`curl https://status.shopflow.io`'],
      solution: 'curl -s https://status.shopflow.io',
      explanation: 'Другой HTTPS-сайт открывается — интернет и DNS у склада в порядке. Не пускают только к API.',
      tags: ['curl'],
    },
    {
      id: 'trace',
      prompt: 'Построй маршрут до `api.shopflow.io`. Введи **IP последнего узла, который ответил** (дальше только `* * *`).',
      answer: { accept: [lastHop], normalize: 'keywords', keywords: [[lastHop]], label: 'IP:' },
      hints: ['`traceroute api.shopflow.io`'],
      solution: 'traceroute api.shopflow.io',
      explanation: `Путь обрывается сразу после ${lastHop} — это шлюз/фаервол самого склада (адрес из их сети 10.8.x.x). Пакеты к API дальше склада не уходят.`,
      tags: ['traceroute'],
    },
    {
      id: 'allowlist',
      prompt: 'Посмотри фаервол склада `/etc/nftables.conf`. Какой IP-адрес ShopFlow API в нём **разрешён**? Сравни с письмом о работах `~/maintenance-notice.txt`.',
      answer: { accept: [OLD_IP], normalize: 'keywords', keywords: [[OLD_IP]], label: 'IP:' },
      hints: ['`cat /etc/nftables.conf` — строка с комментарием `ShopFlow API`.', '`cat ~/maintenance-notice.txt` — старый и новый адрес.'],
      solution: 'cat /etc/nftables.conf\ncat ~/maintenance-notice.txt',
      explanation: `В allowlist склада — старый адрес ${OLD_IP}, который ночью выключили. Новый ${NEW_IP} в списке отсутствует, политика по умолчанию — drop, отсюда timeout. Берлинский офис, видимо, разрешает домен или весь 443.`,
      tags: ['cat'],
    },
    {
      id: 'action',
      prompt: 'Итог: что должен сделать IT клиента, чтобы склад снова подключился? Ответь одной фразой и укажи **новый IP**.',
      answer: {
        accept: [`добавить ${NEW_IP} в allowlist фаервола`],
        normalize: 'keywords',
        keywords: [
          ['фаервол', 'файрвол', 'firewall', 'allowlist', 'allow list', 'белый список', 'разреш', 'nftables', 'правил', 'брандмауэр'],
          [NEW_IP],
        ],
        label: 'Действие:',
      },
      hints: ['Что нужно поменять в `/etc/nftables.conf`?', `Ответ вроде «добавить … в разрешённые на фаерволе».`],
      solution: `# добавить ${NEW_IP} (или домен api.shopflow.io) в allowlist фаервола склада`,
      explanation: 'Проблема на стороне клиента, но вызвана нашими работами: вежливо объясняем, прикладываем выдержку из письма о работах и строку из их фаервола. Рекомендуем разрешать домен, а не IP. Внутри — предложение для L3/менеджеров: проверять allowlist-клиентов перед сменой IP.',
    },
  ],
  quiz: [
    { id: 'q-berlin', type: 'text', prompt: 'Why does the Berlin office work? (по-русски, кратко)', answer: { accept: [], normalize: 'keywords', keywords: [['фаервол', 'файрвол', 'firewall', 'правил', 'allowlist', 'другой', 'другая', 'другие', 'свой', 'своя', 'разреш', 'нет ограничен', 'домен']] }, explanation: 'У Берлина другой фаервол/другие правила: например, разрешён домен или весь исходящий 443. Ограничение по старому IP есть только у склада.' },
    { id: 'q-newip', type: 'text', prompt: 'What is the new IP address of api.shopflow.io?', answer: { accept: [NEW_IP], normalize: 'keywords', keywords: [[NEW_IP]] }, explanation: `${NEW_IP} — из DNS и письма о работах.` },
    { id: 'q-reply', type: 'choice', prompt: 'Какой ответ клиенту лучше?', options: ['«У нас всё работает, проблема на вашей стороне»', '«Спасибо за доступ. Ночью API переехал на новый адрес 203.0.113.80 (об этом было письмо о плановых работах). Фаервол склада разрешает только старый 198.51.100.24 — пожалуйста, добавьте новый адрес или домен api.shopflow.io в allowlist. Будем на связи, пока всё не заработает»', '«Перезагрузите сервер склада»'], correct: 1, explanation: 'Факты, причина, конкретное действие, вежливость и готовность помочь — без обвинений.' },
    { id: 'q-timeout', type: 'text', prompt: 'Почему ошибка была именно timeout, а не connection refused? (кратко)', answer: { accept: [], normalize: 'keywords', keywords: [['drop', 'отбрас', 'молча', 'не отвеч', 'без ответа', 'фаервол', 'firewall', 'блокир', 'режет']] }, explanation: 'Фаервол склада (policy drop) молча отбрасывает пакеты — ответа нет, программа ждёт до таймаута.' },
  ],
  glossary: [
    { ru: 'Плановые работы', en: 'scheduled maintenance', def: 'Заранее объявленное обслуживание сервиса.' },
    { ru: 'Разрешённый список', en: 'allowlist', def: 'Список адресов, куда трафик разрешён; остальное блокируется.' },
    { ru: 'Адрес назначения', en: 'destination address (daddr)', def: 'IP, на который отправлен пакет.' },
    { ru: 'Балансировщик нагрузки', en: 'load balancer', def: 'Сервер на входе, распределяет запросы; при переезде на новый меняется IP.' },
  ],
};
export default lesson;
