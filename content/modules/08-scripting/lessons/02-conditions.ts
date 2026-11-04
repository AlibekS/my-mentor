import type { LessonDef } from '../../../../src/content/types';

const scenario = {
  resources: { disks: [{ fs: '/dev/sda1', sizeGb: 50, usedGb: 43, mount: '/' }] },
  files: { '/var/log/app/app.log': 'INFO start\nERROR db timeout\nINFO ok\n', '/etc/shop/app.conf': 'port=8080\n' },
  services: [
    { name: 'nginx', description: 'nginx', active: 'active' as const, enabled: true, logs: [] },
    { name: 'mailer', description: 'Mailer', active: 'failed' as const, enabled: true, logs: [] },
  ],
};

const lesson: LessonDef = {
  id: 'conditions',
  title: 'Условия: if, [ ], коды выхода, && и ||',
  minutes: 25,
  commands: ['test', '[', 'grep'],
  scenario,
  tasks: [
    {
      id: 'grep-q',
      prompt: 'Напиши условие одной строкой: если в `/var/log/app/app.log` есть `ERROR`, вывести `FOUND`, иначе `CLEAN`. Используй `if` и `grep -q`.',
      check: { type: 'all', checks: [{ type: 'outputEquals', value: 'FOUND' }, { type: 'custom', fn: (_s, l) => !!l && /^if\s/.test(l.line) && /grep\s+-q/.test(l.line) && /else/.test(l.line) }] },
      hints: ['Шаблон: `if команда; then …; else …; fi`', '`if grep -q ERROR /var/log/app/app.log; then echo FOUND; else echo CLEAN; fi`'],
      solution: 'if grep -q ERROR /var/log/app/app.log; then echo FOUND; else echo CLEAN; fi',
    },
    {
      id: 'service',
      prompt: 'Однострочник: если сервис `mailer` **не** активен, вывести `mailer DOWN`. Используй `systemctl is-active` и `||` (вывод самой команды спрячь в `/dev/null`).',
      check: { type: 'all', checks: [{ type: 'outputEquals', value: 'mailer DOWN' }, { type: 'custom', fn: (_s, l) => !!l && l.line.includes('||') }] },
      hints: ['`systemctl is-active mailer > /dev/null || echo "mailer DOWN"`'],
      solution: 'systemctl is-active mailer > /dev/null || echo "mailer DOWN"',
    },
    {
      id: 'disk',
      prompt: 'Достань процент занятости `/` числом в переменную `USED` и выведи `WARNING`, если он **≥ 80**, иначе `OK`.',
      check: { type: 'all', checks: [{ type: 'outputEquals', value: 'WARNING' }, { type: 'custom', fn: (sh) => sh.env.USED === '86' }] },
      hints: [
        "`USED=$(df / | awk 'NR==2 {print $5}' | tr -d '%')`",
        'Сравнение чисел: `[ "$USED" -ge 80 ]`.',
        `USED=$(df / | awk 'NR==2 {print $5}' | tr -d '%'); if [ "$USED" -ge 80 ]; then echo WARNING; else echo OK; fi`,
      ],
      solution: `USED=$(df / | awk 'NR==2 {print $5}' | tr -d '%'); if [ "$USED" -ge 80 ]; then echo WARNING; else echo OK; fi`,
    },
    {
      id: 'file',
      prompt: 'Проверь, что конфиг `/etc/shop/app.conf` **существует и не пустой**, и выведи `config ok` (через `[ -s ... ] && echo ...`).',
      check: { type: 'all', checks: [{ type: 'outputEquals', value: 'config ok' }, { type: 'custom', fn: (_s, l) => !!l && /\[\s+-s\s/.test(l.line) }] },
      hints: ['`[ -s /etc/shop/app.conf ] && echo "config ok"`'],
      solution: '[ -s /etc/shop/app.conf ] && echo "config ok"',
    },
  ],
  quiz: [
    { id: 'q-if', type: 'choice', prompt: 'Что на самом деле проверяет `if`?', options: ['Булево значение true/false', 'Код выхода команды: 0 — условие выполнено', 'Наличие вывода у команды'], correct: 1, explanation: '`if cmd` → ветка then, если `cmd` вернула 0.' },
    { id: 'q-gt', type: 'text', prompt: 'Каким оператором в `[ ]` проверить, что число `$N` больше 80?', answer: { accept: ['-gt'] }, explanation: '`[ "$N" -gt 80 ]`. `>` внутри `[ ]` — перенаправление.' },
    { id: 'q-z', type: 'text', prompt: 'Каким флагом `test` проверить, что строка **пустая**?', answer: { accept: ['-z'] }, explanation: '`[ -z "$VAR" ]`; непустая — `-n`.' },
    { id: 'q-cmd', type: 'command', prompt: 'Однострочник: если сервис `nginx` активен — вывести `nginx up`.', scenario, solution: 'systemctl is-active nginx > /dev/null && echo "nginx up"', check: { type: 'outputEquals', value: 'nginx up' }, explanation: '`systemctl is-active nginx > /dev/null && echo "nginx up"` или через `if`.' },
  ],
  glossary: [
    { ru: 'Код выхода', en: 'exit status', def: '0 — успех, не 0 — ошибка; на нём построены if, && и ||.' },
    { ru: 'Условное выражение', en: 'test expression', def: 'Проверка в [ ] или test: файлы, строки, числа.' },
  ],
};
export default lesson;
