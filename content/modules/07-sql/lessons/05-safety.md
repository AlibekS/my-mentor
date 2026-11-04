# Безопасность: SQL на проде

Самый дорогой SQL-запрос в карьере L3 — это `UPDATE` без `WHERE`. Этот урок про то, как не стать героем постмортема.

## Правила работы с прод-БД

1. **По умолчанию — только чтение.** Работай на read replica или под пользователем с правами только на SELECT.
2. **LIMIT и узкие условия** на больших таблицах. Тяжёлый запрос на primary может положить прод не хуже бага.
3. **Изменения данных — через процесс изменений (change)**: тикет, согласование, скрипт, ревью коллеги, план отката.
4. **Сначала SELECT — потом UPDATE.** Тот же WHERE, посмотреть строки и посчитать их.
5. **Транзакция**: `BEGIN` → изменение → проверка → `COMMIT` или `ROLLBACK`.
6. **Бэкап/снимок затронутых строк** до изменения.

## SELECT перед UPDATE

```sql
-- 1. Что затронем?
SELECT id, status FROM orders WHERE status = 'pending' AND id IN (1213, 1215);
-- 2. Сколько? Должно совпасть с ожиданием из тикета
SELECT COUNT(*) FROM orders WHERE status = 'pending' AND id IN (1213, 1215);
-- 3. Только теперь
UPDATE orders SET status = 'paid' WHERE status = 'pending' AND id IN (1213, 1215);
```

## Транзакции

```sql
BEGIN;
UPDATE orders SET status = 'paid' WHERE id = 1213;
SELECT id, status FROM orders WHERE id = 1213;   -- проверили
ROLLBACK;                                        -- или COMMIT, если всё верно
```

В SQLite и PostgreSQL транзакцию открывает `BEGIN;` (в MySQL можно и `START TRANSACTION;` — в SQLite такой команды нет). Пока нет `COMMIT`, изменения видны только тебе. В PostgreSQL удобен приём: `BEGIN; UPDATE ...;` → смотрим «`UPDATE 3`» → если ждали 3 — `COMMIT`, иначе `ROLLBACK`.

> Длинная открытая транзакция держит блокировки — не уходи на обед посреди `BEGIN`.

## Индексы и EXPLAIN

Индекс — как оглавление: БД находит строки без полного перебора таблицы.

```sql
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 7;
-- SEARCH orders USING INDEX idx_orders_customer (customer_id=?)   ← хорошо
EXPLAIN QUERY PLAN SELECT * FROM orders WHERE status = 'pending';
-- SCAN orders                                                     ← полный перебор
```

В PostgreSQL: `EXPLAIN ANALYZE` (осторожно: он **выполняет** запрос) — ищи `Seq Scan` по большим таблицам. Медленный отчёт часто = нет индекса на столбце фильтра. L3 не обязательно создаёт индекс сам, но приносит разработке план запроса как доказательство.

## Персональные данные

Не выгружай email/телефоны/карты в тикеты и чаты. Для расследования хватает `id`; в эскалации — маскируй (`ai***@mail.kz`).

## Типичные ошибки

- `UPDATE … ` / `DELETE …` без `WHERE` (или с WHERE, который выделил не то).
- Тяжёлый аналитический запрос на primary в часы пик.
- `EXPLAIN ANALYZE` для `DELETE` на проде — он реально удалит.
