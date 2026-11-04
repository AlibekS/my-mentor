# SELECT: достать нужные строки

На проде у L3 обычно есть **доступ на чтение** к реплике базы (read replica). Гипотезы «у клиента пропал заказ», «платёж завис» проверяются запросами. В тренажёре — SQLite, но синтаксис базовых запросов одинаков в PostgreSQL, MySQL и MS SQL.

## Наша база

Магазин-SaaS: `customers`, `orders`, `order_items`, `products`, `payments`, `support_tickets`. Схема — под консолью справа (раскрывается), клик по таблице вставит `SELECT * … LIMIT 10`.

## Базовый запрос

```sql
SELECT id, email, plan       -- какие столбцы
FROM customers               -- из какой таблицы
WHERE country = 'KZ'         -- какие строки
ORDER BY created_at DESC     -- в каком порядке
LIMIT 10;                    -- сколько
```

Порядок частей фиксирован: `SELECT → FROM → WHERE → ORDER BY → LIMIT`.

> **Всегда начинай с `LIMIT`** на незнакомой таблице. `SELECT *` по таблице на 200 млн строк на проде — это нагрузка на БД и, возможно, твой первый инцидент.

## WHERE: условия

```sql
WHERE status = 'pending'                     -- равно (строки — в одинарных кавычках)
WHERE status <> 'cancelled'                  -- не равно (или !=)
WHERE total >= 100 AND status = 'paid'       -- И
WHERE status = 'refunded' OR status = 'cancelled'
WHERE status IN ('refunded', 'cancelled')    -- то же короче
WHERE total BETWEEN 50 AND 100               -- включительно
WHERE email LIKE '%@mail.kz'                 -- шаблон: % — любые символы, _ — один
WHERE country IS NULL                        -- «пусто»: только IS NULL, не = NULL!
```

## Даты

В нашей БД время хранится текстом `'2026-11-03 14:05:00'` (ISO-формат сортируется как строка):

```sql
WHERE created_at >= '2026-11-03 14:00:00' AND created_at < '2026-11-03 15:00:00'
WHERE date(created_at) = '2026-11-04'
```

В PostgreSQL то же: `created_at >= now() - interval '1 hour'`; в SQLite — `datetime('now', '-1 hour')`.

## Как это выглядит на реальной работе L3

Тикет: «клиент aigerim.s@mail.kz не видит свой последний заказ». Ты:
```sql
SELECT id FROM customers WHERE email = 'aigerim.s@mail.kz';
SELECT id, status, total, created_at FROM orders WHERE customer_id = 7 ORDER BY created_at DESC LIMIT 5;
```
Если заказ на месте, но, например, в статусе `pending` — проблема не в «пропал», а в «завис». Следующий шаг — платежи по этому заказу.

## Типичные ошибки

- `= NULL` вместо `IS NULL` — всегда вернёт пусто.
- Двойные кавычки для строк: в PostgreSQL `"text"` — это имя столбца. Строки — `'одинарные'`.
- Забыть `ORDER BY` и думать, что строки придут «по порядку» — порядок без ORDER BY не гарантирован.
