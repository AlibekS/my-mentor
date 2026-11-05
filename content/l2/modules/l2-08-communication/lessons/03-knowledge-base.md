# Статья в базу знаний (knowledge base)

Один и тот же вопрос приходит десятки раз: «не пришло письмо для сброса пароля», «как скачать счёт», «платёж отклонён». Если каждый раз разбираться с нуля — смена утонет. Поэтому у поддержки есть **база знаний** (knowledge base, KB): короткие статьи «симптом → причина → шаги → когда эскалировать».

Бывают статьи **внутренние** (для поддержки: что проверить, куда смотреть) и **публичные** (help center для клиентов). В этом уроке — внутренние: их пишет и обновляет L2.

## Структура статьи

```markdown
# Payment declined at checkout          ← заголовок = симптом словами клиента
Last reviewed: 2026-10-20               ← когда статью последний раз проверяли

## Symptoms                             ← что видит клиент
The customer sees "Payment declined" at checkout.

## Cause                                ← почему так бывает
The bank of the customer declined the payment.

## Steps                                ← что делать, по шагам
1. Check the payment and its error_code.
2. Tell the customer that the bank declined the payment.
3. Suggest another card or PayPal.

## When to escalate                     ← граница L2 → L3
Many customers get "declined" at the same time — escalate to L3.
```

| Часть (EN) | Перевод | Совет |
|---|---|---|
| *Title* | заголовок | пиши **симптом**, как его скажет клиент: *Password reset email not received*, а не *SMTP issue* |
| *Symptoms* | симптомы | что клиент видит и пишет; можно с цитатой ошибки |
| *Cause* | причина | коротко; если неизвестна — *Unknown, under investigation* |
| *Workaround / Steps* | обходной путь / шаги | **нумерованный список**, одно действие в строке, глагол в начале: *Open…, Check…, Send…* |
| *When to escalate* | когда эскалировать | конкретное условие: *If … still … after …, escalate to L3 with …* |
| *Last reviewed* | дата проверки | старая дата — сигнал, что статья могла устареть |

## Язык статьи

Повелительное наклонение (imperative) — самое простое: глагол в начале, без «you should».

- *Open "My orders".* — Откройте «Мои заказы».
- *Check the Spam folder.* — Проверьте папку «Спам».
- *Ask the customer to update the app.* — Попросите клиента обновить приложение.
- *If the problem is still there, escalate to L3.* — Если проблема осталась, эскалируйте в L3.

## Как искать в базе знаний

В тренажёре статьи лежат в `~/kb/` (в жизни — Confluence, Zendesk Guide, Notion). Искать по ключевому слову — тем же `grep`, что и в логах:

```bash
ls ~/kb                       # какие статьи есть
grep -ril "reset" ~/kb        # в каких файлах есть слово reset (-i без регистра, -l только имена файлов)
grep "Last reviewed" ~/kb/*   # даты проверки всех статей
```

## Как это выглядит в работе

Решил тикет, которого нет в базе, — **напиши статью** или дополни существующую. Нашёл устаревшую — поправь или отметь. Хорошая база знаний — это меньше эскалаций, быстрее ответы и проще онбординг новых коллег. В резюме и на собеседовании это хороший пример: *I wrote 15 knowledge base articles for the most common tickets.*

## 🇬🇧 English corner

- *knowledge base article* — статья в базе знаний
- *symptoms / cause / steps* — симптомы / причина / шаги
- *workaround* — обходной путь
- *If the issue is still there, escalate to L3.* — Если проблема осталась, эскалируйте в L3.
- *outdated* — устаревший
