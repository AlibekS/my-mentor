# Обоснование программы и источники

_Сверено: 4 ноября 2026. Следующая сверка — не позже февраля 2027 (`/refresh-curriculum` в Claude Code)._

## Метод

Поиск вакансий и материалов по запросам «L3 support engineer», «production support engineer», «technical escalations engineer», «application support L3», «SaaS technical support engineer» с приоритетом публикаций за последние 6 месяцев (май–ноябрь 2026). Плюс материалы о трендах навыков (Kubernetes, observability, VMware). Выборка — отдельные вакансии и обзоры, а не статистическое исследование: это ориентир, а не бенчмарк.

## Что показал поиск

1. **Kubernetes, SQL, мониторинг/наблюдаемость** — повторяются в большинстве L3-вакансий (AKS/OpenShift, MS SQL/PostgreSQL, Datadog, Prometheus, Grafana, OpenTelemetry; CKA/CKAD — как плюс).
2. **Инциденты, проблемы, RCA, triage логов, ITIL, on-call** — обязательная часть роли; в production support — P1/P2 в рамках SLA, bridge-звонки, ServiceNow.
3. **SaaS-поддержка**: REST/HTTP/JSON, разбор API (Postman/cURL), OAuth и webhooks, Jira/Zendesk, практический SQL, «технически полные» эскалации в разработку.
4. **Скриптинг** Python/Bash/PowerShell для автоматизации — стандартное требование.
5. **AI/AIOps** — растущий сигнал: автоматизация триажа и remediation, инфраструктура для AI-сервисов.
6. **VMware**: после изменений лицензирования Broadcom большинство клиентов сокращают VMware-инфраструктуру (опрос CloudBolt, февраль 2026: 86% сокращают footprint), миграции идут постепенно. Прямых данных по вакансиям мало — вывод: для SaaS-ориентированного L3 это не приоритетный навык.

## Как это повлияло на карту модулей

- Модуль 6 расширен до **«Сеть и API для L3»**: добавлены REST, JSON, jq, токены — по вакансиям SaaS-поддержки.
- **SQL** (модуль 7), **Kubernetes** (модуль 9), **наблюдаемость** (модуль 10) и **управление инцидентами** (модуль 11) получили высокий вес (importance = 5) — они влияют на порядок в персональной программе и на общий процент готовности.
- VMware и ручное администрирование не включены; в разделе «Рынок» отмечены как падающие.
- В модулях 10–11 запланирована тема о работе с AI-ассистентами: как проверять их выводы по логам и данным.

## Источники

Вакансии и обзоры (2026):
- [L3 Support Engineer — iHireTechnology](https://www.ihiretechnology.com/jobs/view/523861527)
- [L3 Application Support Engineer — Insight Global](https://insightglobal.com/jobs/find_a_job/florida/tampa/l3-application-support-engineer/job-542654/)
- [L3 Azure Kubernetes Support Engineer — Insight Global](https://jobs.insightglobal.com/find_a_job/florida/job-414978)
- [L3 Support Engineer — CShark (justjoin.it)](https://justjoin.it/job-offer/cshark-l3-support-engineer-poznan-support)
- [Application Support Engineer L3 (Telco) — Software Mind](https://careers.softwaremind.com/?p=6051)
- [Site Reliability Engineer / L3 Support — Teal](https://www.tealhq.com/job/site-reliability-engineer-l3-support_7ea1acba2123ca40b347d15612fcbb36b988e)
- [Support Lead – Kubernetes — HCLTech](https://careers.hcltech.com/job/Support-Lead-Kubernetes/114146-en_US)
- [Production Support Engineer — Cognizant](https://careers.cognizant.com/emea-de/arbeitsplaetze/00068958112/production-support-engineer/)
- [Production Support Engineer — iHireTechnology](https://www.ihiretechnology.com/jobs/view/522855353)
- [Senior Production Support Engineer — Virtual Vocations](https://www.virtualvocations.com/job/senior-production-support-engineer-2865109-i.html)
- [Application Support Engineer (SaaS) — hirist.tech](https://www.hirist.tech/j/application-support-engineer-saas-1674805)
- [Senior Technical Support Engineer L2/L3 — InfoBeans](https://infobeans.ai/careers/Senior-AIL-2026-07-2058)
- [Technical Escalations Engineer 2 (SaaS Integration) — Built In](https://builtin.com/job/technical-escalations-engineer-2-saas-integration-emea/8199794)
- [Principal Support Engineer — Cisco](https://talentbridge.cisco.com/job/principal-support-engineer-54083)
- [Technical Support Engineer 3 — Datadog (Built In Vancouver)](https://builtinvancouver.org/job/technical-support-engineer-3-brazil/4506849)

Тренды навыков:
- [Top 10 Key DevOps Skills Employers Look For in 2026 — Invensis Learning](https://www.invensislearning.com/info/top-devops-skills)
- [The 25 Fastest-Growing Skills in 2026 Job Postings — SeekerScore](https://www.seekerscore.com/insights/fastest-growing-skills-2026)
- [Top Tech Skills for 2026 — NerdLevelTech](https://nerdleveltech.com/top-tech-skills-2026-ai-devops-cloud-careers)
- [VMware Infrastructure Job Trends — IT Jobs Watch](https://www.itjobswatch.co.uk/jobs/uk/vmware%20infrastructure.do)
- [Will Broadcom's VMware strategy keep paying big dividends? — Network World](https://www.networkworld.com/article/4180754/will-broadcoms-vmware-strategy-keep-paying-big-dividends.html)
- [Enterprises Rethink Virtualization Roadmaps as VMware Pricing Fears Persist — Petri](https://petri.com/vmware-pricing-fears-enterprise-virtualization-shift/)

> Часть источников — агрегаторы вакансий и блоги; цифры из них стоит воспринимать как индикативные.
