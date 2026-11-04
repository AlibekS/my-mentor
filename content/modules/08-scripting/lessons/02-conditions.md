# Условия: коды выхода, if, test

## Всё строится на кодах выхода

`if` в bash проверяет не «истину», а **код выхода команды**: 0 — «да», не 0 — «нет».

```bash
if grep -q ERROR /var/log/app.log; then
  echo "есть ошибки"
fi
```

`grep -q` ничего не печатает, только возвращает код — идеально для условий. Так же работают `systemctl is-active -q nginx`, `curl -sf URL`, `ping -c1 host`.

## test и [ ]

`[ ... ]` — это команда `test` (пробелы после `[` и перед `]` обязательны!).

```bash
[ -f /etc/nginx/nginx.conf ]     # файл существует
[ -d /var/log/app ]              # каталог
[ -s file ]                      # файл не пустой
[ -z "$VAR" ]  [ -n "$VAR" ]     # строка пустая / не пустая
[ "$A" = "$B" ]  [ "$A" != "$B" ]  # строки
[ "$N" -gt 80 ]                  # числа: -eq -ne -lt -le -gt -ge
[ ! -f file ]                    # отрицание
```

`[[ ... ]]` — расширенный вариант bash: `[[ $f == *.log ]]`, `&&` и `||` внутри.

> Числа сравнивают через `-gt`, а не `>`: `[ 10 > 9 ]` — это перенаправление в файл с именем 9!

## if / elif / else

```bash
USED=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$USED" -ge 90 ]; then
  echo "CRITICAL: disk $USED%"
elif [ "$USED" -ge 80 ]; then
  echo "WARNING: disk $USED%"
else
  echo "OK: disk $USED%"
fi
```

## && и || — короткие условия

```bash
systemctl is-active -q nginx || echo "nginx DOWN"
[ -f /tmp/maintenance ] && echo "режим обслуживания"
mkdir -p /backup && cp app.conf /backup/
```

## Как это выглядит на реальной работе L3

Пороговые проверки «диск > 80%», «сервис не active», «HTTP не 200» — это ровно `if` + `[ ]` + код выхода. Такие проверки потом превращаются в cron-задачу или в шаг runbook.

## Типичные ошибки

- `[$A = $B]` без пробелов и без кавычек.
- `if [ grep -q x file ]` — команду в `[ ]` не кладут: `if grep -q x file; then`.
- Сравнение чисел строками: `[ "10" \< "9" ]` истинно.
