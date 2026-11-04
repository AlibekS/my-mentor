import { MASTERY } from './config';
import type { Module } from '../content/types';
import type { Progress, TaskProgress } from './progress';

export type MasteryStatus = 'not-started' | 'in-progress' | 'mastered' | 'review-due';

export function taskQuality(t: TaskProgress | undefined): number {
  if (!t?.solved) return 0;
  const q = MASTERY.taskQuality;
  if (t.solutionShown) return q.solutionShown;
  if (t.hintsUsed === 0) return q.noHints;
  if (t.hintsUsed === 1) return q.oneHint;
  return q.moreHints;
}

/**
 * «Заработанное» освоение темы 0..1 по урокам, заданиям, тесту, боссу и повторениям.
 * Подсказки снижают вклад задания, но никогда не уменьшают уже набранный процент
 * (итог хранится как максимум в masteryBest).
 */
export function earnedFraction(m: Module, p: Progress): { fraction: number; bossDone: boolean } {
  const w = MASTERY.weights;
  const lessons = m.lessons;
  const plan = p.plan?.items.find((i) => i.moduleId === m.id);
  const bossKey = m.boss?.key;
  const bossDone = !!(bossKey && p.lessons[bossKey]?.completedAt);
  if (!lessons.length) return { fraction: 0, bossDone };

  // экзамен на входе: после «босса» тема засчитывается целиком
  if (plan?.mode === 'exam' && bossDone) return { fraction: 1, bossDone };

  let lessonsDone = 0;
  let taskScore = 0;
  let taskTotal = 0;
  let quizScore = 0;
  let quizTotal = 0;
  for (const l of lessons) {
    const lp = p.lessons[l.key];
    const skippedOk = plan?.skippable.includes(l.id);
    if (lp?.completedAt) lessonsDone++;
    else if (skippedOk && bossDone) lessonsDone++;
    for (const t of l.tasks) {
      taskTotal++;
      taskScore += lp ? taskQuality(lp.tasks[t.id]) : skippedOk && bossDone ? 1 : 0;
    }
    for (const q of l.quiz) {
      quizTotal++;
      const qp = lp?.quiz[q.id];
      quizScore += qp?.correct ? (qp.firstTry ? 1 : 0.5) : skippedOk && bossDone ? 1 : 0;
    }
  }
  let f =
    w.lessons * (lessonsDone / lessons.length) +
    w.tasks * (taskTotal ? taskScore / taskTotal : 0) +
    w.quiz * (quizTotal ? quizScore / quizTotal : 0) +
    (bossDone ? w.boss : 0);
  const reviews = Object.values(p.review).filter((r) => r.lessonKey.startsWith(m.id + '/')).reduce((s, r) => s + r.successes, 0);
  f += Math.min(MASTERY.reviewCap, reviews * MASTERY.reviewBonus) / 100;
  return { fraction: Math.min(1, f), bossDone };
}

/** Текущее (сырое) освоение 0..100: старт + рост до 100 */
export function computeMastery(m: Module, p: Progress): number {
  const start = p.plan?.items.find((i) => i.moduleId === m.id)?.startPct ?? 0;
  const { fraction, bossDone } = earnedFraction(m, p);
  let v = start + (100 - start) * fraction;
  if (!bossDone) v = Math.min(v, MASTERY.capWithoutBoss);
  return Math.round(Math.max(start, v));
}

export interface MasteryView {
  moduleId: string;
  start: number;
  best: number;
  value: number;
  status: MasteryStatus;
  reviewDue: number;
}

/** Отображаемое освоение с учётом забывания */
export function masteryView(m: Module, p: Progress, now = Date.now()): MasteryView {
  const start = p.plan?.items.find((i) => i.moduleId === m.id)?.startPct ?? 0;
  const best = Math.max(p.masteryBest[m.id] ?? 0, computeMastery(m, p));
  const overdue = Object.values(p.review).filter((r) => r.lessonKey.startsWith(m.id + '/') && r.due < now).length;
  const last = p.lastActivity[m.id];
  let value = best;
  let status: MasteryStatus;
  const touched = Object.keys(p.lessons).some((k) => k.startsWith(m.id + '/'));
  const daysIdle = last ? (now - last) / 86400e3 : 0;
  if (overdue && last && daysIdle > MASTERY.decayAfterDays) {
    const weeks = (daysIdle - MASTERY.decayAfterDays) / 7;
    value = Math.round(Math.max(best * MASTERY.decayFloor, best - weeks * MASTERY.decayPerWeek));
  }
  if (overdue && (value < best || daysIdle > 3)) status = 'review-due';
  else if (best >= 100) status = 'mastered';
  else if (touched || best > start) status = 'in-progress';
  else status = 'not-started';
  return { moduleId: m.id, start, best, value, status, reviewDue: overdue };
}

/** Общая готовность к роли L3 — взвешенное по важности среднее */
export function overallReadiness(mods: Module[], p: Progress, now = Date.now()): number {
  let s = 0;
  let w = 0;
  for (const m of mods) {
    s += masteryView(m, p, now).value * m.importance;
    w += m.importance;
  }
  return w ? Math.round(s / w) : 0;
}

/** Обновить masteryBest после события; вернуть {before, after} для модуля */
export function bumpMastery(p: Progress, m: Module): { before: number; after: number } {
  const before = p.masteryBest[m.id] ?? computeMastery(m, { ...p, lessons: {} });
  const after = Math.max(before, computeMastery(m, p));
  p.masteryBest[m.id] = after;
  return { before, after };
}
