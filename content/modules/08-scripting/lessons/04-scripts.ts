import type { LessonDef } from '../../../../src/content/types';
import { isExecutable, runUserScript } from '../data';

const scenario = {
  files: {
    '/var/log/app/app.log': 'INFO a\nERROR b\nERROR c\nERROR d\n',
    '/var/log/app/empty.log': '',
    '/home/alibek/broken.sh': { owner: 'alibek', mode: 0o755, content: '#!/usr/bin/env bash\nset -euo pipefail\nLOG_DIR=/var/log/app\necho "Чистим старые логи в $LOG_DIRR"\n' },
  },
  services: [
    { name: 'nginx', description: 'nginx', active: 'active' as const, enabled: true, logs: [] },
    { name: 'mailer', description: 'Mailer', active: 'failed' as const, enabled: true, logs: [] },
  ],
};

const HOME = '/home/alibek';

const lesson: LessonDef = {
  id: 'scripts',
  title: 'Скрипты: shebang, аргументы, exit, set -euo pipefail',
  minutes: 35,
  commands: ['nano', 'chmod', 'bash'],
  scenario,
  tasks: [
    {
      id: 'hello',
      prompt: 'Создай скрипт `~/errors.sh` (команда `nano ~/errors.sh`), который принимает путь к логу **первым аргументом** и печатает `ERRORS: N` — число строк ERROR в этом файле. Сделай его исполняемым и запусти: `./errors.sh /var/log/app/app.log`.',
      check: {
        type: 'custom',
        fn: (sh) => {
          if (!isExecutable(sh, `${HOME}/errors.sh`)) return false;
          const a = runUserScript(sh, `${HOME}/errors.sh`, ['/var/log/app/app.log']);
          const b = runUserScript(sh, `${HOME}/errors.sh`, ['/var/log/app/empty.log']);
          return a.out.trim() === 'ERRORS: 3' && b.out.trim() === 'ERRORS: 0';
        },
      },
      hints: [
        'Содержимое: shebang, затем `COUNT=$(grep -c ERROR "$1")` и `echo "ERRORS: $COUNT"`. Без `set -e`: grep -c при 0 совпадений возвращает код 1.',
        'Сохрани (Ctrl+S), затем `chmod +x ~/errors.sh`.',
        'Проверка запускает скрипт с разными логами — путь не хардкодь, используй `$1`.',
      ],
      solution: `printf '%s\\n' '#!/usr/bin/env bash' 'COUNT=$(grep -c ERROR "$1")' 'echo "ERRORS: $COUNT"' > ~/errors.sh
chmod +x ~/errors.sh
./errors.sh /var/log/app/app.log`,
      explanation: 'Скрипт:\n\n```bash\n#!/usr/bin/env bash\nCOUNT=$(grep -c ERROR "$1")\necho "ERRORS: $COUNT"\n```\n\nЗадание засчитывается, когда скрипт исполняемый и правильно работает на разных файлах — проверка запускает его сама.',
    },
    {
      id: 'exit-code',
      prompt: 'Создай `~/svc.sh`: принимает имя сервиса `$1`; если он active — печатает `OK: имя` и выходит с кодом 0, иначе `FAIL: имя` и код **1**. Сделай исполняемым.',
      check: {
        type: 'custom',
        fn: (sh) => {
          if (!isExecutable(sh, `${HOME}/svc.sh`)) return false;
          const a = runUserScript(sh, `${HOME}/svc.sh`, ['nginx']);
          const b = runUserScript(sh, `${HOME}/svc.sh`, ['mailer']);
          return a.out.trim() === 'OK: nginx' && a.code === 0 && b.out.trim() === 'FAIL: mailer' && b.code === 1;
        },
      },
      hints: ['Условие: `if systemctl is-active "$1" > /dev/null; then … else … fi`', 'В ветке else: `echo "FAIL: $1"` и `exit 1`.', 'Проверь сам: `./svc.sh mailer; echo $?`'],
      solution: `printf '%s\\n' '#!/usr/bin/env bash' 'if systemctl is-active "$1" > /dev/null; then' '  echo "OK: $1"' 'else' '  echo "FAIL: $1"' '  exit 1' 'fi' > ~/svc.sh
chmod +x ~/svc.sh`,
      explanation: '```bash\n#!/usr/bin/env bash\nif systemctl is-active "$1" > /dev/null; then\n  echo "OK: $1"\nelse\n  echo "FAIL: $1"\n  exit 1\nfi\n```',
    },
    {
      id: 'strict',
      prompt: 'Запусти `~/broken.sh`. Он упадёт — благодаря `set -u`. В какой переменной опечатка? Введи её имя (как в скрипте, без `$`).',
      answer: { accept: ['LOG_DIRR'], label: 'Переменная:' },
      hints: ['`./broken.sh` — сообщение `unbound variable`.'],
      solution: './broken.sh 2>&1',
      explanation: 'Без `set -u` скрипт молча вывел бы пустую строку, а в команде `rm` — удалил бы не то.',
    },
  ],
  quiz: [
    { id: 'q-shebang', type: 'text', prompt: 'Как называется первая строка скрипта вида `#!/usr/bin/env bash`? (англ.)', answer: { accept: ['shebang', 'шебанг', 'hashbang'] }, explanation: '**Shebang** указывает интерпретатор.' },
    { id: 'q-argc', type: 'text', prompt: 'Какая переменная содержит **количество** аргументов скрипта?', answer: { accept: ['$#'], normalize: 'exact' }, explanation: '`$#`; сами аргументы — `$1…`, все — `$@`.' },
    { id: 'q-126', type: 'choice', prompt: '`./deploy_check.sh` → `Permission denied`, код 126. Что сделать?', options: ['sudo ./deploy_check.sh', 'chmod +x deploy_check.sh (или запускать через bash deploy_check.sh)', 'Переименовать файл'], correct: 1, explanation: 'Нет права на выполнение.' },
    { id: 'q-strict', type: 'text', prompt: 'Напиши строку «строгого режима» bash (три опции).', answer: { accept: ['set -euo pipefail', 'set -eu -o pipefail', 'set -e -u -o pipefail'], normalize: 'exact' }, explanation: '`set -euo pipefail`.' },
  ],
  glossary: [
    { ru: 'Шебанг', en: 'shebang', def: 'Строка #! в начале скрипта с путём к интерпретатору.' },
    { ru: 'Позиционные параметры', en: 'positional parameters', def: '$1, $2… — аргументы скрипта или функции.' },
    { ru: 'Строгий режим', en: 'strict mode (set -euo pipefail)', def: 'Остановка на ошибках, неопределённых переменных и сбоях в пайпах.' },
  ],
};
export default lesson;
