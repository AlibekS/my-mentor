import type { LessonDef } from '../../../../src/content/types';
import type { Scenario } from '../../../../src/shell/types';
import { obsBuilder } from '../../../shared/obs';
import { rng } from '../../../shared/logs';
import { Shell } from '../../../../src/shell/shell';

// ---- метрики 09:30–10:45
const START = 9 * 3600 + 30 * 60;
const BAD = 36; // 10:06
const FIX_HINT = 60;
const b = obsBuilder({ start: START, points: 76, seed: 77 });
const bad = (i: number) => i >= BAD && i < FIX_HINT;
for (const [service, base] of [['checkout', 30], ['catalog', 90], ['payments', 25]] as const) {
  const traffic = (i: number) => b.wave(i, base) * (i >= 30 ? 3 : 1); // распродажа x3 с 10:00
  const err = (i: number) => (service === 'checkout' && bad(i) ? 0.35 : 0.003);
  b.counter('http_requests_total', { service, code: '200' }, (i) => traffic(i) * (1 - err(i)));
  b.counter('http_requests_total', { service, code: service === 'checkout' ? '503' : '500' }, (i) => traffic(i) * err(i));
}
b.gauge('container_memory_working_set_bytes', { service: 'checkout' }, (i) => (i < 25 ? 300 : i < BAD ? 300 + (i - 25) * 64 : 900 + ((i - BAD) % 4) * 30) * 1024 * 1024);
b.gauge('kube_pod_container_status_restarts_total', { service: 'checkout' }, (i) => (i < BAD ? 0 : Math.floor((i - BAD) * 1.5)));
const obs = b.build({
  dashboard: {
    title: 'Black Friday — war room',
    panels: [
      { title: 'RPS по сервисам', query: 'sum by (service) (rate(http_requests_total[5m]))', unit: 'req/s' },
      { title: 'Доля 5xx по сервисам', query: 'sum by (service) (rate(http_requests_total{code=~"5.."}[5m])) / sum by (service) (rate(http_requests_total[5m]))', unit: '%', threshold: 0.05 },
      { title: 'Память checkout (рабочая)', query: 'container_memory_working_set_bytes{service="checkout"}', unit: 'bytes', threshold: 1024 * 1024 * 1024 },
    ],
  },
});

// ---- кластер
const oom = { status: 'CrashLoopBackOff', ready: '0/1', restarts: 9, lastReason: 'OOMKilled', exitCode: 137, logs: '', previousLogs: '10:05:51 INFO smart-cart: loading recommendations model into memory (1.4GB)\n10:05:58 INFO heap 980MB / limit 1024MB\n' };
const scenario: Scenario = {
  kube: {
    namespace: 'prod',
    deployments: [
      {
        name: 'checkout', namespace: 'prod', image: 'shop/checkout:3.0.0', replicas: 4, memoryLimit: '1Gi',
        history: [{ image: 'shop/checkout:2.9.4' }, { image: 'shop/checkout:3.0.0', cause: 'ci: release 3.0.0 smart-cart (pipeline #9120)' }],
        behaviors: [
          { image: 'shop/checkout:3.0.0', memoryLimitAtLeastMi: 2048, spec: { status: 'Running', logs: 'smart-cart enabled\n' } },
          { image: 'shop/checkout:3.0.0', spec: oom },
          { spec: { status: 'Running', logs: 'listening on :8080\n' } },
        ],
      },
      { name: 'catalog', namespace: 'prod', image: 'shop/catalog:5.0.2', replicas: 3, behaviors: [{ spec: { status: 'Running' } }] },
    ],
    services: [{ name: 'checkout', namespace: 'prod', type: 'ClusterIP', clusterIp: '10.96.12.40', ports: '8080/TCP', age: '300d', selector: 'app=checkout' }],
  },
  files: { '/home/alibek/evidence-bf.txt': { owner: 'alibek', content: '' } },
};

// ---- БД заказов
const r = rng(5);
const rows: string[] = [];
const custRows: string[] = [];
for (let c = 1; c <= 60; c++) custRows.push(`(${c},'customer${c}@mail.kz','${c % 11 === 0 ? 'enterprise' : 'retail'}')`);
let id = 70000;
for (let m = 0; m < 75; m++) {
  const sec = START + m * 60;
  const hh = String(Math.floor(sec / 3600)).padStart(2, '0');
  const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const n = m >= 30 ? 6 : 2;
  for (let k = 0; k < n; k++) {
    const isBad = m >= BAD && m < FIX_HINT && r() < 0.4;
    rows.push(`(${id++},${1 + Math.floor(r() * 60)},'${isBad ? 'pending_payment' : 'paid'}',${(15 + r() * 300).toFixed(2)},'2026-11-27 ${hh}:${mm}:${String(k * 9).padStart(2, '0')}')`);
  }
}
const dataset = `CREATE TABLE customers (id INTEGER PRIMARY KEY, email TEXT, segment TEXT);
CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER, status TEXT, total REAL, created_at TEXT);
INSERT INTO customers VALUES ${custRows.join(',')};
INSERT INTO orders VALUES ${rows.join(',')};`;

const firstPod = new Shell(scenario).state.kube.pods.find((p) => p.deployment === 'checkout')!.name;

const lesson: LessonDef = {
  id: 'boss',
  kind: 'boss',
  title: 'Чёрная пятница',
  minutes: 60,
  incident: { ticket: 'INC-9001: «Оформление заказа падает в начале распродажи»', severity: 'SEV1', customer: 'все покупатели, распродажа' },
  tools: ['obs', 'terminal', 'sql'],
  commands: ['kubectl'],
  scenario,
  obs,
  sql: { dataset },
  tasks: [
    {
      id: 'scope',
      prompt: '🔭 Масштаб: построй **долю 5xx по сервисам** (окно `[5m]`, доля 0–1). У кого ошибки?',
      tool: 'obs',
      obs: 'promql',
      hints: ['`sum by (service) (rate(http_requests_total{code=~"5.."}[5m])) / sum by (service) (rate(http_requests_total[5m]))`'],
      solution: 'sum by (service) (rate(http_requests_total{code=~"5.."}[5m])) / sum by (service) (rate(http_requests_total[5m]))',
    },
    {
      id: 'evidence',
      prompt: '⌨ Причина: посмотри поды `checkout` и сохрани логи **упавшего** контейнера в `~/evidence-bf.txt` до любых действий.',
      tool: 'terminal',
      check: { type: 'fileContains', path: '/home/alibek/evidence-bf.txt', value: 'smart-cart' },
      hints: ['`kubectl get pods`', '`kubectl logs deploy/checkout --previous > ~/evidence-bf.txt`'],
      solution: 'kubectl logs deploy/checkout --previous > ~/evidence-bf.txt',
    },
    {
      id: 'reason',
      prompt: 'Почему падают поды? Посмотри `describe` любого пода checkout и введи **Reason** последнего завершения.',
      tool: 'terminal',
      answer: { accept: [], normalize: 'keywords', keywords: [['oom']], label: 'Reason:' },
      hints: ['`kubectl describe pod <под checkout>` → Last State.'],
      solution: `kubectl describe pod ${firstPod}`,
      explanation: 'Новая «умная корзина» грузит модель рекомендаций 1,4 ГБ в память при лимите 1 ГиБ → OOMKilled. На распродаже нет времени на эксперименты с лимитами — откатываемся.',
    },
    {
      id: 'restore',
      prompt: 'Восстанови оформление заказа: откати `checkout` на предыдущую версию. Все 4 пода должны быть Running.',
      tool: 'terminal',
      check: { type: 'custom', fn: (sh) => { const ps = sh.state.kube.pods.filter((p) => p.deployment === 'checkout'); return ps.length === 4 && ps.every((p) => p.status === 'Running' && p.image === 'shop/checkout:2.9.4'); } },
      hints: ['`kubectl rollout undo deployment/checkout`'],
      solution: 'kubectl rollout undo deployment/checkout',
    },
    {
      id: 'orders',
      prompt: '🗄 Последствия: выведи `email` клиентов (без повторов), у которых заказы **зависли** в статусе `pending_payment` 27 ноября с 10:00 до 11:00 — им нужно отправить письмо с просьбой завершить оплату.',
      tool: 'sql',
      hints: ['JOIN orders → customers, фильтр по статусу и окну времени.', "`SELECT DISTINCT c.email FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.status = 'pending_payment' AND o.created_at >= '2026-11-27 10:00:00' AND o.created_at < '2026-11-27 11:00:00';`"],
      solution: "SELECT DISTINCT c.email FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.status = 'pending_payment' AND o.created_at >= '2026-11-27 10:00:00' AND o.created_at < '2026-11-27 11:00:00';",
    },
    {
      id: 'update',
      prompt: 'Напиши **Resolved**-сообщение на статус-страницу (EN): окно влияния (10:06–10:30 UTC), что было простыми словами, что всё работает, что делать покупателям с незавершёнными заказами (корзина сохранена — можно завершить оплату, деньги не списаны), извинение.',
      write: {
        lang: 'en',
        minWords: 40,
        rubric: [
          { label: 'resolved / working normally', any: ['resolved', 'working normally', 'back to normal', 'fully operational'] },
          { label: 'окно в UTC', any: ['\\d{1,2}:\\d{2}[^\\n]{0,20}\\d{1,2}:\\d{2}[^\\n]{0,8}UTC', 'between\\s+\\d{1,2}:\\d{2}'] },
          { label: 'причина простыми словами', any: ['due to', 'caused by', 'because\\b', '\\bcause\\b', '(after|following) (an?|the|our) (recent |latest |new )?(update|release|change)', 'introduced by', 'result of'] },
          { label: 'что делать покупателям (complete / cart saved)', any: ['complete (your|their|the)', 'cart[^.]{0,30}(saved|kept|preserved)', 'finish (your|the)', '(place|retry|try) (your|the) (order|payment|purchase)'] },
          { label: 'деньги не списаны', any: ["(not|n't|never)\\s+(been\\s+)?(charged|billed|debited)", 'no (payment|charge)', 'no (money|funds) (was|were|has been) (taken|charged|debited)'] },
          { label: 'извинение', any: ['apolog', 'sorry'] },
          { label: 'без внутренних деталей', none: ['\\boom', 'kubernetes', '\\bpods?\\b', 'rollback', 'smart-cart', 'memory limit', '503'] },
        ],
      },
      hints: ['Причина: «a recent update to our checkout» — без OOM, подов и лимитов.', 'Главное для покупателя: товары в корзине сохранены, деньги не списаны, можно завершить заказ.'],
      solution: 'Between 10:06 and 10:30 UTC, some customers were unable to complete checkout due to an issue introduced by a recent update. The issue is resolved and checkout is working normally. If your order was not completed, your cart has been saved and you were not charged — you can complete your order now. We apologize for the inconvenience during the sale.',
    },
  ],
  quiz: [
    { id: 'q-rca', type: 'text', prompt: 'RCA одной фразой (ключевые слова: релиз/умная корзина, память/OOM, лимит).', answer: { accept: [], normalize: 'keywords', keywords: [['релиз', 'release', 'smart', 'корзин', '3.0'], ['памят', 'memory', 'oom'], ['лимит', 'limit', '1gi', 'модел']] }, explanation: 'Релиз 3.0 загружал модель рекомендаций 1,4 ГБ в память при лимите контейнера 1 ГиБ → OOMKilled → CrashLoopBackOff → 503 на checkout в пик распродажи.' },
    { id: 'q-freeze', type: 'choice', prompt: 'Какой процессный action item здесь важнее всего?', options: ['Больше никогда не выпускать новые функции', 'Change freeze перед пиковыми событиями (кроме критичных фиксов) + нагрузочный тест и canary для релизов', 'Увеличить лимит памяти всем сервисам до 8 ГБ'], correct: 1, explanation: 'Заморозка изменений перед распродажей и проверка релизов под нагрузкой.' },
    { id: 'q-order', type: 'text', prompt: 'В каком порядке ты действовал? Назови 3 первых шага (ключевые слова: масштаб, доказательства/логи, откат).', answer: { accept: [], normalize: 'keywords', keywords: [['масштаб', 'scope', 'ошибк', 'метрик'], ['доказат', 'логи', 'evidence', 'previous'], ['откат', 'rollback', 'undo']] }, explanation: 'Масштаб по метрикам → сохранить доказательства → откатить. Последствия и коммуникация — сразу следом.' },
  ],
  glossary: [
    { ru: 'Заморозка изменений', en: 'change freeze', def: 'Запрет некритичных изменений перед важным событием.' },
    { ru: 'Штаб инцидента', en: 'war room', def: 'Общий канал/созвон, где координируют крупный инцидент.' },
  ],
};
export default lesson;
