import type { AnswerSpec } from '../content/types';

export function normText(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'`]/g, '')
    .replace(/[.,;!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normCommand(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/\s*\|\s*/g, ' | ').trim();
}

const WORD_NUMS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  ноль: 0, один: 1, одна: 1, одно: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10,
};

export function parseNumber(s: string): number | null {
  // «four», «три» — число словами (если цифр нет)
  if (!/\d/.test(s)) {
    const w = s.toLowerCase().match(/[a-zа-яё]+/g)?.find((x) => x in WORD_NUMS);
    return w !== undefined ? WORD_NUMS[w] : null;
  }
  // «0.0.0.0:6379», «127.0.0.1:8081» — ответом считается порт
  const ipPort = /\b\d{1,3}(?:\.\d{1,3}){3}:(\d+)\b/.exec(s);
  if (ipPort) return parseFloat(ipPort[1]);
  // «14:41-14:04=37», «итого = 37» — ответ после последнего «=»
  const eq = s.lastIndexOf('=');
  if (eq >= 0 && /\d/.test(s.slice(eq + 1))) s = s.slice(eq + 1);
  // «1 234» → 1234; число, приклеенное к букве (p95, HTTP2, v1), — часть названия, а не ответ
  const t = s.replace(/(?<![\d.,])(\d{1,3})\s(?=\d{3}(?!\d))/g, '$1');
  const m = /(?<![A-Za-zА-Яа-яЁё_\d./])-?\d+(?:[.,]\d+)?/.exec(t) ?? /-?\d+(?:[.,]\d+)?/.exec(t);
  return m ? parseFloat(m[0].replace(',', '.')) : null;
}

/** Проверка текстового ответа с нормализацией */
export function checkAnswer(input: string, spec: AnswerSpec): boolean {
  const mode = spec.normalize ?? 'text';
  if (!input.trim()) return false;
  if (mode === 'number') {
    const n = parseNumber(input);
    return n !== null && spec.accept.some((a) => Math.abs(parseFloat(a) - n) < 1e-9);
  }
  if (mode === 'exact') return spec.accept.some((a) => normCommand(a) === normCommand(input) || normCommand(a) === normCommand(stripCommandName(input, a)));
  if (mode === 'keywords') {
    const t = normText(input);
    const groups = spec.keywords ?? spec.accept.map((a) => [a]);
    return groups.every((g) => g.some((k) => t.includes(normText(k))));
  }
  const t = normText(input);
  return spec.accept.some((a) => normText(a) === t || normText(a) === normText(stripCommandName(input, a)));
}

/**
 * Ответ-флаг можно написать вместе с командой: «grep -v» для «-v», «journalctl -f» для «-f».
 * Убираем первое слово, если ожидается флаг, а ответ начинается с имени команды.
 */
function stripCommandName(input: string, accepted: string): string {
  if (!accepted.trim().startsWith('-')) return input;
  // «grep -v», «docker ps -a», «kubectl logs --previous» — до двух слов (команда и подкоманда) перед флагом
  const m = /^\s*(?:sudo\s+)?[a-z][\w.-]*(?:\s+[a-z][\w.-]*)?\s+(-.*)$/i.exec(input);
  return m ? m[1] : input;
}
