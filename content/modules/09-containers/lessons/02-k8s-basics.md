# Kubernetes: что есть что

Kubernetes (k8s) запускает контейнеры на кластере машин и сам поддерживает нужное состояние: «должно работать 3 копии checkout» — он следит, чтобы их было 3.

## Объекты, которые встречает L3

| Объект | Что это | Аналогия |
|---|---|---|
| **Pod** | 1+ контейнеров, запущенных вместе; имеет IP | один экземпляр приложения |
| **Deployment** | описание «образ X, N реплик» + история версий | systemd-юнит + стратегия обновления |
| **ReplicaSet** | создаётся деплойментом под каждую версию | — |
| **Service** | постоянное имя и IP перед группой подов (по селектору `app=…`) | балансировщик внутри кластера |
| **Namespace** | «папка» для ресурсов: `prod`, `staging`, `monitoring` | — |
| **Node** | машина (VM), где работают поды | сервер |

Поды **эфемерны**: умер под — деплоймент создаёт новый с **другим именем** (`checkout-7d9f8c6b5f-x2k1p` → `checkout-7d9f8c6b5f-q8m3n`).

## Основные команды

```
kubectl config current-context           # в каком кластере я? (как hostname!)
kubectl get pods                          # поды в текущем namespace
kubectl get pods -n prod                  # в namespace prod
kubectl get pods -A                       # во всех namespace
kubectl get pods -o wide                  # + IP и нода
kubectl get deploy                        # деплойменты: READY 2/3
kubectl get svc                           # сервисы
kubectl get nodes                         # ноды кластера
```

## Колонки get pods

```
NAME                         READY   STATUS             RESTARTS   AGE
checkout-7d9f8c6b5f-x2k1p    1/1     Running            0          3d
reports-5b8d9c7f4d-l2m9z     0/1     CrashLoopBackOff   14         42m
```

- **READY** `0/1` — контейнер не готов (не прошёл readiness или не запущен).
- **STATUS** — Running, Pending, CrashLoopBackOff, ImagePullBackOff, Error, OOMKilled…
- **RESTARTS** — растущее число = контейнер падает.

## Как это выглядит на реальной работе L3

Первое на любом k8s-инциденте: `kubectl config current-context` (тот ли кластер!), затем `kubectl get pods -n <ns>` — кто не Running или с растущими RESTARTS, и `kubectl get deploy` — где READY меньше желаемого.

## Типичные ошибки

- Забыть `-n` и смотреть не в тот namespace: «подов нет!».
- Работать не в том контексте (прод вместо стейджа).
- Искать «тот самый под» по имени через час — его уже пересоздали.
