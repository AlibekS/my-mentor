import type { LessonDef } from '../../../../src/content/types';

// ~ 1 из 3 оплат падает с 503 начиная с 12:20 UTC
const lines: string[] = [];
let n503 = 0;
for (let m = 0; m < 40; m++) {
  for (let k = 0; k < 3; k++) {
    const t = `2026-11-06T12:${String(m + 5).padStart(2, '0')}:${String(k * 17 + 3).padStart(2, '0')}Z`;
    const fail = m >= 15 && k === 1;
    if (fail) n503++;
    lines.push(`${t} ${fail ? 'ERROR' : 'INFO '} service=payment-gw status=${fail ? 503 : 200} tenant=mega-retail order=${100200 + m * 3 + k}${fail ? ' msg="upstream bank API unavailable"' : ''}`);
  }
}

export const BOSS1_ERRORS = n503;

const lesson: LessonDef = {
  id: 'boss',
  kind: 'boss',
  title: 'Пятничная эскалация',
  minutes: 35,
  incident: { ticket: 'TCK-1077: «Оплата не проходит у части покупателей во время распродажи»', severity: 'SEV2', customer: 'Mega Retail (Enterprise)' },
  commands: ['ls', 'cat', 'grep', 'echo'],
  scenario: {
    files: {
      '/home/alibek/tickets/TCK-1077.txt': {
        owner: 'alibek',
        content: `Ticket: TCK-1077
Customer: Mega Retail (Enterprise plan)
Created: 2026-11-06 12:40 UTC
Escalated to L3: 2026-11-06 12:42 UTC
Subject: Payments failing for part of shoppers during sale
Description: Around 1 of 3 payments fails with error "Payment provider unavailable". Shoppers can retry and sometimes succeed. Sale traffic x5.
Impact: ~30% of checkout attempts fail, revenue loss during sale. Workaround: retry.
Checked by L2: not related to customer config; reproduced on test order at 12:38 UTC.
`,
      },
      '/home/alibek/sla/policy.txt': {
        owner: 'alibek',
        content: 'P1 Critical: response 15m, resolve 4h\nP2 High: response 1h, resolve 8h\nP3 Medium: response 4h, resolve 3d\nP4 Low: response 1d, resolve planned\n',
      },
      '/var/log/payment/gateway.log': lines.join('\n') + '\n',
      '/home/alibek/escalation-TCK-1077.md': { owner: 'alibek', content: '# Escalation TCK-1077 → payments team\n' },
    },
  },
  tasks: [
    {
      id: 'read',
      prompt: 'Открой тикет в `~/tickets` и прочитай его. Какой процент попыток оплаты падает по оценке L2? Введи число.',
      answer: { accept: ['30'], normalize: 'number', label: 'Процент:' },
      hints: ['`ls ~/tickets`, затем `cat` нужного файла.', 'Ищи строку `Impact`.'],
      solution: 'cat ~/tickets/TCK-1077.txt',
    },
    {
      id: 'priority',
      prompt: 'Функция оплаты работает частично (≈30% отказов), есть обход — повторить попытку. Какой приоритет по матрице? Введи P1–P4.',
      answer: { accept: ['P2', 'p2', 'high', 'P2 high', 'P2 / high', 'P2/high', 'P2 (high)', 'P2 - high', 'P2 — high'], label: 'Приоритет:' },
      hints: ['Посмотри `~/sla/policy.txt` и описание приоритетов в теории босса.', 'Не полная недоступность, но важная функция и деньги — High.'],
      solution: 'cat ~/sla/policy.txt',
      explanation: 'Частичная деградация с обходом — **P2**. Если бы падали 100% оплат — P1. Многие компании поднимают приоритет для Enterprise-клиента во время пикового события — это нормально обсудить с дежурным менеджером.',
    },
    {
      id: 'deadline',
      prompt: 'Тикет создан в 12:40 UTC, приоритет P2. До какого времени (UTC) нужно дать **первый ответ** клиенту по SLA? Формат `ЧЧ:ММ`.',
      answer: { accept: [], normalize: 'keywords', keywords: [['13:40', '13.40', '1340']], label: 'Время UTC:' },
      hints: ['Найди в политике SLA время ответа (response) для P2.', '12:40 + 1 час.'],
      solution: 'grep P2 ~/sla/policy.txt\n# response 1h: 12:40 + 1:00 = 13:40 UTC',
    },
    {
      id: 'count',
      prompt: 'Подтверди проблему в логах `/var/log/payment/gateway.log`: посчитай, сколько оплат завершились статусом **503**. Выведи число командой.',
      check: { type: 'outputNumber', value: n503 },
      hints: ['Фильтруй по `status=503`.', '`grep -c status=503 /var/log/payment/gateway.log`'],
      solution: 'grep -c status=503 /var/log/payment/gateway.log',
      tags: ['grep'],
    },
    {
      id: 'since',
      prompt: 'Когда началась проблема? Выведи **первую** строку с ошибкой 503 (подсказка: пайп в `head -1`).',
      check: { type: 'all', checks: [{ type: 'outputContains', value: '12:20:20Z' }, { type: 'outputLines', value: 1 }] },
      hints: ['Сначала отфильтруй строки с 503, потом возьми первую.', '`grep status=503 /var/log/payment/gateway.log | head -1`'],
      solution: 'grep status=503 /var/log/payment/gateway.log | head -1',
      tags: ['grep'],
    },
    {
      id: 'escalate',
      prompt: 'Заполни эскалацию `~/escalation-TCK-1077.md`: добавь три строки, начинающиеся с `Impact:`, `Since:` и `Evidence:` (в Evidence — что говорит лог). Заголовок не затирай.',
      check: {
        type: 'custom',
        fn: (sh) => {
          const n = sh.fs.lookup('/home/alibek/escalation-TCK-1077.md');
          if (!n) return false;
          const c = n.content;
          // регистр и маркер списка («- Impact:») не важны; время — 12:20 или 12.20
          return c.startsWith('# Escalation TCK-1077') && /^[-*\s]*Impact:.+/im.test(c) && /^[-*\s]*Since:.*12[:.]20/im.test(c) && /^[-*\s]*Evidence:.+/im.test(c);
        },
      },
      hints: [
        'Каждую строку можно дописать отдельной командой `echo "..." >> файл`.',
        'В Since укажи время начала (12:20 UTC). В Evidence — например «503 upstream bank API unavailable».',
        'echo "Impact: ~30% payments fail" >> ~/escalation-TCK-1077.md',
      ],
      solution: `echo "Impact: ~30% of checkout payments fail (status 503), revenue loss during sale" >> ~/escalation-TCK-1077.md
echo "Since: 2026-11-06 12:20 UTC" >> ~/escalation-TCK-1077.md
echo "Evidence: gateway.log — status=503 msg=\\"upstream bank API unavailable\\"" >> ~/escalation-TCK-1077.md`,
      explanation: 'Такая эскалация не вернётся с вопросом «а что случилось?» — в ней симптом, влияние, время начала и доказательство.',
    },
  ],
  quiz: [
    {
      id: 'q-first',
      type: 'choice',
      prompt: 'Тикет P2 эскалирован на тебя в 12:42, клиент нервничает. Что сделать первым?',
      options: ['Молча расследовать, ответить, когда будет решение', 'Короткий ответ клиенту: подтверждаем проблему, следующий апдейт через 30 минут', 'Перевести тикет обратно на L2 за подробностями'],
      correct: 1,
      explanation: 'Сначала **коммуникация** (останавливает таймер ответа и снижает напряжение), затем расследование.',
    },
    {
      id: 'q-upstream',
      type: 'text',
      prompt: 'По логу, какая внешняя зависимость недоступна? (как в сообщении об ошибке, два-три слова)',
      answer: { accept: [], normalize: 'keywords', keywords: [['bank', 'банк'], ['api', 'апи']] },
      explanation: 'В логе: `upstream bank API unavailable` — проблема на стороне **банковского API** (upstream). Значит, параллельно нужно связаться с провайдером.',
    },
    {
      id: 'q-message',
      type: 'text',
      prompt: 'Напиши на английском первую фразу статус-апдейта: мы подтверждаем проблему и расследуем её. (Проверяются ключевые слова: confirm/aware и investigat…)',
      answer: { accept: [], normalize: 'keywords', keywords: [['confirm', 'aware', 'acknowledge'], ['investigat', 'looking into']] },
      explanation: 'Например: *We can confirm the issue with failing payments and are actively investigating. Next update within 30 minutes.*',
    },
  ],
  glossary: [
    { ru: 'Зависимость выше по цепочке', en: 'upstream dependency', def: 'Внешний сервис, от которого зависит наш (банк, платёжный провайдер, API).' },
    { ru: 'Статус-апдейт', en: 'status update', def: 'Регулярное сообщение о ходе работ над инцидентом.' },
  ],
};
export default lesson;
