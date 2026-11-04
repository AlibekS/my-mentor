import { create } from './bus';
import type { Lesson, Module, Task, Question } from '../content/types';

/**
 * Текущий учебный контекст, который видит ментор: какая страница, модуль, урок,
 * задание, сколько подсказок, последние команды в терминале.
 */
export interface MentorContext {
  page: string;
  module?: Pick<Module, 'id' | 'title'>;
  lesson?: Pick<Lesson, 'key' | 'title' | 'kind' | 'theory'>;
  step?: 'theory' | 'practice' | 'quiz' | 'summary';
  task?: Pick<Task, 'id' | 'prompt' | 'hints' | 'solution' | 'explanation'> & { index: number; total: number; hintsUsed: number; solved: boolean };
  question?: Pick<Question, 'id' | 'prompt' | 'explanation'> & { solution?: string };
  terminal?: { line: string; output: string; exitCode: number }[];
  /** вызвать, когда ментор выдал готовое решение (XP за задание = 0) */
  onSolutionRevealed?: () => void;
  /** выдать следующую подсказку задания (засчитывается как подсказка) */
  nextHint?: () => string | null;
}

export const mentorContext = create<MentorContext>({ page: 'home' });
