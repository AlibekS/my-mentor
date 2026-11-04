import type { SystemState } from './types';

/** Процесс завершён: закрываем его файлы — «удалённые, но открытые» освобождают место */
export function releaseProcess(state: SystemState, pid: number) {
  state.openFiles = state.openFiles.filter((f) => f.pid !== pid);
  state.deletedOpen = state.deletedOpen.filter((f) => f.pid !== pid);
  state.listeners = state.listeners.filter((l) => l.pid !== pid);
}

/** Использовано байт на «/» сверх базового значения сценария */
export function rootDeltaBytes(state: SystemState, currentFsBytes: number): number {
  const held = state.deletedOpen.reduce((s, f) => s + (f.size ?? 0), 0);
  return currentFsBytes + held - state.fsBaseBytes;
}
