# Отладка подов: describe, logs --previous, events

## Алгоритм «под не работает»

1. `kubectl get pods` — STATUS и RESTARTS.
2. `kubectl describe pod <имя>` — **State / Last State / Exit Code / Reason** и **Events** внизу.
3. `kubectl logs <имя>` — что пишет сейчас; **`kubectl logs <имя> --previous`** — что писал **упавший** контейнер перед смертью.
4. `kubectl get events --sort-by=.lastTimestamp` — что происходило в namespace.

## Частые статусы и что они значат

| STATUS | Что случилось | Где смотреть |
|---|---|---|
| **CrashLoopBackOff** | контейнер стартует и падает, k8s перезапускает с растущей паузой | `logs --previous`, Exit Code в describe |
| **OOMKilled** (Last State Reason) | превышен лимит памяти, Exit Code 137 | describe: Limits, `kubectl top pod` |
| **ImagePullBackOff / ErrImagePull** | не скачивается образ: опечатка в теге, нет доступа к registry | describe → Events: `Failed to pull image` |
| **Pending** | нет ноды, куда поместить под: не хватает CPU/памяти, taints, не создан PVC | describe → Events: `FailedScheduling: Insufficient memory` |
| **Running, но 0/1 READY** | не проходит readiness probe | describe → Events: `Readiness probe failed` |
| **CreateContainerConfigError** | нет ConfigMap/Secret, на который ссылается под | describe → Events |

> `kubectl logs` у CrashLoopBackOff часто пустой — контейнер только что перезапущен. Причина — в `--previous`.

## Exit Code

- `1` — ошибка приложения (смотри логи);
- `137` — SIGKILL, чаще всего OOMKilled;
- `143` — SIGTERM (остановлен);
- `0` при CrashLoopBackOff — процесс просто завершился (например, неверная команда запуска).

## Как это выглядит на реальной работе L3

`reports` в CrashLoopBackOff. `logs` — пусто. `logs --previous` — `Error: REPORTS_BUCKET is not set`. `describe` → в Environment нет переменной: при релизе забыли добавить её в манифест. Без `--previous` можно было час искать «почему логи пустые».

## Типичные ошибки

- Читать только `logs` без `--previous`.
- Не дочитывать `describe` до секции Events.
- Удалять под в надежде, что «пересоздастся и заработает» — без исправления причины новый упадёт так же.
