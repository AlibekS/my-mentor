import type { LessonDef } from '../../../../../src/content/types';
import { askScenario, CLOSING, EMPATHY, GREETING, NO_BLAME } from '../data';

const lesson: LessonDef = {
  id: 'ask-info',
  title: 'Запросить информацию у клиента',
  minutes: 25,
  commands: ['cat', 'ls'],
  scenario: askScenario,
  tasks: [
    {
      id: 'cet',
      prompt: 'Тикет `~/tickets/ZD-5202.txt`: клиентка пишет время ошибки по своему часовому поясу. Чтобы искать в логах, переведи это время **в UTC** (`ЧЧ:ММ`). Таблица поясов — в `~/notes/timezones.txt`.',
      answer: { accept: ['14:15'], normalize: 'keywords', keywords: [['14:15']], label: 'Время UTC:', placeholder: 'ЧЧ:ММ' },
      hints: ['`cat ~/tickets/ZD-5202.txt` — ищи «PM CET».', '3:15 PM = 15:15. CET = UTC+1, значит UTC = 15:15 − 1 час.'],
      solution: 'cat ~/tickets/ZD-5202.txt\ncat ~/notes/timezones.txt',
      explanation: '15:15 CET = 14:15 UTC (4 ноября). В логах ищем запросы заказа 1062 около 14:15.',
    },
    {
      id: 'almaty',
      prompt: 'Тикет `~/tickets/ZD-5203.txt` (на русском): клиентка из Казахстана называет время по Астане. Сколько это **по UTC**? (`ЧЧ:ММ`)',
      answer: { accept: ['04:40', '4:40', '04:40 UTC', '4:40 UTC', '04:40 utc'], label: 'Время UTC:', placeholder: 'ЧЧ:ММ' },
      hints: ['Казахстан — UTC+5.', '09:40 − 5 часов = …'],
      solution: 'cat ~/tickets/ZD-5203.txt\ngrep -i astana ~/notes/timezones.txt\n# 09:40 по Астане (UTC+5) = 04:40 UTC',
    },
    {
      id: 'har',
      prompt: 'В том же тикете ZD-5203 страница оплаты «бесконечно грузится». Какой **файл из DevTools** попросить у клиентки, чтобы увидеть все сетевые запросы страницы? (название, 3 буквы)',
      answer: { accept: ['HAR'], normalize: 'keywords', keywords: [['har']], label: 'Файл:' },
      hints: ['Он записывается на вкладке Network.', 'HTTP Archive → сокращение из 3 букв.'],
      solution: 'cat ~/tickets/ZD-5203.txt',
      explanation: 'HAR-файл покажет, какой запрос висит или падает. Скриншот тут мало поможет: на нём будет просто крутилка.',
    },
    {
      id: 'ask-noah',
      prompt: 'Тикет `~/tickets/ZD-5201.txt`: *«Your site doesn\'t work!!!»*. Напиши клиенту **на английском** вежливое письмо с **одним списком вопросов**: шаги (что делал, какая страница), скриншот, время **с часовым поясом**, браузер/устройство. Начни с приветствия и сочувствия, закончи вежливо.',
      write: {
        lang: 'en',
        minWords: 25,
        rows: 11,
        template: 'Hi Noah,\n\n\n1. \n2. \n3. \n4. \n\nBest regards,\n',
        rubric: [
          { label: 'приветствие', any: GREETING },
          { label: 'благодарность или сочувствие', any: EMPATHY },
          { label: 'шаги / что делал / какая страница', any: ['\\bsteps?\\b', 'what (did you|you did|happened|were you)', 'reproduc', 'which page', 'what page', 'which button'] },
          { label: 'скриншот или видео', any: ['screen ?shot', 'screen recording', 'screen ?cast', '\\bvideo\\b', '\\bphoto\\b', 'picture'] },
          { label: 'время с часовым поясом', any: ['time ?zone', '\\butc\\b', 'your local time'] },
          { label: 'браузер или устройство', any: ['browser', 'device', 'chrome', 'safari', 'firefox', '\\bphone\\b', 'computer', 'laptop', '\\bapp\\b'] },
          { label: 'вежливая просьба (please / could you)', any: ['\\bplease\\b', 'could you', 'can you', 'would you'] },
          { label: 'вежливое завершение', any: CLOSING },
          { label: 'без обвинения клиента', none: NO_BLAME },
        ],
      },
      hints: [
        'Начало: *Thank you for your message, and I\'m sorry that the site does not work for you.*',
        'Список: *1. What steps did you take? 2. Could you send a screenshot? 3. What time did it happen, and in which time zone? 4. Which browser do you use?*',
        'Объясни зачем: *This will help us find the problem faster.*',
      ],
      solution: `Hi Noah,

Thank you for your message, and I'm sorry that the site does not work for you.
To find the problem faster, could you please send us:
1. What steps did you take, and what happened? Which page did you open?
2. A screenshot of the error.
3. What time did it happen, and in which time zone?
4. Which browser and device do you use?

Thank you! I will check it as soon as I get your answer.
Best regards,
Alibek`,
    },
  ],
  quiz: [
    {
      id: 'q-screenshot',
      type: 'text',
      prompt: 'Переведи: *Could you please send us a screenshot of the error?*',
      answer: { accept: ['Пришлите, пожалуйста, скриншот ошибки'], normalize: 'keywords', keywords: [['пришл', 'отправ', 'скин', 'присла', 'вышл'], ['скриншот', 'снимок', 'скрин']] },
      explanation: '«Пришлите, пожалуйста, скриншот ошибки».',
    },
    {
      id: 'q-har',
      type: 'text',
      prompt: 'Что внутри HAR-файла? (одной фразой)',
      answer: { accept: ['сетевые запросы страницы'], normalize: 'keywords', keywords: [['запрос', 'request', 'network', 'сеть', 'сетев', 'трафик']] },
      explanation: 'Все сетевые запросы страницы с вкладки Network: адреса, статусы, заголовки, время.',
    },
    {
      id: 'q-est',
      type: 'text',
      prompt: 'Клиент из Нью-Йорка: *«It happened at 9:00 AM EST»*. EST = UTC−5. Сколько это по UTC? (`ЧЧ:ММ`)',
      answer: { accept: ['14:00', '14:00 UTC', '14:00 utc', '14.00'] },
      explanation: 'UTC = местное − смещение = 09:00 − (−5) = 14:00 UTC.',
    },
    {
      id: 'q-time-question',
      type: 'choice',
      prompt: 'Как лучше спросить клиента о времени ошибки?',
      options: ['When?', 'What time did it happen, and in which time zone?', 'Please describe the problem in detail.'],
      correct: 1,
      explanation: 'Без часового пояса «в 3 часа» может значить что угодно — логи у нас в UTC.',
    },
  ],
  glossary: [
    { ru: 'Шаги воспроизведения', en: 'steps to reproduce (repro steps)', def: 'Что сделать по порядку, чтобы получить ту же ошибку.' },
    { ru: 'Ожидаемый / фактический результат', en: 'expected / actual result', def: 'Что должно было произойти и что произошло на самом деле.' },
    { ru: 'HAR-файл', en: 'HAR (HTTP Archive)', def: 'Запись всех сетевых запросов страницы из DevTools → Network.' },
    { ru: 'Часовой пояс', en: 'time zone', def: 'Смещение от UTC: CET = UTC+1, Астана = UTC+5.' },
    { ru: 'Ожидание ответа клиента', en: 'Pending', def: 'Статус тикета: ждём данные от клиента.' },
  ],
};
export default lesson;
