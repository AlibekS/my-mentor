# systemd: systemctl

Почти все сервисы на современных Linux (Ubuntu, Debian, RHEL) управляются **systemd**. Каждый сервис — это **юнит** (`nginx.service`), описанный файлом в `/lib/systemd/system/` или `/etc/systemd/system/`.

## Главные команды

```
systemctl status nginx          # состояние, PID, память, последние строки журнала
sudo systemctl start nginx      # запустить
sudo systemctl stop nginx       # остановить
sudo systemctl restart nginx    # перезапустить (stop + start)
sudo systemctl reload nginx     # перечитать конфиг без остановки (если сервис умеет)
sudo systemctl enable nginx     # запускать при загрузке
sudo systemctl disable nginx    # не запускать при загрузке
systemctl is-active nginx       # active / inactive / failed (удобно в скриптах)
systemctl is-enabled nginx
systemctl --failed              # все упавшие юниты — первое, что смотреть на «больном» сервере
systemctl list-units --type=service
```

## Читаем systemctl status

```
× shop.service - Shop web application
     Loaded: loaded (/lib/systemd/system/shop.service; enabled; preset: enabled)
     Active: failed (Result: exit-code) since Wed 2026-11-04 02:01:14 +05
   Main PID: 2240 (code=exited, status=1/FAILURE)

Nov 04 02:01:14 srv shop[2240]: Exception ... AccessDeniedException: /etc/shop/secrets.env
```

- **Loaded** — где файл юнита и `enabled/disabled` (автозапуск).
- **Active** — `active (running)`, `inactive (dead)`, `failed`, `activating (auto-restart)`.
- **Main PID** и код выхода.
- Внизу — последние строки журнала (полностью — `journalctl -u`).

## enable ≠ start

`enable` — только автозапуск при следующей загрузке, **сейчас** сервис не запустится. `start` — сейчас, но после перезагрузки не поднимется. Часто нужны оба: `sudo systemctl enable --now nginx`.

## Файл юнита (на уровне чтения)

```ini
[Service]
User=shop
ExecStart=/usr/bin/java -jar /opt/shop/shop.jar
Restart=on-failure
EnvironmentFile=/etc/shop/secrets.env
```

`User` — от кого работает (важно для прав), `ExecStart` — команда, `Restart` — политика перезапуска. После правки юнита: `sudo systemctl daemon-reload`.

## Как это выглядит на реальной работе L3

Сервер перезагрузили после патчей, сайт не работает. `systemctl --failed` — пусто. `systemctl status shop` → `inactive (dead)`, `disabled`. Сервис просто не был в автозапуске. `sudo systemctl enable --now shop`, проверяешь `is-active`, пишешь action item: добавить проверку автозапуска в чек-лист патчинга.

## Типичные ошибки

- `restart` в цикле без чтения журнала — причина не уйдёт.
- Забыть `enable` — после перезагрузки сервис не поднимется.
- Править юнит и забыть `daemon-reload`.
