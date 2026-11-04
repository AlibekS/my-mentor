# Кейс-интервью L3

На собеседовании в международную компанию L3 обычно проходит: скрининг с рекрутером → техническое интервью (Linux, сеть, SQL, логи) → **кейс/сценарий** («сайт тормозит, что делаешь?») → поведенческое интервью (**STAR**) → иногда практическое задание (разобрать логи, написать запрос или RCA).

## Сценарный вопрос: как отвечать

Интервьюер оценивает структуру мысли. Проговаривай метод:

1. **Clarify** — «All users or some? Since when? Any recent deploys? Which region?»
2. **Scope with data** — дашборды: error rate, latency p95/p99, traffic; один сервис или все.
3. **Recent changes** — deploys, config, infrastructure, traffic spikes.
4. **Narrow down** — от края к центру: DNS/CDN → load balancer → app (logs, traces) → database (slow queries, connections) → external dependencies.
5. **Mitigate** — rollback, scale, disable feature flag, failover.
6. **Communicate** — incident channel, status page, updates on schedule; escalate with data.
7. **Prevent** — postmortem, action items, alerts, runbook.

## Поведенческие вопросы: STAR

**S**ituation — контекст; **T**ask — твоя задача; **A**ction — что сделал **ты** (не «мы»), конкретно; **R**esult — результат **с цифрами** (MTTR, сэкономленные часы, снижение тикетов) и что изменили после.

> Пример: «Tell me about a difficult incident» → ситуация с цифрами влияния, твоя роль, шаги диагностики, митигация, результат, action items.

## Объяснить сложное просто

Частый вопрос: «Explain 502 vs 504 to a non-technical customer». Говори через аналогию и влияние, без жаргона: *«Our front door (gateway) asked the system behind it for your page. 502 — the system answered with something broken; 504 — it didn't answer in time.»*

## Полезные фразы

*Let me first clarify… / My first hypothesis would be… / To narrow it down I'd check… / As a quick mitigation I'd… / Meanwhile I'd keep stakeholders updated… / To prevent recurrence…*

## Твой опыт сисадмина — козырь

CCNA, Linux, инфраструктура — это база, которой не хватает многим кандидатам из L2. Привязывай ответы к своему опыту: «In my sysadmin role I…».
