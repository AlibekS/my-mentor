# Запросить информацию у клиента

*«Your site doesn't work!!!»* — с таким тикетом ничего не сделать: непонятно, **что** не работает, **где**, **когда** и **у кого**. Задача L2 — за **один** вопрос собрать всё нужное. Не пять писем по одному вопросу, а одно письмо со списком.

## Что обычно нужно

| Что | Зачем | Как попросить (EN) | Перевод |
|---|---|---|---|
| Шаги воспроизведения (steps to reproduce) | повторить проблему у себя | *What steps did you take before the error?* | Что вы делали перед ошибкой? |
| Что ожидали и что получили (expected / actual) | понять, в чём проблема | *What did you expect, and what happened instead?* | Чего вы ожидали и что произошло? |
| Скриншот или видео (screenshot / screen recording) | увидеть ошибку своими глазами | *Could you send us a screenshot of the error?* | Пришлите, пожалуйста, скриншот ошибки. |
| Время **и часовой пояс** (time + time zone) | найти запросы в логах | *What time did it happen, and in which time zone?* | Во сколько это было и в каком часовом поясе? |
| Браузер / устройство (browser / device) | баг может быть только в Safari или в старой версии приложения | *Which browser or device do you use?* | Каким браузером или устройством вы пользуетесь? |
| Email аккаунта, номер заказа (account email, order ID) | найти данные клиента | *Could you tell me your order number?* | Подскажите номер заказа. |
| HAR-файл | все сетевые запросы страницы | *Could you record a HAR file? Here is how: …* | Запишите, пожалуйста, HAR-файл. Вот инструкция: … |

**HAR** (HTTP Archive) — файл из DevTools (вкладка Network) со всеми запросами страницы: адреса, статусы, время. Его просят, когда «страница бесконечно грузится» или «кнопка не реагирует». Всегда давай клиенту короткую **инструкцию** и предупреди, что в HAR могут быть личные данные.

## Время и часовые пояса

Логи и база — в **UTC**. Клиенты пишут «в 3 часа дня» по своему времени. Переводи сразу:

| Пояс | Смещение (ноябрь) | Пример |
|---|---|---|
| CET (Франция, Германия зимой) | UTC+1 | 15:15 CET = 14:15 UTC |
| GMT (Великобритания зимой) | UTC+0 | 10:00 GMT = 10:00 UTC |
| EST (Нью-Йорк зимой) | UTC−5 | 09:00 EST = 14:00 UTC |
| Астана / Алматы | UTC+5 | 09:40 по Астане = 04:40 UTC |

Формула: **UTC = местное время − смещение**. Для UTC+1: 15:15 − 1 час = 14:15. Для UTC−5: 09:00 + 5 часов = 14:00.

*3:15 PM* — это 15:15 (PM — после полудня, AM — до полудня).

## Как попросить вежливо

- Начни с благодарности и сочувствия — клиент уже раздражён.
- Объясни **зачем**: *This will help us find the problem faster.* — Это поможет нам быстрее найти проблему.
- Дай **список** — его легко прочитать и ответить по пунктам.
- Вежливые формы: *Could you …?*, *Can you please …?*, *Please send …*.

## Шаблон

> Hi Noah,
>
> Thank you for your message, and I'm sorry that the site does not work for you.
> To find the problem faster, could you please send us:
> 1. What steps did you take, and what happened? (which page, which button)
> 2. A screenshot of the error.
> 3. What time did it happen, and in which time zone?
> 4. Which browser and device do you use?
>
> Thank you! I will check it as soon as I get your answer.
> Best regards,
> Alibek

## Чего не делать

- ❌ *Please describe the problem in detail.* — слишком общо, клиент не знает, что для тебя «детали».
- ❌ Просить то, что уже есть в тикете (браузер указан — не спрашивай снова).
- ❌ Спрашивать время без часового пояса — потом не найдёшь запросы в логах.

## Как это выглядит в работе

Пока ждёшь ответа, переведи тикет в статус **Pending** («ждём клиента») — так SLA не тикает против тебя, а коллеги видят, что мяч на стороне клиента.

## 🇬🇧 English corner

- *steps to reproduce* — шаги воспроизведения
- *Could you send us a screenshot?* — Пришлёте скриншот?
- *in which time zone* — в каком часовом поясе
- *This will help us find the problem faster.* — Это поможет быстрее найти проблему.
