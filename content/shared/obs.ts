import { rng } from './logs';
import type { LogEntry, ObsDataset, Series, Trace, Panel } from '../../src/obs/types';

/** Конструктор телеметрии для сценариев */
export function obsBuilder(opts: { start: number; points: number; step?: number; seed?: number }) {
  const step = opts.step ?? 60;
  const r = rng(opts.seed ?? 1);
  const series: Series[] = [];
  const api = {
    r,
    wave: (i: number, base: number, amp = 0.12) => base * (1 + amp * Math.sin(i / 8) + (r() - 0.5) * 0.06),
    counter(metric: string, labels: Record<string, string>, perSec: (i: number) => number) {
      let acc = Math.floor(r() * 500);
      const values: number[] = [];
      for (let i = 0; i < opts.points; i++) {
        if (i > 0) acc += Math.max(0, perSec(i)) * step;
        values.push(Math.round(acc));
      }
      series.push({ metric, labels, values });
      return api;
    },
    gauge(metric: string, labels: Record<string, string>, f: (i: number) => number) {
      series.push({ metric, labels, values: Array.from({ length: opts.points }, (_, i) => Math.round(f(i) * 1000) / 1000) });
      return api;
    },
    build(extra: { logs?: LogEntry[]; traces?: Trace[]; dashboard?: { title: string; panels: Panel[] } } = {}): ObsDataset {
      return { start: opts.start, step, points: opts.points, series, ...extra };
    },
  };
  return api;
}
