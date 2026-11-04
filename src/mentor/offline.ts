import type { MentorContext } from './context';

/**
 * Офлайн-ментор: работает без Claude (например, в `npm run build`-версии или без логина).
 * Отвечает по шаблонам, используя данные задания.
 */
export function offlineAnswer(text: string, ctx: MentorContext, allowSolution: boolean, summary: { readinessPct: number; nextLesson: string | null; weakSpots: string[] }): string {
  const t = text.toLowerCase();
  const task = ctx.task;
  if (allowSolution && task) return `Готовое решение задания ${task.index}:\n\n\`\`\`\n${task.solution}\n\`\`\`\n\n${task.explanation ?? ''}\n\n_За задание теперь 0 XP — но набери команду сам, так она запомнится._`;
  if (allowSolution && ctx.question?.solution) return `Ответ: \`${ctx.question.solution}\`\n\n${ctx.question.explanation ?? ''}`;
  if (/прогресс|как у меня|статист|готов/.test(t))
    return `Твоя готовность к роли L3 — **${summary.readinessPct}%**.${summary.nextLesson ? ` Следующий шаг: **${summary.nextLesson}**.` : ''}${summary.weakSpots.length ? `\n\nСлабые места (стоит повторить):\n${summary.weakSpots.map((w) => `- ${w}`).join('\n')}` : ''}`;
  if (task && /подсказ|намекни|hint/.test(t)) {
    const h = ctx.nextHint?.();
    return h ? `Подсказка: ${h}` : 'Подсказки к этому заданию закончились. Попробуй разбить задачу на шаги: сначала найди нужный файл/сервис, потом отфильтруй, потом посчитай.';
  }
  if (task)
    return `Сейчас задание ${task.index} из ${task.total}:\n\n> ${task.prompt.replace(/\n/g, '\n> ')}\n\nЧто от тебя нужно: выполнить в терминале команду, которая даст нужный результат — проверка смотрит на **результат**, а не на точный текст команды. Подумай: где лежат данные (какой лог/сервис), как отфильтровать нужное и как посчитать.\n\nНапиши «подсказка», если застрял, или «покажи решение», если совсем никак.`;
  if (ctx.question) return `Это вопрос мини-теста. Перечитай теорию урока — ответ там. Если хочешь, я могу дать готовый ответ: напиши «покажи ответ».`;
  if (ctx.lesson) return `Ты в уроке «${ctx.lesson.title}». Спроси про любой термин или команду из теории — объясню.`;
  return 'Я ментор L3 Quest. Спроси про прогресс, следующий шаг или любую тему из курса.';
}

export const OFFLINE_NOTE =
  'Сейчас я в офлайн-режиме (отвечаю по шаблонам). Чтобы я отвечал как Claude, запусти сайт через `npm run dev` на компьютере, где выполнен вход в Claude Code (`claude` → /login с подпиской Pro). Подробнее — в README.';
