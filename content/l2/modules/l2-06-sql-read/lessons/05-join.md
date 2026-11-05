# JOIN: заказы вместе с клиентами

В таблице `orders` нет email клиента — только `customer_id`. Почему так? Чтобы не хранить одно и то же много раз: email живёт в одном месте (`customers`), а заказ просто **ссылается** на клиента по номеру. Поменял клиент email — меняется одна строка, а не сто заказов.

```
orders                         customers
id   | customer_id | total     id | email
1057 | 5  ─────────────────▶   5  | emily.carter@outlook.com
1058 | 14 ─────────────────▶   14 | jonas.novak@seznam.cz
```

`orders.customer_id` — **внешний ключ** (foreign key): номер строки в другой таблице.

## Два запроса или один JOIN

Без JOIN ты делаешь два шага: нашёл id клиента по email → нашёл заказы по `customer_id`. Это нормально! Но JOIN («соединить») делает это одним запросом:

```sql
SELECT orders.id, customers.email, orders.status, orders.total
FROM orders
JOIN customers ON customers.id = orders.customer_id;
```

- `FROM orders JOIN customers` — берём две таблицы.
- `ON customers.id = orders.customer_id` — **правило склейки**: строка заказа соединяется со строкой клиента, у которого id равен customer_id заказа.
- `orders.id`, `customers.email` — имя столбца с именем таблицы. Нужно, потому что `id` есть в обеих таблицах, и база не поймёт, какой ты имел в виду.

## Короткие имена таблиц (псевдонимы)

Писать `orders.` и `customers.` долго — дают короткие имена (alias):

```sql
SELECT o.id, c.email, o.status, o.total
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE c.email = 'madina.seitkali@mail.kz';
```

`orders o` — «таблица orders, дальше я зову её `o`». Буквы можешь выбрать любые; результат не изменится.

После JOIN работают все знакомые части: `WHERE`, `ORDER BY`, `LIMIT`, `COUNT`, `GROUP BY`.

## Ещё один JOIN: платежи и заказы

Та же идея для платежей: `payments.order_id` ссылается на `orders.id`.

```sql
SELECT p.id, p.status AS payment_status, o.status AS order_status
FROM payments p
JOIN orders o ON o.id = p.order_id
WHERE o.id = 1041;
```

Так видно рядом статус **платежа** и статус **заказа** — это пригодится в боссе модуля.

## Частые ошибки

- Забыть `ON …` — получится «каждый с каждым»: огромный бессмысленный результат.
- Склеить не те столбцы: `ON c.id = o.id` (номер клиента = номер заказа) — синтаксически верно, но по смыслу ерунда. Склеиваем **ссылку** с **id**: `o.customer_id = c.id`.
- `ambiguous column name: id` — столбец есть в обеих таблицах, добавь префикс `o.` или `c.`.

## Как это выглядит в тикете

Тикет: *«Hi, my email is madina.seitkali@mail.kz, where are my orders?»* Один запрос с JOIN по email — и у тебя список заказов клиента со статусами. В ответе клиенту — номера и статусы заказов; в эскалации в L3 — **сам запрос и результат**, чтобы инженер мог повторить проверку.

## 🇬🇧 English corner

- *join tables* — соединить таблицы
- *Can you join orders with customers and send me the emails?* — Можешь соединить заказы с клиентами и прислать мне email-ы?
- *foreign key* — внешний ключ (ссылка на строку другой таблицы)
- *Here is the query I used.* — Вот запрос, который я использовал.
