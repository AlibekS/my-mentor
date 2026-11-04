import type { PlacementTopic } from '../../src/content/types';

/** Все перестановки букв: флаги ss можно писать в любом порядке */
const perms = (s: string): string[] => (s.length <= 1 ? [s] : [...s].flatMap((c, i) => perms(s.slice(0, i) + s.slice(i + 1)).map((p) => c + p)));
const ssVariants = ['tulpn', 'tlpn'].flatMap(perms).flatMap((f) => [`ss -${f}`, `sudo ss -${f}`]);

const t: PlacementTopic = {
  moduleId: '06-network',
  questions: [
    { id: 'pl-net-1', difficulty: 1, lessons: ['http'], prompt: 'Какой HTTP-код означает «не найдено»? (число)', answer: { accept: ['404'], normalize: 'number' } },
    { id: 'pl-net-2', difficulty: 2, lessons: ['ports'], prompt: 'Какой командой посмотреть, какие процессы слушают TCP/UDP-порты (с PID, числами)? (ss с флагами)', answer: { accept: [...ssVariants, 'ss -antp', 'sudo ss -antp'], normalize: 'exact' } },
    {
      id: 'pl-net-3',
      difficulty: 2,
      lessons: ['dns'],
      prompt: 'Клиент пишет, что `api.shop.kz` не открывается. Проверь DNS и введи статус ответа DNS-сервера (как в выводе dig).',
      scenario: { network: { hosts: { 'shop.kz': { ip: '10.0.2.5' } } } },
      answer: { accept: ['NXDOMAIN', 'status: NXDOMAIN'] },
    },
    { id: 'pl-net-4', difficulty: 3, lessons: ['http'], prompt: 'Чем отличаются 502 и 504 от прокси (nginx)? Ответь кратко: какой из них — «бэкенд не ответил вовремя»? (число)', answer: { accept: ['504'], normalize: 'number' } },
    {
      id: 'pl-net-5',
      difficulty: 3,
      lessons: ['tls'],
      prompt: 'Сайт `https://pay.shop.kz` перестал открываться у всех. Исследуй через `curl -v` и введи, что случилось с сертификатом (одно-два слова, англ. или рус.).',
      scenario: { network: { hosts: { 'pay.shop.kz': { ip: '10.0.2.9', cert: { subject: 'CN = pay.shop.kz', issuer: "C = US, O = Let's Encrypt, CN = R11", notBefore: 'Aug  1 00:00:00 2026 GMT', notAfter: 'Oct 30 23:59:59 2026 GMT' } } }, http: { 'https://pay.shop.kz/': { status: 200, body: 'ok' } } } },
      answer: { accept: [], normalize: 'keywords', keywords: [['expired', 'истёк', 'истек', 'просроч', 'закончил', 'срок действия']] },
    },
  ],
};
export default t;
