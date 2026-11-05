# WHERE: найти нужные строки

`SELECT * FROM customers` показывает всех клиентов. Но в тикете тебе нужен **один** клиент — тот, кто написал. Для этого есть `WHERE` («где»): условие, которому должны соответствовать строки.

```sql
SELECT id, name, plan
FROM customers
WHERE email = 'lukas.muller@gmx.de';
```

«Выбери id, name, plan из customers, **где** email равен lukas.muller@gmx.de». База проверяет условие для каждой строки и возвращает только подходящие.

Порядок частей запроса: `SELECT … FROM … WHERE …`.

## Текст — в одинарных кавычках

- Текст (email, статус, страна) — в **одинарных** кавычках: `'paid'`, `'KZ'`.
- Числа — без кавычек: `id = 1041`, `total > 50`.
- Регистр в значениях важен: `'paid'` и `'PAID'` — разные строки. Пиши так, как в таблице.

## Операторы сравнения

| Оператор | Значение | Пример |
|---|---|---|
| `=` | равно | `status = 'unpaid'` |
| `<>` (или `!=`) | не равно | `status <> 'cancelled'` |
| `>` / `<` | больше / меньше | `total > 100` |
| `>=` / `<=` | больше или равно / меньше или равно | `created_at >= '2026-11-05'` |

## LIKE — поиск по шаблону

Когда знаешь только часть значения:

```sql
WHERE email LIKE '%@mail.kz'      -- почта заканчивается на @mail.kz
WHERE subject LIKE '%refund%'     -- в теме тикета есть слово refund
WHERE created_at LIKE '2026-11-05%'  -- всё за 5 ноября
```

`%` — «любые символы, сколько угодно (в том числе ноль)». В SQLite `LIKE` не различает большие и маленькие латинские буквы.

## AND и OR — несколько условий

```sql
WHERE status = 'unpaid' AND total > 50        -- оба условия сразу
WHERE status = 'cancelled' OR status = 'refunded'   -- хотя бы одно
```

- `AND` — «и»: строка должна подходить под **все** условия.
- `OR` — «или»: достаточно **одного**.
- Смешиваешь AND и OR — ставь скобки: `WHERE customer_id = 6 AND (status = 'unpaid' OR status = 'cancelled')`.

## IS NULL — «пусто»

`NULL` — особое значение «нет данных». Например, у тикета ещё нет исполнителя: `assignee` = NULL. Или у успешного платежа нет кода ошибки: `error_code` = NULL.

```sql
WHERE assignee IS NULL        -- исполнитель не назначен
WHERE error_code IS NOT NULL  -- код ошибки есть
```

> ⚠️ `assignee = NULL` **не работает** — всегда вернёт пустой результат. Для NULL — только `IS NULL` / `IS NOT NULL`.

## Даты и время

В нашей базе время хранится текстом `'2026-11-05 10:32:49'` (год-месяц-день часы:минуты:секунды, UTC). Такой текст правильно сравнивается:

```sql
WHERE created_at >= '2026-11-05'                     -- с 5 ноября
WHERE created_at LIKE '2026-11-05%'                  -- ровно 5 ноября
WHERE created_at >= '2026-11-05 10:00' AND created_at < '2026-11-05 12:00'  -- с 10:00 до 12:00
```

## Как это выглядит в тикете

Тикет №7: *«Payment failed, why?»* (почему не прошёл платёж). Шаги L2:

1. Найти клиента по email: `SELECT id FROM customers WHERE email = '…';`
2. Его заказы: `SELECT id, status, total FROM orders WHERE customer_id = …;`
3. Платежи заказа: `SELECT status, error_code FROM payments WHERE order_id = …;`

Если `error_code = 'insufficient_funds'` (недостаточно средств) — это не баг магазина: клиенту можно ответить, что банк отклонил платёж, и предложить другую карту. Эскалация не нужна.

## 🇬🇧 English corner

- *Could you tell me the email on your account?* — Подскажите email вашего аккаунта?
- *What is your order number?* — Какой номер вашего заказа?
- *The payment was declined by your bank.* — Платёж отклонил ваш банк.
- *insufficient funds* — недостаточно средств; *expired card* — карта просрочена
