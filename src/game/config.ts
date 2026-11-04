/**
 * Все «числа игры» в одном месте: XP, кривая уровней, веса освоения тем,
 * формула входного теста, интервалы повторения.
 */
export const XP = {
  task: { noHints: 30, oneHint: 20, moreHints: 10, solutionShown: 0 },
  quiz: { firstTry: 15, secondTry: 5 },
  lessonComplete: 50,
  bossComplete: 200,
  streakPerDay: 10,
  streakMaxBonus: 70,
  reviewSuccess: 5,
};

export const LEVELS = {
  max: 30,
  /** XP, нужный для уровня n: base * (n-1)^exp */
  base: 100,
  exp: 1.5,
};

export const RANKS = [
  { id: 1, minLevel: 1, title: 'Стажёр', titleEn: 'Intern', look: 'обычный человечек в худи' },
  { id: 2, minLevel: 4, title: 'Оператор L1', titleEn: 'L1 Operator', look: 'гарнитура' },
  { id: 3, minLevel: 8, title: 'Инженер L2', titleEn: 'L2 Engineer', look: 'ноутбук и бейдж' },
  { id: 4, minLevel: 12, title: 'Инженер L3', titleEn: 'L3 Engineer', look: 'терминал за спиной, светящиеся очки' },
  { id: 5, minLevel: 16, title: 'Дежурный', titleEn: 'On-call', look: 'тактический жилет, пейджер' },
  { id: 6, minLevel: 20, title: 'Охотник за инцидентами', titleEn: 'Incident Hunter', look: 'кибер-имплант, плащ' },
  { id: 7, minLevel: 25, title: 'Ронин продакшена', titleEn: 'Production Ronin', look: 'катана-кабель, полу-кибер броня' },
  { id: 8, minLevel: 29, title: 'Кибер-самурай', titleEn: 'Cyber Samurai', look: 'полный кибер-доспех, неоновый шлем, катана' },
] as const;

/** Освоение темы: веса компонентов (сумма = 1). Без «босса» максимум = 1 - boss */
export const MASTERY = {
  weights: { lessons: 0.35, tasks: 0.2, quiz: 0.15, boss: 0.3 },
  /** вклад решённого задания в зависимости от подсказок */
  taskQuality: { noHints: 1, oneHint: 0.75, moreHints: 0.5, solutionShown: 0.25 },
  /** бонус за успешное повторение (в % от остатка), не больше reviewCap */
  reviewBonus: 1,
  reviewCap: 5,
  /** без «босса» тема не может быть выше */
  capWithoutBoss: 95,
  /** забывание: через сколько дней без активности и при просроченных повторениях */
  decayAfterDays: 21,
  decayPerWeek: 3,
  /** не ниже этой доли от достигнутого */
  decayFloor: 0.7,
};

/** Онбординг: самооценка → проценты; вес теста больше самооценки */
export const PLACEMENT = {
  selfPct: { none: 0, heard: 20, hints: 50, confident: 80 } as Record<string, number>,
  weights: { test: 0.7, self: 0.3 },
  /** балл теста за правильный ответ на сложности 1/2/3 */
  levelValue: { 1: 35, 2: 65, 3: 90 } as Record<number, number>,
  /** бонус за 2 правильных ответа на сложности 3 */
  topBonus: 10,
  /** штраф за ошибку на уровне не выше достигнутого */
  wrongPenalty: 10,
  maxQuestionsPerTopic: 3,
  /** с какой сложности начинать в зависимости от самооценки */
  startDifficulty: { none: 1, heard: 1, hints: 2, confident: 3, unknown: 2 } as Record<string, 1 | 2 | 3>,
  /** порог «расхождения» самооценки и теста */
  mismatch: 30,
  plan: { full: 30, exam: 70 },
  secondsPerQuestion: 50,
};

/** Интервальное повторение: интервалы в днях */
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60];

/** Сколько дней данные о рынке считаются свежими */
export const MARKET_FRESH_DAYS = 90;
