import { describe, it, expect } from 'vitest';
import { levelFromXp, xpForLevel, rankForLevel, taskXp, quizXp, streakBonus } from '../levels';
import { computeMastery, masteryView, overallReadiness } from '../mastery';
import { emptyProgress, migrate, importProgress, exportProgress } from '../progress';
import { answerTopic, buildPlan, nextQuestion, orderModules, startPct, startTopic, testScore, topicResult, planMode } from '../placement';
import { solveTask, completeLesson, answerQuestion, useHint, touchDay } from '../actions';
import { moduleStates, lessonStates } from '../unlock';
import { awardAchievements } from '../achievements';
import type { Lesson, Module, PlacementTopic } from '../../content/types';

function lesson(mod: string, id: string, kind: 'lesson' | 'boss' = 'lesson'): Lesson {
  return {
    id, key: `${mod}/${id}`, moduleId: mod, title: id, kind, minutes: 20, order: 1, theory: '', scenario: {},
    tasks: [{ id: 't1', prompt: '', hints: ['a', 'b', 'c'], solution: 'ls' }, { id: 't2', prompt: '', hints: [], solution: 'ls' }],
    quiz: [{ id: 'q1', type: 'choice', prompt: '', options: ['a', 'b'], correct: 0, explanation: '' }],
  };
}
function mod(id: string, order: number, requires: string[] = [], importance = 3, ready = true): Module {
  return {
    id, order, title: id, titleEn: id, short: '', description: '', icon: '', importance, requires, skills: [], topics: [],
    reviewedAt: '2026-11-01', demand: 'stable', status: ready ? 'ready' : 'planned',
    lessons: ready ? [lesson(id, 'l1'), lesson(id, 'l2')] : [], boss: ready ? lesson(id, 'boss', 'boss') : undefined,
  };
}

describe('levels & xp', () => {
  it('curve is monotonic and level 30 is the cap', () => {
    for (let i = 2; i <= 30; i++) expect(xpForLevel(i)).toBeGreaterThan(xpForLevel(i - 1));
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(1e9)).toBe(30);
    expect(levelFromXp(xpForLevel(5))).toBe(5);
  });
  it('ranks change every few levels', () => {
    expect(rankForLevel(1).id).toBe(1);
    expect(rankForLevel(4).id).toBe(2);
    expect(rankForLevel(30).id).toBe(8);
  });
  it('xp rules from the spec', () => {
    expect(taskXp(0, false)).toBe(30);
    expect(taskXp(1, false)).toBe(20);
    expect(taskXp(3, false)).toBe(10);
    expect(taskXp(0, true)).toBe(0);
    expect(quizXp(1)).toBe(15);
    expect(quizXp(2)).toBe(5);
    expect(streakBonus(100)).toBe(70);
  });
});

describe('mastery', () => {
  const m = mod('a', 1);
  it('grows with lessons and reaches 100 only after the boss', () => {
    const p = emptyProgress();
    expect(computeMastery(m, p)).toBe(0);
    for (const l of m.lessons) {
      solveTask(p, m, l, 't1', ['ls']);
      solveTask(p, m, l, 't2', ['ls']);
      answerQuestion(p, m, l, 'q1', true);
      completeLesson(p, m, l);
    }
    const before = computeMastery(m, p);
    expect(before).toBe(70);
    completeLesson(p, m, m.boss!);
    expect(computeMastery(m, p)).toBe(100);
  });
  it('hints reduce gain but never reduce stored value', () => {
    const p = emptyProgress();
    const l = m.lessons[0];
    solveTask(p, m, l, 't2', ['ls']);
    const v1 = masteryView(m, p).value;
    useHint(p, l, 't1');
    useHint(p, l, 't1');
    expect(masteryView(m, p).value).toBe(v1);
    solveTask(p, m, l, 't1', ['ls']);
    expect(masteryView(m, p).value).toBeGreaterThan(v1);
  });
  it('starts from onboarding value', () => {
    const p = emptyProgress();
    p.plan = { createdAt: 0, items: [{ moduleId: 'a', mode: 'partial', startPct: 40, skippable: [] }], minutesPerDay: 30, totalMinutes: 0, etaDays: 0 };
    expect(computeMastery(m, p)).toBe(40);
  });
  it('decays when review is overdue, but not below 70% of best', () => {
    const p = emptyProgress();
    p.masteryBest.a = 80;
    const now = Date.now();
    p.lastActivity.a = now - 400 * 86400e3;
    p.review['a/l1#t1'] = { key: 'a/l1#t1', lessonKey: 'a/l1', itemId: 't1', kind: 'task', due: now - 1000, step: 0, lapses: 0, successes: 0 };
    const v = masteryView(m, p, now);
    expect(v.value).toBe(56);
    expect(v.status).toBe('review-due');
  });
  it('overall readiness is weighted by importance', () => {
    const p = emptyProgress();
    p.masteryBest = { a: 100, b: 0 };
    expect(overallReadiness([mod('a', 1, [], 3), mod('b', 2, [], 1)], p)).toBe(75);
  });
});

describe('placement', () => {
  const topic: PlacementTopic = {
    moduleId: 'a',
    questions: [
      { id: 'e1', difficulty: 1, prompt: '', lessons: ['l1'] },
      { id: 'm1', difficulty: 2, prompt: '', lessons: ['l2'] },
      { id: 'h1', difficulty: 3, prompt: '' },
      { id: 'h2', difficulty: 3, prompt: '' },
    ],
  };
  it('confident starts hard, goes down on error', () => {
    let run = startTopic('a', 'confident');
    const q = nextQuestion(run, topic)!;
    expect(q.difficulty).toBe(3);
    run = answerTopic(run, q, false);
    expect(nextQuestion(run, topic)!.difficulty).toBe(2);
  });
  it('"none" asks a single easy question', () => {
    let run = startTopic('a', 'none');
    const q = nextQuestion(run, topic)!;
    expect(q.difficulty).toBe(1);
    run = answerTopic(run, q, false, true);
    expect(run.done).toBe(true);
  });
  it('score formula', () => {
    expect(testScore([])).toBe(0);
    expect(testScore([{ questionId: 'x', difficulty: 1, correct: true, skipped: false }])).toBe(35);
    expect(testScore([{ questionId: 'x', difficulty: 3, correct: true, skipped: false }, { questionId: 'y', difficulty: 3, correct: true, skipped: false }])).toBe(100);
    expect(startPct('confident', 40)).toBe(52);
    expect(startPct('unknown', 65)).toBe(65);
  });
  it('flags mismatch between self assessment and test', () => {
    let run = startTopic('a', 'confident');
    run = answerTopic(run, nextQuestion(run, topic)!, false);
    run = answerTopic(run, nextQuestion(run, topic)!, false);
    run = answerTopic(run, nextQuestion(run, topic)!, true);
    const r = topicResult(run);
    expect(r.mismatch).toBe(true);
  });
  it('plan modes and dependency-aware ordering', () => {
    expect(planMode(10)).toBe('full');
    expect(planMode(50)).toBe('partial');
    expect(planMode(90)).toBe('exam');
    const mods = [mod('a', 1), mod('b', 2, ['a'], 5), mod('c', 3, [], 5)];
    const order = orderModules(mods, { a: 90, b: 0, c: 10 }).map((m) => m.id);
    expect(order.indexOf('b')).toBeGreaterThan(order.indexOf('a'));
    expect(order[0]).toBe('c');
  });
  it('different answers give different plans', () => {
    const mods = [mod('a', 1), mod('b', 2)];
    const survey = { general: 'sysadmin' as const, topics: {}, minutesPerDay: 30 };
    const p1 = buildPlan(mods, [{ moduleId: 'a', self: 'none', testPct: 0, startPct: 0, answers: [], mismatch: false }, { moduleId: 'b', self: 'confident', testPct: 100, startPct: 94, answers: [], mismatch: false }], [], survey);
    const p2 = buildPlan(mods, [{ moduleId: 'a', self: 'confident', testPct: 100, startPct: 94, answers: [], mismatch: false }, { moduleId: 'b', self: 'none', testPct: 0, startPct: 0, answers: [], mismatch: false }], [], survey);
    expect(p1.items.find((i) => i.moduleId === 'a')!.mode).toBe('full');
    expect(p2.items.find((i) => i.moduleId === 'a')!.mode).toBe('exam');
    expect(p1.items[0].moduleId).not.toBe(p2.items[0].moduleId);
    expect(p1.etaDays).toBeGreaterThan(0);
  });
});

describe('unlocking', () => {
  it('next module opens after the boss of previous; planned modules are "soon"', () => {
    const mods = [mod('a', 1), mod('b', 2), mod('z', 3, [], 3, false)];
    const p = emptyProgress();
    let s = moduleStates(mods, p);
    expect(s.get('a')).toBe('open');
    expect(s.get('b')).toBe('locked');
    expect(s.get('z')).toBe('soon');
    const ls = lessonStates(mods[0], p);
    expect(ls.get('l1')).toBe('open');
    expect(ls.get('l2')).toBe('locked');
    expect(ls.get('boss')).toBe('locked');
    p.lessons['a/boss'] = { started: 0, completedAt: 1, tasks: {}, quiz: {}, xp: 0, timeMs: 0 };
    s = moduleStates(mods, p);
    expect(s.get('b')).toBe('open');
  });
});

describe('progress storage', () => {
  it('migrates and round-trips export/import', () => {
    const p = emptyProgress();
    p.xp = 123;
    const back = importProgress(exportProgress(p));
    expect(back.xp).toBe(123);
    expect(migrate({ version: 0, xp: 5 }).stats.tasksSolved).toBe(0);
    expect(() => importProgress('{"app":"other"}')).toThrow();
  });
  it('streak counts consecutive days with capped bonus', () => {
    const p = emptyProgress();
    touchDay(p, new Date('2026-11-01T10:00:00'));
    touchDay(p, new Date('2026-11-02T10:00:00'));
    expect(p.streak.current).toBe(2);
    expect(p.xp).toBe(10);
    touchDay(p, new Date('2026-11-05T23:30:00'));
    expect(p.streak.current).toBe(1);
    expect(p.stats.nightSessions).toBe(1);
  });
  it('awards achievements once', () => {
    const p = emptyProgress();
    p.stats.tasksSolved = 1;
    const ctx = { modules: [], now: new Date() };
    expect(awardAchievements(p, ctx).map((a) => a.id)).toContain('first-blood');
    expect(awardAchievements(p, ctx)).toHaveLength(0);
  });
});
