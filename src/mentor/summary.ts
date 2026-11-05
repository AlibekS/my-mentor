import { lessonByKey, modulesOf } from '../content';
import { currentTrack } from '../game/tracks';
import { levelFromXp, rankForLevel } from '../game/levels';
import { masteryView, overallReadiness } from '../game/mastery';
import type { Progress } from '../game/progress';
import { dueReviews } from '../game/review';
import { nextLesson } from '../game/unlock';
import type { MentorContext } from './context';

/** Сводка прогресса для ментора — компактно, чтобы влезало в промпт */
export function progressSummary(p: Progress) {
  const level = levelFromXp(p.xp);
  const done = Object.entries(p.lessons)
    .filter(([, l]) => l.completedAt)
    .map(([k]) => lessonByKey.get(k)?.title ?? k);
  const weak = Object.values(p.review)
    .slice(0, 8)
    .map((r) => `${lessonByKey.get(r.lessonKey)?.title ?? r.lessonKey} (${r.kind === 'task' ? 'задание' : 'вопрос'} ${r.itemId}, ошибок ${r.lapses + 1})`);
  const track = currentTrack(p);
  const modules = modulesOf(track);
  const next = nextLesson(modules, p);
  return {
    name: p.profile.name,
    track: track === 'l2' ? 'L2 Quest (уровень L1→L2: объясняй проще, без жаргона; английский — постепенно)' : 'L3 Quest',
    level,
    rank: rankForLevel(level).title,
    xp: p.xp,
    streakDays: p.streak.current,
    readinessPct: overallReadiness(modules, p),
    mastery: modules.map((m) => {
      const v = masteryView(m, p);
      return `${m.title}: ${v.value}% (старт ${v.start}%, ${v.status})`;
    }),
    lessonsDone: done,
    weakSpots: weak,
    reviewDueToday: dueReviews(p).length,
    nextLesson: next ? `${next.title} (${next.moduleId})` : null,
    stats: { tasksSolved: p.stats.tasksSolved, tasksNoHints: p.stats.tasksNoHints, quizFirstTry: p.stats.quizFirstTry, quizAnswered: p.stats.quizAnswered },
    survey: p.onboarding.survey ? { general: p.onboarding.survey.general, minutesPerDay: p.onboarding.survey.minutesPerDay, targetDate: p.onboarding.survey.targetDate } : null,
  };
}

const SOLUTION_RE = /(покажи|дай|скажи|напиши|выдай|хочу|можно)[^.?!]{0,30}(решени|ответ|готов)|реши\s+(за\s+меня|сам)|сдаюсь|show\s+(me\s+)?the\s+(solution|answer)/i;

/** Ученик явно просит готовое решение? */
export function asksForSolution(text: string): boolean {
  return SOLUTION_RE.test(text);
}

/** Контекст для отправки: решение передаётся только по явной просьбе */
export function publicContext(ctx: MentorContext, allowSolution: boolean) {
  const { onSolutionRevealed: _cb, nextHint: _nh, ...rest } = ctx;
  const out: Record<string, unknown> = { ...rest };
  if (rest.lesson) out.lesson = { ...rest.lesson, theory: rest.lesson.theory.slice(0, 6000) };
  if (rest.draft) out.draft = rest.draft.slice(0, 4000);
  if (rest.task) {
    const { solution, hints, ...t } = rest.task;
    out.task = { ...t, hintsAlreadyShown: hints.slice(0, rest.task.hintsUsed), hintsNotShownYet: hints.slice(rest.task.hintsUsed), ...(allowSolution ? { solution } : {}) };
  }
  if (rest.question) {
    const { solution, ...q } = rest.question;
    out.question = allowSolution ? { ...q, solution } : { prompt: q.prompt, id: q.id };
  }
  return out;
}
