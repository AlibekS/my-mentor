import { useSyncExternalStore } from 'react';

/** Крошечное внешнее хранилище с подпиской */
export function create<T>(initial: T) {
  let state = initial;
  const subs = new Set<() => void>();
  return {
    get: () => state,
    set(next: T | ((s: T) => T)) {
      state = typeof next === 'function' ? (next as (s: T) => T)(state) : next;
      subs.forEach((s) => s());
    },
    use(): T {
      return useSyncExternalStore(
        (cb) => {
          subs.add(cb);
          return () => subs.delete(cb);
        },
        () => state,
      );
    },
  };
}
