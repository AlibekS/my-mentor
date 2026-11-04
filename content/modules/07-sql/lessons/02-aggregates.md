# Агрегаты: COUNT, SUM, GROUP BY, HAVING

Вопросы инцидента почти всегда про числа: «сколько клиентов затронуто?», «на какую сумму?», «с какого момента выросло?». Отвечают агрегатные функции.

## Функции

```sql
SELECT COUNT(*) FROM orders;                         -- сколько строк
SELECT COUNT(DISTINCT customer_id) FROM orders;      -- сколько уникальных клиентов
SELECT SUM(total), AVG(total), MIN(total), MAX(total) FROM orders WHERE status = 'paid';
SELECT ROUND(SUM(total), 2) FROM orders;             -- округление
```

`COUNT(*)` считает строки, `COUNT(столбец)` — строки, где столбец **не NULL**.

## GROUP BY — посчитать по группам

```sql
SELECT status, COUNT(*) AS cnt
FROM orders
GROUP BY status
ORDER BY cnt DESC;
```

Это SQL-аналог `sort | uniq -c | sort -rn` из модуля «Логи». Правило: в `SELECT` — только столбцы из `GROUP BY` и агрегаты.

### По времени

```sql
SELECT date(created_at) AS day, COUNT(*) AS orders, ROUND(SUM(total), 2) AS revenue
FROM orders GROUP BY day ORDER BY day;

SELECT strftime('%H', created_at) AS hour, COUNT(*) FROM payments
WHERE date(created_at) = '2026-11-03' GROUP BY hour;
```

В PostgreSQL: `date_trunc('hour', created_at)`.

## HAVING — фильтр по группам

`WHERE` фильтрует строки **до** группировки, `HAVING` — группы **после**:

```sql
SELECT customer_id, COUNT(*) AS cnt
FROM orders
WHERE status <> 'cancelled'
GROUP BY customer_id
HAVING COUNT(*) >= 8;
```

## Как это выглядит на реальной работе L3

Алерт «рост отказов оплаты». Ты:
```sql
SELECT provider, status, COUNT(*) FROM payments
WHERE created_at >= '2026-11-03 14:00:00' GROUP BY provider, status;
```
Видно: отказы только у `stripe` — проблема у одного провайдера, а не в нашем коде. Сразу пишешь в эскалацию: «impact только stripe, kaspi работает».

## Типичные ошибки

- Столбец в SELECT без GROUP BY: в PostgreSQL — ошибка, в SQLite/MySQL — случайное значение.
- Фильтр по агрегату в WHERE (`WHERE COUNT(*) > 1`) — нужно HAVING.
- `AVG` по столбцу с NULL — NULL не участвуют, это может исказить картину.
