import type { LessonDef } from '../../../../src/content/types';
import type { Shell } from '../../../../src/shell/shell';
import { isExecutable, runUserScript } from '../data';

const HOME = '/home/alibek';

const scenario = {
  resources: { disks: [{ fs: '/dev/sda1', sizeGb: 50, usedGb: 31, mount: '/' }] },
  files: { '/var/log/shop/old-export.csv': { content: '', size: 15 * 1024 ** 3 } },
  network: {
    hosts: { 'shop.kz': { ip: '10.0.2.5' } },
    http: { 'https://shop.kz/health': { status: 200, body: '{"status":"ok"}' } },
  },
  services: [
    { name: 'nginx', description: 'nginx', active: 'active' as const, enabled: true, logs: [] },
    {
      name: 'shop', description: 'Shop web application', active: 'failed' as const, enabled: true,
      logs: [{ time: '2026-11-04 14:10:00', priority: 'err' as const, message: 'OutOfMemoryError: Java heap space' }],
      startProcess: { user: 'shop', cpu: 2, mem: 8, vsz: 4_000_000, rss: 600_000, stat: 'Ssl', start: '14:30', time: '0:01', command: '/usr/bin/java -jar /opt/shop/shop.jar' },
    },
  ],
};

/** Прогон скрипта ученика в нескольких состояниях системы */
function grade(sh: Shell): boolean {
  const p = `${HOME}/healthcheck.sh`;
  if (!isExecutable(sh, p)) return false;
  const svc = sh.state.services.find((s) => s.name === 'shop')!;
  const saved = { active: svc.active, disks: structuredClone(sh.state.resources.disks), http: structuredClone(sh.state.network.http) };
  const lines = (out: string) => out.split('\n').filter((l) => /^(OK|FAIL):/.test(l));
  try {
    // 1) всё хорошо
    svc.active = 'active';
    sh.state.resources.disks = [{ fs: '/dev/sda1', sizeGb: 50, usedGb: 10, mount: '/' }];
    sh.state.network.http['https://shop.kz/health'] = { status: 200, body: 'ok' };
    const good = runUserScript(sh, p);
    if (good.code !== 0 || lines(good.out).length < 4 || lines(good.out).some((l) => l.startsWith('FAIL'))) return false;
    // 2) shop упал и HTTP 502 — обе ошибки в выводе, код 1
    svc.active = 'failed';
    sh.state.network.http['https://shop.kz/health'] = { status: 502, body: 'bad gateway' };
    const bad = runUserScript(sh, p);
    if (bad.code !== 1 || lines(bad.out).filter((l) => l.startsWith('FAIL')).length < 2) return false;
    // 3) только диск 90%
    svc.active = 'active';
    sh.state.network.http['https://shop.kz/health'] = { status: 200, body: 'ok' };
    sh.state.resources.disks = [{ fs: '/dev/sda1', sizeGb: 50, usedGb: 45, mount: '/' }];
    const disk = runUserScript(sh, p);
    return disk.code === 1 && lines(disk.out).filter((l) => l.startsWith('FAIL')).length === 1;
  } finally {
    svc.active = saved.active;
    sh.state.resources.disks = saved.disks;
    sh.state.network.http = saved.http;
  }
}

const SCRIPT = [
  '#!/usr/bin/env bash',
  'FAILED=0',
  'for s in nginx shop; do',
  '  if systemctl is-active "$s" > /dev/null; then echo "OK: $s active"; else echo "FAIL: $s not active"; FAILED=1; fi',
  'done',
  "USED=$(df / | awk 'NR==2 {print $5}' | tr -d '%')",
  'if [ "$USED" -lt 85 ]; then echo "OK: disk $USED%"; else echo "FAIL: disk $USED%"; FAILED=1; fi',
  'CODE=$(curl -s -o /dev/null -w "%{http_code}" https://shop.kz/health)',
  'if [ "$CODE" = "200" ]; then echo "OK: http $CODE"; else echo "FAIL: http $CODE"; FAILED=1; fi',
  'exit $FAILED',
];
const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

const lesson: LessonDef = {
  id: 'boss',
  kind: 'boss',
  title: 'Чек-лист дежурного в один скрипт',
  minutes: 45,
  incident: { ticket: 'TASK-7720: «Автоматизировать проверки дежурного: healthcheck + cron»', severity: 'SEV3', customer: 'команда поддержки' },
  commands: ['nano', 'chmod', 'systemctl', 'df', 'curl', 'crontab'],
  scenario,
  tasks: [
    {
      id: 'write',
      prompt: 'Напиши `~/healthcheck.sh` по требованиям из описания и сделай его исполняемым. Проверка прогонит скрипт в трёх состояниях системы (всё хорошо / упал сервис и HTTP 502 / только забит диск) и сверит строки `OK:`/`FAIL:` и коды выхода.',
      check: { type: 'custom', fn: grade },
      hints: [
        'Заведи `FAILED=0`; на каждой упавшей проверке печатай `FAIL: …` и ставь `FAILED=1`; в конце `exit $FAILED`.',
        "Диск: `USED=$(df / | awk 'NR==2 {print $5}' | tr -d '%')`, затем `[ \"$USED\" -lt 85 ]`. HTTP: `CODE=$(curl -s -o /dev/null -w \"%{http_code}\" https://shop.kz/health)`.",
        'Не используй `set -e` — скрипт должен пройти все проверки, даже если первая упала.',
      ],
      solution: `printf '%s\\n' ${SCRIPT.map(q).join(' ')} > ~/healthcheck.sh\nchmod +x ~/healthcheck.sh`,
      explanation: '```bash\n' + SCRIPT.join('\n') + '\n```',
    },
    {
      id: 'run',
      prompt: 'Запусти скрипт на текущем сервере. Какая проверка падает? Введи имя сервиса.',
      answer: { accept: ['shop', 'shop.service'], label: 'Сервис:' },
      hints: ['`./healthcheck.sh; echo "exit=$?"`'],
      solution: './healthcheck.sh',
    },
    {
      id: 'fix',
      prompt: 'Подними упавший сервис и убедись, что `./healthcheck.sh` теперь завершается с кодом **0** (запусти его последней командой).',
      check: { type: 'custom', fn: (sh, last) => sh.state.services.find((s) => s.name === 'shop')?.active === 'active' && !!last && /healthcheck\.sh/.test(last.line) && last.exitCode === 0 },
      hints: ['`sudo systemctl restart shop`', 'Потом `./healthcheck.sh`.'],
      solution: 'sudo systemctl restart shop\n./healthcheck.sh',
    },
    {
      id: 'cron',
      prompt: 'Поставь `~/healthcheck.sh` в cron **каждые 5 минут** с выводом в `/tmp/healthcheck.log` (с ошибками). Путь к скрипту — полный: `/home/alibek/healthcheck.sh`.',
      check: { type: 'custom', fn: (sh) => !!sh.fs.lookup('/var/spool/cron/crontabs/alibek')?.content.split('\n').some((l) => /^\*\/5\s+\*\s+\*\s+\*\s+\*\s+\/home\/alibek\/healthcheck\.sh\s*>>\s*\/tmp\/healthcheck\.log\s+2>&1\s*$/.test(l.trim())) },
      hints: ["`echo '*/5 * * * * /home/alibek/healthcheck.sh >> /tmp/healthcheck.log 2>&1' > ~/mycron`", '`crontab ~/mycron && crontab -l`'],
      solution: "echo '*/5 * * * * /home/alibek/healthcheck.sh >> /tmp/healthcheck.log 2>&1' > ~/mycron\ncrontab ~/mycron",
    },
  ],
  quiz: [
    { id: 'q-no-e', type: 'choice', prompt: 'Почему в healthcheck-скрипте не стоит ставить `set -e`?', options: ['set -e медленный', 'Скрипт остановится на первой упавшей проверке, и дежурный не увидит остальные', 'set -e запрещён в cron'], correct: 1, explanation: 'Для отчётных проверок нужен полный список; код выхода собираем в переменную.' },
    { id: 'q-exit', type: 'text', prompt: 'Зачем healthcheck-скрипт возвращает код 1 при любой ошибке? (ключевые слова: мониторинг/алерт/cron/автоматизация)', answer: { accept: [], normalize: 'keywords', keywords: [['монитор', 'алерт', 'alert', 'cron', 'автомат', 'ci', 'другие скрипты', 'pipeline', 'nagios', 'zabbix']] }, explanation: 'Код выхода — машинный сигнал для cron/мониторинга/CI; текст — для человека.' },
    { id: 'q-path', type: 'text', prompt: 'Какая главная причина «вручную скрипт работает, а из cron — нет»? (ключевые слова: PATH/окружение)', answer: { accept: [], normalize: 'keywords', keywords: [['path', 'окружен', 'environment', 'переменн', 'полный путь']] }, explanation: 'У cron минимальный PATH и другое окружение — используй полные пути.' },
  ],
  glossary: [
    { ru: 'Проверка здоровья', en: 'health check', def: 'Автоматическая проверка, что сервис работает корректно.' },
    { ru: 'Регламент', en: 'runbook', def: 'Пошаговая инструкция для типовых ситуаций; часть шагов автоматизируют скриптами.' },
  ],
};
export default lesson;
