import type { LessonDef } from '../../../../../src/content/types';
import { hm, ticketFiles, timeAccept, toMin, type TicketSpec } from '../data';

const REQ = 'req_8f2c41';
const ERR = 'REFUND_EXCEEDS_CAPTURED';
const LOCAL_TIME = '14:14'; // Тбилиси, UTC+4
const UTC_TIME = hm(toMin(LOCAL_TIME) - 4 * 60);

const tickets: TicketSpec[] = [
  {
    id: 'ZD-2301',
    created: '2026-11-04 10:20',
    customer: 'Tbilisi Wine House',
    plan: 'Standard',
    requester: 'nino@tbilisiwine.ge',
    subject: 'Не получается сделать возврат покупателю',
    status: 'Open',
    priority: 'P3',
    assignee: 'L2',
    body: `[Customer, 10:20 UTC] Кнопка «Вернуть деньги» не работает!
[L1, 10:31 UTC] Здравствуйте, Нино! Пришлите, пожалуйста, номер заказа, время ошибки и скриншот окна с ошибкой.
[Customer, 10:52 UTC] Заказ #5521, хотела вернуть покупателю 120 GEL. Ошибка была около ${LOCAL_TIME} по Тбилиси.
Пишет «Что-то пошло не так». Внизу окна мелко: Request ID: ${REQ}
Браузер Chrome 130, Windows 11. Пробовала два раза — одно и то же.`,
  },
  {
    id: 'ZD-2305',
    created: '2026-11-04 11:05',
    customer: 'Almaty Books',
    plan: 'Standard',
    requester: 'dana@almatybooks.kz',
    subject: 'Отчёты не работают!!!',
    status: 'New',
    assignee: 'L2',
    body: 'Отчёты опять не работают, сделайте что-нибудь!!!',
  },
];

const log = `2026-11-04T10:13:58Z INFO  request_id=req_8f2a10 store=berlin-coffee method=GET path=/admin/orders status=200
2026-11-04T10:14:01Z INFO  request_id=req_8f2c39 store=warsaw-bikes method=GET path=/admin/products status=200
2026-11-04T10:14:02Z INFO  request_id=${REQ} store=tbilisi-wine method=POST path=/admin/orders/5521/refund amount=120.00
2026-11-04T10:14:02Z ERROR request_id=${REQ} store=tbilisi-wine status=422 error=${ERR} msg="refund 120.00 GEL > captured 95.00 GEL"
2026-11-04T10:15:40Z INFO  request_id=req_8f3001 store=nomad-outdoor method=GET path=/admin/products status=200
2026-11-04T10:16:11Z ERROR request_id=req_8f3107 store=nomad-outdoor status=500 error=SYNC_TIMEOUT msg="1C export timeout"
2026-11-04T10:18:30Z INFO  request_id=req_8f3302 store=tbilisi-wine method=GET path=/admin/orders/5521 status=200
`;

const scenario = {
  files: {
    ...ticketFiles('tickets', tickets),
    '/var/log/shopflow/app.log': log,
  },
};

const lesson: LessonDef = {
  id: 'reproduce',
  title: 'Воспроизведение и сбор данных',
  minutes: 25,
  commands: ['cat', 'grep'],
  scenario,
  tasks: [
    {
      id: 'request-id',
      prompt: 'В тикете **ZD-2301** клиентка уже прислала данные. Найди в тикете **request id** ошибки и введи его.',
      answer: { accept: [REQ, `Request ID: ${REQ}`, REQ.replace('req_', ''), `request_id=${REQ}`], label: 'Request id:', placeholder: 'req_...' },
      hints: ['`cat ~/tickets/ZD-2301.txt` — читай переписку целиком.', 'Или сразу: `grep -i "request" ~/tickets/ZD-2301.txt` (`-i` — без учёта регистра).'],
      solution: 'grep -i "request" ~/tickets/ZD-2301.txt',
      explanation: `Request id \`${REQ}\` — уникальный идентификатор запроса. По нему в логах находится именно этот запрос.`,
      tags: ['grep'],
    },
    {
      id: 'utc',
      prompt: `Клиентка пишет, что ошибка была «около ${LOCAL_TIME} по Тбилиси». Тбилиси — UTC+4. Какое это время по **UTC** (так пишут логи)? Введи ЧЧ:ММ.`,
      answer: { accept: timeAccept(UTC_TIME), label: 'Время (UTC):', placeholder: 'ЧЧ:ММ' },
      hints: ['UTC+4 — на 4 часа впереди UTC. Чтобы получить UTC, отними 4 часа.'],
      solution: `# ${LOCAL_TIME} (UTC+4) − 4 ч = ${UTC_TIME} UTC`,
      explanation: `${LOCAL_TIME} − 4 ч = **${UTC_TIME} UTC**. Именно это время ищем в логах: \`2026-11-04T${UTC_TIME}:..Z\`.`,
    },
    {
      id: 'log-lines',
      prompt: `Выведи из лога \`/var/log/shopflow/app.log\` **все строки этого запроса** (${REQ}) — и только их.`,
      check: {
        type: 'all',
        checks: [
          { type: 'outputContains', value: [`request_id=${REQ} store=tbilisi-wine method=POST`, `error=${ERR}`] },
          { type: 'outputNotContains', value: ['req_8f2a10', 'req_8f2c39', 'req_8f3001', 'req_8f3107', 'req_8f3302'] },
        ],
      },
      hints: ['Ищи по request id — он уникален.', `\`grep ${REQ} /var/log/shopflow/app.log\``],
      solution: `grep ${REQ} /var/log/shopflow/app.log`,
      explanation: 'Поиск по времени (`grep 10:14`) захватил бы и чужой запрос другого магазина в ту же секунду. Request id находит ровно нужные строки.',
      tags: ['grep'],
    },
    {
      id: 'error-code',
      prompt: 'Какой **код ошибки** (поле `error=`) вернул сервер на этот запрос? Введи его.',
      answer: { accept: [ERR, `error=${ERR}`, 'refund exceeds captured', 'refund_exceeds_captured'], label: 'Код ошибки:' },
      hints: ['Смотри строку с уровнем `ERROR` из предыдущего задания.', 'Значение после `error=`.'],
      solution: `grep ${REQ} /var/log/shopflow/app.log | grep ERROR`,
      explanation: `\`${ERR}\` — «сумма возврата больше списанной»: клиентка вернула бы 120 GEL, а покупатель заплатил 95 GEL. Это не баг — система права. L2 объясняет это клиенту, эскалировать в L3 не нужно.`,
      tags: ['grep'],
    },
    {
      id: 'ask-info',
      prompt: 'Тикет **ZD-2305** от Almaty Books: «Отчёты опять не работают, сделайте что-нибудь!!!» — данных нет совсем. Напиши клиенту **одно письмо** на русском, в котором вежливо попросишь всё нужное: какой отчёт и что именно делали (шаги), когда это было (время), скриншот или текст ошибки, браузер или устройство.',
      write: {
        lang: 'ru',
        minWords: 30,
        rows: 10,
        template: 'Здравствуйте!\n\nЧтобы быстро разобраться, пришлите, пожалуйста:\n1. \n2. \n3. \n4. \n\nС уважением,\n',
        rubric: [
          { label: 'приветствие', any: ['здравствуйте', 'добр(ый|ое|ого) (день|вечер|утро|утра|дня)', 'привет'] },
          { label: 'какой отчёт и что делали (шаги)', any: ['шаг', 'какой (именно )?отч[её]т', 'какие (именно )?действия', 'что (именно )?(вы )?(делал|нажима|выбира)', 'последовательност', 'как (вы )?(строите|формируете|открываете|запускаете)'] },
          { label: 'когда это было (время)', any: ['врем', 'когда', 'во сколько', 'час(овой|овом|ового)? пояс', 'дат[ауы]'] },
          { label: 'скриншот или текст ошибки', any: ['скриншот', 'скрин', 'снимок экрана', 'текст ошибки', 'сообщени[ея] об ошибке', 'текст сообщения', 'request ?id'] },
          { label: 'браузер или устройство', any: ['браузер', 'устройств', 'chrome', 'компьютер', 'телефон', 'приложени'] },
          { label: 'вежливое завершение', any: ['спасибо', 'с уважением', 'благодар', 'хорошего дня'] },
        ],
      },
      hints: ['Список из 4–5 пунктов читать проще, чем абзац.', 'Объясни, зачем нужны данные: «чтобы найти вашу ошибку в логах».', 'Не забудь приветствие и подпись.'],
      solution: `Здравствуйте, Дана!

Спасибо, что написали. Чтобы быстро найти причину, пришлите, пожалуйста:
1. Какой именно отчёт не строится и какие шаги вы делаете (что выбираете и нажимаете).
2. Когда это было в последний раз — примерное время и ваш часовой пояс.
3. Скриншот экрана с ошибкой или её точный текст.
4. Каким браузером и устройством вы пользуетесь.

С уважением,
Алибек, ShopFlow Support`,
      tags: ['write'],
    },
  ],
  quiz: [
    {
      id: 'q-expected',
      type: 'text',
      prompt: 'В описании бага рядом с «фактическим результатом» (actual result) пишут ещё «… результат». Какой? (по-русски или по-английски)',
      answer: { accept: ['ожидаемый', 'ожидаемый результат', 'expected', 'expected result'] },
      explanation: '**Expected result** (ожидаемый) против **actual result** (фактический) — так L3 сразу видит, в чём расхождение.',
    },
    {
      id: 'q-z',
      type: 'text',
      prompt: 'В логе время записано как `2026-11-04T10:14:02Z`. В каком часовом поясе это время? (аббревиатура)',
      answer: { accept: ['UTC', 'GMT', 'UTC+0', 'zulu', 'Z'] },
      explanation: 'Буква **Z** (Zulu) на конце = **UTC**.',
    },
    {
      id: 'q-why-reqid',
      type: 'choice',
      prompt: 'Почему request id ценнее, чем «ошибка была около 14:14»?',
      options: ['Request id короче', 'По request id в логах находится ровно этот запрос, а в одну минуту могут быть тысячи чужих запросов', 'Время клиент всегда пишет неправильно'],
      correct: 1,
      explanation: 'Request id уникален: одна команда `grep` — и перед тобой именно запрос клиента со всеми деталями.',
    },
    {
      id: 'q-reproduce',
      type: 'text',
      prompt: 'Как по-английски называется раздел «шаги воспроизведения»? (три слова)',
      answer: { accept: ['steps to reproduce', 'steps to reproduce:', 'STR', 'repro steps', 'reproduction steps'] },
      explanation: '**Steps to reproduce** (иногда коротко STR или repro steps).',
    },
  ],
  glossary: [
    { ru: 'Воспроизвести', en: 'reproduce', def: 'Повторить ошибку самому по шагам клиента.' },
    { ru: 'Шаги воспроизведения', en: 'steps to reproduce', def: 'Последовательность действий, при которой ошибка повторяется.' },
    { ru: 'Ожидаемый / фактический результат', en: 'expected / actual result', def: 'Что должно было произойти и что произошло на самом деле.' },
    { ru: 'Идентификатор запроса', en: 'request id', def: 'Уникальная строка запроса; по ней запрос находится во всех логах.' },
    { ru: 'Часовой пояс', en: 'time zone', def: 'Смещение местного времени от UTC: Астана UTC+5, Тбилиси UTC+4.' },
  ],
};
export default lesson;
