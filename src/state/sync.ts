import { migrate, type Progress } from '../game/progress';

/**
 * Синхронизация прогресса с файлом на компьютере (через dev-сервер: /api/progress).
 * Браузер (localStorage) — быстрый кэш и запасной вариант, источник правды — файл
 * (по умолчанию OneDrive\my-progress\progress.json). Побеждает версия с большим updatedAt.
 */
export type SyncState =
  | { kind: 'loading' }
  | { kind: 'off'; reason: string }
  | { kind: 'ok'; dir: string; savedAt?: string }
  | { kind: 'error'; dir?: string; error: string };

interface ServerReply {
  dir?: string;
  source?: string;
  progress?: Progress | null;
  savedAt?: string | null;
  error?: string;
}

export async function pullProgress(timeoutMs = 4000): Promise<{ reply: ServerReply | null; state: SyncState }> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch('/api/progress', { signal: ac.signal, cache: 'no-store' });
    if (res.status === 404 || !(res.headers.get('content-type') ?? '').includes('json')) return { reply: null, state: { kind: 'off', reason: 'сервер без хранилища (сборка открыта как статический сайт)' } };
    const reply = (await res.json()) as ServerReply;
    if (!res.ok) return { reply: null, state: { kind: 'error', dir: reply.dir, error: reply.error ?? `HTTP ${res.status}` } };
    return { reply: { ...reply, progress: reply.progress ? migrate(reply.progress) : null }, state: { kind: 'ok', dir: reply.dir ?? '', savedAt: reply.savedAt ?? undefined } };
  } catch (e) {
    return { reply: null, state: { kind: 'off', reason: (e as Error).name === 'AbortError' ? 'сервер не ответил' : 'нет связи с сервером' } };
  } finally {
    clearTimeout(t);
  }
}

export async function pushProgress(p: Progress, keepalive = false): Promise<{ state: SyncState; newer?: Progress }> {
  try {
    const res = await fetch('/api/progress', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ progress: p }), keepalive });
    const reply = (await res.json().catch(() => ({}))) as ServerReply;
    if (res.status === 409 && reply.progress) return { state: { kind: 'ok', dir: reply.dir ?? '', savedAt: reply.savedAt ?? undefined }, newer: migrate(reply.progress) };
    if (!res.ok) return { state: { kind: 'error', dir: reply.dir, error: reply.error ?? `HTTP ${res.status}` } };
    return { state: { kind: 'ok', dir: reply.dir ?? '', savedAt: reply.savedAt ?? undefined } };
  } catch (e) {
    return { state: { kind: 'error', error: `не удалось сохранить в файл: ${(e as Error).message}` } };
  }
}

/** Есть ли в прогрессе что терять */
export const hasData = (p: Progress) => p.onboarding.done || p.xp > 0;
