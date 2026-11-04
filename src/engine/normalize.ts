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

export function parseNumber(s: string): number | null {
  const m = /-?\d+(?:[.,]\d+)?/.exec(s.replace(/\s+/g, ''));
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
  if (mode === 'exact') return spec.accept.some((a) => normCommand(a) === normCommand(input));
  if (mode === 'keywords') {
    const t = normText(input);
    const groups = spec.keywords ?? spec.accept.map((a) => [a]);
    return groups.every((g) => g.some((k) => t.includes(normText(k))));
  }
  const t = normText(input);
  return spec.accept.some((a) => normText(a) === t);
}
