# Ответ клиенту: структура хорошего ответа

Клиент пишет в поддержку, когда у него **что-то сломалось и он нервничает**. Хороший ответ делает две вещи: решает проблему (или показывает, что она решается) и **снимает тревогу**. Плохой ответ — даже технически правильный — злит ещё больше.

С этого модуля письменные задания — **на английском**. Не бойся: в поддержке ценят **короткие простые предложения**, а не сложную грамматику. Ниже — готовые фразы с переводом, их можно брать целиком.

## Шесть частей ответа

| # | Часть | Зачем | Пример (EN) | Перевод |
|---|---|---|---|---|
| 1 | Приветствие (greeting) | вежливо, по имени | *Hi Hannah,* | Здравствуйте, Ханна! |
| 2 | Благодарность / сочувствие (empathy) | показать, что услышали | *Thank you for contacting us. I'm sorry for the trouble.* | Спасибо, что написали. Простите за неудобства. |
| 3 | Что мы знаем (what we know) | факты, простыми словами | *We know about this problem: the "Download PDF" button does not work right now.* | Мы знаем о проблеме: кнопка «Скачать PDF» сейчас не работает. |
| 4 | Что делать сейчас (workaround / next steps) | что клиент может сделать прямо сейчас | *You can order on our website in the meantime.* | Пока можно оформить заказ на сайте. |
| 5 | Срок (ETA) | **когда** будет результат или следующий ответ | *We expect a fix by Friday, November 7.* | Исправление ожидаем к пятнице, 7 ноября. |
| 6 | Завершение (closing) | вежливо закончить, оставить дверь открытой | *Let me know if you have any questions. Best regards, Alibek* | Пишите, если будут вопросы. С уважением, Алибек |

**ETA** (estimated time of arrival) — в поддержке значит «ожидаемый срок». Если точного срока нет — назови **время следующего апдейта**: *I will update you by 16:00 UTC.* — Я напишу вам до 16:00 UTC. Это лучше, чем «as soon as possible» (как можно скорее): такое обещание ничего не значит.

## Полезные фразы

**Сочувствие (empathy):**
- *I understand how frustrating this is.* — Понимаю, как это неприятно.
- *I'm sorry for the inconvenience.* — Простите за неудобства.
- *Thank you for your patience.* — Спасибо за терпение.

**Что мы знаем / что делаем:**
- *We are aware of this issue.* — Мы знаем об этой проблеме.
- *Our team is working on a fix.* — Наша команда работает над исправлением.
- *I checked your payment: …* — Я проверил ваш платёж: …

**Что делать клиенту:**
- *As a workaround, you can …* — В качестве обходного пути можно …
- *Please try another card or PayPal.* — Пожалуйста, попробуйте другую карту или PayPal.

**Срок:**
- *We expect a fix tomorrow.* — Исправление ожидаем завтра.
- *I will send you an update within 2 hours.* — Я пришлю апдейт в течение 2 часов.

## Чего не делать

- ❌ **Обвинять клиента**: *You used a wrong card. It is not our problem.* Даже если причина на стороне клиента (банк отклонил карту), говори о **фактах**, а не о вине: *Your bank declined the payment.* — Ваш банк отклонил платёж.
- ❌ Внутренний жаргон: имена серверов, номера задач в Jira, «пул», «5xx». Клиенту это ничего не говорит.
- ❌ Обещать то, что не контролируешь: *It will be fixed in 10 minutes!*
- ❌ Стена текста. 4–8 коротких строк — нормально.

## Пример целиком

> Hi Hannah,
>
> Thank you for contacting us, and sorry for the trouble.
> We know about this problem: the "Download PDF" button does not work right now. Our developers are working on a fix, and we expect it tomorrow, November 6.
> I attached your invoice for order 1035 to this email, so you can send it to your accountant today.
>
> Best regards,
> Alibek, Tulpar Store Support

## Как это выглядит в работе

В Zendesk у тикета есть **ответ клиенту** (public reply) и **внутренние заметки** (internal notes). Факты для ответа часто лежат в заметках коллег — как в файлах `~/tickets/*.notes` в этом уроке. Прочитай тикет и заметки (`cat`), потом пиши ответ: что клиент видит → что мы знаем → что делать → когда.

## 🇬🇧 English corner

- *Thank you for reaching out.* — Спасибо, что обратились.
- *I'm sorry for the trouble.* — Простите за проблемы.
- *We expect a fix by …* — Исправление ожидаем к …
- *Let me know if you have any questions.* — Пишите, если будут вопросы.
