import type { Lesson, Module } from '../content/types';
import { planItemOf, type PlanItem, type Progress } from './progress';

export type ModuleState = 'done' | 'open' | 'locked' | 'soon';
export type LessonState = 'done' | 'open' | 'locked' | 'skippable';

export function planItem(p: Progress, moduleId: string): PlanItem | undefined {
  return planItemOf(p, moduleId);
}

export function isModuleDone(m: Module, p: Progress): boolean {
  return !!(m.boss && p.lessons[m.boss.key]?.completedAt);
}

/** Модули в порядке персональной программы (или по умолчанию) */
export function orderedModules(mods: Module[], p: Progress): Module[] {
  // программа того трека, к которому относятся модули
  const plan = mods[0]?.track === 'l2' ? p.l2Plan : p.plan;
  if (!plan) return mods;
  const byId = new Map(mods.map((m) => [m.id, m]));
  const res = plan.items.map((i) => byId.get(i.moduleId)).filter((m): m is Module => !!m);
  for (const m of mods) if (!res.includes(m)) res.push(m);
  return res;
}

export function moduleStates(mods: Module[], p: Progress): Map<string, ModuleState> {
  const res = new Map<string, ModuleState>();
  let gate = true;
  for (const m of orderedModules(mods, p)) {
    if (m.status !== 'ready' || !m.lessons.length) {
      res.set(m.id, 'soon');
      continue;
    }
    const done = isModuleDone(m, p);
    const forced = planItem(p, m.id)?.forceUnlocked;
    res.set(m.id, done ? 'done' : gate || forced ? 'open' : 'locked');
    if (!done) gate = false;
  }
  return res;
}

export function lessonStates(m: Module, p: Progress): Map<string, LessonState> {
  const res = new Map<string, LessonState>();
  const item = planItem(p, m.id);
  const skippable = new Set(item?.skippable ?? []);
  let prevOk = true;
  for (const l of m.lessons) {
    const done = !!p.lessons[l.key]?.completedAt;
    if (done) res.set(l.id, 'done');
    else if (skippable.has(l.id)) res.set(l.id, 'skippable');
    else res.set(l.id, prevOk ? 'open' : 'locked');
    prevOk = done || skippable.has(l.id);
  }
  if (m.boss) {
    const done = !!p.lessons[m.boss.key]?.completedAt;
    const allReq = m.lessons.every((l) => p.lessons[l.key]?.completedAt || skippable.has(l.id));
    res.set(m.boss.id, done ? 'done' : item?.mode === 'exam' || allReq ? 'open' : 'locked');
  }
  return res;
}

export function canOpenLesson(m: Module, l: Lesson, p: Progress): boolean {
  const ms = moduleStates([m], p).get(m.id);
  if (ms === 'soon') return false;
  const st = lessonStates(m, p).get(l.id);
  return st !== 'locked';
}

/** Следующий шаг для кнопки «Продолжить» */
export function nextLesson(mods: Module[], p: Progress): Lesson | undefined {
  const states = moduleStates(mods, p);
  for (const m of orderedModules(mods, p)) {
    if (states.get(m.id) !== 'open') continue;
    const ls = lessonStates(m, p);
    const l = m.lessons.find((x) => ls.get(x.id) === 'open');
    if (l) return l;
    if (m.boss && ls.get(m.boss.id) === 'open') return m.boss;
  }
  return undefined;
}

export function nextLessonInModule(m: Module, p: Progress): Lesson | undefined {
  const ls = lessonStates(m, p);
  return m.lessons.find((x) => ls.get(x.id) === 'open') ?? (m.boss && ls.get(m.boss.id) === 'open' ? m.boss : undefined);
}
