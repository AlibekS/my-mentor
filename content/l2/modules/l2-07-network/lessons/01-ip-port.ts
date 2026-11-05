import type { LessonDef } from '../../../../../src/content/types';
import type { Scenario } from '../../../../../src/shell/types';

const proc = (pid: number, user: string, command: string) => ({ pid, user, cpu: 0.4, mem: 1.2, vsz: 420_000, rss: 52_000, stat: 'Ssl', start: 'Nov01', time: '2:10', command });

const scenario: Scenario = {
  host: 'shop-app-01',
  processes: [
    proc(1, 'root', '/sbin/init'),
    proc(512, 'root', 'sshd: /usr/sbin/sshd -D'),
    proc(1101, 'root', 'nginx: master process /usr/sbin/nginx'),
    proc(2240, 'shopflow', 'node /opt/shopflow/server.js'),
    proc(901, 'postgres', '/usr/lib/postgresql/16/bin/postgres'),
    proc(3300, 'redis', '/usr/bin/redis-server 127.0.0.1:6379'),
  ],
  listeners: [
    { proto: 'tcp', local: '0.0.0.0:22', pid: 512, process: 'sshd' },
    { proto: 'tcp', local: '0.0.0.0:80', pid: 1101, process: 'nginx' },
    { proto: 'tcp', local: '0.0.0.0:443', pid: 1101, process: 'nginx' },
    { proto: 'tcp', local: '127.0.0.1:3000', pid: 2240, process: 'node' },
    { proto: 'tcp', local: '127.0.0.1:5432', pid: 901, process: 'postgres' },
    { proto: 'tcp', local: '127.0.0.1:6379', pid: 3300, process: 'redis-server' },
  ],
  network: {
    interfaces: [
      { name: 'lo', ip: '127.0.0.1/8', state: 'UP' },
      { name: 'eth0', ip: '10.0.3.21/24', mac: '02:42:ac:11:03:15', state: 'UP' },
    ],
  },
  files: {
    '/etc/hosts': '127.0.0.1 localhost\n10.0.3.21 shop-app-01\n',
    '/etc/hostname': 'shop-app-01\n',
  },
};

const lesson: LessonDef = {
  id: 'ip-port',
  title: 'IP-адрес и порт: куда «стучится» браузер',
  minutes: 20,
  commands: ['ip', 'hostname', 'ss', 'nc'],
  scenario,
  tasks: [
    {
      id: 'ip',
      prompt: 'Ты на сервере `shop-app-01` интернет-магазина. Какой IP-адрес у его сетевого интерфейса `eth0`? Введи адрес без маски (`/24`).',
      answer: { accept: ['10.0.3.21'], normalize: 'keywords', keywords: [['10.0.3.21']], label: 'IP:' },
      hints: ['Команда `ip a` — ищи блок `eth0` и строку `inet`.', 'Или `hostname -I`.'],
      solution: 'ip a',
      explanation: '`10.0.3.21` — частный адрес (начинается с 10.): из интернета к нему напрямую не попасть, клиенты ходят через балансировщик или публичный адрес.',
      tags: ['ip'],
    },
    {
      id: 'listen',
      prompt: 'Выведи список всех **слушающих TCP-портов** сервера вместе с именами процессов (понадобится `sudo`, чтобы увидеть чужие процессы).',
      check: { type: 'all', checks: [{ type: 'outputContains', value: ['nginx', 'node', 'postgres', ':3000'] }, { type: 'outputContains', value: 'pid=' }] },
      hints: ['Команда `ss` с флагами t, l, n, p.', '`sudo ss -tlnp`'],
      solution: 'sudo ss -tlnp',
      tags: ['ss'],
    },
    {
      id: 'node-port',
      prompt: 'На каком **порту** слушает приложение `node` (сам интернет-магазин)? Введи число.',
      answer: { accept: ['3000'], normalize: 'number', label: 'Порт:' },
      hints: ['В выводе `sudo ss -tlnp` найди строку с `node`.', 'Порт — число после двоеточия в колонке Local Address:Port.'],
      solution: 'sudo ss -tlnp | grep node',
      tags: ['ss', 'grep'],
    },
    {
      id: 'nc-local',
      prompt: 'Проверь с самого сервера, что порт приложения действительно открыт: `nc -zv localhost 3000`. Что показала команда — порт открыт или закрыт?',
      answer: { accept: ['открыт'], normalize: 'keywords', keywords: [['succeeded', 'открыт', 'успеш', 'success', 'connected', 'работает', 'ok']], label: 'Результат:' },
      hints: ['`nc -zv localhost 3000`', '*succeeded* — успешно.'],
      solution: 'nc -zv localhost 3000',
      tags: ['nc'],
    },
    {
      id: 'outside',
      prompt: 'Клиент спрашивает, можно ли ему подключаться к приложению напрямую по адресу `10.0.3.21:3000`, минуя nginx. Посмотри, на каком **адресе** слушает `node`. Можно ли подключиться к нему с другого компьютера? (да/нет и почему)',
      answer: { accept: ['нет'], normalize: 'keywords', keywords: [['нет', 'no', 'нельзя', 'только локал', 'только с сервер', 'только с этого', 'localhost', '127.0.0.1']], label: 'Ответ:' },
      hints: ['В выводе `ss` у node адрес `127.0.0.1:3000`.', '127.0.0.1 — «только этот компьютер».'],
      solution: 'sudo ss -tlnp | grep 3000',
      explanation: '`node` слушает `127.0.0.1:3000` — только локальные подключения. Снаружи клиенты попадают через nginx на портах 80/443 (`0.0.0.0`), а nginx уже передаёт запросы приложению.',
      tags: ['ss'],
    },
  ],
  quiz: [
    { id: 'q-https', type: 'text', prompt: 'Which port does HTTPS use by default? (Какой порт у HTTPS по умолчанию?)', answer: { accept: ['443'], normalize: 'number' }, explanation: '443. HTTP — 80, SSH — 22.' },
    { id: 'q-format', type: 'text', prompt: 'Как записать адрес «IP 10.0.3.21, порт 443» одной строкой?', answer: { accept: ['10.0.3.21:443'] }, explanation: 'Через двоеточие: `10.0.3.21:443`.' },
    { id: 'q-ticket-port', type: 'text', prompt: "A customer writes: *I connect to your API at 52.29.10.4, port 8443.* Which number is the port?", answer: { accept: ['8443'], normalize: 'number' }, explanation: 'Порт — 8443, IP — 52.29.10.4.' },
    { id: 'q-loopback', type: 'choice', prompt: 'Сервис слушает `127.0.0.1:5432`. Кто может к нему подключиться?', options: ['Кто угодно из интернета', 'Только программы на этом же сервере', 'Только компьютеры из офиса'], correct: 1, explanation: '127.0.0.1 (localhost) — петлевой адрес, доступен только на самом сервере.' },
  ],
  glossary: [
    { ru: 'IP-адрес', en: 'IP address', def: 'Адрес компьютера в сети, например 10.0.3.21.' },
    { ru: 'Порт', en: 'port', def: 'Номер «двери» программы на компьютере: 22 — SSH, 443 — HTTPS.' },
    { ru: 'Слушать порт', en: 'listen', def: 'Программа ждёт входящих подключений на адресе и порту.' },
    { ru: 'Петлевой адрес', en: 'loopback / localhost (127.0.0.1)', def: 'Адрес «этот же компьютер»; снаружи недоступен.' },
    { ru: 'Частный адрес', en: 'private IP', def: '10.x, 172.16–31.x, 192.168.x — внутренние сети, из интернета напрямую недоступны.' },
  ],
};
export default lesson;
