# DNS: dig, nslookup, CNAME, NXDOMAIN и /etc/hosts

Компьютеры соединяются по IP-адресам, а люди пишут имена: `app.shopflow.io`. Перевод имени в IP делает **DNS** (Domain Name System) — «телефонная книга интернета». Если DNS отвечает неправильно или не отвечает, сайт «не открывается», хотя сервер работает отлично.

## Как узнать IP имени

```
dig app.shopflow.io
...
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 41022
;; ANSWER SECTION:
app.shopflow.io.    300    IN    A    203.0.113.80
```

- `status: NOERROR` — имя найдено.
- В **ANSWER SECTION**: `A` — запись «имя → IPv4-адрес», `300` — **TTL**, сколько секунд ответ можно хранить в кэше.
- Короткий вариант: `dig +short app.shopflow.io` — только адрес.
- `nslookup app.shopflow.io` — то же самое, есть и в Windows. `host app.shopflow.io` — совсем кратко.

## CNAME — «псевдоним»

Клиенты SaaS часто подключают **свой домен**: магазин открывается по `shop.kazmart.kz`, а работает на наших серверах. Для этого клиент создаёт у себя запись **CNAME** — «это имя — псевдоним другого имени»:

```
shop.kazmart.kz.     300  IN  CNAME  stores.shopflow.io.
stores.shopflow.io.  300  IN  A      203.0.113.90
```

Тикет «мой домен не открывается» L2 начинает с `dig домен`: есть ли CNAME и указывает ли он туда, куда велит наша документация.

## NXDOMAIN — «такого имени нет»

```
dig shop.bluebird.de
;; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN
```

**NXDOMAIN** (Non-Existent Domain) — DNS отвечает: такого имени не существует. В браузере это выглядит как `DNS_PROBE_FINISHED_NXDOMAIN` или «Не удаётся найти IP-адрес сервера». Частые причины:

- опечатка в имени;
- клиент ещё не создал запись у своего регистратора (или создал не ту);
- запись создана только что — DNS-серверы по миру обновляются от минут до нескольких часов (зависит от TTL);
- внутреннее имя компании, которое видно только через **VPN** (следующие уроки).

## /etc/hosts — подмена «в обход» DNS

Перед DNS система заглядывает в файл **`/etc/hosts`** (в Windows — `C:\Windows\System32\drivers\etc\hosts`). Строка в нём «IP имя» **перебивает** DNS для этого компьютера:

```
198.51.100.24  app.shopflow.io   # временно для теста миграции
```

Её добавляют для тестов и забывают удалить. Признаки: `dig` (спрашивает DNS-сервер напрямую) показывает один IP, а `ping`/браузер (идут через систему) — **другой**. Проверить, что видит система:

```
getent hosts app.shopflow.io     # учитывает /etc/hosts — как приложения
ping -c 1 app.shopflow.io        # в скобках — IP, куда реально идём
```

Исправление — удалить или закомментировать (`#` в начале) строку в `/etc/hosts`. Файл системный — нужен `sudo`:

```
sudo nano /etc/hosts                       # открыть в редакторе, удалить строку, Ctrl+O, Enter, Ctrl+X
sudo sed -i '/app.shopflow.io/d' /etc/hosts  # или удалить строку одной командой
```

## Как это выглядит в тикете

> `dig app.shopflow.io` → 203.0.113.80 (правильно), но `getent hosts` на машине клиента → 198.51.100.24: в `/etc/hosts` осталась тестовая запись от миграции. Удалили строку — ping идёт на правильный адрес, сайт открывается. Эскалация не нужна.

## 🇬🇧 English corner

- *The domain does not resolve.* — Домен не разрешается (DNS не находит IP).
- *Please check the CNAME record for your domain.* — Проверьте CNAME-запись вашего домена.
- *DNS changes can take up to 24 hours.* — Изменения DNS могут занять до 24 часов.
- *Do you have any entries in your hosts file?* — Есть ли у вас записи в файле hosts?
- *resolve* — найти IP по имени; *record* — запись.
