/** Схема сохранённого прогресса (localStorage). При изменении — увеличить VERSION и добавить миграцию. */
export const STORAGE_KEY = 'l3quest.progress';
export const VERSION = 1;

export type SelfLevel = 'none' | 'heard' | 'hints' | 'confident' | 'unknown';
export type GeneralLevel = 'newbie' | 'l1' | 'l2' | 'sysadmin' | 'l3';
export type PlanMode = 'full' | 'partial' | 'exam';

export interface TaskProgress {
  solved: boolean;
  hintsUsed: number;
  solutionShown: boolean;
  attempts: number;
  xp: number;
  solvedWith?: string[];
}

export interface QuestionProgress {
  attempts: number;
  correct: boolean;
  firstTry: boolean;
  xp: number;
}

export interface LessonProgress {
  started: number;
  completedAt?: number;
  tasks: Record<string, TaskProgress>;
  quiz: Record<string, QuestionProgress>;
  xp: number;
  /** % освоения темы до урока — для экрана итогов */
  masteryBefore?: number;
  timeMs: number;
}

export interface PlacementAnswer {
  questionId: string;
  difficulty: number;
  correct: boolean;
  skipped: boolean;
}

export interface TopicResult {
  moduleId: string;
  self: SelfLevel;
  testPct: number | null;
  startPct: number;
  answers: PlacementAnswer[];
  mismatch: boolean;
}

export interface PlanItem {
  moduleId: string;
  mode: PlanMode;
  startPct: number;
  /** уроки, которые можно пропустить (подтверждены тестом) */
  skippable: string[];
  /** открыт вручную */
  forceUnlocked?: boolean;
}

export interface Plan {
  createdAt: number;
  items: PlanItem[];
  minutesPerDay: number;
  totalMinutes: number;
  etaDays: number;
  targetDate?: string;
}

export interface Survey {
  general: GeneralLevel;
  topics: Record<string, SelfLevel>;
  minutesPerDay: number;
  targetDate?: string;
}

export interface ReviewItem {
  key: string; // lessonKey#taskId | lessonKey?questionId
  lessonKey: string;
  itemId: string;
  kind: 'task' | 'question';
  due: number;
  step: number;
  lapses: number;
  successes: number;
}

export interface HistoryEntry {
  ts: number;
  text: string;
  xp?: number;
}

export interface MentorMessage {
  role: 'user' | 'assistant';
  text: string;
  ts: number;
}

export interface Progress {
  version: number;
  /** время последнего изменения (мс) — кто новее, файл или браузер */
  updatedAt?: number;
  profile: { name: string; createdAt: number; theme: 'dark' | 'light' };
  xp: number;
  achievements: Record<string, number>;
  lessons: Record<string, LessonProgress>;
  onboarding: { done: boolean; survey?: Survey; results?: TopicResult[] };
  plan?: Plan;
  /** активный трек: 'l2' — L2 Quest, 'l3' (по умолчанию) — L3 Quest */
  track?: 'l2' | 'l3';
  /** программа L2 Quest (строится автоматически, порядок модулей можно менять) */
  l2Plan?: Plan;
  /** лучшее достигнутое освоение по модулям (никогда не уменьшается) */
  masteryBest: Record<string, number>;
  lastActivity: Record<string, number>;
  streak: { current: number; best: number; lastDay?: string };
  stats: {
    tasksSolved: number;
    tasksNoHints: number;
    quizAnswered: number;
    quizFirstTry: number;
    commandCounts: Record<string, number>;
    grepTasks: number;
    maxPipes: number;
    timeMs: number;
    bossesBeaten: number;
    nightSessions: number;
    earlySessions: number;
    reviewsDone: number;
    mentorQuestions: number;
    commandsRun: number;
    errorsSeen: number;
  };
  review: Record<string, ReviewItem>;
  history: HistoryEntry[];
  mentor: Record<string, MentorMessage[]>;
  seenRank: number;
}

export function emptyProgress(now = Date.now()): Progress {
  return {
    version: VERSION,
    profile: { name: 'Алибек', createdAt: now, theme: 'dark' },
    xp: 0,
    achievements: {},
    lessons: {},
    onboarding: { done: false },
    masteryBest: {},
    lastActivity: {},
    streak: { current: 0, best: 0 },
    stats: {
      tasksSolved: 0,
      tasksNoHints: 0,
      quizAnswered: 0,
      quizFirstTry: 0,
      commandCounts: {},
      grepTasks: 0,
      maxPipes: 0,
      timeMs: 0,
      bossesBeaten: 0,
      nightSessions: 0,
      earlySessions: 0,
      reviewsDone: 0,
      mentorQuestions: 0,
      commandsRun: 0,
      errorsSeen: 0,
    },
    review: {},
    history: [],
    mentor: {},
    seenRank: 1,
  };
}

type Migration = (p: any) => any;
/** migrations[n] переводит схему n → n+1 */
const migrations: Record<number, Migration> = {};

export function migrate(raw: unknown): Progress {
  if (!raw || typeof raw !== 'object') return emptyProgress();
  let p: any = raw;
  let v = typeof p.version === 'number' ? p.version : 0;
  if (v > VERSION) throw new Error(`Файл прогресса новее приложения (версия ${v})`);
  while (v < VERSION) {
    const m = migrations[v];
    p = m ? m(p) : p;
    v++;
    p.version = v;
  }
  // добиваем отсутствующие поля значениями по умолчанию
  const base = emptyProgress(p.profile?.createdAt);
  return { ...base, ...p, profile: { ...base.profile, ...p.profile }, stats: { ...base.stats, ...p.stats }, streak: { ...base.streak, ...p.streak } };
}

export function loadProgress(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): Progress {
  try {
    const s = storage?.getItem(`${STORAGE_KEY}.v${VERSION}`) ?? findOlder(storage);
    return s ? migrate(JSON.parse(s)) : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

function findOlder(storage: Pick<Storage, 'getItem'> | undefined): string | null {
  for (let v = VERSION - 1; v >= 0; v--) {
    const s = storage?.getItem(`${STORAGE_KEY}.v${v}`);
    if (s) return s;
  }
  return null;
}

export function saveProgress(p: Progress, storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage) {
  try {
    storage?.setItem(`${STORAGE_KEY}.v${VERSION}`, JSON.stringify(p));
  } catch {
    /* переполнение или приватный режим — игнорируем */
  }
}

export function exportProgress(p: Progress): string {
  return JSON.stringify({ app: 'l3-quest', exportedAt: new Date().toISOString(), ...p }, null, 2);
}

export function importProgress(json: string): Progress {
  const data = JSON.parse(json);
  if (data.app && data.app !== 'l3-quest') throw new Error('Это не файл прогресса L3 Quest');
  delete data.app;
  delete data.exportedAt;
  return migrate(data);
}

/** Пункт программы для модуля любого трека (id модулей L2 и L3 не пересекаются) */
export function planItemOf(p: Pick<Progress, 'plan' | 'l2Plan'>, moduleId: string): PlanItem | undefined {
  return p.plan?.items.find((i) => i.moduleId === moduleId) ?? p.l2Plan?.items.find((i) => i.moduleId === moduleId);
}
