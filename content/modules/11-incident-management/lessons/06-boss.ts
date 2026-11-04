import type { LessonDef } from '../../../../src/content/types';
import type { Scenario } from '../../../../src/shell/types';
import { IC, NEXT_UPDATE, scenario as base, UTC_TIME } from '../data';

const mails: string[] = [];
let failed = 0;
for (let m = 0; m < 100; m++) {
  const h = 9 + Math.floor((m + 5) / 60);
  const mm = (m + 5) % 60;
  const t = `2026-11-07T${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`;
  // ошибки с 09:15 до 10:11 включительно: в 10:12 секрет обновлён и письма снова уходят (как в timeline.md)
  const bad = m >= 10 && m < 67;
  if (bad) failed++;
  mails.push(`${t} mailer type=${m % 3 === 0 ? 'password_reset' : 'order_confirmation'} to=user${m}@mail.kz status=${bad ? 'failed error="535 5.7.8 Authentication credentials invalid"' : 'sent'}`);
}

const scenario: Scenario = {
  files: {
    ...base.files,
    '/home/alibek/inc2/alerts.log': { owner: 'alibek', content: '2026-11-07T09:20:00Z FIRING MailerDeliveryFailures severity=page value=100% service=mailer\n2026-11-07T10:24:00Z RESOLVED MailerDeliveryFailures\n' },
    '/home/alibek/inc2/mailer.log': { owner: 'alibek', content: mails.join('\n') + '\n' },
    '/home/alibek/inc2/changes.log': { owner: 'alibek', content: '2026-11-07T09:00:00Z CHG-904 rotate SMTP credentials (security policy, quarterly) — done by infra\n2026-11-06T16:00:00Z CHG-899 mailer 2.4.1 release\n' },
    '/home/alibek/inc2/timeline.md': {
      owner: 'alibek',
      content: '# INC-8200 (UTC)\n09:00 infra ротировала пароль SMTP (CHG-904)\n09:15 первые ошибки отправки писем\n09:20 алерт MailerDeliveryFailures\n09:40 L3 подключился, объявлен инцидент\n10:05 причина: mailer использует старый пароль из секрета\n10:12 секрет обновлён, mailer перезапущен, письма уходят\n10:18 переотправлены письма из очереди за 09:15–10:12\n10:30 инцидент закрыт\n',
    },
  },
};

export const MAIL_FAILED = failed;

const lesson: LessonDef = {
  id: 'boss',
  kind: 'boss',
  title: 'Ты — Incident Commander',
  minutes: 45,
  incident: { ticket: 'INC-8200: «Не приходят письма подтверждения и сброса пароля»', severity: 'SEV2', customer: 'все клиенты' },
  commands: ['grep', 'cat', 'sort', 'uniq'],
  scenario,
  tasks: [
    {
      id: 'impact',
      prompt: 'Сколько писем **не отправлено** по `~/inc2/mailer.log`? Выведи число командой.',
      check: { type: 'outputNumber', value: failed },
      hints: ['`grep -c status=failed ~/inc2/mailer.log`'],
      solution: 'grep -c status=failed ~/inc2/mailer.log',
      tags: ['grep'],
    },
    {
      id: 'declare',
      prompt: 'Выбери severity по матрице `~/incident/severity.md` (письма не уходят никому, сброс пароля не работает, но покупки идут) и **объяви** инцидент в `#incidents` (EN): severity, impact, start time UTC, IC, канал, next update.',
      write: {
        lang: 'en',
        minWords: 25,
        template: 'SEV? declared: \nImpact: \nIC: \nChannel: \nNext update: ',
        rubric: [
          { label: 'severity', any: ['\\bSEV[\\s-]?[1-4]\\b'] },
          { label: 'impact: письма / email', any: ['impact[ \\t]*:[^\\n]*(email|mail|password|notification)', '(email|mail)s?[^\\n]*(not|fail|undeliver)'] },
          { label: 'время начала UTC', any: UTC_TIME },
          { label: 'IC', any: IC },
          { label: 'канал', any: ['#[\\w-]+'] },
          { label: 'next update', any: NEXT_UPDATE },
        ],
      },
      hints: ['Severity: покупки и оплата работают, а письма и сброс пароля — нет. Это серьёзная деградация, но не полная недоступность ключевой функции — обычно SEV2 (SEV1 тоже можно обосновать).', 'Начало — первые ошибки в логе (09:15 UTC).', 'Формат как в уроке «Триаж».'],
      solution: 'SEV2 declared: transactional emails are not delivered\nImpact: 100% of order confirmation and password reset emails fail since 09:15 UTC; users cannot reset passwords.\nIC: @alibek\nChannel: #inc-8200\nNext update: 10:10 UTC',
    },
    {
      id: 'cause',
      prompt: 'Найди причину: какая **ошибка SMTP** в логе (код из трёх цифр) и какое **изменение** в `~/inc2/changes.log` случилось прямо перед этим? Введи номер изменения (CHG-…).',
      answer: { accept: [], normalize: 'keywords', keywords: [['904']], label: 'Изменение:' },
      hints: ['`grep failed ~/inc2/mailer.log | head -1` — код 535 (неверные учётные данные).', '`cat ~/inc2/changes.log`'],
      solution: 'cat ~/inc2/changes.log',
      explanation: 'Infra в 09:00 ротировала пароль SMTP (CHG-904), а mailer продолжил использовать старый из своего секрета → `535 Authentication credentials invalid`.',
    },
    {
      id: 'identified',
      prompt: 'Апдейт клиентам на стадии **Identified** (EN): что затронуто, причина найдена (без внутренних деталей вроде SMTP/CHG/паролей серверов), что делаете, что письма будут **отправлены повторно**, next update.',
      write: {
        lang: 'en',
        minWords: 25,
        rubric: [
          { label: 'identified / found the cause', any: ['identified', 'found the (cause|issue|problem|reason)', 'cause has been'] },
          { label: 'email / notifications', any: ['email', 'notification', 'password reset'] },
          { label: 'повторная отправка', any: ['re-?sen[dt]', 're-?deliver', 'will be (\\w+ )?(delivered|sent)', 'send .{0,40}again', 'retry'] },
          { label: 'next update', any: NEXT_UPDATE },
          { label: 'без внутренних деталей', none: ['smtp', 'chg-', 'credential', '535', '\\bsecrets?\\b', '\\binfra\\b'] },
        ],
      },
      hints: ['Причина простыми словами: «a configuration issue with our email provider integration».', 'Обещай повторную отправку писем, которые не дошли.'],
      solution: 'We have identified the cause of the delayed emails: a configuration issue with our email delivery integration. A fix is being applied now. Order confirmation and password reset emails that were not delivered will be resent automatically. Next update by 10:30 UTC.',
    },
    {
      id: 'mttr',
      prompt: 'Посчитай **MTTR** по `~/inc2/timeline.md`: от первых ошибок до момента, когда письма снова уходят (минут).',
      answer: { accept: ['57'], normalize: 'number', label: 'MTTR, мин:' },
      hints: ['09:15 → 10:12.'],
      solution: 'cat ~/inc2/timeline.md\n# 10:12 − 09:15 = 57 минут',
    },
    {
      id: 'summary',
      prompt: 'Напиши **Summary постмортема** (по-русски, 4–6 предложений) и **2+ action items** в формате `- [P1] … — owner: @… — due: ГГГГ-ММ-ДД`. В summary — окно в UTC, число неотправленных писем, причина, как восстановили.',
      write: {
        lang: 'ru',
        minWords: 60,
        rows: 12,
        template: 'Summary: \n\nAction items:\n- [P1]  — owner: @ — due: 2026-11-\n- [P2]  — owner: @ — due: 2026-11-',
        rubric: [
          { label: 'окно в UTC', any: ['\\d{1,2}:\\d{2}[^\\n]{0,20}\\d{1,2}:\\d{2}[^\\n]{0,10}UTC', '\\d{1,2}:\\d{2}\\s?UTC'] },
          { label: `число неотправленных писем (${failed})`, any: [`\\b${failed}\\b`] },
          { label: 'причина: ротация пароля / учётные данные', any: ['ротац', 'парол', 'учётн', 'учетн', 'credential', 'секрет'] },
          { label: 'восстановление: обновили секрет / переотправили', any: ['обнов', 'перезапуст', 'переотправ', 'повторн'] },
          { label: '2+ action items с owner и due', any: ['^-[^\\n]*owner:[ \\t]*@\\w+[^\\n]*due:[ \\t]*\\d{4}-\\d{2}-\\d{2}'], minMatches: 2 },
          { label: 'action item про процесс ротации (оповещение/автоматизация/проверка)', any: ['(ротац|rotation|смен\\S* парол|парол|секрет)[^\\n]*(автомат|оповещ|уведом|провер|чек-лист|vault|синхрон)', '(автомат|оповещ|уведом|провер|чек-лист|vault|синхрон)[^\\n]*(ротац|rotation|секрет|парол)'] },
          { label: 'без поиска виноватых', none: ['винова', 'накаж'] },
        ],
      },
      hints: [`Цифры: окно 09:15–10:12 UTC, ${failed} писем, MTTR 57 минут.`, 'Причина системная: ротация пароля в одной системе не синхронизирована с секретом mailer.', 'Action items: автоматическая синхронизация секретов при ротации (Vault), алерт на ошибки 535, проверка отправки после изменений.'],
      solution: `Summary: 7 ноября с 09:15 до 10:12 UTC не отправлялись письма подтверждения заказа и сброса пароля — ${failed} писем, затронуты все клиенты. Причина: плановая ротация пароля SMTP (CHG-904) не была синхронизирована с секретом сервиса mailer, который продолжал использовать старые учётные данные. Сервис восстановили, обновив секрет и перезапустив mailer, затем переотправили письма из очереди. MTTR — 57 минут.\n\nAction items:\n- [P1] Автоматическая синхронизация секрета mailer при ротации пароля через Vault — owner: @infra-team — due: 2026-11-21\n- [P2] Проверка отправки тестового письма в чек-листе ротации — owner: @alibek — due: 2026-11-14`,
    },
  ],
  quiz: [
    { id: 'q-cause-type', type: 'choice', prompt: 'К какому классу причин относится инцидент?', options: ['Баг в коде mailer', 'Изменение (change) в смежной системе без координации с зависимыми сервисами', 'Перегрузка сервера'], correct: 1, explanation: 'Большая доля инцидентов — следствие изменений. Поэтому первым делом смотрят журнал изменений.' },
    { id: 'q-first', type: 'text', prompt: 'Что L3 проверяет одним из первых при внезапном инциденте? (ключевые слова: изменения/changes/деплой)', answer: { accept: [], normalize: 'keywords', keywords: [['изменен', 'change', 'деплой', 'deploy', 'релиз', 'release']] }, explanation: '«Что поменялось?» — журнал изменений, деплои, конфиги.' },
    { id: 'q-comms', type: 'text', prompt: 'Почему во внешнем апдейте не пишут «SMTP 535, credentials rotated by infra»? (ключевые слова: клиенту непонятно/внутренние детали/безопасность)', answer: { accept: [], normalize: 'keywords', keywords: [['непонят', 'внутрен', 'безопасн', 'security', 'жаргон', 'деталь', 'клиент']] }, explanation: 'Клиенту это ничего не говорит, а детали о паролях и инфраструктуре — лишняя информация с точки зрения безопасности.' },
  ],
  glossary: [
    { ru: 'Ротация секретов', en: 'secret rotation', def: 'Плановая смена паролей и ключей.' },
    { ru: 'Журнал изменений', en: 'change log', def: 'Записи о плановых и экстренных изменениях системы.' },
  ],
};
export default lesson;
