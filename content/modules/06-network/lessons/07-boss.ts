import type { LessonDef } from '../../../../src/content/types';

const oldCert = { subject: 'CN = api.shop.kz', issuer: "C = US, O = Let's Encrypt, CN = R11", notBefore: 'Aug  5 00:00:00 2026 GMT', notAfter: 'Nov  3 23:59:59 2026 GMT' };
const newCert = { subject: 'CN = api.shop.kz', issuer: "C = US, O = Let's Encrypt, CN = R10", notBefore: 'Nov  1 00:00:00 2026 GMT', notAfter: 'Jan 30 23:59:59 2027 GMT' };

const scenario = {
  network: {
    hosts: {
      'api.shop.kz': { ip: '10.0.2.7', cname: 'lb-old.shop.kz', cert: oldCert },
      'lb-old.shop.kz': { ip: '10.0.2.7', cert: oldCert },
      'lb-new.shop.kz': { ip: '10.0.4.20', cert: { ...newCert, subject: 'CN = api.shop.kz, SAN = lb-new.shop.kz' } },
      'm.shop.kz': { ip: '10.0.4.21' },
    },
    http: {
      'https://api.shop.kz/v1/health': { status: 200, body: '{"status":"ok","lb":"old"}\n' },
      'https://lb-new.shop.kz/v1/health': { status: 200, headers: { 'Content-Type': 'application/json' }, body: '{"status":"ok","lb":"new","version":"2.15.0","db":"ok"}\n' },
    },
  },
  files: {
    '/home/alibek/migration-plan.md': { owner: 'alibek', content: '# Миграция API на lb-new (суббота)\n1. Поднять lb-new, выпустить сертификат — DONE\n2. Прогнать smoke-тесты на lb-new — DONE\n3. Переключить DNS api.shop.kz → lb-new (CNAME) — TODO\n4. Через неделю выключить lb-old\n' },
  },
};

const lesson: LessonDef = {
  id: 'boss',
  kind: 'boss',
  title: 'После миграции API лёг у партнёров',
  minutes: 40,
  incident: { ticket: 'INC-6033: «Партнёрские интеграции не подключаются к API с ночи»', severity: 'SEV2', customer: 'партнёры (B2B-интеграции)' },
  commands: ['curl', 'dig', 'openssl', 'jq', 'cat'],
  scenario,
  tasks: [
    {
      id: 'repro',
      prompt: 'Воспроизведи: запроси `https://api.shop.kz/v1/health`. Введи текст ошибки curl (после кода в скобках, коротко).',
      answer: { accept: [], normalize: 'keywords', keywords: [['expired', 'истек', 'истёк', 'certificate', 'сертифик']], label: 'Ошибка:' },
      hints: ['`curl https://api.shop.kz/v1/health`'],
      solution: 'curl https://api.shop.kz/v1/health',
      tags: ['curl'],
    },
    {
      id: 'dns',
      prompt: 'Куда указывает `api.shop.kz` в DNS? Введи имя из CNAME.',
      answer: { accept: ['lb-old.shop.kz', 'lb-old.shop.kz.'], label: 'CNAME:' },
      hints: ['`dig api.shop.kz`'],
      solution: 'dig api.shop.kz',
      tags: ['dig'],
    },
    {
      id: 'cert',
      prompt: 'Посмотри сертификат, который отдаёт `api.shop.kz`, через `openssl s_client`. Выведи его (задание засчитается по наличию NotAfter в выводе).',
      // NotAfter из s_client или notAfter= из openssl x509 -dates/-enddate
      check: { type: 'outputMatches', pattern: 'not ?after\\s*[:=]\\s*Nov\\s+3\\b', flags: 'im' },
      hints: ['`openssl s_client -connect api.shop.kz:443 -servername api.shop.kz`'],
      solution: 'openssl s_client -connect api.shop.kz:443 -servername api.shop.kz',
      tags: ['openssl'],
    },
    {
      id: 'new-lb',
      prompt: 'Проверь, живой ли новый балансировщик: запроси `https://lb-new.shop.kz/v1/health` и выведи через jq поле `version`.',
      check: { type: 'all', checks: [{ type: 'outputContains', value: '2.15.0' }, { type: 'commandUsed', name: 'jq' }] },
      hints: ["`curl -s https://lb-new.shop.kz/v1/health | jq -r '.version'`"],
      solution: "curl -s https://lb-new.shop.kz/v1/health | jq -r '.version'",
      tags: ['curl', 'jq'],
    },
    {
      id: 'plan',
      prompt: 'Загляни в `~/migration-plan.md`. Какой **номер шага** миграции не выполнен и стал причиной инцидента? Введи число.',
      answer: { accept: ['3'], normalize: 'number', label: 'Шаг:' },
      hints: ['`cat ~/migration-plan.md`'],
      solution: 'cat ~/migration-plan.md',
    },
  ],
  quiz: [
    { id: 'q-rca', type: 'text', prompt: 'RCA одной фразой (ключевые слова: DNS/CNAME не переключили и сертификат старого балансировщика истёк).', answer: { accept: [], normalize: 'keywords', keywords: [['dns', 'cname', 'переключ'], ['сертификат', 'certificate', 'истек', 'истёк', 'expired', 'lb-old', 'старый']] }, explanation: 'DNS api.shop.kz остался на lb-old (шаг 3 не выполнен), а сертификат на lb-old истёк в ночь на 4 ноября — партнёры получили ошибку TLS. Мобильное приложение ходит на другой домен и не пострадало.' },
    { id: 'q-fix', type: 'choice', prompt: 'Что сделать в первую очередь, чтобы восстановить сервис?', options: ['Сказать партнёрам добавить -k', 'Переключить CNAME api.shop.kz на lb-new (новый сертификат уже есть) и следить за TTL; параллельно — продлить сертификат на lb-old на время переходного периода', 'Откатить релиз 2.15.0'], correct: 1, explanation: 'Восстановление — завершить шаг миграции. Пока кеши DNS не обновились, помогает и продление сертификата на старом LB.' },
    { id: 'q-prevent', type: 'text', prompt: 'Action item, чтобы такое не повторилось (ключевые слова: мониторинг сертификатов/алерт или чек-лист/проверка миграции).', answer: { accept: [], normalize: 'keywords', keywords: [['монитор', 'алерт', 'alert', 'чек-лист', 'checklist', 'провер', 'smoke', 'автопродл']] }, explanation: 'Мониторинг сроков сертификатов на всех LB + чек-лист миграции с проверкой итогового DNS и внешним smoke-тестом.' },
  ],
  glossary: [
    { ru: 'Балансировщик нагрузки', en: 'load balancer', def: 'Распределяет запросы между бэкендами, часто терминирует TLS.' },
    { ru: 'Smoke-тест', en: 'smoke test', def: 'Быстрая проверка, что основное работает после изменения.' },
  ],
};
export default lesson;
