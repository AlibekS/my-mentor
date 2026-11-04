import { describe, it, expect } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readProgress, resolveDataDir, writeProgress } from './progress-store';

const tmp = () => mkdtempSync(join(tmpdir(), 'l3-progress-'));
const prog = (xp: number, updatedAt: number) => ({ version: 1, xp, updatedAt, onboarding: { done: true } });

describe('progress file store', () => {
  it('picks L3_DATA_DIR, then OneDrive\\my-progress, then ./data', () => {
    const od = tmp();
    expect(resolveDataDir({ L3_DATA_DIR: '/x' }, '/proj')).toEqual({ dir: '/x', source: 'L3_DATA_DIR' });
    expect(resolveDataDir({ OneDriveCommercial: od }, '/proj')).toEqual({ dir: join(od, 'my-progress'), source: 'OneDrive' });
    expect(resolveDataDir({ OneDrive: '/nonexistent-dir' }, '/proj')).toEqual({ dir: join('/proj', 'data'), source: 'project' });
  });
  it('writes in export format, reads back, refuses to overwrite a newer file', () => {
    const dir = join(tmp(), 'my-progress');
    expect(readProgress(dir)).toBeNull();
    expect(writeProgress(dir, prog(10, 1000)).ok).toBe(true);
    const raw = JSON.parse(readFileSync(join(dir, 'progress.json'), 'utf8'));
    expect(raw.app).toBe('l3-quest');
    expect(readProgress(dir)!.progress.xp).toBe(10);
    // с другого ноутбука через OneDrive пришла версия новее — старая вкладка её не затрёт
    const r = writeProgress(dir, prog(5, 500));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.conflict.progress.xp).toBe(10);
    expect(writeProgress(dir, prog(20, 2000)).ok).toBe(true);
    expect(readProgress(dir)!.progress.xp).toBe(20);
  });
  it('daily backups (keeps 30) and a copy before reset', () => {
    const dir = tmp();
    writeProgress(dir, prog(1, 1), new Date('2026-11-01T10:00:00'));
    mkdirSync(join(dir, 'backups'), { recursive: true });
    for (let d = 1; d <= 35; d++) writeFileSync(join(dir, 'backups', `progress-2026-09-${String(d).padStart(2, '0')}.json`), '{}');
    writeProgress(dir, prog(2, 2), new Date('2026-11-02T10:00:00'));
    writeProgress(dir, prog(3, 3), new Date('2026-11-02T11:00:00'));
    const files = readdirSync(join(dir, 'backups'));
    expect(files.filter((f) => /^progress-\d{4}-\d{2}-\d{2}\.json$/.test(f))).toHaveLength(30);
    expect(files).toContain('progress-2026-11-02.json');
    writeProgress(dir, { version: 1, xp: 0, updatedAt: 4, onboarding: { done: false } }, new Date('2026-11-02T12:00:00'));
    expect(readdirSync(join(dir, 'backups')).some((f) => f.startsWith('progress-before-reset-'))).toBe(true);
  });
});
