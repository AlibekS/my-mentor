import { LEVELS, RANKS, XP } from './config';

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(LEVELS.base * Math.pow(level - 1, LEVELS.exp));
}

export function levelFromXp(xp: number): number {
  let lvl = 1;
  while (lvl < LEVELS.max && xp >= xpForLevel(lvl + 1)) lvl++;
  return lvl;
}

export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  const cur = xpForLevel(level);
  const next = level >= LEVELS.max ? cur : xpForLevel(level + 1);
  return { level, cur, next, into: xp - cur, need: next - cur, pct: next === cur ? 100 : Math.round(((xp - cur) / (next - cur)) * 100) };
}

export function rankForLevel(level: number) {
  let r: (typeof RANKS)[number] = RANKS[0];
  for (const rank of RANKS) if (level >= rank.minLevel) r = rank;
  return r;
}

export function taskXp(hintsUsed: number, solutionShown: boolean): number {
  if (solutionShown) return XP.task.solutionShown;
  if (hintsUsed === 0) return XP.task.noHints;
  if (hintsUsed === 1) return XP.task.oneHint;
  return XP.task.moreHints;
}

export function quizXp(attempt: number): number {
  return attempt === 1 ? XP.quiz.firstTry : attempt === 2 ? XP.quiz.secondTry : 0;
}

export function streakBonus(days: number): number {
  return Math.min(days * XP.streakPerDay, XP.streakMaxBonus);
}
