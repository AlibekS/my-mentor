import type { Lesson, Module } from '../content/types';
import type { ExecRecord } from '../shell/types';
import { XP } from './config';
import { quizXp, streakBonus, taskXp } from './levels';
import { bumpMastery } from './mastery';
import type { LessonProgress, Progress, TaskProgress } from './progress';
import { reviewResult, scheduleReview } from './review';

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function log(p: Progress, text: string, xp?: number, now = Date.now()) {
  p.history.unshift({ ts: now, text, xp });
  if (p.history.length > 60) p.history.length = 60;
}

export function addXp(p: Progress, xp: number, text: string, now = Date.now()) {
  if (xp <= 0) return;
  p.xp += xp;
  log(p, text, xp, now);
}

/** Отметить активность сегодня: серия дней и бонус */
export function touchDay(p: Progress, now = new Date()): number {
  const today = dayKey(now);
  const h = now.getHours();
  if (p.streak.lastDay === today) return 0;
  const yesterday = dayKey(new Date(now.getTime() - 86400e3));
  p.streak.current = p.streak.lastDay === yesterday ? p.streak.current + 1 : 1;
  p.streak.best = Math.max(p.streak.best, p.streak.current);
  p.streak.lastDay = today;
  if (h >= 23) p.stats.nightSessions++;
  if (h < 7) p.stats.earlySessions++;
  const bonus = p.streak.current > 1 ? streakBonus(p.streak.current - 1) : 0;
  if (bonus) addXp(p, bonus, `Серия ${p.streak.current} дн. подряд`, now.getTime());
  return bonus;
}

export function ensureLesson(p: Progress, l: Lesson, now = Date.now()): LessonProgress {
  if (!p.lessons[l.key]) p.lessons[l.key] = { started: now, tasks: {}, quiz: {}, xp: 0, timeMs: 0 };
  return p.lessons[l.key];
}

export function ensureTask(lp: LessonProgress, taskId: string): TaskProgress {
  if (!lp.tasks[taskId]) lp.tasks[taskId] = { solved: false, hintsUsed: 0, solutionShown: false, attempts: 0, xp: 0 };
  return lp.tasks[taskId];
}

export function recordCommand(p: Progress, rec: ExecRecord, moduleId?: string, now = Date.now()) {
  p.stats.commandsRun++;
  for (const c of rec.commands) p.stats.commandCounts[c] = (p.stats.commandCounts[c] ?? 0) + 1;
  p.stats.maxPipes = Math.max(p.stats.maxPipes, rec.pipes);
  if (rec.exitCode !== 0) p.stats.errorsSeen++;
  if (moduleId) p.lastActivity[moduleId] = now;
}

export function useHint(p: Progress, l: Lesson, taskId: string) {
  const t = ensureTask(ensureLesson(p, l), taskId);
  if (!t.solved) t.hintsUsed++;
}

export function showSolution(p: Progress, l: Lesson, taskId: string) {
  const t = ensureTask(ensureLesson(p, l), taskId);
  if (!t.solved) t.solutionShown = true;
}

/** Задание решено. Возвращает начисленный XP (0, если уже было решено) */
export function solveTask(p: Progress, m: Module, l: Lesson, taskId: string, commandsUsed: string[], now = Date.now()): number {
  const lp = ensureLesson(p, l, now);
  const t = ensureTask(lp, taskId);
  if (t.solved) return 0;
  t.solved = true;
  t.solvedWith = [...new Set(commandsUsed)];
  const xp = taskXp(t.hintsUsed, t.solutionShown);
  t.xp = xp;
  lp.xp += xp;
  p.stats.tasksSolved++;
  if (t.hintsUsed === 0 && !t.solutionShown) p.stats.tasksNoHints++;
  if (commandsUsed.includes('grep')) p.stats.grepTasks++;
  if (t.hintsUsed > 1 || t.solutionShown) scheduleReview(p, l.key, taskId, 'task', now);
  p.lastActivity[m.id] = now;
  addXp(p, xp, `Задание решено: ${l.title}`, now);
  bumpMastery(p, m);
  return xp;
}

export function failAttempt(p: Progress, l: Lesson, taskId: string) {
  ensureTask(ensureLesson(p, l), taskId).attempts++;
}

/** Ответ на вопрос мини-теста. Возвращает XP */
export function answerQuestion(p: Progress, m: Module, l: Lesson, qId: string, correct: boolean, now = Date.now()): number {
  const lp = ensureLesson(p, l, now);
  const q = (lp.quiz[qId] ??= { attempts: 0, correct: false, firstTry: false, xp: 0 });
  if (q.correct) return 0;
  q.attempts++;
  p.lastActivity[m.id] = now;
  if (!correct) {
    if (q.attempts === 1) scheduleReview(p, l.key, qId, 'question', now);
    return 0;
  }
  q.correct = true;
  q.firstTry = q.attempts === 1;
  p.stats.quizAnswered++;
  if (q.firstTry) p.stats.quizFirstTry++;
  const xp = quizXp(q.attempts);
  q.xp = xp;
  lp.xp += xp;
  addXp(p, xp, `Тест: ${l.title}`, now);
  bumpMastery(p, m);
  return xp;
}

/** Пропустить вопрос (после 2 неудачных попыток) — он уйдёт в повторение */
export function giveUpQuestion(p: Progress, l: Lesson, qId: string) {
  const lp = ensureLesson(p, l);
  const q = (lp.quiz[qId] ??= { attempts: 0, correct: false, firstTry: false, xp: 0 });
  q.attempts = Math.max(q.attempts, 2);
}

export function completeLesson(p: Progress, m: Module, l: Lesson, now = Date.now()): { xp: number; before: number; after: number } {
  const lp = ensureLesson(p, l, now);
  const before = p.masteryBest[m.id] ?? p.plan?.items.find((i) => i.moduleId === m.id)?.startPct ?? 0;
  if (lp.completedAt) return { xp: 0, before, after: before };
  lp.masteryBefore = before;
  lp.completedAt = now;
  const boss = l.kind === 'boss';
  const xp = boss ? XP.bossComplete : XP.lessonComplete;
  lp.xp += xp;
  if (boss) p.stats.bossesBeaten++;
  addXp(p, xp, boss ? `Босс повержен: ${m.title}` : `Урок пройден: ${l.title}`, now);
  const { after } = bumpMastery(p, m);
  p.lastActivity[m.id] = now;
  return { xp, before, after };
}

export function completeReview(p: Progress, m: Module | undefined, key: string, success: boolean, now = Date.now()): number {
  reviewResult(p, key, success, now);
  if (!success) return 0;
  p.stats.reviewsDone++;
  addXp(p, XP.reviewSuccess, 'Повторение', now);
  if (m) {
    p.lastActivity[m.id] = now;
    bumpMastery(p, m);
  }
  return XP.reviewSuccess;
}
