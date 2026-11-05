# 👹 Босс модуля: «Hamburg warehouse can't reach your API»

**Четверг, 14:05 по Астане (09:05 UTC).** Тикет от клиента из Германии:

> **Subject:** API not reachable from our Hamburg warehouse since last night
>
> Hello,
>
> since your maintenance last night our warehouse system in **Hamburg** cannot connect to your API. The error is:
>
> `connect ETIMEDOUT api.shopflow.io:443`
>
> Our office in **Berlin** uses the same integration and it works fine. We did not change anything on our side.
> We gave you access to the warehouse server **wh-hamburg-01** for the remote session.
>
> Best regards,
> Jonas Weber, IT, Brew & Leaf GmbH

Словарик: *maintenance* — плановые работы, *warehouse* — склад, *works fine* — работает нормально, *we did not change anything* — мы ничего не меняли.

В домашней папке лежит наше письмо о работах — `~/maintenance-notice.txt` (на английском).

## Что важно заметить сразу

- `ETIMEDOUT` — **таймаут**: пакеты уходят и пропадают. Не NXDOMAIN (имя находится) и не refused.
- Берлин работает, Гамбург — нет. У остальных клиентов всё работает. Значит, дело, скорее всего, **в сети гамбургского склада**.
- «Мы ничего не меняли» — правда. Но **мы** кое-что поменяли ночью.

## План

1. Воспроизвести ошибку с сервера склада (`curl`).
2. Проверить DNS: какой IP у `api.shopflow.io` **сейчас**.
3. Проверить, что интернет с сервера вообще работает (другой HTTPS-сайт, например наша статус-страница).
4. `traceroute`: где обрывается путь к API?
5. Найти правило, которое режет трафик (фаервол склада: `/etc/nftables.conf`), и сравнить с письмом о работах.
6. Сформулировать, что должен сделать клиент.

## Подсказки по фаерволу

`nftables` — фаервол Linux. В конфиге строки вида:

```
policy drop;                                   # по умолчанию — запрещать всё
ip daddr 1.2.3.4 tcp dport 443 accept          # разрешить: адрес назначения 1.2.3.4, порт 443
```

`daddr` — destination address, адрес назначения. Если нужного адреса в списке нет — пакеты молча отбрасываются → **timeout**.

## 🇬🇧 English corner

- *The new IP address of api.shopflow.io is 203.0.113.80.* — Новый IP-адрес api.shopflow.io — 203.0.113.80.
- *Your firewall allows only the old IP address.* — Ваш фаервол разрешает только старый IP-адрес.
- *Please add the new address to your allowlist.* — Пожалуйста, добавьте новый адрес в разрешённый список.
- *We recommend allowing the domain instead of a fixed IP.* — Рекомендуем разрешать домен, а не фиксированный IP.
