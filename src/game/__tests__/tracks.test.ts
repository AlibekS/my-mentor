import { describe, it, expect } from 'vitest';
import { l2Modules, modules } from '../../content';
import { completeLesson, ensureLesson, solveTask } from '../actions';
import { awardAchievements } from '../achievements';
import { emptyProgress } from '../progress';
import { currentTrack, ensureL2Plan, trackModules } from '../tracks';
import { lessonStates, moduleStates, nextLesson } from '../unlock';

describe('L2 / L3 tracks', () => {
  it('L2 plan is built automatically and keeps user order when new modules appear', () => {
    const p = emptyProgress();
    expect(currentTrack(p)).toBe('l3');
    p.track = 'l2';
    expect(ensureL2Plan(p)).toBe(true);
    expect(p.l2Plan!.items.map((i) => i.moduleId)).toEqual(l2Modules.map((m) => m.id));
    expect(ensureL2Plan(p)).toBe(false);
    // пользователь переставил модули, один «пропал» из плана — он дописывается в конец, порядок сохраняется
    const moved = [p.l2Plan!.items[2], p.l2Plan!.items[0]];
    p.l2Plan!.items = moved;
    expect(ensureL2Plan(p)).toBe(true);
    expect(p.l2Plan!.items.slice(0, 2).map((i) => i.moduleId)).toEqual(moved.map((i) => i.moduleId));
    expect(p.l2Plan!.items).toHaveLength(l2Modules.length);
    expect(trackModules(p)).toBe(l2Modules);
  });

  it('fresh L2: first module open, first lesson open, the rest locked', () => {
    const p = emptyProgress();
    p.track = 'l2';
    ensureL2Plan(p);
    const st = moduleStates(l2Modules, p);
    expect(st.get(l2Modules[0].id)).toBe('open');
    expect(st.get(l2Modules[1].id)).toBe('locked');
    const ls = lessonStates(l2Modules[0], p);
    expect(ls.get(l2Modules[0].lessons[0].id)).toBe('open');
    expect(ls.get(l2Modules[0].lessons[1].id)).toBe('locked');
    expect(nextLesson(l2Modules, p)?.key).toBe(l2Modules[0].lessons[0].key);
  });

  it('L2 boss raises the start percent of linked L3 modules (bridge) and never lowers it', () => {
    const m = l2Modules.find((x) => x.id === 'l2-06-sql-read')!;
    const p = emptyProgress();
    p.plan = { createdAt: 1, minutesPerDay: 30, totalMinutes: 0, etaDays: 0, items: modules.map((x) => ({ moduleId: x.id, mode: 'full' as const, startPct: x.id === '07-sql' ? 5 : 60, skippable: [] })) };
    for (const l of m.lessons) completeLesson(p, m, l);
    expect(p.plan.items.find((i) => i.moduleId === '07-sql')!.startPct).toBe(5);
    completeLesson(p, m, m.boss!);
    expect(p.plan.items.find((i) => i.moduleId === '07-sql')!.startPct).toBe(m.feedsL3!['07-sql']);
    expect(p.masteryBest['07-sql']).toBe(m.feedsL3!['07-sql']);
    // модуль, где старт уже выше, не трогаем
    const m4 = l2Modules.find((x) => x.id === 'l2-04-linux-basics')!;
    completeLesson(p, m4, m4.boss!);
    expect(p.plan.items.find((i) => i.moduleId === '02-linux-files')!.startPct).toBe(60);
  });

  it('summary shows mastery from the lesson start, L2 achievements are awarded', () => {
    const m = l2Modules[0];
    const p = emptyProgress();
    const l = m.lessons[0];
    expect(ensureLesson(p, l).masteryBefore).toBe(0);
    for (const t of l.tasks) solveTask(p, m, l, t.id, []);
    completeLesson(p, m, l);
    expect(p.lessons[l.key].masteryBefore).toBe(0);
    expect(p.masteryBest[m.id]).toBeGreaterThan(0);
    for (const x of [...m.lessons, m.boss!]) completeLesson(p, m, x);
    const got = awardAchievements(p, { modules: [...l2Modules, ...modules], now: new Date() }).map((a) => a.id);
    expect(got).toContain('l2-first-ticket');
    expect(got).not.toContain('l2-graduate');
  });
});
