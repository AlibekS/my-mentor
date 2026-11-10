import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { allModules } from '../../src/content';
import { lessonTools, taskTool, type AnswerSpec } from '../../src/content/types';

/**
 * Экспорт «шпаргалки» для сквозного прогона в браузере (tools/e2e/play.js): решения и ответы всех уроков.
 * Запускается только с SPEC_OUT=<файл>: SPEC_OUT=/tmp/spec.json npx vitest run content/__tests__/e2e-spec.test.ts
 */
const ans = (a: AnswerSpec) => (a.normalize === 'keywords' ? (a.keywords ?? a.accept.map((x) => [x])).map((g) => g[0]).join(' ') : a.accept[0]);

it.skipIf(!process.env.SPEC_OUT)('exports lesson solutions for the browser play-through', () => {
  const out = allModules.flatMap((m) =>
    [...m.lessons, ...(m.boss ? [m.boss] : [])].map((l) => ({
      key: l.key,
      track: m.track,
      tools: lessonTools(l),
      tasks: l.tasks.map((t) => ({ id: t.id, tool: taskTool(l, t), kind: t.write ? 'write' : t.answer ? 'answer' : t.obs ? t.obs : taskTool(l, t), solution: t.solution, answer: t.answer ? ans(t.answer) : undefined })),
      quiz: l.quiz.map((q) => ({ type: q.type, input: q.type === 'choice' ? String(q.correct) : q.type === 'text' ? ans(q.answer) : q.solution })),
    })),
  );
  writeFileSync(process.env.SPEC_OUT!, JSON.stringify(out));
});
