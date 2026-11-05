/**
 * Общие данные модуля «Роль L2 и работа с тикетами»: вымышленный SaaS ShopFlow (платформа интернет-магазинов),
 * тикеты в стиле Zendesk, матрица приоритетов, SLA. Все числа в ответах вычисляются отсюда.
 */

export const HOME = '/home/alibek';

export interface TicketSpec {
  id: string;
  created: string; // "2026-11-04 08:12"
  customer: string;
  plan: 'Business' | 'Standard' | 'Enterprise';
  requester: string;
  subject: string;
  status: 'New' | 'Open' | 'Pending' | 'On-hold' | 'Solved';
  assignee: 'L1' | 'L2' | 'L3' | '-';
  priority?: string;
  category?: string;
  /** дополнительные поля после Assignee (Affected:, Workaround: …) */
  extra?: Record<string, string>;
  body: string;
}

/** Текст тикета, как его выгружает helpdesk */
export function ticketText(t: TicketSpec): string {
  const lines = [
    `Ticket: ${t.id}`,
    `Created: ${t.created} UTC`,
    `Customer: ${t.customer} (plan: ${t.plan})`,
    `Requester: ${t.requester}`,
    `Subject: ${t.subject}`,
    `Status: ${t.status}`,
    `Priority: ${t.priority ?? '-'}`,
    `Assignee: ${t.assignee}`,
  ];
  if (t.category) lines.push(`Category: ${t.category}`);
  for (const [k, v] of Object.entries(t.extra ?? {})) lines.push(`${k}: ${v}`);
  return lines.join('\n') + '\n---\n' + t.body.trim() + '\n';
}

/** Файлы тикетов для scenario.files: ~/<dir>/<id>.txt */
export function ticketFiles(dir: string, list: TicketSpec[]): Record<string, { content: string; owner: string }> {
  return Object.fromEntries(list.map((t) => [`${HOME}/${dir}/${t.id}.txt`, { content: ticketText(t), owner: 'alibek' }]));
}

/** Варианты ответа «номер тикета» */
export function ticketAccept(id: string): string[] {
  const num = id.replace(/^\D+/, '');
  return [id, num, `${id}.txt`, id.replace('-', ' '), id.replace('-', ''), `#${num}`, `#${id}`, `~/queue/${id}.txt`, `~/tickets/${id}.txt`, `${HOME}/queue/${id}.txt`, `${HOME}/tickets/${id}.txt`, `тикет ${id}`, `ticket ${id}`];
}

const PRIO_NAMES: Record<number, string[]> = {
  1: ['urgent', 'critical', 'критический', 'срочный', 'наивысший'],
  2: ['high', 'высокий'],
  3: ['normal', 'medium', 'средний', 'обычный', 'нормальный'],
  4: ['low', 'низкий'],
};

/** Варианты ответа «приоритет P1–P4» (латиница, кириллица «Р», слова Zendesk) */
export function prioAccept(n: number): string[] {
  const codes = [`P${n}`, `Р${n}`, `P-${n}`, `P ${n}`, `Р-${n}`, `Р ${n}`, `${n}`, `priority ${n}`, `приоритет ${n}`, `приоритет P${n}`, `priority P${n}`];
  const out = [...codes, ...PRIO_NAMES[n]];
  for (const c of [`P${n}`, `Р${n}`])
    for (const name of PRIO_NAMES[n]) out.push(`${c} ${name}`, `${c} (${name})`, `${c} - ${name}`, `${c} — ${name}`, `${c}, ${name}`, `${c} / ${name}`);
  return out;
}

/** Первый ответ (first response) по SLA, минуты — тариф Business, 24/7 */
export const SLA_FIRST_RESPONSE_MIN: Record<number, number> = { 1: 30, 2: 120, 3: 480, 4: 1440 };
/** Решение / обходной путь (resolution), часы */
export const SLA_RESOLUTION_H: Record<number, string> = { 1: '4 часа', 2: '1 сутки', 3: '3 рабочих дня', 4: '10 рабочих дней' };

export const toMin = (hm: string) => {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
};
export const hm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Варианты записи времени для keywords: «11:40», «11.40», «11-40», «11 40» */
export function timeKeywords(t: string): string[] {
  const [h, m] = t.split(':');
  const hh = String(Number(h));
  const v = new Set([`${h}:${m}`, `${h}.${m}`, `${h}-${m}`, `${h} ${m}`, `${h}ч${m}`, `${h} ч ${m}`, `${hh}:${m}`, `${hh}.${m}`, `${hh}-${m}`, `${hh} ${m}`, `${h}h${m}`]);
  return [...v];
}

/**
 * Варианты точного ответа «время»: «11:40», «11.40», «в 11:40 UTC», «до 11:40 (UTC)».
 * Точное сравнение (а не keywords), чтобы «15:30» не засчитывалось как «5:30».
 */
export function timeAccept(t: string, zone = 'utc'): string[] {
  const [h, m] = t.split(':');
  const hh = String(Number(h));
  const bases = new Set([`${h}:${m}`, `${h}.${m}`, `${h}-${m}`, `${h} ${m}`, `${hh}:${m}`, `${hh}.${m}`, `${hh}-${m}`, `${h}ч${m}`, `${hh} ч ${m} мин`, `${h}:${m}:00`]);
  const out: string[] = [];
  for (const b of bases)
    for (const pre of ['', 'в ', 'до ', 'к ', 'at '])
      for (const suf of ['', ` ${zone}`, ` по ${zone}`, ` (${zone})`, zone === 'utc' ? ' gmt' : ' ', ` ${zone}+0`].map((s) => s.trimEnd()))
        out.push(pre + b + suf);
  return [...new Set(out)];
}

export const PRIORITY_MD = `# Матрица приоритетов ShopFlow Support

Приоритет = влияние (impact) × срочность (urgency).

## Влияние (impact)
- High   — не работает ключевая функция (оплата, вход, оформление заказа)
           ИЛИ затронуто много клиентов (магазинов) сразу
- Medium — проблема у одного клиента или в неключевой функции
- Low    — косметика, вопрос «как сделать», пожелание

## Срочность (urgency)
- High — обходного пути нет, клиент теряет деньги/продажи прямо сейчас
- Low  — есть обходной путь (workaround) или можно подождать

## Итог
| Impact \\ Urgency | High | Low |
|------------------|------|-----|
| High             | P1   | P2  |
| Medium           | P2   | P3  |
| Low              | P3   | P4  |

Сомневаешься между двумя приоритетами — ставь более высокий и напиши почему.
`;

export const SLA_MD = `# SLA ShopFlow Support

Время считается от создания тикета (Created) в UTC.

## Тариф Business и Enterprise — 24/7
| Приоритет | Первый ответ (first response) | Решение или workaround (resolution) |
|-----------|-------------------------------|-------------------------------------|
| P1        | 30 минут                      | 4 часа                              |
| P2        | 2 часа                        | 1 сутки                             |
| P3        | 8 часов                       | 3 рабочих дня                       |
| P4        | 24 часа                       | 10 рабочих дней                     |

## Тариф Standard — только рабочие часы
Те же цифры, но часы считаются только в рабочее время клиента:
пн–пт, 09:00–18:00 по его часовому поясу.

## Пауза
В статусе Pending (ждём ответа клиента) таймер решения стоит на паузе.
`;
