# JOIN: связать таблицы

Данные разложены по таблицам: клиент — в `customers`, его заказы — в `orders`, оплаты — в `payments`. Чтобы ответить «у кого из enterprise-клиентов не прошёл платёж», таблицы нужно **соединить**.

## INNER JOIN — только совпадающие пары

```sql
SELECT o.id, c.email, o.status, o.total
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE c.plan = 'enterprise';
```

- `orders o` — короткий псевдоним (alias).
- `ON` — условие связи: внешний ключ `orders.customer_id` → `customers.id`.
- Строки без пары **выпадают**.

## LEFT JOIN — все слева, даже без пары

```sql
SELECT c.id, c.email, COUNT(o.id) AS orders
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id;
```

Клиенты без заказов останутся с `orders = 0` (у них `o.id` будет NULL).

### Поиск «сирот» — главный приём расследований

```sql
-- клиенты без заказов
SELECT c.id, c.email FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL;

-- платежи на несуществующие заказы (нарушена целостность)
SELECT p.* FROM payments p
LEFT JOIN orders o ON o.id = p.order_id
WHERE o.id IS NULL;
```

Альтернатива: `WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)`.

## Несколько JOIN

```sql
SELECT c.email, o.id, p.provider, p.status, p.amount
FROM payments p
JOIN orders o ON o.id = p.order_id
JOIN customers c ON c.id = o.customer_id
WHERE c.email = 'aigerim.s@mail.kz';
```

## Как это выглядит на реальной работе L3

«Клиенту приходят чеки на заказы, которых он не делал». Ты джойнишь `payments → orders → customers` и видишь платежи с `order_id`, которого нет в `orders`. Это не мошенничество, а баг: заказ удалялся при откате транзакции, а платёж — нет. В эскалации — запрос и список id.

## Типичные ошибки

- Забыть `ON` или указать не те ключи → декартово произведение (каждая строка с каждой), миллионы строк.
- Фильтр по правой таблице в `WHERE` после LEFT JOIN (`WHERE o.status = 'paid'`) превращает его в INNER. Условие для правой таблицы — в `ON`.
- `COUNT(*)` вместо `COUNT(o.id)` при LEFT JOIN: клиент без заказов получит 1, а не 0.
