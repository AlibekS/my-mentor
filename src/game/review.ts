import { REVIEW_INTERVALS } from './config';
import type { Progress, ReviewItem } from './progress';

const DAY = 86400e3;

/** Добавить в повторение задание/вопрос, где была ошибка или подсказка */
export function scheduleReview(p: Progress, lessonKey: string, itemId: string, kind: ReviewItem['kind'], now = Date.now()) {
  const key = `${lessonKey}${kind === 'task' ? '#' : '?'}${itemId}`;
  const existing = p.review[key];
  if (existing) {
    existing.step = 0;
    existing.due = now + REVIEW_INTERVALS[0] * DAY;
    return;
  }
  p.review[key] = { key, lessonKey, itemId, kind, due: now + REVIEW_INTERVALS[0] * DAY, step: 0, lapses: 0, successes: 0 };
}

export function reviewResult(p: Progress, key: string, success: boolean, now = Date.now()) {
  const r = p.review[key];
  if (!r) return;
  if (success) {
    r.successes++;
    r.step++;
    if (r.step >= REVIEW_INTERVALS.length) {
      delete p.review[key];
      return;
    }
    r.due = now + REVIEW_INTERVALS[r.step] * DAY;
  } else {
    r.lapses++;
    r.step = 0;
    r.due = now + REVIEW_INTERVALS[0] * DAY;
  }
}

export function dueReviews(p: Progress, now = Date.now()): ReviewItem[] {
  return Object.values(p.review)
    .filter((r) => r.due <= now)
    .sort((a, b) => a.due - b.due);
}
