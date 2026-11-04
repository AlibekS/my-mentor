import type { WriteSpec } from '../content/types';

export interface RubricResult {
  items: { label: string; ok: boolean }[];
  words: number;
  enoughWords: boolean;
  ok: boolean;
}

/** Проверка письменного ответа по чек-листу: каждое требование — набор regex (любой подходит) */
export function checkRubric(text: string, spec: WriteSpec): RubricResult {
  const items = spec.rubric.map((r) => ({
    label: r.label,
    ok:
      (r.minMatches && r.any
        ? (text.match(new RegExp(r.any[0], 'gimu')) ?? []).length >= r.minMatches
        : !r.any || r.any.some((p) => new RegExp(p, 'imu').test(text))) &&
      (!r.none || (text.trim().length > 0 && !r.none.some((p) => new RegExp(p, 'imu').test(text)))),
  }));
  const words = (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
  const enoughWords = words >= (spec.minWords ?? 0);
  return { items, words, enoughWords, ok: enoughWords && items.every((i) => i.ok) };
}
