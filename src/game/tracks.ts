import { l2Modules, modulesOf } from '../content';
import type { Track } from '../content/types';
import { finalizePlan } from './placement';
import type { Progress } from './progress';

export const TRACK_INFO: Record<Track, { title: string; role: string; tagline: string }> = {
  l2: { title: 'L2 Quest', role: 'L2', tagline: 'С первой линии на вторую: воспроизвести, сузить, собрать доказательства, грамотно эскалировать.' },
  l3: { title: 'L3 Quest', role: 'L3', tagline: 'Путь от тикета до первопричины.' },
};

export const currentTrack = (p: Pick<Progress, 'track'>): Track => p.track ?? 'l3';

/** Программа L2 строится сама (без входного теста): модули по порядку; новые модули дописываются в конец */
export function ensureL2Plan(p: Progress): boolean {
  if (!l2Modules.length) return false;
  const have = new Set(p.l2Plan?.items.map((i) => i.moduleId) ?? []);
  const missing = l2Modules.filter((m) => !have.has(m.id));
  const stale = p.l2Plan?.items.some((i) => !l2Modules.some((m) => m.id === i.moduleId));
  if (p.l2Plan && !missing.length && !stale) return false;
  const items = [...(p.l2Plan?.items ?? []).filter((i) => l2Modules.some((m) => m.id === i.moduleId)), ...missing.map((m) => ({ moduleId: m.id, mode: 'full' as const, startPct: 0, skippable: [] }))];
  const minutes = p.l2Plan?.minutesPerDay ?? p.plan?.minutesPerDay ?? p.onboarding.survey?.minutesPerDay ?? 30;
  p.l2Plan = { ...finalizePlan(l2Modules, items, minutes, p.l2Plan?.targetDate), createdAt: p.l2Plan?.createdAt ?? Date.now() };
  return true;
}

/** Модули активного трека */
export const trackModules = (p: Pick<Progress, 'track'>) => modulesOf(currentTrack(p));

/** Программа активного трека */
export const trackPlan = (p: Progress) => (currentTrack(p) === 'l2' ? p.l2Plan : p.plan);
