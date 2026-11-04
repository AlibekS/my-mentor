import { describe, it, expect } from 'vitest';
import { modules, placementTopics } from '../../src/content';
import { Shell } from '../../src/shell/shell';
import { evaluate } from '../../src/engine/checks';
import { checkAnswer } from '../../src/engine/normalize';
import { checkCommandAnswer } from '../../src/engine/commandQuestion';
import { stripAnsi } from '../../src/shell/shell';

/**
 * Проверка целостности контента: эталонные решения проходят собственные проверки.
 * Если тест упал — в уроке опечатка в решении, проверке или сценарии.
 */
describe('content integrity', () => {
  it('has 12 modules with unique ids and valid dependencies', () => {
    expect(modules).toHaveLength(12);
    const ids = new Set(modules.map((m) => m.id));
    for (const m of modules) for (const r of m.requires) expect(ids.has(r), `${m.id} requires ${r}`).toBe(true);
  });

  for (const m of modules.filter((x) => x.status === 'ready')) {
    describe(m.id, () => {
      it('has 3–6 lessons and a boss', () => {
        expect(m.lessons.length).toBeGreaterThanOrEqual(3);
        expect(m.lessons.length).toBeLessThanOrEqual(6);
        expect(m.boss).toBeDefined();
      });
      for (const l of [...m.lessons, ...(m.boss ? [m.boss] : [])]) {
        it(`${l.id}: theory, 2–6 tasks, 3–5 questions (≤1/3 choice)`, () => {
          expect(l.theory.length, 'theory').toBeGreaterThan(400);
          expect(l.tasks.length).toBeGreaterThanOrEqual(2);
          expect(l.tasks.length).toBeLessThanOrEqual(6);
          expect(l.quiz.length).toBeGreaterThanOrEqual(3);
          expect(l.quiz.length).toBeLessThanOrEqual(5);
          expect(l.quiz.filter((q) => q.type === 'choice').length).toBeLessThanOrEqual(Math.floor(l.quiz.length / 3) || 1);
          const ids = l.tasks.map((t) => t.id).concat(l.quiz.map((q) => q.id));
          expect(new Set(ids).size).toBe(ids.length);
        });
        // задания без своего сценария работают в общем окружении урока — по порядку
        let shared: Shell | null = null;
        for (const t of l.tasks) {
          it(`${l.id}/${t.id}: solution passes its check`, () => {
            expect(t.hints.length).toBeLessThanOrEqual(3);
            expect(t.check || t.answer, 'task needs check or answer').toBeTruthy();
            const sh = t.scenario ? new Shell(t.scenario) : (shared ??= new Shell(l.scenario));
            let out = '';
            for (const line of t.solution.split('\n')) out += sh.run(line).stdout;
            if (t.check && !t.answer) expect(evaluate(t.check, sh), `check failed; output:\n${out}`).toBe(true);
            if (t.answer && !t.solution.split('\n').some((x) => x.trim().startsWith('#')) && t.answer.normalize !== 'keywords' && t.answer.normalize !== 'number') {
              const plain = stripAnsi(out).toLowerCase();
              expect(t.answer.accept.some((a) => plain.includes(a.toLowerCase())), `solution output should reveal answer ${t.answer.accept[0]}`).toBe(true);
            }
          });
        }
        for (const q of l.quiz) {
          it(`${l.id}/${q.id}: question is answerable`, () => {
            if (q.type === 'command') expect(checkCommandAnswer(q.solution, q.scenario, q.solution, q.check).ok).toBe(true);
            if (q.type === 'text' && q.answer.normalize !== 'keywords') expect(checkAnswer(q.answer.accept[0], q.answer)).toBe(true);
            if (q.type === 'choice') expect(q.correct).toBeLessThan(q.options.length);
          });
        }
      }
    });
  }

  it('placement bank covers all 12 topics with 3–4 questions of mixed difficulty', () => {
    for (const m of modules) {
      const t = placementTopics.find((x) => x.moduleId === m.id);
      expect(t, `placement for ${m.id}`).toBeDefined();
      expect(t!.questions.length).toBeGreaterThanOrEqual(3);
      expect(new Set(t!.questions.map((q) => q.difficulty)).size).toBeGreaterThanOrEqual(2);
      expect(t!.questions.some((q) => q.difficulty === 1)).toBe(true);
    }
  });

  it('placement questions are answerable', () => {
    for (const t of placementTopics)
      for (const q of t.questions) {
        if (q.solution && q.scenario && !q.answer) expect(checkCommandAnswer(q.solution, q.scenario, q.solution).ok, q.id).toBe(true);
        if (q.answer && q.answer.normalize !== 'keywords') expect(checkAnswer(q.answer.accept[0], q.answer), q.id).toBe(true);
        if (q.options) expect(q.correct, q.id).toBeLessThan(q.options.length);
        expect(q.answer || q.solution || q.options, q.id).toBeTruthy();
      }
  });
});
