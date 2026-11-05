import type { LessonDef } from '../../../../../src/content/types';
import { kbScenario } from '../data';

const lesson: LessonDef = {
  id: 'knowledge-base',
  title: 'Статья в базу знаний',
  minutes: 25,
  commands: ['ls', 'cat', 'grep'],
  scenario: kbScenario,
  tasks: [
    {
      id: 'find-article',
      prompt: 'Тикет `~/tickets/ZD-5301.txt`: *«I didn\'t get the password reset email»*. Найди в `~/kb/` статью, которая подходит к этому тикету. Введи **имя файла**.',
      answer: { accept: ['reset-password.md'], normalize: 'keywords', keywords: [['reset-password']], label: 'Файл:' },
      hints: ['`ls ~/kb` — названия статей уже подсказывают.', '`grep -ril "reset" ~/kb` — файлы, где есть слово reset.'],
      solution: 'grep -ril "reset" ~/kb',
      explanation: 'Статья `reset-password.md`: проверить «Спам», проверить email на опечатки, отправить ссылку ещё раз; если письмо не дошло через 30+ минут — эскалация с email и временем UTC.',
    },
    {
      id: 'outdated',
      prompt: 'Проверь даты `Last reviewed` у всех статей в `~/kb/`. Какая статья **устарела** (не проверялась больше года)? Введи имя файла.',
      answer: { accept: ['invoice-download.md'], normalize: 'keywords', keywords: [['invoice']], label: 'Файл:' },
      hints: ['Одной командой: `grep "Last reviewed" ~/kb/*`.', 'Сегодня 5 ноября 2026 — ищи дату из 2025 года.'],
      solution: 'grep "Last reviewed" ~/kb/*',
      explanation: '`invoice-download.md` проверяли в феврале 2025 — а кнопка «Download PDF» с тех пор менялась (и сейчас сломана). Устаревшая статья вредит: L2 по ней даёт клиенту неверные шаги.',
    },
    {
      id: 'write-article',
      prompt: 'iOS-приложение падает при открытии корзины — тикетов всё больше. Напиши **внутреннюю статью** в базу знаний **на английском** по фактам из `~/notes/app-crash.txt`. Части: заголовок (симптом), Symptoms, Cause, Workaround/Steps (**списком, минимум 2 пункта**), When to escalate.',
      write: {
        lang: 'en',
        minWords: 40,
        rows: 16,
        template: '# \nLast reviewed: 2026-11-05\n\n## Symptoms\n\n## Cause\n\n## Steps\n\n## When to escalate\n',
        rubric: [
          { label: 'заголовок', any: ['^[ \\t]*#[ \\t]*[^#\\s]', '^[ \\t]*##[ \\t]*(?!symptoms|cause|steps|workaround|when to escalate|resolution)[^#\\s]', '^[ \\t]*title[ \\t]*:[ \\t]*\\S'] },
          { label: 'симптом: приложение падает / закрывается', any: ['crash', '\\bclos', 'freez', 'stops? working', 'shuts? down'] },
          { label: 'причина: известный баг в версии 3.8.0', any: ['3\\.8\\.0', '\\bbug\\b', 'known (issue|problem)'] },
          { label: 'шаги списком (минимум 2 пункта)', any: ['^[ \\t]*(\\d+[.)]|[-*•])[ \\t]+\\S'], minMatches: 2 },
          { label: 'обход: сайт в браузере или обновление 3.8.1', any: ['website', 'browser', 'web version', 'tulpar\\.store', '3\\.8\\.1', 'update the app'] },
          { label: 'когда эскалировать в L3', any: ['\\bL3\\b', 'escalat[^\\n]{0,60}(engineer|developer|dev team|tier 3|level 3)', '\\bif\\b[^\\n]{0,80}escalat'] },
        ],
      },
      hints: [
        '`cat ~/notes/app-crash.txt` — там всё: симптом, причина, исправление, обход, условие эскалации.',
        'Шаги — глаголом в начале: *1. Ask the customer which app version they use. 2. Suggest ordering on the website in a browser.*',
        'Эскалация с условием: *If the app crashes in version 3.8.1, escalate to L3.*',
      ],
      solution: `# iOS app crashes when the customer opens the cart
Last reviewed: 2026-11-05

## Symptoms
The iOS app closes (crashes) when the customer opens the cart.

## Cause
Known bug in iOS app version 3.8.0 (MOB-77).

## Steps
1. Ask the customer which app version they use.
2. If it is 3.8.0, suggest ordering on the website tulpar.store in a browser. The cart is the same.
3. Tell the customer that the fix is in version 3.8.1, in the App Store on Friday, November 7.

## When to escalate
If the app still crashes in version 3.8.1, or crashes on another screen, escalate to L3.`,
      explanation: 'Во внутренней статье номер задачи (MOB-77) уместен — коллеги найдут по нему подробности. В публичной статье для клиентов его бы не было.',
    },
  ],
  quiz: [
    {
      id: 'q-steps',
      type: 'text',
      prompt: 'Как по-английски называется раздел статьи «шаги» (что делать по порядку)?',
      answer: { accept: ['Steps'], normalize: 'keywords', keywords: [['step', 'procedure', 'how to', 'instruction']] },
      explanation: '*Steps* (или *Resolution steps*, *How to fix*).',
    },
    {
      id: 'q-workaround',
      type: 'text',
      prompt: 'Переведи слово *workaround*.',
      answer: { accept: ['обходной путь'], normalize: 'keywords', keywords: [['обход', 'временн', 'обойти', 'костыл']] },
      explanation: '«Обходной путь» (временное решение), пока основная проблема не исправлена.',
    },
    {
      id: 'q-title',
      type: 'choice',
      prompt: 'Какой заголовок статьи лучше?',
      options: ['SMTP relay timeout on mail-02', 'Password reset email not received', 'Problem with emails (read carefully!)'],
      correct: 1,
      explanation: 'Заголовок — симптом словами клиента: по нему статью найдут и L2, и клиенты.',
    },
    {
      id: 'q-grep',
      type: 'text',
      prompt: 'Какой флаг `grep` выводит **только имена файлов**, где нашлось совпадение?',
      answer: { accept: ['-l'], normalize: 'exact' },
      explanation: '`grep -ril "reset" ~/kb`: `-r` — по всем файлам папки, `-i` — без учёта регистра, `-l` — только имена файлов.',
    },
  ],
  glossary: [
    { ru: 'База знаний', en: 'knowledge base (KB)', def: 'Сборник коротких статей «симптом → причина → шаги → когда эскалировать».' },
    { ru: 'Симптом', en: 'symptom', def: 'Что видит и пишет клиент.' },
    { ru: 'Устаревший', en: 'outdated', def: 'Статья, которая больше не соответствует продукту.' },
    { ru: 'Повелительное наклонение', en: 'imperative', def: 'Глагол в начале: Open…, Check…, Send… — стиль шагов в статьях.' },
  ],
};
export default lesson;
