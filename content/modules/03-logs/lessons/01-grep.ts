import type { LessonDef } from '../../../../src/content/types';

const app: string[] = [];
const levels = ['INFO', 'INFO', 'INFO', 'DEBUG', 'INFO', 'WARN', 'INFO', 'error', 'INFO', 'INFO', 'ERROR', 'INFO'];
for (let i = 0; i < 180; i++) {
  const lvl = levels[i % levels.length];
  const t = `2026-11-04 13:${String(Math.floor(i / 3)).padStart(2, '0')}:${String((i % 3) * 20).padStart(2, '0')}`;
  const msg =
    lvl === 'ERROR' ? `payment failed user_id=${8800 + (i % 5)} reason="card declined"` :
    lvl === 'error' ? `cache miss storm key=product:${i}` :
    lvl === 'WARN' ? `slow request path=/api/search took=${900 + i}ms` :
    i % 10 === 0 ? 'GET /health 200' : `request ok path=/api/products/${i} user_id=${8800 + (i % 7)}`;
  app.push(`${t} ${lvl.padEnd(5)} ${msg}`);
}
app.splice(150, 0, '2026-11-04 13:50:05 FATAL OutOfMemoryError: Java heap space');
const log = app.join('\n') + '\n';
const lines = log.trim().split('\n');
const errCi = lines.filter((l) => /error/i.test(l.split(' ')[2] ?? '')).length;
const errAny = lines.filter((l) => /error/i.test(l)).length;
const health = lines.filter((l) => l.includes('/health')).length;
const fatalLine = lines.findIndex((l) => l.includes('FATAL')) + 1;
const u8812 = lines.filter((l) => l.includes('user_id=8802') && l.includes('ERROR')).length;

const lesson: LessonDef = {
  id: 'grep',
  title: 'grep и его флаги',
  minutes: 25,
  commands: ['grep'],
  scenario: { files: { '/var/log/app/app.log': log } },
  tasks: [
    {
      id: 'ci',
      prompt: 'В логе `/var/log/app/app.log` ошибки пишутся то как `ERROR`, то как `error`. Посчитай **все строки**, где встречается слово error в любом регистре. Выведи число.',
      check: { type: 'outputNumber', value: errAny },
      hints: ['Нужны два флага: без учёта регистра и подсчёт.', '`grep -ic error /var/log/app/app.log`'],
      solution: 'grep -ic error /var/log/app/app.log',
      explanation: `\`-i\` — ignore case, \`-c\` — count. Без \`-i\` ты бы пропустил часть ошибок. (Уровней ERROR/error здесь ${errCi}, остальные — OutOfMemoryError в строке FATAL.)`,
      tags: ['grep'],
    },
    {
      id: 'fatal',
      prompt: 'Найди строку с уровнем **FATAL** и выведи её **с номером строки**.',
      check: { type: 'all', checks: [{ type: 'outputContains', value: `${fatalLine}:` }, { type: 'outputContains', value: 'OutOfMemoryError' }] },
      hints: ['Номера строк — флаг `-n`.'],
      solution: 'grep -n FATAL /var/log/app/app.log',
      tags: ['grep'],
    },
    {
      id: 'no-health',
      prompt: 'Health-check запросы (`/health`) засоряют лог. Сколько строк останется, если их **исключить**? Выведи число одной командой.',
      check: { type: 'outputNumber', value: lines.length - health },
      hints: ['Инвертированный поиск — `-v`.', 'Можно совместить: `grep -vc /health файл`.'],
      solution: 'grep -vc /health /var/log/app/app.log',
      tags: ['grep'],
    },
    {
      id: 'user',
      prompt: 'Пользователь с `user_id=8802` жалуется на оплату. Сколько у него строк уровня `ERROR` (заглавными)? Введи число.',
      answer: { accept: [String(u8812)], normalize: 'number', label: 'Ошибок:' },
      hints: ['Два фильтра через пайп: сначала пользователь, потом ERROR.', '`grep user_id=8802 /var/log/app/app.log | grep -c ERROR`'],
      solution: 'grep user_id=8802 /var/log/app/app.log | grep -c ERROR',
      tags: ['grep'],
    },
  ],
  quiz: [
    {
      id: 'q-invert',
      type: 'text',
      prompt: 'Какой флаг grep выводит строки, которые **не** содержат шаблон?',
      answer: { accept: ['-v', 'v', '--invert-match'] },
      explanation: '`-v` — invert match.',
    },
    {
      id: 'q-count-cmd',
      type: 'command',
      prompt: 'Напиши команду, которая посчитает строки со словом `WARN` в `/var/log/app/app.log`.',
      scenario: { files: { '/var/log/app/app.log': log } },
      solution: 'grep -c WARN /var/log/app/app.log',
      explanation: 'Подойдёт и `grep WARN файл | wc -l` — проверка смотрит на результат.',
    },
    {
      id: 'q-context',
      type: 'text',
      prompt: 'Какой флаг grep покажет 5 строк **после** каждого совпадения (например, чтобы увидеть стек-трейс)? Запиши флаг с числом.',
      answer: { accept: ['-A 5', '-A5', '--after-context=5'], normalize: 'exact' },
      explanation: '`-A 5` (after). `-B` — before, `-C` — context вокруг.',
    },
    {
      id: 'q-exit',
      type: 'text',
      prompt: 'Какой код выхода возвращает grep, если **ничего не нашёл**?',
      answer: { accept: ['1'], normalize: 'number' },
      explanation: '0 — найдено, 1 — не найдено, 2 — ошибка.',
    },
    {
      id: 'q-word',
      type: 'choice',
      prompt: 'Ты ищешь HTTP-статус 500 командой `grep 500 access.log`, но получаешь лишние строки с «15003 bytes». Как точнее?',
      options: ['grep -i 500', 'grep -w 500 или grep " 500 "', 'grep -c 500'],
      correct: 1,
      explanation: '`-w` — только целое слово; или добавь пробелы вокруг в кавычках.',
    },
  ],
  glossary: [
    { ru: 'Регулярное выражение', en: 'regular expression, regex', def: 'Шаблон поиска текста со спецсимволами.' },
    { ru: 'Без учёта регистра', en: 'case-insensitive', def: 'ERROR и error считаются одинаковыми.' },
    { ru: 'Код выхода', en: 'exit code / exit status', def: 'Число, которое команда возвращает по завершении: 0 — успех.' },
  ],
};
export default lesson;
