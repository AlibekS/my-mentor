# Эскалация в L3 на английском

Эскалация (escalation) — передача тикета на следующий уровень, когда L2 не может решить сам: ошибка в коде, нужны права на прод, проблема у многих клиентов. Плохая эскалация — *«Export doesn't work, please check»* — заставляет инженера L3 заново делать твою работу: спрашивать, искать клиента, искать логи. Хорошая — экономит ему час и ускоряет решение для клиента.

В иностранных компаниях эскалации пишут **на английском** — в Jira, Slack или в поле тикета. Хорошая новость: эскалация — это **не сочинение**, а заполненный шаблон с фактами.

## Шаблон эскалации

```
Summary:   CSV export fails with error 500 for all users of account Anna Schmidt (business)
Impact:    business customer, 25 users; all export requests fail since 08:13 UTC
Steps to reproduce:
  1. Log in as any user of the account
  2. Open Reports → click "Export CSV"
Expected:  CSV file is downloaded
Actual:    "Error 500"
Evidence:  api.log: 5 errors, first request_id req-394a0 at 08:13 UTC,
           error="column vat_id does not exist"; reports-service 4.2.0 deployed at 08:09 UTC
What I tried: customer tried Chrome and Edge — same error; other API endpoints work (200)
Priority:  high — customer needs reports for a meeting today at 15:00
```

| Поле (EN) | Перевод | Что писать |
|---|---|---|
| *Summary* | кратко | одна строка: **что** сломано и **у кого** |
| *Impact* | влияние | сколько клиентов/пользователей, с какого времени, насколько серьёзно |
| *Steps to reproduce* | шаги воспроизведения | нумерованный список |
| *Expected / Actual* | ожидалось / на самом деле | два коротких предложения |
| *Evidence* | доказательства | request_id, строки логов, время **в UTC**, номера заказов, запросы SQL |
| *What I tried* | что проверено | что уже сделано — чтобы L3 не повторял |
| *Priority* | приоритет | и **почему**: дедлайн клиента, деньги, много пользователей |

## Факты, а не догадки

- ✅ *The errors started at 08:13 UTC, 4 minutes after the deploy of reports-service 4.2.0.* — Ошибки начались в 08:13 UTC, через 4 минуты после деплоя.
- ❌ *I think the developers broke something in the release.* — Я думаю, разработчики что-то сломали.

Связь по времени с релизом — это **факт**, его стоит написать. А вывод «кто виноват» — нет. Эскалация, как и постмортем, **без поиска виноватых** (blameless).

## Полезные фразы

- *Since 08:13 UTC, all CSV exports fail with error 500.* — С 08:13 UTC все выгрузки CSV падают с ошибкой 500.
- *The issue affects all users of the account.* — Проблема затрагивает всех пользователей аккаунта.
- *I can reproduce it.* / *I could not reproduce it.* — Я могу / не смог воспроизвести.
- *Please see the logs below.* — Логи — ниже.
- *The customer has a deadline today at 15:00.* — У клиента дедлайн сегодня в 15:00.
- *I told the customer that we are investigating.* — Я сообщил клиенту, что мы разбираемся.

## Где взять доказательства

Тем же терминалом, что в модуле про логи:

```bash
grep export /var/log/app/api.log                 # все запросы экспорта
grep export /var/log/app/api.log | grep -c 500   # сколько ошибок
cat /var/log/app/deploy.log                      # что выкатывали и когда
```

**request_id** — уникальный номер запроса (здесь `req-…`). По нему L3 за секунды найдёт этот запрос во всех сервисах. Это самое ценное доказательство в эскалации.

## После эскалации

1. Ответь клиенту: *I passed your case to our engineering team. I will update you by 12:00 UTC.* — Я передал ваш случай инженерам. Напишу вам до 12:00 UTC.
2. Следи за тикетом и **сам** держи клиента в курсе — эскалация не значит «забыл».

## 🇬🇧 English corner

- *escalate to L3* — эскалировать в L3
- *impact* — влияние (сколько клиентов затронуто)
- *expected / actual* — ожидалось / на самом деле
- *evidence* — доказательства (логи, request_id, скриншоты)
- *I can reproduce it.* — Я могу это воспроизвести.
