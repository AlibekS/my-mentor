# Error-логи, стек-трейсы и request id

Access-лог говорит **что** случилось с запросом (502). Error-лог и лог приложения — **почему**. Связывает их **request id** (он же correlation id, trace id).

## nginx error.log

```
2026/11/04 14:05:12 [error] 1234#0: *5531 connect() failed (111: Connection refused) while connecting to upstream, client: 185.12.40.7, server: shop.kz, request: "POST /api/checkout HTTP/1.1", upstream: "http://127.0.0.1:8081/api/checkout"
```

Частые сообщения и что они значат:

| Сообщение | Значит | Обычно → |
|---|---|---|
| `connect() failed (111: Connection refused)` | на порту upstream никто не слушает | **502**, приложение упало/не запущено |
| `upstream timed out (110)` | приложение не ответило вовремя | **504**, тормоза/блокировки |
| `no live upstreams` | все бэкенды помечены мёртвыми | 502 |
| `upstream prematurely closed connection` | приложение оборвало ответ (крэш, OOM) | 502 |
| `client intended to send too large body` | превышен `client_max_body_size` | 413 |

## Стек-трейс (stack trace)

Исключение в Java/Python/Node печатается многострочно:
```
2026-11-04 14:04:58 ERROR [req=8f3a] Unhandled exception
java.lang.NullPointerException: Cannot invoke "Address.getCity()" because "address" is null
    at kz.shop.checkout.TaxService.calc(TaxService.java:42)
    at kz.shop.checkout.CheckoutController.submit(CheckoutController.java:88)
    ...
```
Читать: **первая строка** — тип и сообщение; **первый кадр с кодом компании** (`kz.shop...`) — где упало. `grep -A 5 Exception` покажет трейс целиком.

## request id — нить через все логи

Хорошие системы пробрасывают id запроса через nginx → приложение → сервисы:
```
grep 8f3a /var/log/nginx/access.log
grep 8f3a /var/log/shop/app.log
grep -r 8f3a /var/log/
```
Один `grep` — и вся история запроса перед глазами. В распределённых системах это делает трейсинг (модуль «Наблюдаемость»).

## Как это выглядит на реальной работе L3

Клиент присылает скрин ошибки с `Request ID: 8f3a`. Ты: `grep -r 8f3a /var/log/` → в app.log NullPointerException в TaxService.calc строка 42 при пустом адресе. Это не «всё сломалось», а конкретный баг: пустой адрес у старых аккаунтов. Workaround — попросить клиента заполнить адрес; задача разработке — с трейсом и шагами.

## Типичные ошибки

- Смотреть только последнюю строку трейса («...47 more») вместо первой.
- Искать причину 502 в приложении, когда в error.log `Connection refused` — приложение просто не запущено.
- Не просить у клиента request id / время с часовым поясом.
