import { PLACEMENT } from './config';
import type { Module, PlacementQuestion, PlacementTopic } from '../content/types';
import type { PlacementAnswer, Plan, PlanItem, SelfLevel, Survey, TopicResult } from './progress';

/** Состояние адаптивного теста по одной теме */
export interface TopicRun {
  moduleId: string;
  self: SelfLevel;
  difficulty: 1 | 2 | 3;
  answers: PlacementAnswer[];
  done: boolean;
}

export function startTopic(moduleId: string, self: SelfLevel): TopicRun {
  return { moduleId, self, difficulty: PLACEMENT.startDifficulty[self] ?? 2, answers: [], done: false };
}

export function maxQuestions(self: SelfLevel): number {
  return self === 'none' ? 1 : PLACEMENT.maxQuestionsPerTopic;
}

/** Выбрать следующий вопрос (не повторяя уже заданные) */
export function nextQuestion(run: TopicRun, topic: PlacementTopic): PlacementQuestion | null {
  if (run.done) return null;
  const asked = new Set(run.answers.map((a) => a.questionId));
  const pool = topic.questions.filter((q) => !asked.has(q.id));
  if (!pool.length) return null;
  // ближайшая доступная сложность к целевой (сначала ниже — так честнее)
  const order = [run.difficulty, run.difficulty - 1, run.difficulty + 1, run.difficulty - 2, run.difficulty + 2];
  for (const d of order) {
    const q = pool.find((x) => x.difficulty === d);
    if (q) return q;
  }
  return pool[0];
}

/** Записать ответ и решить, что дальше: вверх/вниз по сложности или стоп */
export function answerTopic(run: TopicRun, q: PlacementQuestion, correct: boolean, skipped = false): TopicRun {
  const answers = [...run.answers, { questionId: q.id, difficulty: q.difficulty, correct, skipped }];
  let difficulty = run.difficulty;
  let done = false;
  if (correct) {
    if (q.difficulty >= 3) {
      const topCorrect = answers.filter((a) => a.correct && a.difficulty === 3).length;
      if (topCorrect >= 2 || run.self === 'none') done = true;
    } else difficulty = (q.difficulty + 1) as 1 | 2 | 3;
  } else {
    if (q.difficulty <= 1) done = true;
    else difficulty = (q.difficulty - 1) as 1 | 2 | 3;
    // ошибка после правильного ответа на уровне ниже — граница найдена
    if (answers.some((a) => a.correct && a.difficulty === q.difficulty - 1)) done = true;
  }
  if (answers.length >= maxQuestions(run.self)) done = true;
  return { ...run, answers, difficulty, done };
}

/** Балл теста по теме 0..100 */
export function testScore(answers: PlacementAnswer[]): number {
  if (!answers.length) return 0;
  const correct = answers.filter((a) => a.correct);
  const best = Math.max(0, ...correct.map((a) => a.difficulty));
  if (!best) return 0;
  let score = PLACEMENT.levelValue[best];
  if (correct.filter((a) => a.difficulty === 3).length >= 2) score += PLACEMENT.topBonus;
  const wrongBelow = answers.filter((a) => !a.correct && a.difficulty <= best).length;
  score -= wrongBelow * PLACEMENT.wrongPenalty;
  return Math.max(0, Math.min(100, score));
}

/** Стартовый процент: тест весит больше самооценки */
export function startPct(self: SelfLevel, test: number | null): number {
  if (test === null) return self === 'unknown' ? 0 : Math.round(PLACEMENT.selfPct[self] * 0.5);
  if (self === 'unknown') return Math.round(test);
  const w = PLACEMENT.weights;
  return Math.round(w.test * test + w.self * PLACEMENT.selfPct[self]);
}

export function topicResult(run: TopicRun): TopicResult {
  const test = run.answers.length ? testScore(run.answers) : null;
  const start = startPct(run.self, test);
  const selfP = run.self === 'unknown' ? null : PLACEMENT.selfPct[run.self];
  return {
    moduleId: run.moduleId,
    self: run.self,
    testPct: test,
    startPct: start,
    answers: run.answers,
    mismatch: selfP !== null && test !== null && Math.abs(selfP - test) >= PLACEMENT.mismatch,
  };
}

export function planMode(pct: number): PlanItem['mode'] {
  if (pct < PLACEMENT.plan.full) return 'full';
  if (pct <= PLACEMENT.plan.exam) return 'partial';
  return 'exam';
}

/** Уроки, подтверждённые тестом (правильный ответ на вопрос, привязанный к уроку) */
export function confirmedLessons(result: TopicResult, topic: PlacementTopic | undefined): string[] {
  if (!topic) return [];
  const ok = new Set<string>();
  const bad = new Set<string>();
  for (const a of result.answers) {
    const q = topic.questions.find((x) => x.id === a.questionId);
    for (const l of q?.lessons ?? []) (a.correct ? ok : bad).add(l);
  }
  return [...ok].filter((l) => !bad.has(l));
}

/** Минуты на модуль в зависимости от режима */
export function moduleMinutes(m: Module, item: Pick<PlanItem, 'mode' | 'skippable'>): number {
  const bossMin = m.boss?.minutes ?? 30;
  if (!m.lessons.length) return (m.estimatedMinutes ?? 240) * (item.mode === 'exam' ? 0.2 : item.mode === 'partial' ? 0.6 : 1);
  if (item.mode === 'exam') return bossMin;
  const lessons = item.mode === 'partial' ? m.lessons.filter((l) => !item.skippable.includes(l.id)) : m.lessons;
  return lessons.reduce((s, l) => s + l.minutes, 0) + bossMin;
}

/**
 * Порядок модулей: соблюдаем зависимости (requires), а среди доступных
 * сначала берём темы с наибольшим «пробелом × важность».
 */
export function orderModules(mods: Module[], start: Record<string, number>): Module[] {
  const remaining = new Map(mods.map((m) => [m.id, m]));
  const done = new Set<string>();
  const order: Module[] = [];
  while (remaining.size) {
    const avail = [...remaining.values()].filter((m) => m.requires.every((r) => done.has(r) || !mods.some((x) => x.id === r)));
    const pool = avail.length ? avail : [...remaining.values()];
    pool.sort((a, b) => {
      const pa = (100 - (start[a.id] ?? 0)) * a.importance;
      const pb = (100 - (start[b.id] ?? 0)) * b.importance;
      // пока у модуля нет контента, он не может стоять впереди готовых
      const ra = a.status === 'ready' ? 0 : 1;
      const rb = b.status === 'ready' ? 0 : 1;
      return ra - rb || pb - pa || a.order - b.order;
    });
    const next = pool[0];
    order.push(next);
    done.add(next.id);
    remaining.delete(next.id);
  }
  return order;
}

export function buildPlan(mods: Module[], results: TopicResult[], topics: PlacementTopic[], survey: Survey, now = Date.now()): Plan {
  const start = Object.fromEntries(results.map((r) => [r.moduleId, r.startPct]));
  const ordered = orderModules(mods, start);
  const items: PlanItem[] = ordered.map((m) => {
    const r = results.find((x) => x.moduleId === m.id);
    const pct = r?.startPct ?? 0;
    const mode = planMode(pct);
    const skippable = mode === 'partial' && r ? confirmedLessons(r, topics.find((t) => t.moduleId === m.id)) : [];
    return { moduleId: m.id, mode, startPct: pct, skippable };
  });
  return finalizePlan(mods, items, survey.minutesPerDay, survey.targetDate, now);
}

export function finalizePlan(mods: Module[], items: PlanItem[], minutesPerDay: number, targetDate: string | undefined, now = Date.now()): Plan {
  const totalMinutes = Math.round(items.reduce((s, it) => s + moduleMinutes(mods.find((m) => m.id === it.moduleId)!, it), 0));
  return { createdAt: now, items, minutesPerDay, totalMinutes, etaDays: Math.ceil(totalMinutes / Math.max(10, minutesPerDay)), targetDate };
}
