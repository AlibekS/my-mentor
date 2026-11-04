# Операции: rollout, scale, лимиты, сервисы без endpoints

Отладить — половина дела. L3 часто ещё и **восстанавливает** сервис: откатывает релиз, перезапускает, поднимает лимит, масштабирует. Всё — через деплоймент, а не через отдельные поды.

## rollout

```
kubectl rollout status deployment/checkout       # дошло ли обновление до конца
kubectl rollout history deployment/checkout      # ревизии
kubectl rollout undo deployment/checkout         # откат на предыдущую ревизию
kubectl rollout undo deployment/checkout --to-revision=3
kubectl rollout restart deployment/checkout      # перезапустить все поды (тот же образ)
```

`rollout restart` пересоздаёт поды по очереди без даунтайма — правильная замена «удалить все поды руками».

## scale

```
kubectl scale deployment/checkout --replicas=6
```

Временная мера при наплыве трафика (если нет автоскейлинга HPA). Помни вернуть обратно — или пусть это сделает HPA.

## Лимиты ресурсов

```
kubectl set resources deployment search --limits=memory=1Gi
```

- **requests** — сколько гарантировать (влияет на размещение: Pending, если не влезает);
- **limits** — потолок; превышение памяти → **OOMKilled**, CPU → троттлинг (тормоза, но не смерть).

## Образ и переменные

```
kubectl set image deployment/checkout checkout=shop/checkout:2.3.1
kubectl set env deployment/reports REPORTS_BUCKET=s3://shop-reports
```

В реальных командах это делают через GitOps (ArgoCD/Flux) или CI: правка в git → деплой. Ручной `kubectl set` на проде — только как экстренная мера, с записью в тикет и последующим переносом в git (иначе следующий деплой «откатит твой фикс»).

## Сервис есть, а трафик не идёт

```
kubectl get endpoints checkout
NAME       ENDPOINTS   AGE
checkout   <none>      210d
```

`<none>` — за сервисом нет готовых подов: все поды не Ready, или **селектор сервиса не совпадает с метками подов** (`app=checkout` vs `app=checkout-v2`). Клиенты получают 503 от ingress.

## Как это выглядит на реальной работе L3

После релиза растут 5xx. `rollout status` висит, новые поды в CrashLoopBackOff, endpoints у сервиса пустеют. Решение за минуту — `rollout undo`, проверка `get pods` и `get endpoints`, апдейт в инцидент-канал. Разбор причины — уже после восстановления.

## Типичные ошибки

- Удалять поды вместо `rollout restart` / `undo`.
- `kubectl set ...` на проде и не перенести изменение в git.
- Поднять лимит памяти выше, чем помещается на ноду, — получить Pending.
