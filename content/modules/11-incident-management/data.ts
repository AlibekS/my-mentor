import { rng } from '../../shared/logs';
import type { Scenario } from '../../../src/shell/types';

/** Сквозной инцидент модуля (время UTC): отчёт reconcile-report занял пул БД payments */
const r = rng(11);
const pad = (n: number) => String(n).padStart(2, '0');

const orders: string[] = [];
let failed = 0;
const failedCustomers = new Set<string>();
for (let m = 50; m < 120; m++) {
  const h = 13 + Math.floor(m / 60);
  const mm = m % 60;
  for (let k = 0; k < 4; k++) {
    const t = `2026-11-04T${pad(h)}:${pad(mm)}:${pad(k * 14 + 3)}Z`;
    const inWin = (h === 14 && mm >= 4 && mm < 41);
    const fail = inWin && r() < 0.42;
    const cust = `C${1000 + Math.floor(r() * 180)}`;
    if (fail) {
      failed++;
      failedCustomers.add(cust);
    }
    orders.push(`${t} order=${50000 + orders.length} customer=${cust} amount=${(10 + r() * 190).toFixed(2)} status=${fail ? 'failed reason=payment_timeout' : 'paid'}`);
  }
}

export const FAILED_ORDERS = failed;
export const FAILED_CUSTOMERS = failedCustomers.size;

export const TIMELINE = `# INC-8104 — хронология (UTC)
14:02 payments: стартовал reconcile-report (новый cron в релизе 3.7.0)
14:04 рост 5xx у payments, затем у checkout
14:07 алерт CheckoutHighErrorRate (PagerDuty)
14:12 дежурный L2 подтвердил алерт (acknowledged)
14:15 эскалация на L3 (alibek)
14:18 объявлен инцидент SEV2, IC — alibek, канал #inc-8104
14:25 статус-страница: Investigating
14:31 причина найдена: пул соединений БД payments 50/50, держит reconcile-report
14:36 reconcile-report остановлен (kill job), пул освобождается
14:41 доля ошибок вернулась к норме
14:45 статус-страница: Monitoring
15:20 инцидент закрыт (Resolved), статус-страница: Resolved
`;

export const scenario: Scenario = {
  files: {
    '/home/alibek/incident/timeline.md': { owner: 'alibek', content: TIMELINE },
    '/home/alibek/incident/orders.log': { owner: 'alibek', content: orders.join('\n') + '\n' },
    '/home/alibek/incident/alerts.log': {
      owner: 'alibek',
      content: `2026-11-04T14:07:00Z FIRING  CheckoutHighErrorRate severity=page service=checkout value=11.8% runbook=https://wiki/runbooks/checkout-5xx
2026-11-04T14:08:00Z FIRING  PaymentsHighErrorRate severity=page service=payments value=42.6%
2026-11-04T14:09:00Z FIRING  PaymentsDbPoolSaturated severity=ticket service=payments value=100%
2026-11-04T14:44:00Z RESOLVED CheckoutHighErrorRate
2026-11-04T14:45:00Z RESOLVED PaymentsHighErrorRate
`,
    },
    '/home/alibek/incident/severity.md': {
      owner: 'alibek',
      content: `# Матрица severity
SEV1 — полная недоступность ключевой функции для всех / утечка данных / потеря денег массово. Будим всех, апдейт каждые 30 мин.
SEV2 — ключевая функция деградировала для заметной части клиентов (ошибки > 10%) или недоступна для крупного клиента. IC обязателен, апдейт каждые 30 мин.
SEV3 — частичная деградация, есть обход, мало клиентов. Работа в рабочее время, апдейт раз в день.
SEV4 — косметика, вопрос, нет влияния на клиентов.
`,
    },
  },
};
