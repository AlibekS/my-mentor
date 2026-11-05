# 👹 Босс модуля: «Checkout button does nothing»

**Четверг, 12:50 по Астане (07:50 UTC).** В очередь L2 пришёл тикет с высоким приоритетом от продавца из Германии:

> **Subject:** Checkout button does nothing
>
> Hi team,
>
> since this morning our customers can't pay in our shop **brewandleaf.shopflow.store**. They click "Place order" on the checkout page and nothing happens — no error, no redirect. I tried it myself in Chrome 130 on Windows, same result. I attached a HAR file.
>
> Please help, we are losing orders!
>
> Lena Schmidt, Brew & Leaf GmbH

Перевод ключевых слов: *can't pay* — не могут оплатить, *nothing happens* — ничего не происходит, *redirect* — переход на другую страницу, *losing orders* — теряем заказы.

Справа — HAR-файл Лены, открытый в тренажёре DevTools: вкладки Network, Console и Application.

## План расследования

1. **Отделить шум от сигнала.** Сколько запросов с ошибками? Какие из них объясняют жалобу, а какие — нет (иконка, блокировщик)?
2. **Найти запрос кнопки.** Что отправляется при нажатии *Place order*? Какой статус и что в ответе?
3. **Собрать данные для L3:** эндпоинт, статус, `request_id`, время (UTC) — из заголовка ответа `date`.
4. **Понять, почему «ничего не происходит».** Что в Console после упавшего запроса?
5. **Написать эскалацию** в L3 — коротко, по фактам, без «у клиента что-то сломалось».

## Подсказки

- `502 Bad Gateway` — наш сервер (шлюз) обратился к **другому** сервису (например, платёжному провайдеру) и получил от него плохой ответ или не получил его вовсе. Ошибка на стороне сервера, не клиента.
- Фронтенд, который при ошибке сервера молчит (не показывает сообщение), — **отдельный баг**: покупатель не понимает, что случилось.
- Время в заголовке `date` — всегда в GMT (= UTC).

## Как выглядит хорошая эскалация

```
Кратко: на витрине brewandleaf.shopflow.store не проходит оплата — кнопка Place order «ничего не делает».
Запрос: POST /api/storefront/v1/payments/intent → 502 Bad Gateway, request_id …, время … UTC.
Ответ сервера: …
Фронтенд: после 502 в Console TypeError … — ошибка не показывается покупателю.
Шум (не связано): favicon.ico 404, trackly ERR_BLOCKED_BY_CLIENT.
Влияние: магазин не принимает заказы с утра. HAR приложен (куки удалены).
```

## 🇬🇧 English corner

- *Thank you for the HAR file, it helps a lot.* — Спасибо за HAR-файл, он очень помог.
- *We have escalated this to our engineering team.* — Мы передали проблему нашим инженерам.
- *We will update you within 1 hour.* — Мы сообщим новости в течение часа.
- *payment provider* — платёжный провайдер; *Bad Gateway* — ошибка шлюза.
