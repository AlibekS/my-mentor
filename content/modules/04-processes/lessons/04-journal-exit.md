# journalctl и коды выхода

## journalctl — журнал systemd

Всё, что сервис пишет в stdout/stderr, systemd сохраняет в журнал.

```
journalctl -u shop                      # весь журнал сервиса
journalctl -u shop -n 50                # последние 50 строк
journalctl -u shop -f                   # следить в реальном времени
journalctl -u shop --since "1 hour ago"
journalctl -u shop --since "2026-11-04 14:00" --until "2026-11-04 14:30"
journalctl -u shop -p err               # err и серьёзнее
journalctl -xeu shop                    # конец журнала + пояснения (то, что советует systemctl при ошибке)
journalctl -b                           # с последней загрузки
journalctl -k                           # сообщения ядра (OOM killer, диски)
```

Комбинируй с grep: `journalctl -u shop --since today | grep -i timeout`.

## Коды выхода (exit codes)

Каждая команда возвращает число: **0 — успех**, всё остальное — ошибка. Последний код хранится в `$?`.

```
$ systemctl is-active mailer
failed
$ echo $?
3
```

| Код | Обычно значит |
|---|---|
| 0 | успех |
| 1 | общая ошибка |
| 2 | неправильное использование (аргументы) |
| 126 | файл не исполняемый (нет `x`) |
| 127 | команда не найдена |
| 130 | прервано Ctrl+C (128 + 2) |
| 137 | убит SIGKILL (128 + 9) — часто **OOM killer** |
| 143 | завершён SIGTERM (128 + 15) |

> Правило: **код > 128 = убит сигналом (код − 128)**. Видишь в `systemctl status` `status=137` или `code=killed, signal=KILL` — ищи OOM в `journalctl -k`.

## && и || — логика на кодах выхода

```
sudo systemctl restart shop && echo OK || echo FAIL
grep -q ERROR app.log && echo "есть ошибки"
```

`&&` — выполнить, если предыдущая **успешна**; `||` — если **упала**.

## Как это выглядит на реальной работе L3

Сервис раз в час перезапускается. `systemctl status` → `Main process exited, code=killed, status=9/KILL`. `journalctl -k --since today | grep -i oom` → `Out of memory: Killed process 2240 (java)`. Причина — лимит памяти, а не баг «случайного падения».

## Типичные ошибки

- Смотреть только `systemctl status` (6 строк) вместо полного `journalctl -u`.
- Игнорировать коды выхода в скриптах: команда упала, а скрипт пошёл дальше.
- Путать 127 (нет команды) и 126 (нет прав на запуск).
