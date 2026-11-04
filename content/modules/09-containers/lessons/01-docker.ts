import type { LessonDef } from '../../../../src/content/types';
import type { Scenario } from '../../../../src/shell/types';

const scenario: Scenario = {
  docker: {
    containers: [
      { id: 'f6e5d4c3b2a1f0e9', name: 'nginx', image: 'nginx:1.27', status: 'Up 3 days', ports: '0.0.0.0:80->80/tcp', memMb: 24, cpu: 0.3, files: { '/etc/nginx/conf.d/default.conf': 'server {\n  listen 80;\n  location /api/ { proxy_pass http://api:8080/; }\n}\n' } },
      {
        id: 'a1b2c3d4e5f6a7b8', name: 'api', image: 'shop/api:1.8.2', status: 'Exited (137) 4 minutes ago', oomKilled: true, exitCode: 137, restartCount: 3, memLimitMb: 256, sizeMb: 40,
        env: { APP_ENV: 'staging', DB_HOST: 'postgres', JAVA_OPTS: '-Xmx512m' },
        logs: '2026-11-04T14:20:01Z INFO  started on :8080\n2026-11-04T14:25:40Z INFO  report export requested rows=2400000\n2026-11-04T14:25:58Z WARN  heap usage 92%\n',
        onStart: { status: 'Up 1 second' },
      },
      { id: 'c9d8e7f6a5b4c3d2', name: 'postgres', image: 'postgres:16', status: 'Up 3 days', ports: '5432/tcp', memMb: 310, cpu: 1.1, env: { POSTGRES_DB: 'shop', POSTGRES_USER: 'shop' } },
      { id: 'b7a6f5e4d3c2b1a0', name: 'worker', image: 'shop/worker:1.8.2', status: 'Restarting (1) 8 seconds ago', restartCount: 41, logs: 'Error: connect ECONNREFUSED 127.0.0.1:6379\nError: connect ECONNREFUSED 127.0.0.1:6379\n', env: { REDIS_URL: 'redis://127.0.0.1:6379' } },
    ],
    images: [
      { repo: 'shop/api', tag: '1.8.2', id: 'sha256:9a1f', sizeMb: 420 },
      { repo: 'shop/worker', tag: '1.8.2', id: 'sha256:7c2e', sizeMb: 180 },
      { repo: '<none>', tag: '<none>', id: 'sha256:11aa', sizeMb: 2300, dangling: true },
      { repo: '<none>', tag: '<none>', id: 'sha256:22bb', sizeMb: 1900, dangling: true },
    ],
  },
};

const lesson: LessonDef = {
  id: 'docker',
  title: 'Docker: ps, logs, inspect, exec',
  minutes: 30,
  commands: ['docker'],
  scenario,
  tasks: [
    {
      id: 'ps-a',
      prompt: 'Выведи **все** контейнеры, включая остановленные (нужен `sudo`). Какой контейнер в статусе `Exited`? Введи имя.',
      answer: { accept: ['api'], label: 'Контейнер:' },
      hints: ['`sudo docker ps -a`'],
      solution: 'sudo docker ps -a',
      tags: ['docker'],
    },
    {
      id: 'oom',
      prompt: 'Почему упал `api`? Выведи через `docker inspect --format` значения **ExitCode** и **OOMKilled** одной строкой.',
      check: { type: 'all', checks: [{ type: 'outputContains', value: ['137', 'true'] }, { type: 'outputLines', value: 1 }] },
      hints: ["`--format '{{.State.ExitCode}} {{.State.OOMKilled}}'`"],
      solution: "sudo docker inspect api --format '{{.State.ExitCode}} {{.State.OOMKilled}}'",
      explanation: 'Код 137 и OOMKilled=true — контейнер упёрся в лимит памяти (256 МБ), а в JAVA_OPTS стоит `-Xmx512m`: приложению разрешено больше, чем контейнеру.',
      tags: ['docker'],
    },
    {
      id: 'xmx',
      prompt: 'Посмотри переменные окружения `api` через `docker inspect` (или `--format \'{{.Config.Env}}\'`). Какой размер heap задан в `JAVA_OPTS`? Введи значение (например `512m`).',
      answer: { accept: ['512m', '-Xmx512m', '512'], label: 'Xmx:' },
      hints: ["`sudo docker inspect api --format '{{.Config.Env}}'`"],
      solution: "sudo docker inspect api --format '{{.Config.Env}}'",
      tags: ['docker'],
    },
    {
      id: 'worker',
      prompt: '`worker` постоянно перезапускается. Посмотри его последние логи и введи, к какому **адресу:порту** он не может подключиться.',
      answer: { accept: ['127.0.0.1:6379', 'localhost:6379'], label: 'Адрес:' },
      hints: ['`sudo docker logs --tail 5 worker`'],
      solution: 'sudo docker logs --tail 5 worker',
      explanation: 'Внутри контейнера `127.0.0.1` — это сам контейнер, а не хост и не Redis. Нужно имя сервиса в docker-сети (`redis://redis:6379`). Частая ошибка при переносе конфигов в контейнеры.',
      tags: ['docker'],
    },
    {
      id: 'prune',
      prompt: 'На хосте мало места. Посмотри `docker system df` и удали **висячие образы** (`<none>`). Задание засчитается, когда их не останется.',
      check: { type: 'custom', fn: (sh) => !(sh.state.docker.images ?? []).some((i) => i.dangling) },
      hints: ['`sudo docker system df`', '`sudo docker image prune -f`'],
      solution: 'sudo docker image prune -f',
      tags: ['docker'],
    },
  ],
  quiz: [
    { id: 'q-137', type: 'text', prompt: 'Контейнер в статусе `Exited (137)`. Каким сигналом его завершили? (имя или номер)', answer: { accept: ['SIGKILL', 'KILL', '9'] }, explanation: '137 = 128 + 9. Если `OOMKilled: true` — это лимит памяти.' },
    { id: 'q-a', type: 'text', prompt: 'Какой флаг `docker ps` покажет и остановленные контейнеры?', answer: { accept: ['-a', '--all'] }, explanation: '`docker ps -a`.' },
    { id: 'q-localhost', type: 'choice', prompt: 'Приложение в контейнере пытается подключиться к Redis по `127.0.0.1:6379`, а Redis в соседнем контейнере. Почему не работает?', options: ['Redis выключен', '127.0.0.1 внутри контейнера — это сам контейнер; нужно имя сервиса в docker-сети', 'Порт 6379 запрещён в Docker'], correct: 1, explanation: 'В docker-compose/сети контейнеры видят друг друга по именам сервисов.' },
    { id: 'q-logs', type: 'command', prompt: 'Выведи последние **2** строки логов контейнера `api`.', scenario, solution: 'sudo docker logs --tail 2 api', explanation: '`sudo docker logs --tail 2 api`.' },
  ],
  glossary: [
    { ru: 'Образ', en: 'image', def: 'Неизменяемый шаблон файловой системы и настроек для запуска контейнера.' },
    { ru: 'Контейнер', en: 'container', def: 'Изолированный процесс, запущенный из образа.' },
    { ru: 'Политика перезапуска', en: 'restart policy', def: 'Когда Docker перезапускает контейнер: no, on-failure, always, unless-stopped.' },
  ],
};
export default lesson;
