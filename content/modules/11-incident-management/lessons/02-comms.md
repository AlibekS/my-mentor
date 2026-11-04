# Коммуникация во время инцидента

Клиенты прощают сбои, но не прощают **молчание**. Хорошая коммуникация снижает поток тикетов в поддержку и сохраняет доверие.

## Стадии статус-страницы (Statuspage, Instatus и т.п.)

| Стадия | Что пишем |
|---|---|
| **Investigating** | видим проблему, разбираемся; что затронуто; когда следующий апдейт |
| **Identified** | причина найдена, работаем над исправлением; есть ли обход |
| **Monitoring** | исправление применено, наблюдаем |
| **Resolved** | всё работает; когда началось/закончилось; кратко причина; извинения |

## Формула апдейта

**Что затронуто → что делаем → что делать клиенту (если есть обход) → когда следующий апдейт.**

> **Investigating — 14:25 UTC**
> We are investigating elevated error rates affecting card payments at checkout. Some customers may be unable to complete orders. Retrying the payment may succeed. Next update by 14:55 UTC.

> **Identified — 14:40 UTC**
> We have identified the cause: a background job overloaded the payment database. We have stopped the job and payments are recovering. Next update by 15:10 UTC.

> **Resolved — 15:20 UTC**
> Between 14:04 and 14:41 UTC, some card payments failed due to a database capacity issue caused by a background job. The issue is resolved and all payments are processing normally. Affected orders were not charged. We apologize for the inconvenience.

## Правила

- **Время в UTC** и **время следующего апдейта** — всегда. Обещал апдейт в 14:55 — напиши в 14:55, даже если новостей нет («still investigating»).
- **Без внутренней кухни**: не «Hikari pool exhausted on payments-db-02», а «database capacity issue».
- **Без обвинений** (ни провайдера, ни коллег) и без непроверенных обещаний («fixed in 5 minutes»).
- Пиши **влияние глазами клиента**: «cannot complete orders», а не «5xx on /v1/charge».
- Внутренний канал — подробно и технично; внешний — коротко и понятно.

## Полезные фразы

*We are aware of… / We are actively investigating… / A fix has been implemented and we are monitoring the results. / We will provide an update within 30 minutes. / We apologize for the inconvenience caused.*

## Как это выглядит на реальной работе L3

Comms lead просит у тебя «что написать клиентам». Ты за минуту даёшь 2 фразы: что затронуто и есть ли обход, — без технических деталей. Остальное — в внутреннем канале.

## Типичные ошибки

- Пропущенный апдейт → клиенты решают, что вы забыли о проблеме.
- Технический жаргон во внешнем сообщении.
- «Resolved» без окна времени и без информации о последствиях (списали ли деньги).
