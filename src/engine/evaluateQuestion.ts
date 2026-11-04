import type { AnswerSpec, Check } from '../content/types';
import type { Scenario } from '../shell/types';
import { checkAnswer } from './normalize';
import { checkCommandAnswer } from './commandQuestion';

/** Универсальная проверка вопроса: текст / команда / выбор */
export interface Gradable {
  answer?: AnswerSpec;
  solution?: string;
  scenario?: Scenario;
  check?: Check;
  options?: string[];
  correct?: number;
  type?: string;
  ordered?: boolean;
}

export function kindOf(q: Gradable): 'choice' | 'command' | 'text' | 'sql' | 'promql' {
  if (q.type === 'sql') return 'sql';
  if (q.type === 'promql') return 'promql';
  if (q.options && q.correct !== undefined) return 'choice';
  if (q.type === 'command' || (!q.answer && q.solution && q.scenario)) return 'command';
  return 'text';
}

export function grade(q: Gradable, input: string): { ok: boolean; output?: string } {
  const k = kindOf(q);
  if (k === 'sql' || k === 'promql') throw new Error('sql/promql questions are graded asynchronously');
  if (k === 'choice') return { ok: Number(input) === q.correct };
  if (k === 'command') return checkCommandAnswer(input, q.scenario ?? {}, q.solution ?? '', q.check);
  return { ok: !!q.answer && checkAnswer(input, q.answer) };
}
