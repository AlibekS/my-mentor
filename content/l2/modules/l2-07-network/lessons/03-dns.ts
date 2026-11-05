import type { LessonDef } from '../../../../../src/content/types';
import type { Scenario } from '../../../../../src/shell/types';

const NEW_IP = '203.0.113.80';
const OLD_IP = '198.51.100.24';

const scenario: Scenario = {
  host: 'kazmart-pos-03',
  network: {
    hosts: {
      'app.shopflow.io': { ip: NEW_IP, latencyMs: 41 },
      'old-lb.shopflow.io': { ip: OLD_IP, reachable: false, latencyMs: 40 },
      'stores.shopflow.io': { ip: '203.0.113.90', latencyMs: 41 },
      'shop.kazmart.kz': { ip: '203.0.113.90', cname: 'stores.shopflow.io', latencyMs: 41 },
    },
    http: { 'https://app.shopflow.io/health': { status: 200, body: '{"status":"ok"}\n' } },
  },
  files: {
    '/etc/hosts': `127.0.0.1 localhost\n10.20.1.33 kazmart-pos-03\n${OLD_IP}  app.shopflow.io   # temp: migration test, Oct 2026\n`,
    '/etc/hostname': 'kazmart-pos-03\n',
  },
};

/** /etc/hosts больше не подменяет app.shopflow.io (строку удалили или закомментировали) */
const hostsFixed = (content: string) => !content.split('\n').some((l) => l.replace(/#.*/, '').split(/\s+/).includes('app.shopflow.io'));

const lesson: LessonDef = {
  id: 'dns',
  title: 'DNS: dig, nslookup, CNAME, NXDOMAIN и /etc/hosts',
  minutes: 25,
  commands: ['dig', 'nslookup', 'host', 'getent', 'ping', 'cat', 'sed', 'nano'],
  scenario,
  tasks: [
    {
      id: 'a-record',
      prompt: 'Ты подключился к кассовому компьютеру клиента Kazmart (сеанс удалённой поддержки). Узнай через DNS (`dig` или `nslookup`), какой IP у `app.shopflow.io`.',
      answer: { accept: [NEW_IP], normalize: 'keywords', keywords: [[NEW_IP]], label: 'IP:' },
      hints: ['`dig app.shopflow.io` — смотри ANSWER SECTION.', 'Или `dig +short app.shopflow.io`.'],
      solution: 'dig +short app.shopflow.io',
      tags: ['dig'],
    },
    {
      id: 'cname',
      prompt: 'Магазин Kazmart открывается по их собственному домену `shop.kazmart.kz`. На какое имя он указывает (запись CNAME)?',
      answer: { accept: ['stores.shopflow.io'], normalize: 'keywords', keywords: [['stores.shopflow.io']], label: 'CNAME:' },
      hints: ['`dig shop.kazmart.kz` или `nslookup shop.kazmart.kz` (строка canonical name).'],
      solution: 'dig shop.kazmart.kz',
      explanation: 'CNAME указывает на `stores.shopflow.io` — так и требует наша документация для своих доменов.',
      tags: ['dig'],
    },
    {
      id: 'nxdomain',
      prompt:
        'Тикет от клиента из Германии:\n\n> *We set up our domain shop.bluebird.de yesterday, but the browser says DNS_PROBE_FINISHED_NXDOMAIN.*\n\n' +
        '(*set up* — настроили.) Проверь `dig shop.bluebird.de`. Какой **status** вернул DNS?',
      answer: { accept: ['NXDOMAIN'], normalize: 'keywords', keywords: [['nxdomain']], label: 'status:' },
      hints: ['Строка `->>HEADER<<-` … `status: …`.'],
      solution: 'dig shop.bluebird.de',
      explanation: 'NXDOMAIN — имени нет в DNS: клиент не создал запись CNAME (или создал с опечаткой/для другого имени). Ответ клиенту: «создайте CNAME shop.bluebird.de → stores.shopflow.io у вашего DNS-провайдера».',
      tags: ['dig'],
    },
    {
      id: 'hosts-ip',
      prompt: 'Касса Kazmart не может открыть `app.shopflow.io`, хотя DNS отвечает правильно. Посмотри, **какой IP реально использует система** для этого имени (`getent hosts` или `ping -c 1`).',
      answer: { accept: [OLD_IP], normalize: 'keywords', keywords: [[OLD_IP]], label: 'IP:' },
      hints: ['`getent hosts app.shopflow.io` учитывает /etc/hosts, а `dig` — нет.', 'Или `ping -c 1 app.shopflow.io` — IP в скобках.'],
      solution: 'getent hosts app.shopflow.io',
      explanation: `Система идёт на ${OLD_IP} — старый адрес, который уже не отвечает. DNS при этом говорит ${NEW_IP}. Значит, имя подменено локально.`,
      tags: ['getent'],
    },
    {
      id: 'fix-hosts',
      prompt: 'Найди причину в `/etc/hosts` и **убери подмену** для `app.shopflow.io` (удали строку или закомментируй её `#`). Файл системный — нужен `sudo`.',
      check: {
        type: 'custom',
        fn: (sh) => {
          const n = sh.fs.lookup('/etc/hosts');
          return !!n && n.type === 'file' && n.content.includes('localhost') && hostsFixed(n.content);
        },
      },
      hints: ['`cat /etc/hosts` — третья строка с пометкой temp.', "`sudo sed -i '/app.shopflow.io/d' /etc/hosts` или `sudo nano /etc/hosts`."],
      solution: "sudo sed -i '/app.shopflow.io/d' /etc/hosts",
      explanation: 'После удаления строки система спрашивает DNS и получает правильный адрес. Проверь: `ping -c 2 app.shopflow.io` — теперь 203.0.113.80 и 0% loss.',
      tags: ['sed', 'sudo'],
    },
  ],
  quiz: [
    { id: 'q-dns', type: 'text', prompt: 'What does DNS do? (ответь по-русски, кратко)', answer: { accept: [], normalize: 'keywords', keywords: [['имя', 'имен', 'name', 'домен', 'domain'], ['ip', 'адрес', 'address']] }, explanation: 'DNS переводит имена (домены) в IP-адреса.' },
    { id: 'q-hosts', type: 'text', prompt: 'Какой файл в Linux позволяет вручную привязать имя к IP в обход DNS? (полный путь)', answer: { accept: ['/etc/hosts', 'etc/hosts'] }, explanation: '`/etc/hosts`. В Windows — `C:\\Windows\\System32\\drivers\\etc\\hosts`.' },
    { id: 'q-nx', type: 'choice', prompt: 'DNS вернул `status: NXDOMAIN`. Что это значит?', options: ['Сервер не отвечает на порту 443', 'Такого имени в DNS нет', 'Сертификат истёк'], correct: 1, explanation: 'NXDOMAIN — Non-Existent Domain: имя не найдено. До соединения с сервером дело даже не дошло.' },
    { id: 'q-short', type: 'text', prompt: 'Какой флаг `dig` выводит только IP-адрес, без остальной информации?', answer: { accept: ['+short'], normalize: 'keywords', keywords: [['+short']] }, explanation: '`dig +short app.shopflow.io`.' },
  ],
  glossary: [
    { ru: 'Система доменных имён', en: 'DNS (Domain Name System)', def: 'Переводит имена вроде app.shopflow.io в IP-адреса.' },
    { ru: 'Запись A / CNAME', en: 'A record / CNAME record', def: 'A — имя → IPv4; CNAME — имя → другое имя (псевдоним).' },
    { ru: 'Несуществующий домен', en: 'NXDOMAIN', def: 'Ответ DNS «такого имени нет».' },
    { ru: 'Время жизни записи', en: 'TTL (time to live)', def: 'Сколько секунд ответ DNS можно хранить в кэше.' },
    { ru: 'Файл hosts', en: 'hosts file', def: 'Локальная таблица «IP — имя», которая перебивает DNS на этом компьютере.' },
  ],
};
export default lesson;
