import type { LessonDef } from '../../../../src/content/types';

const scenario = {
  files: {
    '/var/log/app/app.log': 'INFO start\nERROR db timeout\nWARN slow\nERROR db timeout\nINFO ok\nERROR payment failed\n',
    '/var/log/app/worker.log': 'INFO job 1\nERROR job 2 failed\nINFO job 3\n',
  },
};

const lesson: LessonDef = {
  id: 'variables',
  title: 'Переменные, кавычки, $(...) и $((...))',
  minutes: 25,
  commands: ['echo', 'printf'],
  scenario,
  tasks: [
    {
      id: 'var',
      prompt: 'Сохрани число строк `ERROR` из `/var/log/app/app.log` в переменную `COUNT` (через `$(...)`), затем выведи фразу `Errors: 3` с помощью этой переменной.',
      check: { type: 'all', checks: [{ type: 'outputEquals', value: 'Errors: 3' }, { type: 'custom', fn: (sh) => sh.env.COUNT === '3' }] },
      hints: ['`COUNT=$(grep -c ERROR /var/log/app/app.log)`', 'Потом `echo "Errors: $COUNT"`. Можно в одну строку через `;`.'],
      solution: 'COUNT=$(grep -c ERROR /var/log/app/app.log); echo "Errors: $COUNT"',
    },
    {
      id: 'quotes',
      prompt: 'Выведи **буквально** строку `Use $HOME for your files` (знак доллара и слово HOME должны остаться как есть).',
      check: { type: 'outputEquals', value: 'Use $HOME for your files' },
      hints: ['В двойных кавычках `$HOME` раскроется в путь.', 'Одинарные кавычки ничего не раскрывают.'],
      solution: "echo 'Use $HOME for your files'",
    },
    {
      id: 'arith',
      prompt: 'Посчитай общее число строк `ERROR` в **обоих** логах (`app.log` и `worker.log`) через две подстановки и арифметику `$((...))` и выведи **только число**.',
      check: { type: 'all', checks: [{ type: 'outputEquals', value: '4' }, { type: 'custom', fn: (sh, last) => !!last && (last.line.includes('$((') || sh.history.slice(-5).some((h) => h.includes('$(('))) }] },
      hints: ['`A=$(grep -c ERROR /var/log/app/app.log)`, аналогично `B` для worker.log.', '`echo $((A + B))`'],
      solution: 'A=$(grep -c ERROR /var/log/app/app.log); B=$(grep -c ERROR /var/log/app/worker.log); echo $((A + B))',
    },
    {
      id: 'printf',
      prompt: 'Выведи отчёт одной строкой через `printf`: имя лога, выровненное по левому краю в поле из 10 символов, затем число ошибок. Для app.log должно получиться ровно `app.log   3`.',
      check: { type: 'all', checks: [{ type: 'outputEquals', value: 'app.log   3' }, { type: 'commandUsed', name: 'printf' }] },
      hints: ['Формат: `"%-10s%d\\n"` — `-10` значит «влево, ширина 10».', '`printf "%-10s%d\\n" app.log $(grep -c ERROR /var/log/app/app.log)`'],
      solution: 'printf "%-10s%d\\n" app.log $(grep -c ERROR /var/log/app/app.log)',
    },
  ],
  quiz: [
    { id: 'q-eq', type: 'choice', prompt: 'Почему `HOST = web-01` — ошибка?', options: ['Имя переменной должно быть строчным', 'С пробелами bash воспринимает HOST как команду с аргументами = и web-01', 'Нужно export'], correct: 1, explanation: 'Присваивание — строго `NAME=value` без пробелов.' },
    { id: 'q-default', type: 'text', prompt: 'Как подставить значение переменной `LOG`, а если она пустая — `/var/log/app.log`? (запись целиком)', answer: { accept: ['${LOG:-/var/log/app.log}', '"${LOG:-/var/log/app.log}"'], normalize: 'exact' }, explanation: '`${LOG:-/var/log/app.log}`.' },
    { id: 'q-subst', type: 'command', prompt: 'Выведи фразу `host: srv-prod-01` с помощью подстановки команды `hostname`.', scenario, solution: 'echo "host: $(hostname)"', explanation: '`echo "host: $(hostname)"`.' },
    { id: 'q-div', type: 'text', prompt: 'Что выведет `echo $((7 / 2))`?', answer: { accept: ['3'], normalize: 'number' }, explanation: 'Арифметика bash целочисленная: 7/2 = 3.' },
  ],
  glossary: [
    { ru: 'Подстановка команды', en: 'command substitution', def: '$(команда) — подставить её вывод.' },
    { ru: 'Арифметическое раскрытие', en: 'arithmetic expansion', def: '$((выражение)) — целочисленные вычисления.' },
    { ru: 'Переменная окружения', en: 'environment variable', def: 'Переменная, видимая дочерним процессам (export).' },
  ],
};
export default lesson;
