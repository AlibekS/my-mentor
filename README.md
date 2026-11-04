# L3 Quest — тренажёр и ментор для роли L3 Support Engineer

Личный локальный сайт для подготовки к роли **L3 Support / Production Support Engineer**: тема → теория → практика в эмуляторе Linux прямо в браузере → мини-тест с ответами руками. XP, уровни, 8 рангов-аватаров (от стажёра в худи до кибер-самурая), ачивки, проценты освоения тем, интервальное повторение и **ментор на базе Claude**, который знает, где ты сейчас и что уже прошёл.

## Запуск

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm test           # тесты: эмулятор, движок, игра, целостность контента, промпт ментора
npm run build      # сборка в dist/ (npm run preview — посмотреть сборку с ментором)
```

При первом запуске — онбординг: опрос → адаптивный входной тест → «Твоя программа».

## Ментор (Claude)

Кнопка с пиксельным персонажем справа внизу. Ментор видит текущую страницу, урок, задание, сколько подсказок ты открыл, последние команды в терминале и их вывод, а также прогресс по всем темам. Он наводит на решение и **выдаёт готовый ответ только по явной просьбе** («покажи решение» — тогда за задание 0 XP, как и при кнопке «Показать решение»).

Как это работает: dev/preview-сервер Vite вызывает локальный **Claude Code CLI** (`claude -p`, без инструментов), поэтому используется твой вход в Claude Code:

1. Установи Claude Code: `npm install -g @anthropic-ai/claude-code`
2. Запусти `claude` и выполни `/login` — войди с подпиской **Pro** (или задай `ANTHROPIC_API_KEY`).
3. `npm run dev` — точка в шапке чата станет зелёной.

Без входа ментор работает в офлайн-режиме (по шаблонам: формулировка задания, подсказки, сводка прогресса). Настройки: `MENTOR_MODEL` — модель, `MENTOR_DISABLED=1` — выключить, `MENTOR_CLAUDE_BIN` — путь к `claude`. Эндпоинт принимает запросы только с localhost.

## Актуальность программы

- Раздел **«Рынок»** на сайте: что растёт, что стабильно, что падает (например, VMware), дата последней сверки и сверка каждого модуля. Через 90 дней данные помечаются устаревшими.
- Обновление — командой **`/refresh-curriculum`** в Claude Code в папке проекта: Claude ищет свежие вакансии (приоритет — последние 6 месяцев), обновляет `content/market/trends.json`, `reviewedAt`/`demand`/`importance` модулей, `docs/curriculum-sources.md`, предлагает новые уроки и коммитит.
- Обоснование текущей программы и источники: [`docs/curriculum-sources.md`](docs/curriculum-sources.md).

## Прогресс

Хранится в `localStorage` (ключ `l3quest.progress.v1`, схема с версией и миграциями в `src/game/progress.ts`). В профиле — экспорт/импорт JSON и сброс (с подтверждением).

## Структура

```
content/
  modules/<NN-slug>/module.json          метаданные модуля: важность, зависимости, навыки для опроса, спрос на рынке
  modules/<NN-slug>/lessons/NN-x.md       теория урока
  modules/<NN-slug>/lessons/NN-x.ts       задания, сценарий терминала, мини-тест, глоссарий (export default LessonDef)
  placement/<NN-slug>.ts                  банк входного теста по теме
  market/trends.json                      тренды рынка
  shared/logs.ts                          генераторы детерминированных логов
src/
  shell/        эмулятор: vfs.ts, parser.ts, shell.ts, commands/*.ts (каждая команда — отдельный модуль)
  engine/       проверки заданий (checks.ts), нормализация ответов, вопросы-команды
  game/         config.ts (все числа: XP, уровни, веса освоения, онбординг), levels, mastery, placement, unlock, achievements, review
  mentor/       виджет чата, контекст урока, офлайн-ответы
  pages/        Onboarding, PlanView, Home (карта), LessonPage, Profile, Reference, Review, Market
server/         Vite-плагин ментора + промпт
docs/           обоснование программы
.claude/commands/refresh-curriculum.md
```

## Как добавить урок

1. Создай `content/modules/<модуль>/lessons/06-my-lesson.md` (теория) и `06-my-lesson.ts`:

```ts
import type { LessonDef } from '../../../../src/content/types';

const lesson: LessonDef = {
  id: 'my-lesson',
  title: 'Название',
  minutes: 25,
  commands: ['grep'],
  scenario: { files: { '/var/log/app.log': 'ERROR x\nINFO y\n' } },   // окружение терминала
  tasks: [
    {
      id: 't1',
      prompt: 'Посчитай ошибки в `/var/log/app.log`.',
      check: { type: 'outputNumber', value: 1 },                     // проверка по результату
      hints: ['…', '…'],
      solution: 'grep -c ERROR /var/log/app.log',
    },
  ],
  quiz: [
    { id: 'q1', type: 'text', prompt: '…', answer: { accept: ['-c'] }, explanation: '…' },
  ],
};
export default lesson;
```

2. Число в начале имени файла задаёт порядок. «Босс» модуля — урок с `kind: 'boss'` и `incident: {...}`.
3. Если модуль был в статусе `planned`, поставь в `module.json` `"status": "ready"`.
4. `npm test` — тест целостности сам прогонит эталонные решения через эмулятор и проверит, что каждое проходит свою проверку.

Задания без собственного `scenario` делят одно окружение урока (как реальный сервер: исправил конфиг в задании 4 — в задании 5 он исправлен).

Типы проверок (`src/content/types.ts`): `outputContains`, `outputNumber`, `outputLines`, `outputMatches`, `fileExists`, `fileContains`, `fileMode`, `fileOwner`, `cwd`, `serviceState`, `processGone`, `commandUsed`, `minPipes`, `exitCode`, `custom`, `all`, `any`. Вопросы: `text` (с нормализацией `text`/`number`/`exact`/`keywords`), `command` (команда ученика и эталон запускаются в одинаковых окружениях и сравниваются по выводу), `choice` (не больше трети вопросов).

## Как добавить модуль или команду

- **Модуль**: каталог `content/modules/NN-slug/` с `module.json` (+ уроки) и файл `content/placement/NN-slug.ts` с 3–4 вопросами входного теста разной сложности.
- **Команда эмулятора**: файл `src/shell/commands/<имя>.ts` с `export default { name, summary, usage, run(args, stdin, ctx) { return { stdout, stderr, exitCode } } }`. Ядро менять не нужно — реестр подхватывает файлы автоматически.

## Статус

Готово (этапы 1–6): эмулятор (~70 команд), движок уроков, геймификация, онбординг с банком вопросов по всем 12 темам, контент модулей 1–3 с «боссами», ментор, раздел «Рынок». Модули 4–12 видны на карте с описанием и откроются по мере написания контента (этап 7).
