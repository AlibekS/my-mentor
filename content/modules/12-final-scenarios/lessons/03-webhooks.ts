import type { LessonDef } from '../../../../src/content/types';

const log: string[] = [];
let n403 = 0;
for (let m = 0; m < 80; m++) {
  const h = m < 40 ? 22 + Math.floor(m / 20) : 0 + Math.floor((m - 40) / 4);
  const d = m < 40 ? '03' : '04';
  const mm = (m * 7) % 60;
  const t = `2026-11-${d}T${String(h % 24).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`;
  const after = m >= 30;
  if (after) n403++;
  log.push(`${t} notifier webhook partner=kazpost-logistics event=order.created order=${81000 + m} url=https://api.kazpost-logistics.kz/hooks/orders status=${after ? '403 body="IP not allowed"' : '200'}`);
}
log.splice(30, 0, '2026-11-03T23:30:00Z infra CHG-911 migrate egress to new NAT gateway nat-gw-02 (eip 34.89.120.17)');

const lesson: LessonDef = {
  id: 'webhooks',
  title: 'Сценарий: партнёр перестал получать вебхуки',
  minutes: 30,
  commands: ['grep', 'curl', 'cat'],
  scenario: {
    files: {
      '/var/log/notifier/webhooks.log': log.join('\n') + '\n',
      '/home/alibek/partners/kazpost-logistics.md': { owner: 'alibek', content: '# Партнёр: KazPost Logistics\nКонтакт: integrations@kazpost-logistics.kz\nВебхук: https://api.kazpost-logistics.kz/hooks/orders\nIP allowlist (согласован 2025-06): 35.198.44.201\n' },
    },
    network: {
      hosts: { 'ifconfig.me': { ip: '34.117.59.81' }, 'api.kazpost-logistics.kz': { ip: '91.201.215.10' } },
      http: {
        'https://ifconfig.me/': { status: 200, body: '34.89.120.17' },
        'https://api.kazpost-logistics.kz/hooks/orders': { status: 403, body: '{"error":"IP not allowed"}\n', headers: { 'Content-Type': 'application/json' } },
      },
    },
  },
  tasks: [
    {
      id: 'count',
      prompt: 'Сколько вебхуков партнёру получили ответ **403** в `/var/log/notifier/webhooks.log`? Выведи число.',
      check: { type: 'outputNumber', value: n403 },
      hints: ['`grep -c "status=403" /var/log/notifier/webhooks.log`'],
      solution: 'grep -c "status=403" /var/log/notifier/webhooks.log',
      tags: ['grep'],
    },
    {
      id: 'change',
      prompt: 'Что изменилось прямо перед первым 403? Найди в том же логе запись infra и введи **номер изменения**.',
      answer: { accept: ['CHG-911', '911'], label: 'Изменение:' },
      hints: ['`grep infra /var/log/notifier/webhooks.log`', 'Или: `grep -B1 -m1 403 …` — строка перед первым 403.'],
      solution: 'grep infra /var/log/notifier/webhooks.log',
    },
    {
      id: 'egress',
      prompt: 'Какой у нас **сейчас** внешний (egress) IP? Узнай через `curl` к `https://ifconfig.me` и введи адрес.',
      answer: { accept: ['34.89.120.17'], label: 'IP:' },
      hints: ['`curl -s https://ifconfig.me`'],
      solution: 'curl -s https://ifconfig.me',
      tags: ['curl'],
    },
    {
      id: 'allowlist',
      prompt: 'Какой IP согласован у партнёра в allowlist? Посмотри `~/partners/kazpost-logistics.md` и введи адрес.',
      answer: { accept: ['35.198.44.201'], label: 'IP в allowlist:' },
      hints: ['`cat ~/partners/kazpost-logistics.md`'],
      solution: 'cat ~/partners/kazpost-logistics.md',
    },
    {
      id: 'email',
      prompt: 'Напиши письмо партнёру (EN): что вебхуки отклоняются с 403 «IP not allowed» с 23:30 UTC 3 ноября, что мы сменили исходящий IP, **просьба добавить новый IP** (укажи его), что после этого мы переотправим пропущенные события, контакт для связи.',
      write: {
        lang: 'en',
        minWords: 45,
        rubric: [
          { label: '403 / IP not allowed', any: ['403', 'not allowed', 'rejected', 'forbidden'] },
          { label: 'время начала UTC', any: ['\\d{1,2}:\\d{2}\\s?UTC'] },
          { label: 'новый IP 34.89.120.17', any: ['34\\.89\\.120\\.17'] },
          { label: 'просьба добавить в allowlist', any: ['(add|whitelist|allowlist|allow).{0,40}(ip|address|34\\.89)', 'allow ?list'] },
          { label: 'переотправим пропущенные события', any: ['resen[dt]', 're-?deliver', 'replay', 'retry (the )?(missed|failed)'] },
          { label: 'вежливое закрытие / контакт', any: ['thank', 'regards', 'contact', 'reach (out|us)'] },
        ],
      },
      hints: ['Партнёру не нужны внутренние подробности про NAT — достаточно «we changed our outgoing IP address».', 'Можно предложить оставить старый IP ещё на неделю, если он им важен.'],
      solution: 'Hello KazPost Logistics team,\n\nSince 23:30 UTC on November 3, our order webhooks to https://api.kazpost-logistics.kz/hooks/orders are rejected with 403 "IP not allowed". We have changed our outgoing IP address as part of planned infrastructure work. Could you please add 34.89.120.17 to your allowlist? As soon as it is added, we will resend all missed order events.\n\nThank you, and feel free to contact us at any time.\nBest regards, Alibek, L3 Support',
    },
  ],
  quiz: [
    { id: 'q-403', type: 'choice', prompt: 'После переноса нашего сервиса в новый облачный регион партнёр отвечает 403, хотя токен верный. Наиболее вероятная причина?', options: ['Истёк сертификат партнёра', 'Наш egress IP изменился и не входит в allowlist партнёра', 'Партнёр удалил эндпоинт'], correct: 1, explanation: 'Удалённый эндпоинт дал бы 410/404, проблема с сертификатом — ошибку TLS.' },
    { id: 'q-egress', type: 'text', prompt: 'Как по-английски называется исходящий внешний IP-адрес сервиса? (одно слово + IP)', answer: { accept: ['egress IP', 'egress', 'outbound IP', 'outgoing IP'] }, explanation: 'Egress IP (outbound).' },
    { id: 'q-401', type: 'text', prompt: 'Партнёр отвечает 401 на наши вебхуки. Что проверить первым? (ключевые слова: токен/секрет/подпись)', answer: { accept: [], normalize: 'keywords', keywords: [['токен', 'token', 'секрет', 'secret', 'подпис', 'signature', 'credential', 'ключ']] }, explanation: '401 — аутентификация: токен, секрет подписи, срок действия.' },
    { id: 'q-prevent', type: 'text', prompt: 'Action item, чтобы такое не повторилось (ключевые слова: реестр/уведомлять партнёров заранее/фиксированный IP).', answer: { accept: [], normalize: 'keywords', keywords: [['реестр', 'список', 'уведом', 'заранее', 'фиксирован', 'статическ', 'static', 'notify']] }, explanation: 'Реестр партнёров с allowlist + уведомление заранее при смене egress; статические IP для интеграций.' },
  ],
  glossary: [
    { ru: 'Белый список IP', en: 'IP allowlist', def: 'Список адресов, с которых разрешены запросы.' },
    { ru: 'Исходящий адрес', en: 'egress IP', def: 'Внешний IP, с которого сервис ходит в интернет.' },
    { ru: 'NAT-шлюз', en: 'NAT gateway', def: 'Узел, через который приватные серверы выходят в интернет под общим IP.' },
  ],
};
export default lesson;
