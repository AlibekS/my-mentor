import type { LessonDef } from '../../../../src/content/types';
import type { Scenario } from '../../../../src/shell/types';
import { Shell } from '../../../../src/shell/shell';

const scenario: Scenario = {
  kube: {
    namespace: 'default',
    deployments: [
      { name: 'checkout', namespace: 'prod', image: 'shop/checkout:2.3.1', replicas: 3, behaviors: [{ spec: { status: 'Running', logs: 'listening on :8080\n' } }] },
      { name: 'catalog', namespace: 'prod', image: 'shop/catalog:5.0.2', replicas: 2, behaviors: [{ spec: { status: 'Running' } }] },
      { name: 'reports', namespace: 'prod', image: 'shop/reports:1.4.0', replicas: 1, behaviors: [{ spec: { status: 'CrashLoopBackOff', ready: '0/1', restarts: 14, lastReason: 'Error', exitCode: 1 } }] },
      { name: 'checkout', namespace: 'staging', image: 'shop/checkout:2.4.0-rc1', replicas: 1, behaviors: [{ spec: { status: 'Running' } }] },
    ],
    services: [
      { name: 'checkout', namespace: 'prod', type: 'ClusterIP', clusterIp: '10.96.12.40', ports: '8080/TCP', age: '210d', selector: 'app=checkout' },
      { name: 'catalog', namespace: 'prod', type: 'ClusterIP', clusterIp: '10.96.12.41', ports: '8080/TCP', age: '210d', selector: 'app=catalog' },
      { name: 'shop-public', namespace: 'prod', type: 'LoadBalancer', clusterIp: '10.96.12.2', ports: '443:31443/TCP', age: '210d', selector: 'app=checkout' },
    ],
    nodes: [
      { name: 'worker-1', status: 'Ready', cpu: '1200m', memory: '9Gi', cpuPct: 30, memPct: 56 },
      { name: 'worker-2', status: 'Ready', cpu: '900m', memory: '7Gi', cpuPct: 22, memPct: 44 },
      { name: 'worker-3', status: 'NotReady', cpu: '-', memory: '-', cpuPct: 0, memPct: 0 },
    ],
  },
};

const pods = new Shell(scenario).state.kube.pods;
const reportsPod = pods.find((p) => p.deployment === 'reports')!.name;

const lesson: LessonDef = {
  id: 'k8s-basics',
  title: 'Kubernetes: pods, deployments, services, namespaces',
  minutes: 25,
  commands: ['kubectl'],
  scenario,
  tasks: [
    {
      id: 'context',
      prompt: 'Первым делом — в каком кластере ты работаешь? Введи имя текущего контекста.',
      answer: { accept: ['prod-eu-1'], label: 'Контекст:' },
      hints: ['`kubectl config current-context`'],
      solution: 'kubectl config current-context',
      tags: ['kubectl'],
    },
    {
      id: 'ns',
      prompt: '`kubectl get pods` показывает «No resources found». Выведи поды namespace **prod**.',
      check: { type: 'all', checks: [{ type: 'outputContains', value: ['checkout-', 'catalog-', 'reports-'] }, { type: 'outputNotContains', value: 'rc1' }] },
      hints: ['Флаг namespace: `-n prod`.'],
      solution: 'kubectl get pods -n prod',
      tags: ['kubectl'],
    },
    {
      id: 'broken',
      prompt: 'Какой под в prod **не Running**? Введи его полное имя.',
      answer: { accept: [reportsPod], label: 'Под:' },
      hints: ['`kubectl get pods -n prod` — колонка STATUS.'],
      solution: 'kubectl get pods -n prod',
      tags: ['kubectl'],
    },
    {
      id: 'deploy',
      prompt: 'Выведи деплойменты **во всех namespace**. Сколько реплик у `checkout` в prod (желаемое число)? Введи число.',
      answer: { accept: ['3'], normalize: 'number', label: 'Реплик:' },
      hints: ['`kubectl get deploy -A`', 'Колонка READY: `готово/желаемо`.'],
      solution: 'kubectl get deploy -A',
      tags: ['kubectl'],
    },
    {
      id: 'node',
      prompt: 'Проверь ноды кластера. Какая нода в статусе **NotReady**? Введи имя.',
      answer: { accept: ['worker-3'], label: 'Нода:' },
      hints: ['`kubectl get nodes`'],
      solution: 'kubectl get nodes',
      tags: ['kubectl'],
    },
  ],
  quiz: [
    { id: 'q-pod', type: 'choice', prompt: 'Под упал и был пересоздан деплойментом. Что изменится?', options: ['Ничего', 'Имя и IP пода (новый под), образ тот же', 'Образ обновится до последней версии'], correct: 1, explanation: 'Поды эфемерны: новый под — новое имя и IP. Постоянный адрес даёт Service.' },
    { id: 'q-all', type: 'text', prompt: 'Каким флагом `kubectl get` смотреть ресурсы во всех namespace? (короткий)', answer: { accept: ['-A', '--all-namespaces'] }, explanation: '`kubectl get pods -A`.' },
    { id: 'q-svc', type: 'text', prompt: 'Какой объект даёт постоянное имя и IP перед группой подов? (англ.)', answer: { accept: ['Service', 'svc', 'Service (svc)', 'сервис', 'Kubernetes Service'] }, explanation: 'Service выбирает поды по селектору (например `app=checkout`).' },
    { id: 'q-wide', type: 'command', prompt: 'Выведи поды namespace prod с IP и нодами.', scenario, solution: 'kubectl get pods -n prod -o wide', explanation: '`-o wide`.' },
  ],
  glossary: [
    { ru: 'Под', en: 'pod', def: 'Минимальная единица запуска в k8s: 1+ контейнеров с общим IP.' },
    { ru: 'Деплоймент', en: 'deployment', def: 'Желаемое состояние: образ, число реплик, стратегия обновления.' },
    { ru: 'Пространство имён', en: 'namespace', def: 'Логическая группа ресурсов внутри кластера.' },
    { ru: 'Контекст', en: 'kubeconfig context', def: 'Какой кластер и пользователь используются kubectl сейчас.' },
  ],
};
export default lesson;
