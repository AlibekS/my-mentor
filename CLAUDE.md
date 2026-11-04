# L3 Quest — тренажёр и ментор для роли L3 Support Engineer

## Цель

Личный локальный сайт (`http://127.0.0.1:5173`) для подготовки владельца (сисадмин, CCNA, базовый Linux,
изучает DevOps, Казахстан) к роли **L3 Support / Production Support Engineer** в международной компании.
Тема → теория → практика в эмуляторе → мини-тест «руками» → итоги. XP, уровни, ранги-аватары, ачивки,
проценты освоения тем, интервальное повторение и **ментор на базе Claude**. Исходное ТЗ — `SPEC.md`
владельца (в репозиторий не коммитился; ключевые требования отражены ниже).

Язык интерфейса и теории — русский; ключевые термины парой с английским: «первопричина (root cause)».

## Стек и команды

- Vite 5 + React 18 + TypeScript, без бэкенда; xterm.js; sql.js (SQLite/WASM); marked.
- `npm install && npm run dev` — запуск; `npm test` — Vitest (держать зелёным, сейчас 703 теста);
  `npm run build` — `tsc --noEmit && vite build`; `npm run typecheck`.
- Ментор работает только в dev/preview-сервере Vite (плагин `server/mentor-plugin.ts`): вызывает локальный
  `claude -p` (вход владельца в Claude Code с подпиской Pro, или `ANTHROPIC_API_KEY`). Без него — офлайн-шаблоны.
  Переменные: `MENTOR_MODEL`, `MENTOR_DISABLED=1`, `MENTOR_CLAUDE_BIN`.

## Структура

```
src/shell/        эмулятор Linux: vfs.ts, parser.ts (кавычки, $VAR, $(..), $((..)), пайпы, редиректы),
                  script.ts (if/for/while/функции), shell.ts (исполнение, builtins: sudo, bash, source,
                  nano→редактор, exit, set -euo pipefail), kube.ts, procstate.ts,
                  commands/*.ts — каждая команда отдельный модуль (export default CommandDef | CommandDef[]),
                  реестр подхватывает файлы автоматически
src/engine/       checks.ts (проверки по состоянию/выводу), normalize.ts, commandQuestion.ts,
                  evaluateQuestion.ts, rubric.ts (письменные задания)
src/sql/          engine.ts — sql.js, openDb/runQuery/gradeSql (сравнение результатов на свежих копиях БД)
src/obs/          promql.ts (мини-PromQL), kql.ts (поиск логов), types.ts
src/game/         config.ts (ВСЕ числа: XP, уровни, ранги, веса освоения, онбординг), levels, mastery,
                  placement (адаптивный тест + план), unlock, achievements, review (SRS), progress (схема
                  localStorage `l3quest.progress.v1`, миграции, экспорт/импорт), actions
src/mentor/       MentorWidget, context (что видит ментор), summary, offline, ask (запрос из урока)
src/pages/        Onboarding, PlanView, Home (карта), LessonPage (теория/практика/тест/итоги, ToolPanes),
                  Profile, Reference, Review, Market
src/ui/           Terminal (xterm + nano-оверлей), SqlConsole, ObsConsole, LineChart, WriteBox, QuestionCard,
                  Avatar (8 стадий pixel-art SVG), Markdown (safe-режим для ответов ментора)
server/           mentor-plugin.ts, mentor-prompt.ts (+ тест)
content/modules/<NN-slug>/module.json + lessons/NN-x.md (теория) + NN-x.ts (LessonDef), data.ts — датасеты
content/placement/<NN-slug>.ts — банк входного теста; content/market/trends.json — тренды рынка
content/shared/   logs.ts (детерминированные генераторы логов, rng), obs.ts (конструктор метрик)
content/__tests__/content.test.ts — целостность: эталонные решения проходят свои проверки
docs/curriculum-sources.md — обоснование программы и источники
.claude/commands/refresh-curriculum.md — сверка программы с рынком
```

## Формат контента (кратко; подробно — README)

- `LessonDef`: `scenario` (терминал), `sql: { dataset }`, `obs` (метрики/логи/трейсы/дашборд),
  `tools: ['obs','terminal','sql']` для нескольких инструментов; `tasks` 2–6, `quiz` 3–5 (choice ≤ 1/3),
  `glossary`, `kind: 'boss'` + `incident`.
- Task: `check` (терминал) | `answer` | SQL по `solution` | `obs: 'promql'|'logs'` | `write: { rubric }`;
  `tool` — какой инструмент открыть; `hints` ≤ 3; `solution` обязателен (для answer-задач вывод решения
  должен содержать ответ, иначе добавь строку-комментарий `# …`).
- Вопросы: `text` | `command` | `sql` | `promql` | `choice`.
- Задания без своего `scenario` делят одно окружение урока (по порядку). Когда окружение создаётся заново
  (перезагрузка, «Сбросить окружение», «Повторение»), решения уже решённых предыдущих заданий применяются
  автоматически (`src/engine/replay.ts`). Ответы с числами — вычислять из тех же данных (data.ts), не хардкодить.
- Чтобы правильный ответ не «отбивался»: проверка — по сути результата (`outputMatches`, состояние, `custom`),
  а не по формату конкретной команды; синонимы RU/EN в `accept`, в `keywords` — основы слов («депло», «троттл»);
  в PromQL-заданиях указывать окно `[5m]`; время в ответах — через `keywords` («14:41», «14:41 UTC»).
- content.test проверяет: решение проходит проверку, проверка НЕ выполнена до решения (нет самозасчёта),
  решение проходит в восстановленном окружении; rubric: пример проходит, заготовка — нет.
- Регулярки в rubric — без катастрофического backtracking (для «N строк» используй `minMatches`).

## Соглашения

- Весь пользовательский текст по-русски; цвета только через CSS-переменные (тёмная/светлая тема);
  видимый фокус, `prefers-reduced-motion`; без горизонтальной прокрутки до ширины телефона.
- Ментор не выдаёт готовое решение без явной просьбы (`asksForSolution`), решение уходит в контекст только тогда;
  при выдаче — задание помечается solutionShown (0 XP).
- Проверка UI — Playwright (Chromium предустановлен), скриншоты в scratchpad, не в репозиторий.
- Коммиты — по-русски, осмысленные; модельные идентификаторы в коммиты/PR не писать.

## Текущий статус (4 ноября 2026)

Готово и смёржено в `main` (PR AlibekS/my-mentor#1):
- Все 12 модулей: 55 уроков + 12 «боссов» (модули 1–3 по ТЗ, затем 4, 7, 6, 5, 8, 9, 10, 11, 12).
- Онбординг (опрос → адаптивный тест по 12 темам → «Твоя программа» с ручной правкой), геймификация
  (XP, 30 уровней, 8 рангов, 27 ачивок), освоение тем с забыванием, повторение, экспорт/импорт.
- Ментор (Claude через локальный CLI) с контекстом урока; «Разбор ментором» для письменных заданий.
- Раздел «Рынок», `docs/curriculum-sources.md`, `/refresh-curriculum`.
- Ежемесячный Routine «Сверка программы L3 Quest с рынком» (trig_01T6C3HJ7PxhQN9aSxRQDxcw),
  1-го числа 10:54 Asia/Almaty, новая облачная сессия → ветка `curriculum-refresh-ГГГГ-ММ` + PR.

Известные ограничения / заметки:
- Веткой по умолчанию на GitHub всё ещё может быть `claude/quirky-franklin-c121tq` — владелец должен
  переключить на `main` (Settings → General → Default branch).
- Эмулятор упрощён: нет интерактивных программ (top/less — снимки), docker exec/kubectl exec — только
  env/cat/ls; PromQL/KQL — подмножества; нет case/esac, trap, массивов bash, `( … )`/`{ …; }`, heredoc
  (терминал построчный — для скриптов nano или printf). ~105 команд + встроенные bash, awk — полноценный.
- Письменные задания проверяются по ключевым элементам, смысл оценивает только ментор (нужен Claude).
- Бандл ~1 МБ (без code-splitting) — для локального сайта приемлемо.

## Бэклог (идеи следующих итераций)

1. Владелец проходит курс с онбординга — правки контента и проверок по его отзывам.
2. Больше сценариев в модуле 12 и задач по облакам (AWS/Azure/GCP на уровне диагностики), Python для L3.
3. Тема «работа с AI-ассистентами в поддержке» (как проверять выводы ИИ по логам/данным) в модулях 10–11.
4. Code-splitting (lazy-загрузка контента модулей), светлая тема — визуальная доводка графиков.
5. Режим «экзамен перед собеседованием»: случайный набор задач из всех модулей на время.
