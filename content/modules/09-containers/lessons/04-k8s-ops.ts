import type { LessonDef } from '../../../../src/content/types';
import type { Scenario } from '../../../../src/shell/types';

const scenario: Scenario = {
  kube: {
    namespace: 'prod',
    deployments: [
      {
        name: 'catalog', namespace: 'prod', image: 'shop/catalog:5.1.0', replicas: 3,
        history: [{ image: 'shop/catalog:5.0.1' }, { image: 'shop/catalog:5.0.2' }, { image: 'shop/catalog:5.1.0' }],
        behaviors: [
          { image: 'shop/catalog:5.1.0', spec: { status: 'CrashLoopBackOff', ready: '0/1', restarts: 5, lastReason: 'Error', exitCode: 1, previousLogs: 'panic: runtime error: invalid memory address or nil pointer dereference\n' } },
          { spec: { status: 'Running', logs: 'listening on :8080\n' } },
        ],
      },
      {
        name: 'search', namespace: 'prod', image: 'shop/search:3.1.0', replicas: 1, memoryLimit: '512Mi',
        behaviors: [
          { memoryLimitAtLeastMi: 1024, spec: { status: 'Running' } },
          { spec: { status: 'CrashLoopBackOff', ready: '0/1', restarts: 6, lastReason: 'OOMKilled', exitCode: 137 } },
        ],
      },
      { name: 'checkout', namespace: 'prod', image: 'shop/checkout:2.3.1', replicas: 2, behaviors: [{ spec: { status: 'Running' } }] },
    ],
    services: [
      { name: 'catalog', namespace: 'prod', type: 'ClusterIP', clusterIp: '10.96.12.41', ports: '8080/TCP', age: '210d', selector: 'app=catalog' },
      { name: 'checkout', namespace: 'prod', type: 'ClusterIP', clusterIp: '10.96.12.40', ports: '8080/TCP', age: '210d', selector: 'app=checkout' },
    ],
  },
};

const lesson: LessonDef = {
  id: 'k8s-ops',
  title: 'rollout, scale, лимиты, endpoints',
  minutes: 30,
  commands: ['kubectl'],
  scenario,
  tasks: [
    {
      id: 'endpoints',
      prompt: 'Клиенты получают 503 от каталога. Проверь, есть ли у сервиса `catalog` живые **endpoints**.',
      check: { type: 'all', checks: [{ type: 'outputContains', value: ['catalog', '<none>'] }] },
      hints: ['`kubectl get endpoints catalog`'],
      solution: 'kubectl get endpoints catalog',
      tags: ['kubectl'],
    },
    {
      id: 'history',
      prompt: 'Посмотри историю ревизий деплоймента `catalog`. Какой образ был в **предыдущей** ревизии (до текущей)? Введи тег.',
      answer: { accept: ['5.0.2', 'shop/catalog:5.0.2'], label: 'Тег:' },
      hints: ['`kubectl rollout history deployment/catalog`'],
      solution: 'kubectl rollout history deployment/catalog',
      tags: ['kubectl'],
    },
    {
      id: 'undo',
      prompt: 'Новая версия падает с panic. **Откати** `catalog` на предыдущую ревизию и добейся, чтобы все 3 пода были Running.',
      check: { type: 'custom', fn: (sh) => { const ps = sh.state.kube.pods.filter((p) => p.deployment === 'catalog'); return ps.length === 3 && ps.every((p) => p.status === 'Running' && p.image === 'shop/catalog:5.0.2'); } },
      hints: ['`kubectl rollout undo deployment/catalog`', 'Проверь: `kubectl get pods` и `kubectl rollout status deployment/catalog`.'],
      solution: 'kubectl rollout undo deployment/catalog',
      tags: ['kubectl'],
    },
    {
      id: 'limits',
      prompt: '`search` падает с OOMKilled при лимите 512Mi. Подними лимит памяти деплоймента до **1Gi** и убедись, что под стал Running.',
      check: { type: 'custom', fn: (sh) => sh.state.kube.pods.filter((p) => p.deployment === 'search').every((p) => p.status === 'Running') && sh.state.kube.deployments!.find((d) => d.name === 'search')!.memoryLimit === '1Gi' },
      hints: ['`kubectl set resources deployment search --limits=memory=1Gi`'],
      solution: 'kubectl set resources deployment search --limits=memory=1Gi',
      explanation: 'Это экстренная мера — изменение нужно перенести в манифест в git, иначе следующий деплой вернёт 512Mi.',
      tags: ['kubectl'],
    },
    {
      id: 'scale',
      prompt: 'Начинается распродажа. Временно увеличь число реплик `checkout` до **5**.',
      check: { type: 'custom', fn: (sh) => sh.state.kube.pods.filter((p) => p.deployment === 'checkout' && p.status === 'Running').length === 5 },
      hints: ['`kubectl scale deployment/checkout --replicas=5`'],
      solution: 'kubectl scale deployment/checkout --replicas=5',
      tags: ['kubectl'],
    },
  ],
  quiz: [
    { id: 'q-undo', type: 'text', prompt: 'Какой командой откатить деплоймент `api` на предыдущую ревизию? (команда целиком)', answer: { accept: ['kubectl rollout undo deployment/api', 'kubectl rollout undo deploy/api', 'kubectl rollout undo deployment api'], normalize: 'exact' }, explanation: '`kubectl rollout undo deployment/api`.' },
    { id: 'q-endpoints', type: 'choice', prompt: '`kubectl get endpoints shop` → `<none>`, хотя поды Running и Ready. Вероятная причина?', options: ['Сервис удалён', 'Селектор сервиса не совпадает с метками подов', 'Нода NotReady'], correct: 1, explanation: 'Service выбирает поды по меткам; несовпадение = пустые endpoints.' },
    { id: 'q-cpu', type: 'text', prompt: 'Что происходит с контейнером при превышении **CPU**-лимита (в отличие от памяти)? (ключевые слова: троттлинг/замедляется)', answer: { accept: [], normalize: 'keywords', keywords: [['тротл', 'throttl', 'замедл', 'тормоз', 'ограничива']] }, explanation: 'CPU троттлится (тормоза), а превышение памяти — OOMKilled.' },
    { id: 'q-restart', type: 'command', prompt: 'Перезапусти все поды деплоймента `checkout` без смены образа.', scenario, solution: 'kubectl rollout restart deployment/checkout', check: { type: 'outputContains', value: 'restarted' }, explanation: '`kubectl rollout restart deployment/checkout`.' },
  ],
  glossary: [
    { ru: 'Откат', en: 'rollback (rollout undo)', def: 'Возврат деплоймента к предыдущей ревизии.' },
    { ru: 'Лимиты и запросы', en: 'limits / requests', def: 'Потолок и гарантированный объём CPU/памяти контейнера.' },
    { ru: 'Конечные точки', en: 'endpoints', def: 'Список IP:порт готовых подов за сервисом.' },
    { ru: 'GitOps', en: 'GitOps', def: 'Состояние кластера описано в git и применяется автоматически (ArgoCD, Flux).' },
  ],
};
export default lesson;
