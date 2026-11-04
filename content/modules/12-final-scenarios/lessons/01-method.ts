import type { LessonDef } from '../../../../src/content/types';

const lines: string[] = [];
let kazErr = 0;
for (let m = 0; m < 90; m++) {
  const t = `2026-11-05T09:${String(Math.floor(m / 1.5) % 60).padStart(2, '0')}:${String((m * 37) % 60).padStart(2, '0')}Z`;
  const tenant = ['kazlogistic', 'astana-retail', 'globex', 'initech', 'kazlogistic'][m % 5];
  if (tenant === 'kazlogistic' && m % 2 === 0) {
    kazErr++;
    lines.push(`${t} ERROR tenant=${tenant} request_id=r${7000 + m} POST /api/exports/bulk 403 msg="feature bulk_export is not enabled for this tenant"`);
  } else lines.push(`${t} INFO  tenant=${tenant} request_id=r${7000 + m} GET /api/orders 200`);
}

const dataset = `CREATE TABLE tenants (id INTEGER PRIMARY KEY, slug TEXT, plan TEXT, region TEXT, updated_at TEXT);
CREATE TABLE feature_flags (tenant_id INTEGER, flag TEXT, enabled INTEGER, updated_at TEXT, updated_by TEXT);
INSERT INTO tenants VALUES (1,'kazlogistic','enterprise','kz','2026-11-04 22:10:00'),(2,'astana-retail','enterprise','kz','2026-11-04 22:10:00'),(3,'globex','pro','eu','2026-09-01 10:00:00'),(4,'initech','enterprise','eu','2026-11-04 22:10:00'),(5,'umbrella','free','us','2026-07-12 10:00:00'),(6,'stark','enterprise','us','2026-03-02 10:00:00');
INSERT INTO feature_flags VALUES
 (1,'bulk_export',0,'2026-11-04 22:10:00','plan-migration-v2'),(1,'sso',1,'2026-05-01 10:00:00','admin'),
 (2,'bulk_export',0,'2026-11-04 22:10:00','plan-migration-v2'),(2,'sso',1,'2026-05-01 10:00:00','admin'),
 (3,'bulk_export',0,'2026-09-01 10:00:00','admin'),
 (4,'bulk_export',0,'2026-11-04 22:10:00','plan-migration-v2'),
 (6,'bulk_export',1,'2026-03-02 10:00:00','admin'),(6,'sso',1,'2026-03-02 10:00:00','admin');`;

const lesson: LessonDef = {
  id: 'method',
  title: 'Метод L3: жалоба одного клиента',
  minutes: 35,
  tools: ['terminal', 'sql'],
  commands: ['grep'],
  scenario: { files: { '/var/log/app/api.log': lines.join('\n') + '\n' } },
  sql: { dataset },
  tasks: [
    {
      id: 'count',
      prompt: 'Клиент **kazlogistic** (Enterprise) пишет: «массовый экспорт не работает с утра». Посчитай в `/var/log/app/api.log` его ошибки (`ERROR` для `tenant=kazlogistic`). Выведи число.',
      tool: 'terminal',
      check: { type: 'outputNumber', value: kazErr },
      hints: ['`grep tenant=kazlogistic /var/log/app/api.log | grep -c ERROR`'],
      solution: 'grep tenant=kazlogistic /var/log/app/api.log | grep -c ERROR',
      tags: ['grep'],
    },
    {
      id: 'msg',
      prompt: 'Что говорит ошибка? Введи **имя функции (feature flag)**, которая выключена для клиента.',
      tool: 'terminal',
      answer: { accept: ['bulk_export', 'bulk export', 'bulk-export'], label: 'Флаг:' },
      hints: ['`grep tenant=kazlogistic /var/log/app/api.log | grep ERROR | head -1`'],
      solution: 'grep ERROR /var/log/app/api.log | head -1',
    },
    {
      id: 'flags',
      prompt: 'Вкладка **SQL**. Выведи флаги клиента kazlogistic: `flag, enabled, updated_at, updated_by` (JOIN tenants → feature_flags по slug).',
      tool: 'sql',
      hints: ['`FROM feature_flags f JOIN tenants t ON t.id = f.tenant_id`', "`WHERE t.slug = 'kazlogistic'`"],
      solution: "SELECT f.flag, f.enabled, f.updated_at, f.updated_by FROM feature_flags f JOIN tenants t ON t.id = f.tenant_id WHERE t.slug = 'kazlogistic';",
    },
    {
      id: 'scope',
      prompt: 'Флаг выключила вчерашняя миграция тарифов (`updated_by = \'plan-migration-v2\'`). Масштаб: найди **всех Enterprise-клиентов**, у которых эта миграция выключила `bulk_export`. Выведи `slug`.',
      tool: 'sql',
      hints: ["Условия: `t.plan = 'enterprise' AND f.flag = 'bulk_export' AND f.enabled = 0 AND f.updated_by = 'plan-migration-v2'`."],
      solution: "SELECT t.slug FROM tenants t JOIN feature_flags f ON f.tenant_id = t.id WHERE t.plan = 'enterprise' AND f.flag = 'bulk_export' AND f.enabled = 0 AND f.updated_by = 'plan-migration-v2';",
      explanation: 'Затронуты 3 Enterprise-клиента, хотя пожаловался один. Проактивно сообщить остальным и исправить всех сразу — то, что отличает L3.',
    },
    {
      id: 'reply',
      prompt: 'Напиши ответ клиенту kazlogistic (EN): признай проблему, объясни простыми словами (функция отключилась после планового обновления тарифов), что вы восстанавливаете доступ, срок/следующий апдейт, извинение. Без внутренних имён (`plan-migration-v2`, таблицы, флаги в snake_case).',
      write: {
        lang: 'en',
        minWords: 35,
        rubric: [
          { label: 'признание проблемы', any: ['we (\\w+ )?confirm', "we('re| are) aware", 'thanks?( you)? for (reporting|reaching out|contacting|letting us know|your (message|report))', 'you are right', "we('ve| have) (identified|found|confirmed|reproduced)", 'sorry to hear'] },
          { label: 'объяснение простыми словами (update / change of plans)', any: ['(plan|subscription|pricing|tariff|billing).{0,40}(update|change|migration)', '(update|change|migration).{0,40}(plan|subscription|pricing|tariff|billing)'] },
          { label: 'что делаете (restore / re-enable)', any: ['restor', 're-?enabl', 'fixing', 'turn(ed|ing)? (it )?back on'] },
          { label: 'срок или следующий апдейт', any: ['\\d{1,2}:\\d{2}\\s?\\(?UTC', 'within (the next |an? |the )?(\\d+\\s*)?(min|minutes|mins|hours?|business day)\\b', '\\bin (\\d+|an?|half an)\\s*(min|minutes|mins|hours?)\\b', 'by \\d{1,2}:\\d{2}', 'next update', '(today|tomorrow|end of (the )?day)'] },
          { label: 'извинение', any: ['apolog', 'sorry'] },
          { label: 'без внутренних имён', none: ['plan-migration', 'bulk_export', 'feature_flags', 'tenant_id', 'updated_by'] },
        ],
      },
      hints: ['Структура: спасибо/подтверждаем → что случилось простыми словами → что делаем → когда → извинение.', '«Bulk export was unintentionally disabled for your account during a scheduled update of our subscription plans.»'],
      solution: 'Thank you for reporting this. We have identified the issue: bulk export was unintentionally disabled for your account during a scheduled update of our subscription plans yesterday. We are restoring access now and expect it to be available again within 30 minutes; we will confirm once it is done. We apologize for the inconvenience.',
    },
  ],
  quiz: [
    { id: 'q-fork', type: 'choice', prompt: 'Жалуется один клиент, у остальных всё работает. С чего логичнее начать?', options: ['Перезапустить все сервисы', 'Найти, чем этот клиент отличается: тариф, флаги, регион, интеграция, недавние изменения его конфигурации', 'Попросить клиента почистить кеш браузера'], correct: 1, explanation: 'Ищем отличие клиента от остальных.' },
    { id: 'q-steps', type: 'text', prompt: 'Какой шаг метода идёт **раньше** полного исправления — вернуть работу клиенту любой временной мерой? (одно слово)', answer: { accept: [], normalize: 'keywords', keywords: [['митиг', 'mitigat', 'workaround', 'обход', 'откат', 'rollback']] }, explanation: 'Митигация (workaround/откат) — до полного фикса.' },
    { id: 'q-repro', type: 'text', prompt: 'Какой вопрос себе стоит задать в первую очередь, прежде чем глубоко копать? (ключевое слово: воспроизвести)', answer: { accept: [], normalize: 'keywords', keywords: [['воспроизв', 'reproduce', 'repro']] }, explanation: '«Могу ли я воспроизвести?»' },
    { id: 'q-proactive', type: 'sql', prompt: "Выведи `slug` и `region` всех Enterprise-тенантов (`plan = 'enterprise'`) для проактивной проверки.", solution: "SELECT slug, region FROM tenants WHERE plan = 'enterprise';", explanation: "`SELECT slug, region FROM tenants WHERE plan = 'enterprise';`" },
  ],
  glossary: [
    { ru: 'Арендатор (клиент в SaaS)', en: 'tenant', def: 'Отдельная организация-клиент в мультиарендной системе.' },
    { ru: 'Флаг функции', en: 'feature flag', def: 'Переключатель, включающий функцию для части клиентов.' },
    { ru: 'Проактивная коммуникация', en: 'proactive communication', def: 'Сообщить затронутым клиентам до того, как они пожалуются.' },
  ],
};
export default lesson;
