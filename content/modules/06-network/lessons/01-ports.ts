import type { LessonDef } from '../../../../src/content/types';

const scenario = {
  processes: [
    { pid: 1101, user: 'root', cpu: 0.1, mem: 0.2, vsz: 55000, rss: 9000, stat: 'Ss', start: 'Nov01', time: '1:12', command: 'nginx: master process /usr/sbin/nginx' },
    { pid: 901, user: 'postgres', cpu: 1, mem: 4, vsz: 1_200_000, rss: 390_000, stat: 'Ss', start: 'Oct12', time: '42:10', command: '/usr/lib/postgresql/16/bin/postgres' },
    { pid: 2240, user: 'shop', cpu: 3, mem: 9, vsz: 4_000_000, rss: 790_000, stat: 'Ssl', start: 'Nov03', time: '58:31', command: '/usr/bin/java -jar /opt/shop/shop.jar' },
    { pid: 3300, user: 'redis', cpu: 0.4, mem: 1.1, vsz: 70_000, rss: 15_000, stat: 'Ssl', start: 'Nov01', time: '3:02', command: '/usr/bin/redis-server 0.0.0.0:6379' },
    { pid: 3410, user: 'node_exporter', cpu: 0.1, mem: 0.2, vsz: 720_000, rss: 18_000, stat: 'Ssl', start: 'Nov04', time: '0:02', command: '/usr/local/bin/node_exporter --web.listen-address=127.0.0.1:9100' },
    { pid: 512, user: 'root', cpu: 0, mem: 0.1, vsz: 72000, rss: 6500, stat: 'Ss', start: 'Oct12', time: '0:03', command: 'sshd: /usr/sbin/sshd -D' },
  ],
  listeners: [
    { proto: 'tcp' as const, local: '0.0.0.0:22', pid: 512, process: 'sshd' },
    { proto: 'tcp' as const, local: '0.0.0.0:80', pid: 1101, process: 'nginx' },
    { proto: 'tcp' as const, local: '0.0.0.0:443', pid: 1101, process: 'nginx' },
    { proto: 'tcp' as const, local: '127.0.0.1:5432', pid: 901, process: 'postgres' },
    { proto: 'tcp' as const, local: '127.0.0.1:8080', pid: 2240, process: 'java' },
    { proto: 'tcp' as const, local: '0.0.0.0:6379', pid: 3300, process: 'redis-server' },
    { proto: 'tcp' as const, local: '127.0.0.1:9100', pid: 3410, process: 'node_exporter' },
    { proto: 'udp' as const, local: '127.0.0.53:53', pid: 410, process: 'systemd-resolve' },
  ],
};

const lesson: LessonDef = {
  id: 'ports',
  title: 'Интерфейсы и порты: ip, ss',
  minutes: 20,
  commands: ['ip', 'ss', 'hostname'],
  scenario,
  tasks: [
    {
      id: 'ip',
      prompt: 'Какой IP-адрес у интерфейса `eth0` этого сервера? Введи адрес без маски.',
      answer: { accept: ['10.0.1.15'], label: 'IP:' },
      hints: ['`ip a`'],
      solution: 'ip a',
      tags: ['ip'],
    },
    {
      id: 'listen',
      prompt: 'Выведи **все слушающие TCP и UDP порты с процессами** (с правами, чтобы видеть процессы).',
      // systemd-resolve — единственный UDP-сокет: так засчитывается и `ss -tulpn`, и `ss -tlpn; ss -ulpn`
      check: { type: 'all', checks: [{ type: 'outputContains', value: ['nginx', 'postgres', 'node_exporter', 'systemd-resolve'] }, { type: 'outputContains', value: 'pid=' }] },
      hints: ['`ss` с флагами t, u, l, p, n.', '`sudo ss -tulpn`'],
      solution: 'sudo ss -tulpn',
      tags: ['ss'],
    },
    {
      id: 'exporter',
      prompt: 'Prometheus с другого сервера не может собрать метрики с `node_exporter` (порт 9100). Посмотри, **на каком адресе** он слушает, и введи этот адрес (без порта).',
      answer: { accept: ['127.0.0.1', 'localhost', 'loopback', '127.0.0.1:9100'], label: 'Адрес:' },
      hints: ['`sudo ss -tulpn | grep 9100`'],
      solution: 'sudo ss -tulpn | grep 9100',
      explanation: '`127.0.0.1` — доступен только с самого сервера. Отсюда и «не собирается снаружи».',
      tags: ['ss', 'grep'],
    },
    {
      id: 'danger',
      prompt: 'Аудит безопасности: какой сервис хранилища данных (не веб и не SSH) слушает на **всех интерфейсах** (`0.0.0.0`)? Введи номер порта.',
      answer: { accept: ['6379', ':6379', '0.0.0.0:6379', '*:6379', 'порт 6379', 'redis 6379', '6379 redis', 'redis:6379', '6379/tcp', 'tcp/6379'], label: 'Порт:' },
      hints: ['Ищи строки с `0.0.0.0:` и исключи 22, 80, 443.'],
      solution: 'sudo ss -tulpn | grep 0.0.0.0',
      explanation: 'Redis на `0.0.0.0:6379` без пароля — классическая дыра. Его стоит повесить на 127.0.0.1/внутренний адрес и закрыть фаерволом.',
      tags: ['ss'],
    },
  ],
  quiz: [
    { id: 'q-flags', type: 'text', prompt: 'Что означает флаг `l` в `ss -tulpn`?', answer: { accept: [], normalize: 'keywords', keywords: [['listen', 'слуша']] }, explanation: '`-l` — только сокеты в состоянии LISTEN.' },
    { id: 'q-local', type: 'choice', prompt: 'Приложение слушает `127.0.0.1:8080`. Получится ли подключиться к нему с другого сервера напрямую?', options: ['Да, если открыт фаервол', 'Нет, только с этого же хоста (например, через nginx на нём)', 'Да, это стандартный адрес'], correct: 1, explanation: 'Loopback-адрес доступен только локально.' },
    { id: 'q-pg', type: 'text', prompt: 'Какой стандартный порт у PostgreSQL?', answer: { accept: ['5432'], normalize: 'number' }, explanation: '5432. MySQL — 3306, Redis — 6379.' },
    { id: 'q-who80', type: 'command', prompt: 'Напиши команду (с пайпом), которая покажет, какой процесс слушает порт **443**.', scenario, solution: 'sudo ss -tulpn | grep :443', check: { type: 'all', checks: [{ type: 'outputContains', value: ['nginx', '1101', '443'] }, { type: 'outputNotContains', value: ['sshd', 'redis', 'postgres'] }] }, explanation: '`sudo ss -tulpn | grep :443` или `sudo lsof -i :443`. Без `sudo` колонка процесса для чужих сокетов пустая.' },
  ],
  glossary: [
    { ru: 'Сокет', en: 'socket', def: 'Конечная точка соединения: адрес + порт + протокол.' },
    { ru: 'Петлевой интерфейс', en: 'loopback (127.0.0.1)', def: 'Виртуальный интерфейс для соединений внутри хоста.' },
    { ru: 'Слушать порт', en: 'listen / bind', def: 'Процесс ожидает входящие соединения на адресе и порту.' },
  ],
};
export default lesson;
