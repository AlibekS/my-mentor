import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { allModules as modules } from '../content';
import { ACHIEVEMENTS, awardAchievements } from '../game/achievements';
import { touchDay } from '../game/actions';
import { levelFromXp, rankForLevel } from '../game/levels';
import { emptyProgress, loadProgress, saveProgress, STORAGE_KEY, type Progress } from '../game/progress';
import { hasData, pullProgress, pushProgress, type SyncState } from './sync';

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
  /** где хранится прогресс и удалось ли сохранить */
  sync: SyncState;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [rankUp, setRankUp] = useState<number | null>(null);
  const idRef = useRef(1);
  const ref = useRef(progress);
  ref.current = progress;

  const [sync, setSync] = useState<SyncState>({ kind: 'loading' });
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  /** Принять версию из файла (она новее) — без отметки времени и без обратной записи */
  const adopt = useCallback((p: Progress) => {
    saveProgress(p);
    ref.current = p;
    setProgress(p);
  }, []);

  const pulled = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeRef = useRef<(text: string) => void>(() => {});

  /** Сверка с файлом: новее браузера — берём файл; иначе браузер уходит в файл */
  const reconcile = useCallback(async (): Promise<boolean> => {
    const { reply, state } = await pullProgress();
    setSync(state);
    if (!reply) return false;
    pulled.current = true;
    const local = ref.current;
    const remote = reply.progress;
    if (remote && (remote.updatedAt ?? 0) >= (local.updatedAt ?? 0) && (hasData(remote) || !hasData(local))) {
      if ((remote.updatedAt ?? 0) > (local.updatedAt ?? 0)) adopt(remote);
    } else if (hasData(local)) {
      if (!local.updatedAt) local.updatedAt = Date.now();
      dirty.current = true;
    }
    return true;
  }, [adopt]);

  const flush = useCallback(
    async (keepalive = false) => {
      if (!dirty.current) return;
      // файл ещё ни разу не прочитан (сервер стартовал позже страницы) — сначала сверяемся, чтобы не затереть его
      if (!pulled.current && !keepalive && !(await reconcile())) {
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => void flush(), 15000);
        return;
      }
      if (!dirty.current) return;
      dirty.current = false;
      const sent = ref.current;
      const r = await pushProgress(sent, keepalive);
      setSync(r.state);
      if (r.newer) {
        adopt(r.newer);
        noticeRef.current('В файле прогресса оказалась более новая версия — взята она');
      } else if (r.state.kind === 'error') {
        // не сохранилось (файл занят, сервер остановлен) — повторим
        dirty.current = true;
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => void flush(), 15000);
      }
    },
    [adopt, reconcile],
  );

  /** Сохранить в файл через секунду после последнего изменения */
  const schedulePush = useCallback(() => {
    dirty.current = true;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => void flush(), 1200);
  }, [flush]);

  // старт: сверка с файлом; закрытие вкладки — досохранить; другая вкладка сохранила — взять её версию
  useEffect(() => {
    let alive = true;
    void reconcile().then(() => alive && dirty.current && void flush());
    const onHide = () => {
      if (dirty.current && pulled.current) void flush(true);
    };
    const onVisibility = () => document.visibilityState === 'hidden' && onHide();
    // вторая вкладка сайта: без этого вкладки затирали бы прогресс друг друга
    const onStorage = (e: StorageEvent) => {
      if (!e.key?.startsWith(STORAGE_KEY) || !e.newValue) return;
      const other = loadProgress();
      if ((other.updatedAt ?? 0) > (ref.current.updatedAt ?? 0)) {
        ref.current = other;
        setProgress(other);
      }
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorage);
    return () => {
      alive = false;
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
    };
  }, [reconcile, flush]);

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = idRef.current++;
    setToasts((ts) => [...ts.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), t.kind === 'achievement' ? 5000 : 2800);
  }, []);
  noticeRef.current = (text) => toast({ kind: 'info', text });

  const commit = useCallback(
    (next: Progress, prevXp: number) => {
      const got = awardAchievements(next, { modules, now: new Date() });
      for (const a of got) toast({ kind: 'achievement', text: `Ачивка: ${a.title}`, icon: a.icon });
      const gained = next.xp - prevXp;
      if (gained > 0) toast({ kind: 'xp', text: `+${gained} XP` });
      const rank = rankForLevel(levelFromXp(next.xp)).id;
      if (rank > next.seenRank) setRankUp(rank);
      next.updatedAt = Date.now();
      saveProgress(next);
      setProgress(next);
      schedulePush();
    },
    [toast, schedulePush],
  );

  const update = useCallback(
    (fn: (p: Progress) => void) => {
      const prev = ref.current;
      const next = structuredClone(prev);
      // серия дней считается, когда обучение началось: онбординг L3 пройден или идёт L2 Quest
      if (next.onboarding.done || next.track === 'l2') touchDay(next);
      fn(next);
      ref.current = next;
      commit(next, prev.xp);
    },
    [commit],
  );

  const replace = useCallback(
    (p: Progress) => {
      p.updatedAt = Date.now();
      saveProgress(p);
      ref.current = p;
      setProgress(p);
      schedulePush();
    },
    [schedulePush],
  );

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
    () => ({ progress, update, replace, reset, toasts, toast, dismissToast: (id) => setToasts((t) => t.filter((x) => x.id !== id)), rankUp, ackRankUp, sync }),
    [progress, update, replace, reset, toasts, toast, rankUp, ackRankUp, sync],
  );
  // пока читаем файл прогресса — не показываем сайт (иначе на новом браузере открылся бы онбординг)
  if (sync.kind === 'loading') return <div className="page narrow"><p className="muted">Загружаю прогресс…</p></div>;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}

export { ACHIEVEMENTS };
