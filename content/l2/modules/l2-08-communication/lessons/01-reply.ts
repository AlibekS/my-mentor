import type { LessonDef } from '../../../../../src/content/types';
import { CLOSING, EMPATHY, ETA, GREETING, NO_BLAME, replyScenario } from '../data';

const lesson: LessonDef = {
  id: 'reply',
  title: 'Ответ клиенту: структура хорошего ответа',
  minutes: 25,
  commands: ['cat', 'ls'],
  scenario: replyScenario,
  tasks: [
    {
      id: 'what-wants',
      prompt: 'Прочитай тикет `~/tickets/ZD-5101.txt` (он на английском). **Что клиентке нужно получить?** Ответь по-русски или по-английски.',
      answer: { accept: ['invoice'], normalize: 'keywords', keywords: [['invoice', 'счёт', 'счет', 'инвойс', 'pdf', 'фактур']], label: 'Ответ:' },
      hints: ['`cat ~/tickets/ZD-5101.txt`', '*I need the invoice for my October order* — «мне нужен счёт за октябрьский заказ».'],
      solution: 'cat ~/tickets/ZD-5101.txt',
      explanation: 'Клиентке нужен счёт (invoice) за заказ 1035 в PDF — для бухгалтера, на этой неделе. Кнопка «Download PDF» не работает.',
    },
    {
      id: 'missing',
      prompt: 'Коллега подготовила черновик ответа: `~/drafts/reply-1.txt`. Сверь его с шестью частями хорошего ответа. **Какой части не хватает?**',
      answer: { accept: ['ETA'], normalize: 'keywords', keywords: [['срок', 'eta', 'когда', 'дата', 'date', 'time', 'время', 'deadline']], label: 'Не хватает:' },
      hints: ['`cat ~/drafts/reply-1.txt` — пройди по частям: приветствие, сочувствие, что знаем, что делать, срок, завершение.', 'Есть ли в черновике ответ на вопрос «когда починят?» Срок есть в `~/tickets/ZD-5101.notes`.'],
      solution: 'cat ~/drafts/reply-1.txt\ncat ~/tickets/ZD-5101.notes',
      explanation: 'Нет срока (ETA). В заметках сказано: исправление планируется на завтра, 6 ноября. Добавь фразу *We expect a fix tomorrow, November 6.*',
    },
    {
      id: 'reply-app',
      prompt: 'Напиши ответ клиенту на тикет `~/tickets/ZD-5102.txt` **на английском**. Факты — во внутренних заметках `~/tickets/ZD-5102.notes`. Нужны: приветствие, сочувствие, что мы знаем о проблеме, обходной путь (workaround), **срок** исправления, вежливое завершение.',
      write: {
        lang: 'en',
        minWords: 30,
        rows: 9,
        template: 'Hi James,\n\n\n\nBest regards,\n',
        rubric: [
          { label: 'приветствие (Hi / Hello / Dear)', any: GREETING },
          { label: 'благодарность или сочувствие (thank you / sorry / I understand)', any: EMPATHY },
          { label: 'что мы знаем (known issue / bug / crash)', any: ['crash', '\\bclos', 'known', 'aware', '\\bbug\\b', '\\bissue\\b', 'problem'] },
          { label: 'обходной путь: сайт в браузере', any: ['website', 'browser', 'web version', 'tulpar\\.store', 'on (our|the) site', 'computer'] },
          { label: 'срок (Friday / November 7 / tomorrow …)', any: ETA },
          { label: 'вежливое завершение (Best regards / Let me know …)', any: CLOSING },
          { label: 'без обвинения клиента', none: NO_BLAME },
        ],
      },
      hints: [
        'Сначала `cat ~/tickets/ZD-5102.notes`: там баг, версия с исправлением, дата и обходной путь.',
        'Фразы: *We are aware of this issue.* / *As a workaround, you can order on our website.* / *The fix will be in version 3.8.1 on Friday, November 7.*',
        'Короткие предложения — это нормально. 5–7 строк достаточно.',
      ],
      solution: `Hi James,

Thank you for contacting us, and sorry for the trouble.
We are aware of this issue: the app 3.8.0 closes when you open the cart.
As a workaround, you can order on our website tulpar.store in a browser. Your cart is the same there.
The fix will be in version 3.8.1. We expect it in the App Store on Friday, November 7.

Best regards,
Alibek, Tulpar Store Support`,
      explanation: 'Клиенту важны три вещи: «меня услышали», «что мне делать сейчас» (купить подарок сегодня через сайт) и «когда починят». Номер задачи MOB-77 — внутренний, клиенту он не нужен.',
    },
    {
      id: 'rewrite',
      prompt: 'Тикет `~/tickets/ZD-5103.txt`: клиент злится, что платёж отклонён 3 раза. Коллега написал грубый черновик (он уже в редакторе). **Перепиши ответ вежливо на английском**: приветствие, сочувствие, что случилось (данные — в `~/tickets/ZD-5103.payments`), что клиенту сделать, завершение. Без обвинений.',
      write: {
        lang: 'en',
        minWords: 22,
        rows: 9,
        template: 'Our shop is not broken. It is not our problem, you used a wrong card.\nCheck your card.\n',
        rubric: [
          { label: 'приветствие', any: GREETING },
          { label: 'сочувствие (sorry / I understand / thank you)', any: EMPATHY },
          { label: 'что случилось: платёж отклонил банк', any: ['\\bbank\\b', 'card_declined', 'declined by', 'card (was|is) declined'] },
          { label: 'что сделать: другая карта / PayPal / позвонить в банк', any: ['another (card|payment)', 'different (card|payment)', 'paypal', 'apple pay', '(contact|call|ask) (your|the) bank', 'try again'] },
          { label: 'вежливое завершение', any: CLOSING },
          { label: 'без обвинения клиента (wrong card, not our problem)', none: [...NO_BLAME, 'wrong card'] },
        ],
      },
      hints: [
        '`cat ~/tickets/ZD-5103.payments` — у всех трёх попыток `card_declined`: отказал банк, магазин работает.',
        'Вместо *you used a wrong card* — факт без вины: *Your bank declined the payment.*',
        'Предложи шаги: *Please try another card or PayPal, or contact your bank.*',
      ],
      solution: `Hello Mehmet,

I'm sorry that your payment did not go through, I understand how frustrating this is.
I checked your three attempts: each time your bank declined the card payment (card_declined). Our shop is working normally.
Please try another card or PayPal. You can also contact your bank and ask about the declined payments.

Let me know if you need any help.
Best regards,
Alibek`,
    },
  ],
  quiz: [
    {
      id: 'q-thanks',
      type: 'text',
      prompt: 'Как по-английски начать ответ: «Спасибо, что написали нам»?',
      answer: { accept: ['Thank you for contacting us.'], normalize: 'keywords', keywords: [['thank'], ['contact', 'reach', 'writ', 'message', 'getting in touch', 'email', 'letter']] },
      explanation: '*Thank you for contacting us.* / *Thanks for reaching out.* / *Thank you for your message.*',
    },
    {
      id: 'q-eta',
      type: 'text',
      prompt: 'Что в поддержке значит **ETA**? (по-русски, одной фразой)',
      answer: { accept: ['ожидаемый срок'], normalize: 'keywords', keywords: [['срок', 'время', 'когда', 'ожидаем', 'примерн', 'estimated']] },
      explanation: 'Estimated time of arrival — ожидаемый срок решения или следующего ответа.',
    },
    {
      id: 'q-frustrating',
      type: 'text',
      prompt: 'Переведи: *I understand how frustrating this is.*',
      answer: { accept: ['Понимаю, как это неприятно'], normalize: 'keywords', keywords: [['понима'], ['неприятн', 'расстра', 'раздраж', 'обидн', 'досад', 'неудоб', 'бесит', 'злит', 'сложно', 'тяжело', 'трудно', 'разочар', 'нерв']] },
      explanation: '«Понимаю, как это неприятно». Одна фраза сочувствия заметно снижает накал.',
    },
    {
      id: 'q-best',
      type: 'choice',
      prompt: 'Какая фраза лучше для клиента, чей платёж отклонён?',
      options: ['You used a wrong card.', 'Your bank declined the payment. Please try another card or PayPal.', 'Payment failed: gateway returned 402, see PSP logs.'],
      correct: 1,
      explanation: 'Факт без обвинения + понятный следующий шаг. Третий вариант — внутренний жаргон.',
    },
  ],
  glossary: [
    { ru: 'Сочувствие', en: 'empathy', def: 'Показать клиенту, что его услышали: *I understand…, I\'m sorry…*' },
    { ru: 'Ожидаемый срок', en: 'ETA (estimated time of arrival)', def: 'Когда будет решение или следующий апдейт.' },
    { ru: 'Обходной путь', en: 'workaround', def: 'Что клиент может сделать, пока проблема не исправлена.' },
    { ru: 'Публичный ответ / внутренняя заметка', en: 'public reply / internal note', def: 'Ответ видит клиент, заметку — только команда.' },
  ],
};
export default lesson;
