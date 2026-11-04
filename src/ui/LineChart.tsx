import { useEffect, useRef, useState } from 'react';
import { hhmm } from '../obs/types';

export interface ChartSeries {
  name: string;
  values: number[];
}

export function fmtValue(v: number, unit?: string): string {
  if (Number.isNaN(v)) return '—';
  if (unit === 's') return v < 1 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(2)} s`;
  if (unit === 'ms') return `${Math.round(v)} ms`;
  if (unit === '%') return `${(v * (Math.abs(v) <= 1 ? 100 : 1)).toFixed(1)}%`;
  if (unit === 'bytes') return v >= 1024 ** 3 ? `${(v / 1024 ** 3).toFixed(2)} GiB` : `${Math.round(v / 1024 ** 2)} MiB`;
  const abs = Math.abs(v);
  const s = abs >= 100 ? v.toFixed(0) : abs >= 1 ? v.toFixed(2) : abs === 0 ? '0' : v.toPrecision(3);
  return unit === 'req/s' ? `${s} req/s` : s;
}

const MAX_SERIES = 6;

/** Линейный график временного ряда: 2px линии, одна ось, перекрестие с подсказкой, легенда, таблица */
export function LineChart({ series, start, step, unit, threshold, height = 200, title }: { series: ChartSeries[]; start: number; step: number; unit?: string; threshold?: number; height?: number; title?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(260, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const shown = series.slice(0, MAX_SERIES);
  const n = Math.max(0, ...shown.map((s) => s.values.length));
  const all = shown.flatMap((s) => s.values.filter((v) => Number.isFinite(v)));
  if (threshold !== undefined) all.push(threshold);
  const maxV = all.length ? Math.max(...all) : 1;
  const minV = Math.min(0, ...(all.length ? all : [0]));
  const pad = { l: 56, r: 12, t: 10, b: 24 };
  const iw = w - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const top = maxV === minV ? minV + 1 : maxV + (maxV - minV) * 0.08;
  const x = (i: number) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * iw);
  const y = (v: number) => pad.t + ih - ((v - minV) / (top - minV)) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => minV + (top - minV) * f);
  const xt = Math.max(1, Math.floor(n / Math.max(2, Math.floor(iw / 80))));

  const path = (vals: number[]) => {
    let d = '';
    let pen = false;
    vals.forEach((v, i) => {
      if (!Number.isFinite(v)) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * iw;
    setHover(Math.max(0, Math.min(n - 1, Math.round((px / iw) * (n - 1)))));
  };

  if (!series.length) return <p className="muted small">Нет данных для выбранного запроса.</p>;
  return (
    <figure className="chart" ref={wrap}>
      <div className="chart-head">
        {title && <figcaption>{title}</figcaption>}
        <button type="button" className="btn ghost small" onClick={() => setTable((t) => !t)} aria-pressed={table}>
          {table ? 'График' : 'Таблица'}
        </button>
      </div>
      {table ? (
        <div className="table-scroll">
          <table className="table sql-table">
            <thead>
              <tr><th>Ряд</th><th>Последнее</th><th>Макс</th><th>Мин</th></tr>
            </thead>
            <tbody>
              {series.map((s) => {
                const f = s.values.filter(Number.isFinite);
                return (
                  <tr key={s.name}>
                    <td>{s.name}</td>
                    <td className="num">{fmtValue(s.values[s.values.length - 1], unit)}</td>
                    <td className="num">{f.length ? fmtValue(Math.max(...f), unit) : '—'}</td>
                    <td className="num">{f.length ? fmtValue(Math.min(...f), unit) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart-plot">
          <svg width={w} height={height} role="img" aria-label={`${title ?? 'График'}: ${shown.length} рядов`}>
            {ticks.map((t, i) => (
              <g key={i}>
                <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} className="grid" />
                <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="axis">{fmtValue(t, unit)}</text>
              </g>
            ))}
            {Array.from({ length: n }, (_, i) => i)
              .filter((i) => i % xt === 0)
              .map((i) => (
                <text key={i} x={x(i)} y={height - 6} textAnchor="middle" className="axis">{hhmm(start + i * step)}</text>
              ))}
            {threshold !== undefined && <line x1={pad.l} x2={w - pad.r} y1={y(threshold)} y2={y(threshold)} className="threshold" />}
            {shown.map((s, k) => (
              <path key={s.name} d={path(s.values)} className={`line s${k + 1}`} />
            ))}
            {hover !== null && (
              <>
                <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className="crosshair" />
                {shown.map((s, k) =>
                  Number.isFinite(s.values[hover]) ? <circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r={4} className={`dot s${k + 1}`} /> : null,
                )}
              </>
            )}
            <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
          </svg>
          {hover !== null && (
            <div className="chart-tip" style={{ left: Math.min(x(hover) + 10, w - 200) }} role="status">
              <strong>{hhmm(start + hover * step)}</strong>
              {shown
                .map((s, k) => ({ s, k, v: s.values[hover] }))
                .sort((a, b) => (b.v || 0) - (a.v || 0))
                .map(({ s, k, v }) => (
                  <div key={s.name} className="tip-row">
                    <span className={`sw s${k + 1}`} />
                    <span className="tip-name">{s.name}</span>
                    <span className="tip-val">{fmtValue(v, unit)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
      {shown.length > 1 && (
        <div className="legend">
          {shown.map((s, k) => (
            <span key={s.name} className="legend-item"><span className={`sw s${k + 1}`} /> {s.name}</span>
          ))}
        </div>
      )}
      {series.length > MAX_SERIES && <p className="muted small">Показаны {MAX_SERIES} рядов из {series.length} — сузь запрос (by, topk).</p>}
    </figure>
  );
}
