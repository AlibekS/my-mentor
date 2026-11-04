import type { LessonDef } from '../../../../src/content/types';
import type { Scenario } from '../../../../src/shell/types';

const crash = {
  status: 'CrashLoopBackOff', ready: '0/1', restarts: 4, lastReason: 'Error', exitCode: 1, logs: '',
  previousLogs: '2026-11-04T15:05:12Z INFO  checkout v2.4.0 starting\n2026-11-04T15:05:12Z INFO  loading config from env\n2026-11-04T15:05:13Z FATAL missing required env PAYMENT_GATEWAY_URL (renamed from PAYMENTS_URL in 2.4.0)\n',
  events: ['Warning  BackOff  20s (x18 over 6m)  kubelet  Back-off restarting failed container checkout'],
};

const scenario: Scenario = {
  kube: {
    namespace: 'prod',
    deployments: [
      {
        name: 'checkout', namespace: 'prod', image: 'shop/checkout:2.4.0', replicas: 3,
        env: { PAYMENTS_URL: 'https://pay.internal.shop.kz', DB_URL: 'postgres://db.prod:5432/shop' },
        history: [{ image: 'shop/checkout:2.2.9' }, { image: 'shop/checkout:2.3.1' }, { image: 'shop/checkout:2.4.0', cause: 'ci: release 2.4.0 (pipeline #8812)' }],
        behaviors: [
          { image: 'shop/checkout:2.4.0', envHas: 'PAYMENT_GATEWAY_URL', spec: { status: 'Running', logs: 'listening on :8080\n' } },
          { image: 'shop/checkout:2.4.0', spec: crash },
          { spec: { status: 'Running', logs: 'listening on :8080\n' } },
        ],
      },
      { name: 'catalog', namespace: 'prod', image: 'shop/catalog:5.0.2', replicas: 2, behaviors: [{ spec: { status: 'Running' } }] },
    ],
    services: [
      { name: 'checkout', namespace: 'prod', type: 'ClusterIP', clusterIp: '10.96.12.40', ports: '8080/TCP', age: '210d', selector: 'app=checkout' },
      { name: 'catalog', namespace: 'prod', type: 'ClusterIP', clusterIp: '10.96.12.41', ports: '8080/TCP', age: '210d', selector: 'app=catalog' },
    ],
  },
  files: { '/home/alibek/evidence.txt': { owner: 'alibek', content: '' } },
};

const lesson: LessonDef = {
  id: 'boss',
  kind: 'boss',
  title: 'Релиз checkout уронил оплату',
  minutes: 40,
  incident: { ticket: 'INC-7301: «5xx на оформлении заказа после релиза checkout 2.4.0»', severity: 'SEV1', customer: 'все покупатели' },
  commands: ['kubectl'],
  scenario,
  tasks: [
    {
      id: 'state',
      prompt: 'Оцени масштаб: выведи деплойменты namespace prod. Сколько подов `checkout` **готово** из желаемых? Введи в формате `X/Y`.',
      answer: { accept: ['0/3'], label: 'READY:' },
      hints: ['`kubectl get deploy -n prod` (namespace по умолчанию тут уже prod).'],
      solution: 'kubectl get deploy',
      tags: ['kubectl'],
    },
    {
      id: 'evidence',
      prompt: 'Сохрани доказательства **до отката**: запиши логи упавшего контейнера любого пода `checkout` (`--previous`) в файл `~/evidence.txt`.',
      check: { type: 'fileContains', path: '/home/alibek/evidence.txt', value: 'PAYMENT_GATEWAY_URL' },
      hints: ['Имя пода — из `kubectl get pods`.', '`kubectl logs <под> --previous > ~/evidence.txt`', 'Или сразу по деплойменту: `kubectl logs deploy/checkout --previous > ~/evidence.txt`.'],
      solution: 'kubectl logs deploy/checkout --previous > ~/evidence.txt',
      tags: ['kubectl'],
    },
    {
      id: 'cause',
      prompt: 'Что не так с новой версией? Введи **имя переменной окружения**, которую ждёт 2.4.0.',
      answer: { accept: ['PAYMENT_GATEWAY_URL'], label: 'Переменная:' },
      hints: ['`cat ~/evidence.txt`'],
      solution: 'cat ~/evidence.txt',
      tags: ['cat'],
    },
    {
      id: 'restore',
      prompt: 'Восстанови сервис **самым быстрым безопасным способом** — откатом на рабочую ревизию. Все поды `checkout` должны стать Running.',
      check: { type: 'custom', fn: (sh) => { const ps = sh.state.kube.pods.filter((p) => p.deployment === 'checkout'); return ps.length === 3 && ps.every((p) => p.status === 'Running'); } },
      hints: ['`kubectl rollout undo deployment/checkout`', 'Альтернатива — добавить переменную через `kubectl set env`, но откат на проверенную версию — надёжнее и быстрее.'],
      solution: 'kubectl rollout undo deployment/checkout',
      tags: ['kubectl'],
    },
    {
      id: 'verify',
      prompt: 'Убедись, что трафик снова идёт: у сервиса `checkout` должны появиться endpoints. Выведи их.',
      check: { type: 'all', checks: [{ type: 'outputContains', value: ['checkout', ':8080'] }, { type: 'outputNotContains', value: '<none>' }] },
      hints: ['`kubectl get endpoints checkout`'],
      solution: 'kubectl get endpoints checkout',
      tags: ['kubectl'],
    },
  ],
  quiz: [
    { id: 'q-rca', type: 'text', prompt: 'RCA одной фразой (ключевые слова: переменная окружения переименована/отсутствует и релиз/манифест).', answer: { accept: [], normalize: 'keywords', keywords: [['переменн', 'env', 'payment_gateway_url', 'payments_url'], ['релиз', 'release', '2.4', 'манифест', 'manifest', 'переименов', 'renamed']] }, explanation: 'В 2.4.0 переименовали `PAYMENTS_URL` → `PAYMENT_GATEWAY_URL`, а манифест деплоймента не обновили: новые поды падали на старте (CrashLoopBackOff), endpoints опустели, ingress отдавал 5xx.' },
    { id: 'q-why-not-delete', type: 'choice', prompt: 'Почему не помогло бы «удалить все поды checkout»?', options: ['Удалять поды запрещено', 'Деплоймент создал бы такие же поды той же версии 2.4.0 — и они упали бы так же', 'Удаление подов удаляет сервис'], correct: 1, explanation: 'Поды пересоздаются по шаблону деплоймента. Лечится сменой шаблона (undo/set env), а не удалением.' },
    { id: 'q-action', type: 'text', prompt: 'Action item, чтобы такое не повторилось (ключевые слова: проверка конфигурации/валидация env, canary/staging, readiness/smoke-тест в CI).', answer: { accept: [], normalize: 'keywords', keywords: [['валидац', 'провер', 'canary', 'канар', 'staging', 'стейдж', 'smoke', 'readiness', 'ci', 'тест', 'changelog', 'миграц']] }, explanation: 'Например: канареечный релиз с автооткатом по ошибкам, проверка обязательных env в CI, smoke-тест на staging с тем же манифестом.' },
  ],
  glossary: [
    { ru: 'Канареечный релиз', en: 'canary deployment', def: 'Новая версия сначала получает малую долю трафика.' },
    { ru: 'Доказательства', en: 'evidence', def: 'Логи и данные, сохранённые до восстановления — для RCA.' },
  ],
};
export default lesson;
