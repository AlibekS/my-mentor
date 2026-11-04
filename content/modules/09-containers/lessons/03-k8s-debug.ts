import type { LessonDef } from '../../../../src/content/types';
import type { Scenario } from '../../../../src/shell/types';
import { Shell } from '../../../../src/shell/shell';

const scenario: Scenario = {
  kube: {
    namespace: 'prod',
    deployments: [
      {
        name: 'reports', namespace: 'prod', image: 'shop/reports:1.5.0', replicas: 1, env: { DB_URL: 'postgres://db.prod:5432/shop' },
        behaviors: [{ spec: { status: 'CrashLoopBackOff', ready: '0/1', restarts: 9, lastReason: 'Error', exitCode: 1, logs: '', previousLogs: '2026-11-04T14:29:31Z INFO  starting reports v1.5.0\n2026-11-04T14:29:32Z FATAL config: REPORTS_BUCKET is not set\n', events: ['Warning  BackOff  30s (x40 over 9m)  kubelet  Back-off restarting failed container reports'] } }],
      },
      {
        name: 'search', namespace: 'prod', image: 'shop/search:3.1.0', replicas: 1, memoryLimit: '512Mi',
        behaviors: [{ spec: { status: 'CrashLoopBackOff', ready: '0/1', restarts: 6, lastReason: 'OOMKilled', exitCode: 137, previousLogs: 'INFO building index\nINFO loaded 1.2M docs\n', events: ['Warning  BackOff  1m (x20 over 12m)  kubelet  Back-off restarting failed container search'] } }],
      },
      {
        name: 'mailer', namespace: 'prod', image: 'shop/mailer:2.0.O', replicas: 1,
        behaviors: [{ spec: { status: 'ImagePullBackOff', ready: '0/1', restarts: 0, events: ['Normal   Pulling  3m (x4 over 5m)  kubelet  Pulling image "shop/mailer:2.0.O"', 'Warning  Failed   3m (x4 over 5m)  kubelet  Failed to pull image "shop/mailer:2.0.O": manifest unknown: manifest for shop/mailer:2.0.O not found'] } }],
      },
      {
        name: 'ml-scoring', namespace: 'prod', image: 'shop/ml:0.9.1', replicas: 1, memoryLimit: '24Gi',
        behaviors: [{ spec: { status: 'Pending', ready: '0/1', restarts: 0, events: ['Warning  FailedScheduling  2m (x8 over 10m)  default-scheduler  0/3 nodes are available: 3 Insufficient memory.'] } }],
      },
    ],
  },
};

const pods = new Shell(scenario).state.kube.pods;
const pod = (d: string) => pods.find((p) => p.deployment === d)!.name;

const lesson: LessonDef = {
  id: 'k8s-debug',
  title: 'Отладка подов: describe, logs --previous, events',
  minutes: 35,
  commands: ['kubectl'],
  scenario,
  tasks: [
    {
      id: 'previous',
      prompt: `Под \`${pod('reports')}\` в CrashLoopBackOff, а \`kubectl logs\` пустой. Посмотри логи **упавшего** контейнера. Какой переменной не хватает?`,
      answer: { accept: ['REPORTS_BUCKET'], label: 'Переменная:' },
      hints: ['Флаг `--previous` (или `-p`).'],
      solution: `kubectl logs ${pod('reports')} --previous`,
      tags: ['kubectl'],
    },
    {
      id: 'oom',
      prompt: 'Под `search` тоже перезапускается. Через `describe` найди **причину последнего завершения** (Last State → Reason).',
      answer: { accept: ['OOMKilled'], label: 'Reason:' },
      hints: ['`kubectl describe pod <имя пода search>` — имя возьми из `kubectl get pods`.'],
      solution: `kubectl describe pod ${pod('search')}`,
      explanation: 'OOMKilled + Exit Code 137 при лимите 512Mi — индексу не хватает памяти. Решение — лимит/оптимизация, а не перезапуски.',
      tags: ['kubectl'],
    },
    {
      id: 'image',
      prompt: 'Под `mailer` в ImagePullBackOff. Найди в событиях describe причину и введи **тег образа**, который не удаётся скачать (присмотрись к нему внимательно).',
      answer: { accept: ['2.0.O', 'shop/mailer:2.0.O'], label: 'Тег:' },
      hints: ['`kubectl describe pod <под mailer>` → Events.'],
      solution: `kubectl describe pod ${pod('mailer')}`,
      explanation: 'В теге буква **O** вместо нуля: `2.0.O`. Опечатка в манифесте — образа с таким тегом нет.',
      tags: ['kubectl'],
    },
    {
      id: 'pending',
      prompt: 'Под `ml-scoring` висит в Pending. Выведи **события** namespace и найди причину. Введи, чего не хватает на нодах (одно слово, англ.).',
      answer: { accept: ['memory', 'insufficient memory', 'память', 'памяти'], label: 'Чего не хватает:' },
      hints: ['`kubectl get events`', 'Ищи `FailedScheduling`.'],
      solution: 'kubectl get events',
      explanation: 'Лимит/запрос 24Gi больше, чем свободно на любой ноде. Нужно уменьшить запрос или добавить ноду побольше.',
      tags: ['kubectl'],
    },
  ],
  quiz: [
    { id: 'q-prev', type: 'text', prompt: 'Какой флаг `kubectl logs` показывает логи предыдущего (упавшего) экземпляра контейнера?', answer: { accept: ['--previous', '-p'] }, explanation: '`kubectl logs POD --previous`.' },
    { id: 'q-137', type: 'text', prompt: 'В describe: `Last State: Terminated, Reason: OOMKilled`. Какой будет Exit Code? (число)', answer: { accept: ['137'], normalize: 'number' }, explanation: '137 = SIGKILL от OOM killer по лимиту памяти контейнера.' },
    { id: 'q-pull', type: 'choice', prompt: 'ImagePullBackOff — самые частые причины?', options: ['Ошибка в коде приложения', 'Опечатка в имени/теге образа или нет доступа к registry (credentials)', 'Не хватает памяти на ноде'], correct: 1, explanation: 'Смотри Events: `manifest unknown` (нет тега) или `unauthorized` (доступ).' },
    { id: 'q-events', type: 'command', prompt: 'Выведи события текущего namespace.', scenario, solution: 'kubectl get events', explanation: '`kubectl get events` (часто с `--sort-by=.lastTimestamp`).' },
  ],
  glossary: [
    { ru: 'Цикл падений', en: 'CrashLoopBackOff', def: 'Контейнер падает, k8s перезапускает его с растущей паузой.' },
    { ru: 'Ошибка загрузки образа', en: 'ImagePullBackOff', def: 'Не удаётся скачать образ из registry.' },
    { ru: 'Ожидание размещения', en: 'Pending / FailedScheduling', def: 'Под не может быть размещён ни на одной ноде.' },
    { ru: 'Проба готовности', en: 'readiness probe', def: 'Проверка, готов ли под принимать трафик.' },
  ],
};
export default lesson;
