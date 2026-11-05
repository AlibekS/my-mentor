# ORDER BY и LIMIT: свежие сверху

Клиент пишет: «мой **последний** заказ не пришёл». У него может быть десять заказов — нужен самый новый. Для этого строки надо **отсортировать** и взять первую.

## ORDER BY — сортировка

```sql
SELECT id, status, created_at
FROM orders
WHERE customer_id = 14
ORDER BY created_at DESC;
```

- `ORDER BY столбец` — отсортировать по этому столбцу.
- `ASC` (ascending, по возрастанию) — от меньшего к большему, от старого к новому. Это вариант **по умолчанию**, слово можно не писать.
- `DESC` (descending, по убыванию) — от большего к меньшему, **новые сверху**.

Для текста — по алфавиту, для чисел — по величине, для нашего времени `'2026-11-05 10:32:49'` — по времени (такой формат сортируется правильно).

> Без `ORDER BY` база **не обещает** никакого порядка. Сегодня строки пришли «по порядку», завтра — нет. Нужен порядок — пиши ORDER BY.

## LIMIT — сколько строк взять

`LIMIT` ты уже знаешь из первого урока. Вместе с ORDER BY он отвечает на самые частые вопросы поддержки:

```sql
-- последний заказ клиента
SELECT id, status, total FROM orders WHERE customer_id = 14
ORDER BY created_at DESC LIMIT 1;

-- 5 самых свежих тикетов
SELECT id, subject, created_at FROM support_tickets
ORDER BY created_at DESC LIMIT 5;

-- самый старый открытый тикет (кого клиент ждёт дольше всех)
SELECT id, subject FROM support_tickets WHERE status = 'open'
ORDER BY created_at LIMIT 1;
```

## Полный порядок частей запроса

```
SELECT … FROM … WHERE … ORDER BY … LIMIT …
```

Части можно пропускать, но **нельзя переставлять**: `LIMIT` всегда в конце, `ORDER BY` — после `WHERE`.

## Хронология — лучший друг L2

Отсортировать события по времени — значит восстановить историю. Например, платежи заказа по возрастанию времени:

```sql
SELECT id, status, error_code, created_at FROM payments
WHERE order_id = 1064 ORDER BY created_at;
```

Видно: сначала платёж `failed` с ошибкой `card_declined`, через три минуты — `succeeded`. Клиент пишет «карту отклонили, но заказ оплачен?» — и это правда: первая попытка не прошла, вторая прошла, деньги списаны **один раз**.

## Как это выглядит в тикете

В ответе клиенту или в заметке для коллег опирайся на факты из запроса, со временем и часовым поясом:

> Order 1064: first payment attempt failed at 13:41 UTC (card_declined), second attempt succeeded at 13:44 UTC. Charged once.

## 🇬🇧 English corner

- *latest / most recent* — последний, самый свежий
- *oldest* — самый старый
- *sort by date, newest first* — отсортировать по дате, новые сверху
- *The first attempt failed, the second one succeeded.* — Первая попытка не прошла, вторая прошла.
