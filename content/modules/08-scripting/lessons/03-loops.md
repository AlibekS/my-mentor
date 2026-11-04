# Циклы: for и while read

Циклы превращают «сделай то же самое для 20 серверов/логов/файлов» в одну команду.

## for по списку

```bash
for h in web-01 web-02 db-01; do
  echo "== $h"
done

for f in /var/log/app/*.log; do          # по файлам (glob)
  echo "$f: $(grep -c ERROR "$f")"
done

for h in $(cat servers.txt); do          # по словам из файла
  ping -c 1 "$h" > /dev/null && echo "$h up" || echo "$h DOWN"
done
```

В одну строку: `for f in *.log; do wc -l "$f"; done`.

## while read — построчно

Когда строки содержат пробелы, правильнее читать построчно:

```bash
while read -r host port; do
  echo "проверяю $host:$port"
done < endpoints.txt

grep ERROR app.log | while read -r date time level msg; do
  echo "$time $msg"
done
```

`read -r` не трогает обратные слеши; несколько переменных — строка делится по пробелам, остаток уходит в последнюю.

## while с условием и счётчиком

```bash
i=1
while [ $i -le 5 ]; do
  curl -s -o /dev/null -w "%{http_code}\n" https://api.shop.kz/health
  i=$((i + 1))
done
```

Типичный приём «подождать, пока сервис поднимется»:
```bash
until systemctl is-active -q shop; do sleep 2; done
```

## Как это выглядит на реальной работе L3

После релиза нужно проверить health-эндпоинт на 12 нодах. Вместо 12 ручных `curl`:
```bash
for n in $(cat nodes.txt); do printf "%-10s %s\n" "$n" "$(curl -s -o /dev/null -w '%{http_code}' https://$n/health)"; done
```
Результат — готовая табличка для тикета.

## Типичные ошибки

- `for line in $(cat file)` для строк с пробелами — он разобьёт по словам. Используй `while read`.
- Бесконечный `while` без изменения условия.
- Забыть кавычки вокруг `"$f"`.
