import type { Scenario } from '../shell/types';
import type { Shell } from '../shell/shell';
import type { ExecRecord } from '../shell/types';

/** Проверка результата задания — по состоянию и выводу, а не по точному тексту команды */
export type Check =
  /** stdout последней команды содержит все строки (без учёта регистра, если ci) */
  | { type: 'outputContains'; value: string | string[]; ci?: boolean }
  /** stdout последней команды НЕ содержит ни одной из строк */
  | { type: 'outputNotContains'; value: string | string[] }
  | { type: 'outputMatches'; pattern: string; flags?: string }
  /** stdout после нормализации пробелов равен значению */
  | { type: 'outputEquals'; value: string }
  /** вывод — это число N (одиночное число, «file:N» или «N file») */
  | { type: 'outputNumber'; value: number }
  /** количество строк вывода */
  | { type: 'outputLines'; value: number }
  | { type: 'fileExists'; path: string; negate?: boolean }
  | { type: 'fileContains'; path: string; value: string | string[] }
  | { type: 'fileMode'; path: string; mode: number }
  | { type: 'fileOwner'; path: string; owner: string; group?: string }
  | { type: 'cwd'; path: string }
  | { type: 'serviceState'; name: string; state: 'active' | 'inactive' | 'failed' }
  | { type: 'processGone'; pid: number }
  /** в последней строке использована команда (например grep) */
  | { type: 'commandUsed'; name: string | string[] }
  /** минимальное число пайпов в последней строке */
  | { type: 'minPipes'; value: number }
  | { type: 'exitCode'; value: number }
  /** произвольная проверка */
  | { type: 'custom'; fn: (shell: Shell, last: ExecRecord | undefined) => boolean }
  | { type: 'all'; checks: Check[] }
  | { type: 'any'; checks: Check[] };

export type AnswerNormalize = 'text' | 'number' | 'exact' | 'keywords';

export interface AnswerSpec {
  /** допустимые ответы (для keywords — группы синонимов, нужно совпадение по каждой группе) */
  accept: string[];
  normalize?: AnswerNormalize;
  /** для keywords: массив групп синонимов, каждая группа должна встретиться */
  keywords?: string[][];
  /** подпись поля ввода */
  label?: string;
  placeholder?: string;
}

export interface Task {
  id: string;
  /** Формулировка (markdown) */
  prompt: string;
  /** Окружение (если не задано — берётся lesson.scenario) */
  scenario?: Scenario;
  /** Проверка по терминалу. Если задан answer — сначала исследуешь, потом вводишь ответ */
  check?: Check;
  /** Ответ вводится в поле «Ответ» */
  answer?: AnswerSpec;
  hints: string[];
  /** Эталонное решение (команды) */
  solution: string;
  /** Почему так (показывается после решения) */
  explanation?: string;
  /** Метки для статистики/ачивок: grep, awk, pipes, systemctl … */
  tags?: string[];
  /** SQL-урок: важен ли порядок строк при сравнении с эталоном (solution) */
  sqlOrdered?: boolean;
}

export type Question =
  | {
      id: string;
      type: 'text';
      prompt: string;
      answer: AnswerSpec;
      explanation: string;
      hint?: string;
    }
  | {
      id: string;
      type: 'command';
      prompt: string;
      /** Команда ученика запускается в чистом окружении и сравнивается с эталоном по выводу */
      scenario: Scenario;
      solution: string;
      /** Иначе — сравнение вывода с выводом эталона; можно задать свою проверку */
      check?: Check;
      explanation: string;
      hint?: string;
    }
  | {
      id: string;
      type: 'sql';
      prompt: string;
      /** Запрос ученика и эталон выполняются на копиях БД урока и сравниваются по результату */
      solution: string;
      ordered?: boolean;
      explanation: string;
      hint?: string;
    }
  | {
      id: string;
      type: 'choice';
      prompt: string;
      options: string[];
      correct: number;
      explanation: string;
      hint?: string;
    };

export interface GlossaryItem {
  ru: string;
  en: string;
  def: string;
}

export interface LessonDef {
  id: string;
  title: string;
  kind?: 'lesson' | 'boss';
  minutes: number;
  /** Окружение терминала по умолчанию */
  scenario: Scenario;
  /** SQL-урок: вместо терминала — SQL-консоль с этой БД (CREATE TABLE + INSERT, диалект SQLite) */
  sql?: { dataset: string };
  tasks: Task[];
  quiz: Question[];
  glossary?: GlossaryItem[];
  /** Команды, которые изучаются в уроке (для справочника) */
  commands?: string[];
  /** Для «босса»: легенда инцидента */
  incident?: { ticket: string; severity: 'SEV1' | 'SEV2' | 'SEV3'; customer: string };
}

export interface Lesson extends LessonDef {
  moduleId: string;
  /** "01-l3-role/02-sla" */
  key: string;
  theory: string;
  order: number;
}

export interface ModuleMeta {
  id: string;
  order: number;
  title: string;
  titleEn: string;
  short: string;
  description: string;
  icon: string;
  /** Важность для L3 (1–5) — влияет на порядок в программе и вес в общем проценте */
  importance: number;
  requires: string[];
  /** Примеры навыков для самооценки в онбординге */
  skills: string[];
  topics: string[];
  /** Дата последней сверки с рынком */
  reviewedAt: string;
  demand: 'rising' | 'stable' | 'declining';
  marketNote?: string;
  status: 'ready' | 'planned';
  estimatedMinutes?: number;
}

export interface Module extends ModuleMeta {
  lessons: Lesson[];
  boss?: Lesson;
}

export interface PlacementQuestion {
  id: string;
  difficulty: 1 | 2 | 3;
  prompt: string;
  /** В каких уроках темы этот навык изучается (для плана «частично») */
  lessons?: string[];
  answer?: AnswerSpec;
  /** Задание в терминале: исследуй окружение и введи ответ */
  scenario?: Scenario;
  /** Вопрос-команда: сравнение вывода с эталоном */
  solution?: string;
  options?: string[];
  correct?: number;
  explanation?: string;
  /** SQL-вопрос: запрос сравнивается с solution на этой БД */
  type?: 'sql';
  dataset?: string;
  ordered?: boolean;
}

export interface PlacementTopic {
  moduleId: string;
  questions: PlacementQuestion[];
}
