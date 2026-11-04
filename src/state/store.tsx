import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { modules } from '../content';
import { ACHIEVEMENTS, awardAchievements } from '../game/achievements';
import { touchDay } from '../game/actions';
import { levelFromXp, rankForLevel } from '../game/levels';
import { emptyProgress, loadProgress, saveProgress, type Progress } from '../game/progress';

export interface Toast {
  id: number;
  kind: 'xp' | 'achievement' | 'info' | 'error';
  text: string;
  icon?: string;
}

interface Store {
  progress: Progress;
  /** Изменить прогресс: fn получает копию и может её мутировать */
  update(fn: (p: Progress) => void): void;
  replace(p: Progress): void;
  reset(): void;
  toasts: Toast[];
  toast(t: Omit<Toast, 'id'>): void;
  dismissToast(id: number): void;
  rankUp: number | null;
  ackRankUp(): void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [rankUp, setRankUp] = useState<number | null>(null);
  const idRef = useRef(1);
  const ref = useRef(progress);
  ref.current = progress;

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = idRef.current++;
    setToasts((ts) => [...ts.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), t.kind === 'achievement' ? 5000 : 2800);
  }, []);

  const commit = useCallback(
    (next: Progress, prevXp: number) => {
      const got = awardAchievements(next, { modules, now: new Date() });
      for (const a of got) toast({ kind: 'achievement', text: `Ачивка: ${a.title}`, icon: a.icon });
      const gained = next.xp - prevXp;
      if (gained > 0) toast({ kind: 'xp', text: `+${gained} XP` });
      const rank = rankForLevel(levelFromXp(next.xp)).id;
      if (rank > next.seenRank) setRankUp(rank);
      saveProgress(next);
      setProgress(next);
    },
    [toast],
  );

  const update = useCallback(
    (fn: (p: Progress) => void) => {
      const prev = ref.current;
      const next = structuredClone(prev);
      if (next.onboarding.done) touchDay(next);
      fn(next);
      ref.current = next;
      commit(next, prev.xp);
    },
    [commit],
  );

  const replace = useCallback((p: Progress) => {
    saveProgress(p);
    ref.current = p;
    setProgress(p);
  }, []);

  const reset = useCallback(() => replace(emptyProgress()), [replace]);

  const ackRankUp = useCallback(() => {
    if (rankUp) update((p) => (p.seenRank = rankUp));
    setRankUp(null);
  }, [rankUp, update]);

  // тема
  useEffect(() => {
    document.documentElement.dataset.theme = progress.profile.theme;
  }, [progress.profile.theme]);

  const value = useMemo<Store>(
    () => ({ progress, update, replace, reset, toasts, toast, dismissToast: (id) => setToasts((t) => t.filter((x) => x.id !== id)), rankUp, ackRankUp }),
    [progress, update, replace, reset, toasts, toast, rankUp, ackRankUp],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}

export { ACHIEVEMENTS };
