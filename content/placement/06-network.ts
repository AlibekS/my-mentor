import type { PlacementTopic } from '../../src/content/types';

const t: PlacementTopic = {
  moduleId: '06-network',
  questions: [
    { id: 'pl-net-1', difficulty: 1, prompt: 'Какой HTTP-код означает «не найдено»? (число)', answer: { accept: ['404'], normalize: 'number' } },
    { id: 'pl-net-2', difficulty: 2, prompt: 'Какой командой посмотреть, какие процессы слушают TCP/UDP-порты (с PID, числами)? (ss с флагами)', answer: { accept: ['ss -tulpn', 'ss -tlpn', 'ss -lntp', 'ss -ltnp', 'ss -tunlp', 'sudo ss -tulpn', 'ss -nltp', 'ss -plnt', 'ss -antp'], normalize: 'exact' } },
    {
      id: 'pl-net-3',
      difficulty: 2,
      prompt: 'Клиент пишет, что `api.shop.kz` не открывается. Проверь DNS и введи статус ответа DNS-сервера (как в выводе dig).',
      scenario: { network: { hosts: { 'shop.kz': { ip: '10.0.2.5' } } } },
      answer: { accept: ['NXDOMAIN'] },
    },
    { id: 'pl-net-4', difficulty: 3, prompt: 'Чем отличаются 502 и 504 от прокси (nginx)? Ответь кратко: какой из них — «бэкенд не ответил вовремя»? (число)', answer: { accept: ['504'], normalize: 'number' } },
    {
      id: 'pl-net-5',
      difficulty: 3,
      prompt: 'Сайт `https://pay.shop.kz` перестал открываться у всех. Исследуй через `curl -v` и введи, что случилось с сертификатом (одно-два слова, англ. или рус.).',
      scenario: { network: { hosts: { 'pay.shop.kz': { ip: '10.0.2.9', cert: { subject: 'CN = pay.shop.kz', issuer: "C = US, O = Let's Encrypt, CN = R11", notBefore: 'Aug  1 00:00:00 2026 GMT', notAfter: 'Oct 30 23:59:59 2026 GMT' } } }, http: { 'https://pay.shop.kz/': { status: 200, body: 'ok' } } } },
      answer: { accept: [], normalize: 'keywords', keywords: [['expired', 'истёк', 'истек', 'просроч']] },
    },
  ],
};
export default t;
