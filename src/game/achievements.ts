import type { Module } from '../content/types';
import type { Progress } from './progress';
import { isModuleDone } from './unlock';
import { levelFromXp } from './levels';

export interface AchievementCtx {
  modules: Module[];
  now: Date;
}

export interface Achievement {
  id: string;
  title: string;
  icon: string;
  /** как получить (показывается на закрытом бейдже) */
  hint: string;
  test(p: Progress, c: AchievementCtx): boolean;
}

const lessonsDone = (p: Progress) => Object.entries(p.lessons).filter(([, l]) => l.completedAt);
const moduleDone = (id: string) => (p: Progress, c: AchievementCtx) => {
  const m = c.modules.find((x) => x.id === id);
  return !!m && isModuleDone(m, p);
};

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-blood', title: 'Первая кровь', icon: '🩸', hint: 'Реши первое задание в терминале', test: (p) => p.stats.tasksSolved >= 1 },
  { id: 'no-hints-lesson', title: 'Без подсказок', icon: '🧠', hint: 'Пройди урок, не открыв ни одной подсказки', test: (p) => lessonsDone(p).some(([, l]) => Object.keys(l.tasks).length > 0 && Object.values(l.tasks).every((t) => t.hintsUsed === 0 && !t.solutionShown)) },
  { id: 'grep-master', title: 'Grep-мастер', icon: '🔍', hint: 'Реши 25 заданий с помощью grep', test: (p) => p.stats.grepTasks >= 25 },
  { id: 'grep-apprentice', title: 'Grep-подмастерье', icon: '🔎', hint: 'Реши 5 заданий с помощью grep', test: (p) => p.stats.grepTasks >= 5 },
  { id: 'pipeliner', title: 'Пайплайнер', icon: '🚰', hint: 'Выполни команду с 4 и более пайпами', test: (p) => p.stats.maxPipes >= 4 },
  { id: 'night-shift', title: 'Ночной дежурный', icon: '🌙', hint: 'Позанимайся после 23:00', test: (p) => p.stats.nightSessions >= 1 },
  { id: 'early-bird', title: 'Утренний стендап', icon: '🌅', hint: 'Позанимайся до 7:00', test: (p) => p.stats.earlySessions >= 1 },
  { id: 'streak-3', title: 'Разогрев', icon: '🔥', hint: 'Серия 3 дня подряд', test: (p) => p.streak.best >= 3 },
  { id: 'streak-7', title: 'Неделя в строю', icon: '📅', hint: 'Серия 7 дней подряд', test: (p) => p.streak.best >= 7 },
  { id: 'streak-30', title: 'Месяц on-call', icon: '🏅', hint: 'Серия 30 дней подряд', test: (p) => p.streak.best >= 30 },
  { id: 'killer-502', title: 'Убийца 502', icon: '🛡️', hint: 'Пройди модуль «Сеть для L3»', test: moduleDone('06-network') },
  { id: 'root-cause', title: 'Root Cause', icon: '🌱', hint: 'Напиши первый постмортем (модуль «Управление инцидентами»)', test: moduleDone('11-incident-management') },
  { id: 'boss-slayer', title: 'Босс повержен', icon: '⚔️', hint: 'Победи первого «босса» модуля', test: (p) => p.stats.bossesBeaten >= 1 },
  { id: 'boss-trio', title: 'Тройной фраг', icon: '🗡️', hint: 'Победи трёх «боссов»', test: (p) => p.stats.bossesBeaten >= 3 },
  { id: 'ticket-culture', title: 'Тикет-культура', icon: '🎫', hint: 'Пройди модуль «Роль L3»', test: moduleDone('01-l3-role') },
  { id: 'navigator', title: 'Навигатор', icon: '🧭', hint: 'Пройди модуль «Linux-навигация и файлы»', test: moduleDone('02-linux-files') },
  { id: 'log-whisperer', title: 'Заклинатель логов', icon: '📜', hint: 'Пройди модуль «Логи и поиск»', test: moduleDone('03-logs') },
  { id: 'onboarded', title: 'Добро пожаловать в смену', icon: '👋', hint: 'Пройди онбординг и получи программу', test: (p) => p.onboarding.done },
  { id: 'honest', title: 'Честный сигнал', icon: '🙋', hint: 'Нажми «не знаю» во входном тесте — это нормально', test: (p) => (p.onboarding.results ?? []).some((r) => r.answers.some((a) => a.skipped)) },
  { id: 'sharpshooter', title: 'Снайпер', icon: '🎯', hint: 'Ответь с первой попытки на 20 вопросов мини-тестов', test: (p) => p.stats.quizFirstTry >= 20 },
  { id: 'centurion', title: 'Сотня команд', icon: '⌨️', hint: 'Выполни 100 команд в терминале', test: (p) => p.stats.commandsRun >= 100 },
  { id: 'thousand', title: 'Тысяча команд', icon: '💾', hint: 'Выполни 1000 команд в терминале', test: (p) => p.stats.commandsRun >= 1000 },
  { id: 'reviewer', title: 'Повторение — мать учения', icon: '🔁', hint: 'Успешно повтори 10 заданий', test: (p) => p.stats.reviewsDone >= 10 },
  { id: 'mentor-friend', title: 'Спросить у старшего', icon: '👾', hint: 'Задай 5 вопросов ментору', test: (p) => p.stats.mentorQuestions >= 5 },
  { id: 'rank-up', title: 'Эволюция', icon: '🧬', hint: 'Получи новый ранг', test: (p) => levelFromXp(p.xp) >= 4 },
  { id: 'l3-ready', title: 'Готов к L3', icon: '🏆', hint: 'Достигни ранга «Инженер L3» (уровень 12)', test: (p) => levelFromXp(p.xp) >= 12 },
  // --- L2 Quest ---
  { id: 'l2-first-ticket', title: 'Первый тикет', icon: '🎟️', hint: 'Пройди модуль «Роль L2 и работа с тикетами»', test: moduleDone('l2-01-support-role') },
  { id: 'l2-devtools', title: 'DevTools-детектив', icon: '🕵️', hint: 'Пройди модуль «Браузер как инструмент: DevTools»', test: moduleDone('l2-03-browser-devtools') },
  { id: 'l2-sql', title: 'SELECT без страха', icon: '🗃️', hint: 'Пройди модуль «SQL на чтение»', test: moduleDone('l2-06-sql-read') },
  { id: 'l2-english', title: 'Reply sent', icon: '✉️', hint: 'Пройди модуль «Коммуникация и английский в поддержке»', test: moduleDone('l2-08-communication') },
  { id: 'l2-graduate', title: 'Выпускник L2 Quest', icon: '🎓', hint: 'Победи всех «боссов» L2 Quest', test: (p, c) => { const l2 = c.modules.filter((m) => m.track === 'l2'); return l2.length > 0 && l2.every((m) => isModuleDone(m, p)); } },
  { id: 'clean-run', title: 'Чистый прогон', icon: '✨', hint: 'Пройди 5 уроков без «Показать решение»', test: (p) => lessonsDone(p).filter(([, l]) => Object.values(l.tasks).every((t) => !t.solutionShown)).length >= 5 },
];

/** Вернуть новые ачивки и отметить их в прогрессе */
export function awardAchievements(p: Progress, c: AchievementCtx): typeof ACHIEVEMENTS {
  const got: typeof ACHIEVEMENTS = [];
  for (const a of ACHIEVEMENTS) {
    if (p.achievements[a.id]) continue;
    if (a.test(p, c)) {
      p.achievements[a.id] = c.now.getTime();
      got.push(a);
    }
  }
  return got;
}
