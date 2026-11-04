import type { LessonDef } from '../../../../src/content/types';

const appLog = `2026-11-04T09:00:01Z INFO  request_id=7f1a status=200 path=/api/orders tenant=acme
2026-11-04T09:00:07Z INFO  request_id=7f1b status=200 path=/api/orders tenant=globex
2026-11-04T09:01:12Z ERROR request_id=9c2e status=500 path=/api/invoices tenant=acme msg="pdf renderer timeout"
2026-11-04T09:01:13Z INFO  request_id=7f1c status=200 path=/api/orders tenant=acme
2026-11-04T09:02:40Z ERROR request_id=9c31 status=500 path=/api/invoices tenant=acme msg="pdf renderer timeout"
2026-11-04T09:03:05Z INFO  request_id=7f1d status=200 path=/api/users tenant=initech
`;

const lesson: LessonDef = {
  id: 'tickets',
  title: 'Тикет-культура и коммуникация',
  minutes: 25,
  commands: ['grep', 'echo', 'cat'],
  scenario: { files: { '/var/log/app/app.log': appLog, '/home/alibek/escalation.md': { owner: 'alibek', content: '# Escalation: invoices 500 for ACME\n' } } },
  tasks: [
    {
      id: 'request-ids',
      prompt: 'Клиент ACME жалуется, что не скачиваются счета (invoices). Найди в `/var/log/app/app.log` все строки с ошибками для этого клиента.',
      check: { type: 'all', checks: [{ type: 'outputContains', value: ['9c2e', '9c31'] }, { type: 'outputNotContains', value: '7f1a' }] },
      hints: ['Ошибки помечены словом `ERROR`.', 'Можно отфильтровать дважды через пайп: `grep ERROR файл | grep acme`.'],
      solution: 'grep ERROR /var/log/app/app.log | grep tenant=acme',
      tags: ['grep'],
    },
    {
      id: 'append',
      prompt: 'Допиши эти строки с ошибками в файл эскалации `~/escalation.md` (не затирая заголовок!). Используй перенаправление.',
      check: { type: 'fileContains', path: '/home/alibek/escalation.md', value: ['# Escalation: invoices 500 for ACME', 'request_id=9c2e', 'request_id=9c31'] },
      hints: ['`>` перезапишет файл, а `>>` допишет в конец.', '`grep ERROR /var/log/app/app.log >> ~/escalation.md`'],
      solution: 'grep ERROR /var/log/app/app.log | grep tenant=acme >> ~/escalation.md',
      explanation: 'Перенаправление `>>` дописывает в конец файла. Одиночный `>` стёр бы заголовок — частая ошибка, которая стоит потерянных заметок.',
      tags: ['grep'],
    },
    {
      id: 'next-update',
      prompt: 'Добавь в `~/escalation.md` строку `Next update: 10:00 UTC` — клиент всегда должен знать, когда ждать новостей.',
      check: { type: 'fileContains', path: '/home/alibek/escalation.md', value: ['Next update: 10:00 UTC', '# Escalation'] },
      hints: ['Команда `echo "текст"` печатает текст.', '`echo "Next update: 10:00 UTC" >> ~/escalation.md`'],
      solution: 'echo "Next update: 10:00 UTC" >> ~/escalation.md',
    },
  ],
  quiz: [
    {
      id: 'q-utc',
      type: 'text',
      prompt: 'В какой временной зоне лучше всего указывать время в тикетах международной команды? (аббревиатура)',
      answer: { accept: ['UTC', 'gmt', 'utc+0'] },
      explanation: '**UTC** — общий знаменатель для команд в разных часовых поясах.',
    },
    {
      id: 'q-redirect',
      type: 'text',
      prompt: 'Каким оператором дописать вывод команды в конец файла, не стирая содержимое?',
      answer: { accept: ['>>'], normalize: 'exact' },
      explanation: '`>>` — append (дописать). `>` — перезаписать.',
    },
    {
      id: 'q-eta',
      type: 'text',
      prompt: 'Какая английская аббревиатура означает «ожидаемое время» (готовности фикса, прибытия)? (3 буквы)',
      answer: { accept: ['ETA'] },
      explanation: '**ETA — estimated time of arrival**. В поддержке: «ETA for the fix is 15:00 UTC».',
    },
    {
      id: 'q-public',
      type: 'choice',
      prompt: 'Что из этого НЕ стоит отправлять клиенту в публичном ответе?',
      options: ['Время следующего апдейта', 'Имя упавшего сервера и внутренние IP из логов', 'Описание обходного пути'],
      correct: 1,
      explanation: 'Внутренние детали инфраструктуры — только во **internal note**.',
    },
  ],
  glossary: [
    { ru: 'Внутренняя заметка', en: 'internal note', def: 'Комментарий в тикете, видимый только команде.' },
    { ru: 'Публичный ответ', en: 'public reply', def: 'Сообщение, которое видит клиент.' },
    { ru: 'Ожидаемое время', en: 'ETA, estimated time of arrival', def: 'Оценка, когда будет результат.' },
    { ru: 'Идентификатор запроса', en: 'request id / correlation id', def: 'Уникальный id запроса, по которому его можно найти во всех логах.' },
  ],
};
export default lesson;
