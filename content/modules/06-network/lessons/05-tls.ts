import type { LessonDef } from '../../../../src/content/types';

const scenario = {
  network: {
    hosts: {
      'shop.kz': { ip: '10.0.2.5', cert: { subject: 'CN = shop.kz', issuer: "C = US, O = Let's Encrypt, CN = R11", notBefore: 'Oct 10 00:00:00 2026 GMT', notAfter: 'Jan  8 23:59:59 2027 GMT' } },
      'partners.shop.kz': { ip: '10.0.2.11', cert: { subject: 'CN = partners.shop.kz', issuer: 'C = KZ, O = Shop Internal CA', notBefore: 'Nov  1 00:00:00 2025 GMT', notAfter: 'Nov  1 23:59:59 2026 GMT' } },
      'status.shop.kz': { ip: '10.0.2.12', cert: { subject: 'CN = status.shop.kz', issuer: "C = US, O = Let's Encrypt, CN = R10", notBefore: 'Aug 20 00:00:00 2026 GMT', notAfter: 'Nov 18 23:59:59 2026 GMT' } },
    },
    http: {
      'https://shop.kz/': { status: 200, body: 'ok\n' },
      'https://partners.shop.kz/api/ping': { status: 200, body: '{"pong":true}\n' },
      'https://status.shop.kz/': { status: 200, body: 'all systems operational\n' },
    },
  },
};

const lesson: LessonDef = {
  id: 'tls',
  title: 'TLS-сертификаты: curl -v, openssl s_client',
  minutes: 20,
  commands: ['curl', 'openssl'],
  scenario,
  tasks: [
    {
      id: 'partners',
      prompt: 'Партнёры не могут достучаться до `https://partners.shop.kz/api/ping`. Воспроизведи запрос через curl и введи **код ошибки curl** (число в скобках).',
      answer: { accept: ['60'], normalize: 'number', label: 'Код:' },
      hints: ['`curl https://partners.shop.kz/api/ping`', 'Ошибка вида `curl: (NN) ...`.'],
      solution: 'curl https://partners.shop.kz/api/ping',
      tags: ['curl'],
    },
    {
      id: 'expired',
      prompt: 'Посмотри сертификат `partners.shop.kz` через `openssl s_client` и введи **дату окончания** (как в поле NotAfter, достаточно `Nov 1 2026` или `2026-11-01`).',
      // день + месяц в любом привычном формате и год 2026 (NotBefore — Nov 1 2025, его не засчитываем)
      answer: { accept: [], normalize: 'keywords', keywords: [['nov 1 2', 'nov 01 2', 'nov 1, 2', 'november 1 2', 'november 1, 2', '1 nov 2', '01 nov 2', '1 november 2', '2026-11-01', '01.11.2026', '1.11.2026', '01.11.26', '1 ноября', '1 ноя 2'], ['2026', '.11.26']], label: 'NotAfter:' },
      hints: ['`openssl s_client -connect partners.shop.kz:443 -servername partners.shop.kz`'],
      solution: 'openssl s_client -connect partners.shop.kz:443 -servername partners.shop.kz',
      tags: ['openssl'],
    },
    {
      id: 'soon',
      prompt: 'Проактивная проверка: у какого из сайтов (`shop.kz` или `status.shop.kz`) сертификат истекает **в ближайшие 30 дней**? Сегодня 4 ноября 2026. Введи имя.',
      answer: { accept: ['status.shop.kz', 'status.shop.kz/', 'https://status.shop.kz', 'https://status.shop.kz/'], label: 'Сайт:' },
      hints: ['Проверь оба через `curl -v ... 2>&1 | grep expire` или openssl.'],
      solution: 'curl -v https://status.shop.kz/ 2>&1 | grep "expire date"\n# 18 ноября — через 14 дней',
      tags: ['curl'],
    },
  ],
  quiz: [
    { id: 'q-k', type: 'choice', prompt: 'Коллега предлагает добавить `-k` во все скрипты интеграции, «раз сертификат глючит». Что ответишь?', options: ['Отличная идея', '-k отключает проверку сертификата — допустимо только для диагностики; нужно перевыпустить/починить цепочку', '-k ускоряет запросы'], correct: 1, explanation: 'Отключение проверки открывает путь к атаке «человек посередине».' },
    { id: 'q-sni', type: 'text', prompt: 'Какой флаг `openssl s_client` передаёт имя сайта (SNI), чтобы получить правильный сертификат на общем IP?', answer: { accept: [], normalize: 'keywords', keywords: [['servername']] }, explanation: '`-servername api.shop.kz`.' },
    { id: 'q-chain', type: 'text', prompt: 'Ошибка `unable to get local issuer certificate` чаще всего значит, что сервер не отдаёт … сертификат. (одно слово)', answer: { accept: ['промежуточный', 'intermediate', 'промежуточные', 'промежуточного', 'промежуточный сертификат', 'intermediate certificate', 'intermediate ca'] }, explanation: 'Неполная цепочка: нужно отдавать fullchain (сервер + intermediate).' },
    { id: 'q-alert', type: 'text', prompt: 'Предложи профилактику, чтобы сертификаты не истекали внезапно (ключевые слова: мониторинг/алерт или автопродление).', answer: { accept: [], normalize: 'keywords', keywords: [['монитор', 'алерт', 'alert', 'автопродл', 'auto-renew', 'autorenew', 'certbot', 'cert-manager', 'напомина']] }, explanation: 'Алерт за 21/7/1 день и автопродление (certbot, cert-manager).' },
  ],
  glossary: [
    { ru: 'Сертификат', en: 'TLS certificate', def: 'Подписанный документ, связывающий имя сайта с ключом.' },
    { ru: 'Цепочка сертификатов', en: 'certificate chain', def: 'Серверный → промежуточный → корневой сертификат.' },
    { ru: 'Указание имени сервера', en: 'SNI, Server Name Indication', def: 'Имя сайта в TLS-рукопожатии для выбора сертификата.' },
  ],
};
export default lesson;
