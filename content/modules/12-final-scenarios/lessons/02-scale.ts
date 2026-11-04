import type { LessonDef } from '../../../../src/content/types';
import type { Scenario } from '../../../../src/shell/types';
import { obsBuilder } from '../../../shared/obs';

const START = 10 * 3600;
const SCALE = 18; // 10:18 — масштабирование
const b = obsBuilder({ start: START, points: 46, seed: 12 });
const replicas = (i: number) => (i < SCALE ? 6 : 12);
const conns = (i: number) => Math.min(200, replicas(i) * 18 + 8);
b.gauge('pg_connections', { db: 'shop' }, (i) => conns(i) + (b.r() - 0.5) * 2)
  .gauge('pg_max_connections', { db: 'shop' }, () => 200)
  .gauge('kube_deployment_replicas', { deployment: 'api' }, replicas)
  .counter('http_requests_total', { service: 'api', code: '200' }, (i) => b.wave(i, 120) * (i >= SCALE + 2 ? 0.82 : 0.997))
  .counter('http_requests_total', { service: 'api', code: '500' }, (i) => b.wave(i, 120) * (i >= SCALE + 2 ? 0.18 : 0.003));
const obs = b.build({
  dashboard: {
    title: 'API & PostgreSQL',
    panels: [
      { title: 'Реплики api', query: 'kube_deployment_replicas', unit: '' },
      { title: 'Соединения PostgreSQL', query: 'pg_connections', unit: '', threshold: 200 },
      { title: 'Доля 5xx api', query: 'sum(rate(http_requests_total{code=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))', unit: '%', threshold: 0.05 },
    ],
  },
});

const ok = { status: 'Running', logs: 'listening on :8080\nconnected to postgres (pool=20)\n' };
const scenario: Scenario = {
  kube: {
    namespace: 'prod',
    deployments: [
      {
        name: 'api', namespace: 'prod', image: 'shop/api:4.2.0', replicas: 12, env: { DB_POOL_SIZE: '20' },
        history: [{ image: 'shop/api:4.2.0' }],
        behaviors: [{ spec: ok }],
      },
    ],
  },
};
// 6 «старых» подов работают, 6 новых получают отказ от БД
const KUBE = scenario.kube!;
KUBE.pods = [];
for (let k = 0; k < 12; k++) {
  KUBE.pods.push({
    name: `api-7c9d5f8b6d-${['a1b2c', 'd3e4f', 'g5h6j', 'k7l8m', 'n9p0q', 'r1s2t', 'u3v4w', 'x5y6z', 'b7c8d', 'f9g0h', 'j1k2l', 'm3n4p'][k]}`,
    namespace: 'prod', deployment: 'api', image: 'shop/api:4.2.0', node: `worker-${(k % 3) + 1}`, ip: `10.244.${(k % 3) + 1}.${20 + k}`,
    age: k < 6 ? '5d' : '12m',
    status: 'Running', ready: k < 6 ? '1/1' : '0/1', restarts: k < 6 ? 0 : 4,
    logs: k < 6 ? ok.logs : 'listening on :8080\nERROR db pool: FATAL: sorry, too many clients already\nreadiness probe: database unavailable\n',
  });
}

const brokenPod = KUBE.pods.find((p) => p.ready === '0/1')!.name;

const lesson: LessonDef = {
  id: 'scale',
  title: 'Сценарий: масштабировали — стало хуже',
  minutes: 35,
  tools: ['obs', 'terminal'],
  commands: ['kubectl'],
  scenario,
  obs,
  tasks: [
    {
      id: 'saturation',
      prompt: 'Вкладка **Наблюдаемость**. Построй **долю занятых соединений PostgreSQL**: `pg_connections / pg_max_connections`.',
      tool: 'obs',
      obs: 'promql',
      hints: ['Деление двух метрик с одинаковой меткой `db` сопоставит их автоматически.'],
      solution: 'pg_connections / pg_max_connections',
    },
    {
      id: 'when',
      prompt: 'Во сколько число реплик выросло до 12? Посмотри панель «Реплики api» на дашборде и введи `ЧЧ:ММ`.',
      tool: 'obs',
      answer: { accept: [], normalize: 'keywords', keywords: [['10:17', '10:18', '10:19']], label: 'Время UTC:', placeholder: 'ЧЧ:ММ' },
      hints: ['Наведи курсор на ступеньку графика.'],
      solution: 'Дашборд → «Реплики api» → 10:18',
    },
    {
      id: 'logs',
      prompt: 'Вкладка **Терминал**. Найди под `api`, который **не Ready** (`0/1`), и посмотри его логи. Введи текст ошибки PostgreSQL (после `FATAL:`).',
      tool: 'terminal',
      answer: { accept: [], normalize: 'keywords', keywords: [['too many clients', 'too many connections']], label: 'Ошибка:' },
      hints: ['`kubectl get pods`', '`kubectl logs <под с 0/1>`'],
      solution: `kubectl get pods\nkubectl logs ${brokenPod}`,
    },
    {
      id: 'math',
      prompt: '`max_connections = 200`, пул каждого пода — 20 (`DB_POOL_SIZE`), 20 соединений держим в резерве для админов и мониторинга. Сколько реплик `api` **максимум** можно запустить? Введи число.',
      tool: 'terminal',
      answer: { accept: ['9'], normalize: 'number', label: 'Реплик:' },
      hints: ['(max_connections − резерв) / пул на под.', '(200 − 20) / 20.'],
      solution: 'kubectl describe deploy api\n# (200 − 20) / 20 = 9',
    },
    {
      id: 'fix',
      prompt: 'Митигация: уменьши число реплик `api` до безопасного значения из прошлого задания.',
      tool: 'terminal',
      check: { type: 'custom', fn: (sh) => sh.state.kube.deployments?.find((d) => d.name === 'api')?.replicas === 9 && sh.state.kube.pods.filter((p) => p.deployment === 'api').length === 9 },
      hints: ['`kubectl scale deployment/api --replicas=9`'],
      solution: 'kubectl scale deployment/api --replicas=9',
      explanation: 'Долгосрочно: PgBouncer перед PostgreSQL или меньший пул на под + `maxReplicas` в HPA, рассчитанный по этой формуле.',
    },
  ],
  quiz: [
    { id: 'q-formula', type: 'text', prompt: 'Запиши условие для пулов соединений: реплики × … ≤ … − резерв (ключевые слова: пул и max_connections).', answer: { accept: [], normalize: 'keywords', keywords: [['пул', 'pool'], ['max_connections', 'max connections', 'max_conn', 'макс', 'лимит']] }, explanation: '`replicas × pool_size ≤ max_connections − reserve`.' },
    { id: 'q-pgbouncer', type: 'text', prompt: 'Как называется популярный пулер соединений для PostgreSQL? (одно слово)', answer: { accept: [], normalize: 'keywords', keywords: [['pgbouncer', 'pg bouncer', 'pgpool', 'pgcat', 'odyssey']] }, explanation: 'PgBouncer мультиплексирует много клиентских соединений в небольшое число серверных.' },
    { id: 'q-shared', type: 'choice', prompt: 'Главный урок сценария?', options: ['Масштабировать нельзя никогда', 'Горизонтальное масштабирование упирается в общие ресурсы (БД, лимиты API) — их нужно учитывать', 'Kubernetes работает плохо'], correct: 1, explanation: 'Больше копий = больше нагрузки на общие зависимости.' },
    { id: 'q-promql', type: 'promql', prompt: 'Построй долю 5xx сервиса api (один ряд, окно `[5m]`).', solution: 'sum(rate(http_requests_total{code=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))', explanation: 'Числитель — 5xx, знаменатель — все запросы.' },
  ],
  glossary: [
    { ru: 'Горизонтальное масштабирование', en: 'horizontal scaling', def: 'Увеличение числа копий сервиса.' },
    { ru: 'Пулер соединений', en: 'connection pooler', def: 'Прокси, переиспользующий соединения к БД (PgBouncer).' },
    { ru: 'Автомасштабирование подов', en: 'HPA, Horizontal Pod Autoscaler', def: 'Автоматическое изменение числа реплик по метрикам.' },
  ],
};
export default lesson;
