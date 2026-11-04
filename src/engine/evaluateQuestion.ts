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
}

export function kindOf(q: Gradable): 'choice' | 'command' | 'text' {
  if (q.options && q.correct !== undefined) return 'choice';
  if (q.type === 'command' || (!q.answer && q.solution && q.scenario)) return 'command';
  return 'text';
}

export function grade(q: Gradable, input: string): { ok: boolean; output?: string } {
  const k = kindOf(q);
  if (k === 'choice') return { ok: Number(input) === q.correct };
  if (k === 'command') return checkCommandAnswer(input, q.scenario ?? {}, q.solution ?? '', q.check);
  return { ok: !!q.answer && checkAnswer(input, q.answer) };
}
