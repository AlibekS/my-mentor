import { create } from './bus';

/** Попросить ментора: открыть чат и отправить сообщение (используется из уроков) */
export const mentorAsk = create<{ text: string; ts: number } | null>(null);

export function askMentor(text: string) {
  mentorAsk.set({ text, ts: Date.now() });
}
