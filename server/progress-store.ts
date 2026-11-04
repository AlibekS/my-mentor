import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Хранение прогресса в файле (а не только в браузере).
 *
 * Папка: L3_DATA_DIR → OneDrive\my-progress (переменные Windows OneDriveCommercial / OneDrive /
 * OneDriveConsumer — клиент OneDrive сам синхронизирует файл в облако) → ./data в папке проекта.
 * Файл — progress.json в формате экспорта из «Профиля» (его же можно импортировать вручную).
 * Перед первой записью за день — копия в backups/progress-ГГГГ-ММ-ДД.json (хранятся 30 последних),
 * перед сбросом прогресса — отдельная копия progress-before-reset-….json.
 */

export interface DataDir {
  dir: string;
  source: 'L3_DATA_DIR' | 'OneDrive' | 'project';
}

export function resolveDataDir(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): DataDir {
  if (env.L3_DATA_DIR) return { dir: env.L3_DATA_DIR, source: 'L3_DATA_DIR' };
  const od = env.OneDriveCommercial || env.OneDrive || env.OneDriveConsumer;
  if (od && existsSync(od)) return { dir: join(od, 'my-progress'), source: 'OneDrive' };
  return { dir: join(cwd, 'data'), source: 'project' };
}

type Progress = Record<string, unknown> & { updatedAt?: number; xp?: number; onboarding?: { done?: boolean } };

const FILE = 'progress.json';
const KEEP_BACKUPS = 30;

export function readProgress(dir: string): { progress: Progress; savedAt?: string } | null {
  const p = join(dir, FILE);
  if (!existsSync(p)) return null;
  const raw = JSON.parse(readFileSync(p, 'utf8')) as Progress & { app?: string; exportedAt?: string };
  const { app: _app, exportedAt, ...progress } = raw;
  return { progress, savedAt: exportedAt };
}

const isEmpty = (p: Progress) => !p.onboarding?.done && !(Number(p.xp) > 0);
const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export type WriteResult = { ok: true; savedAt: string } | { ok: false; conflict: { progress: Progress; savedAt?: string } };

/**
 * Записать прогресс. Если в файле версия новее (например, пришла с другого ноутбука через OneDrive) —
 * не перезаписываем, а возвращаем её (conflict), клиент возьмёт её себе.
 */
export function writeProgress(dir: string, progress: Progress, now = new Date()): WriteResult {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, FILE);
  const existing = existsSync(file) ? safeRead(dir) : null;
  if (existing && (existing.progress.updatedAt ?? 0) > (progress.updatedAt ?? 0)) return { ok: false, conflict: existing };
  if (existing) {
    const backups = join(dir, 'backups');
    mkdirSync(backups, { recursive: true });
    // сброс прогресса — всегда отдельная копия «до»
    if (isEmpty(progress) && !isEmpty(existing.progress)) copyFileSync(file, join(backups, `progress-before-reset-${day(now)}-${now.getTime()}.json`));
    const daily = join(backups, `progress-${day(now)}.json`);
    if (!existsSync(daily)) copyFileSync(file, daily);
    const old = readdirSync(backups).filter((f) => /^progress-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    for (const f of old.slice(0, Math.max(0, old.length - KEEP_BACKUPS))) rmSync(join(backups, f), { force: true });
  }
  const savedAt = now.toISOString();
  // атомарно: сначала временный файл, потом переименование — файл не испортится при обрыве
  const tmp = join(dir, `.${FILE}.${process.pid}.tmp`);
  writeFileSync(tmp, JSON.stringify({ app: 'l3-quest', exportedAt: savedAt, ...progress }, null, 2), 'utf8');
  renameSync(tmp, file);
  return { ok: true, savedAt };
}

function safeRead(dir: string) {
  try {
    return readProgress(dir);
  } catch {
    // повреждённый файл не блокирует запись: сохраним его копию рядом
    const file = join(dir, FILE);
    try {
      copyFileSync(file, join(dir, `progress-broken-${Date.now()}.json`));
    } catch {
      /* ignore */
    }
    return null;
  }
}
