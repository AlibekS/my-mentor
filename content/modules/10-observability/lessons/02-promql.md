# PromQL: читать и писать запросы метрик

Prometheus хранит временные ряды; **PromQL** — язык запросов к ним. L3 не обязан быть гуру PromQL, но должен понимать панели дашборда и уметь быстро задать свой вопрос.

## Типы метрик

- **Counter** — только растёт (`http_requests_total`): само значение бессмысленно, важна скорость роста → `rate()`.
- **Gauge** — текущее значение (`db_pool_connections_in_use`, память): смотрим как есть.
- **Histogram** — бакеты `_bucket{le="0.5"}` для перцентилей (следующий урок).

## Селекторы

```
http_requests_total                                  # все ряды метрики
http_requests_total{service="checkout"}              # точное совпадение метки
http_requests_total{code=~"5.."}                     # регулярка: 500–599
http_requests_total{service!="catalog"}              # не равно
```

## rate — скорость счётчика

```
rate(http_requests_total[5m])        # запросов в секунду, усреднено за 5 минут
increase(http_requests_total[1h])    # прирост за час (сколько штук)
```

`[5m]` — окно. Больше окно — глаже график, но медленнее реакция.

## Агрегация

```
sum(rate(http_requests_total[5m]))                         # общий RPS
sum by (service) (rate(http_requests_total[5m]))           # по сервисам
sum by (code) (rate(http_requests_total{service="checkout"}[5m]))
topk(3, sum by (route) (rate(http_requests_total[5m])))    # топ-3 маршрута
```

`by (…)` — какие метки оставить; остальные схлопнутся. `sum(...) by (service)` — то же самое.

## Доля ошибок — главный запрос L3

```
sum(rate(http_requests_total{code=~"5.."}[5m]))
/
sum(rate(http_requests_total[5m]))
```

С разбивкой по сервисам — `sum by (service)` в обеих частях. Деление сопоставляет ряды с одинаковыми метками.

## Как это выглядит на реальной работе L3

Клиент жалуется на ошибки только на `/api/checkout`. Ты на дашборде не находишь такой панели — пишешь сам `sum by (code) (rate(http_requests_total{route="/api/checkout"}[5m]))` и видишь, что 502 начались в 14:04.

## Типичные ошибки

- Строить график сырого счётчика (вечно растущая линия) вместо `rate`.
- `rate(sum(...))` вместо `sum(rate(...))` — сначала rate, потом sum.
- Забыть `[5m]` в `rate()` — ошибка «ожидает range vector».
