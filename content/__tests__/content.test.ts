import { describe, it, expect } from 'vitest';
import { modules, placementTopics } from '../../src/content';
import { Shell } from '../../src/shell/shell';
import { evaluate } from '../../src/engine/checks';
import { checkAnswer } from '../../src/engine/normalize';
import { checkCommandAnswer } from '../../src/engine/commandQuestion';
import { stripAnsi } from '../../src/shell/shell';
import { gradeSql, openDb, runQuery, resultText } from '../../src/sql/engine';
import { evalQuery, sameResult } from '../../src/obs/promql';
import { searchLogs } from '../../src/obs/kql';
import { checkRubric } from '../../src/engine/rubric';
import { taskTool } from '../../src/content/types';
import { shellForTask } from '../../src/engine/replay';

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
          if (t.write) {
            it(`${l.id}/${t.id}: sample text passes rubric, template does not`, () => {
              expect(t.hints.length).toBeLessThanOrEqual(3);
              const r = checkRubric(t.solution, t.write!);
              expect(r.ok, `rubric fails on solution: ${JSON.stringify(r.items.filter((i) => !i.ok))} words=${r.words}`).toBe(true);
              expect(checkRubric(t.write!.template ?? '', t.write!).ok, 'template alone must not pass').toBe(false);
            });
            continue;
          }
          if (l.obs && taskTool(l, t) === 'obs') {
            it(`${l.id}/${t.id}: observability task is solvable`, () => {
              expect(t.hints.length).toBeLessThanOrEqual(3);
              expect(t.answer || t.obs, 'obs task needs answer or obs check').toBeTruthy();
              if (t.obs === 'promql') {
                const r = evalQuery(t.solution, l.obs!);
                expect(r.ok, r.error).toBe(true);
                expect(r.series.length).toBeGreaterThan(0);
              }
              if (t.obs === 'logs') {
                const r = searchLogs(l.obs!.logs ?? [], t.solution);
                expect(r.ok, r.error).toBe(true);
                expect(r.hits.length).toBeGreaterThan(0);
              }
              for (const p of l.obs!.dashboard?.panels ?? []) expect(evalQuery(p.query, l.obs!).ok, p.query).toBe(true);
            });
            continue;
          }
          if (l.sql && taskTool(l, t) === 'sql') {
            it(`${l.id}/${t.id}: SQL solution runs and grades`, async () => {
              expect(t.hints.length).toBeLessThanOrEqual(3);
              const db = await openDb(l.sql!.dataset);
              const r = runQuery(db, t.solution);
              expect(r.ok, r.ok ? '' : r.error).toBe(true);
              if (t.answer) {
                if (t.answer.normalize !== 'keywords') expect(t.answer.accept.some((a) => resultText(r, 1000).toLowerCase().includes(a.toLowerCase())), `answer ${t.answer.accept[0]} not in:\n${resultText(r)}`).toBe(true);
              } else {
                expect(r.ok && r.rows.length > 0, 'solution should return rows').toBe(true);
                expect((await gradeSql(l.sql!.dataset, t.solution, t.solution, t.sqlOrdered)).ok).toBe(true);
              }
            });
            continue;
          }
          it(`${l.id}/${t.id}: solution passes its check`, () => {
            expect(t.hints.length).toBeLessThanOrEqual(3);
            expect(t.check || t.answer, 'task needs check or answer').toBeTruthy();
            const sh = t.scenario ? new Shell(t.scenario) : (shared ??= new Shell(l.scenario));
            // задание не должно засчитываться само при открытии (ни в свежем окружении, ни после предыдущих заданий)
            if (t.check && !t.answer) {
              expect(evaluate(t.check, sh, null), 'check already satisfied before the solution — task would auto-solve').toBe(false);
              expect(evaluate(t.check, new Shell(t.scenario ?? l.scenario), null), 'check satisfied in a fresh environment — task would auto-solve').toBe(false);
            }
            let out = '';
            for (const line of t.solution.split('\n')) out += sh.run(line).stdout;
            if (t.check && !t.answer) expect(evaluate(t.check, sh), `check failed; output:\n${out}`).toBe(true);
            // после перезагрузки страницы / в «Повторении» окружение восстанавливается повтором предыдущих решений
            if (t.check && !t.answer && !t.scenario) {
              const { shell: restored } = shellForTask(l, t);
              expect(evaluate(t.check, restored, null), 'restored env must not pre-solve the task').toBe(false);
              for (const line of t.solution.split('\n')) restored.run(line);
              expect(evaluate(t.check, restored), 'solution must pass in the restored environment').toBe(true);
            }
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
          if (q.type === 'promql')
            it(`${l.id}/${q.id}: PromQL question grades its own solution`, () => {
              expect(l.obs).toBeDefined();
              expect(sameResult(evalQuery(q.solution, l.obs!), evalQuery(q.solution, l.obs!)).ok).toBe(true);
              expect(evalQuery(q.solution, l.obs!).series.length).toBeGreaterThan(0);
            });
          if (q.type === 'sql')
            it(`${l.id}/${q.id}: SQL question grades its own solution`, async () => {
              expect(l.sql, 'sql question needs lesson.sql').toBeDefined();
              const g = await gradeSql(l.sql!.dataset, q.solution, q.solution, q.ordered);
              expect(g.ok, g.reason).toBe(true);
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
        if (q.solution && q.scenario && !q.answer && q.type !== 'sql') expect(checkCommandAnswer(q.solution, q.scenario, q.solution).ok, q.id).toBe(true);
        if (q.answer && q.answer.normalize !== 'keywords') expect(checkAnswer(q.answer.accept[0], q.answer), q.id).toBe(true);
        if (q.options) expect(q.correct, q.id).toBeLessThan(q.options.length);
        expect(q.answer || q.solution || q.options, q.id).toBeTruthy();
      }
  });

  it('placement SQL questions grade their own solutions', async () => {
    for (const t of placementTopics)
      for (const q of t.questions.filter((x) => x.type === 'sql')) {
        const g = await gradeSql(q.dataset!, q.solution!, q.solution!, q.ordered);
        expect(g.ok, `${q.id}: ${g.reason}`).toBe(true);
      }
  });
});
