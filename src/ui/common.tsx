import { useEffect, useRef, type ReactNode } from 'react';

export function ProgressBar({ value, start, label, tone = 'cyan' }: { value: number; start?: number; label?: string; tone?: 'cyan' | 'magenta' | 'green' | 'amber' }) {
  return (
    <div className={`bar bar-${tone}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={label}>
      <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      {start !== undefined && start > 0 && <div className="bar-start" style={{ left: `${start}%` }} title={`Старт: ${start}%`} />}
    </div>
  );
}

export function Modal({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button, [href], input, textarea')?.focus();
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', on);
    return () => {
      window.removeEventListener('keydown', on);
      prev?.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={label} ref={ref} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

export function fmtMinutes(min: number) {
  if (min < 60) return `${Math.round(min)} мин`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

export function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

export const DEMAND_LABEL = { rising: '↗ спрос растёт', stable: '→ спрос стабилен', declining: '↘ спрос падает' } as const;
