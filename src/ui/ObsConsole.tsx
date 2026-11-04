import { useMemo, useRef, useState } from 'react';
import type { ObsDataset, Trace } from '../obs/types';
import { hhmm } from '../obs/types';
import { evalQuery, labelsText, type QueryResult } from '../obs/promql';
import { searchLogs } from '../obs/kql';
import { LineChart, fmtValue } from './LineChart';

export type ObsKind = 'promql' | 'logs' | 'traces';
type Tab = 'dash' | ObsKind;

interface Props {
  ds: ObsDataset;
  onQuery?: (kind: ObsKind, query: string, summary: string) => void;
  initialTab?: Tab;
}

export function resultSummary(r: QueryResult, ds: ObsDataset): string {
  if (!r.ok) return 'ERROR: ' + r.error;
  return r.series
    .slice(0, 8)
    .map((s) => {
      const f = s.values.filter(Number.isFinite);
      return `${labelsText(s.labels)} last=${fmtValue(s.values[ds.points - 1])} max=${f.length ? fmtValue(Math.max(...f)) : '—'}`;
    })
    .join('\n');
}

export function ObsConsole({ ds, onQuery, initialTab }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab ?? (ds.dashboard ? 'dash' : 'promql'));
  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'dash', label: 'Дашборд', show: !!ds.dashboard },
    { id: 'promql', label: 'Метрики (PromQL)', show: ds.series.length > 0 },
    { id: 'logs', label: 'Логи (KQL)', show: !!ds.logs?.length },
    { id: 'traces', label: 'Трейсы', show: !!ds.traces?.length },
  ];
  return (
    <div className="obs">
      <div className="obs-tabs" role="tablist">
        {tabs.filter((t) => t.show).map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
        <span className="muted small obs-range">{hhmm(ds.start)}–{hhmm(ds.start + (ds.points - 1) * ds.step)} · шаг {ds.step / 60} мин</span>
      </div>
      {tab === 'dash' && ds.dashboard && <Dashboard ds={ds} />}
      {tab === 'promql' && <Metrics ds={ds} onQuery={onQuery} />}
      {tab === 'logs' && <Logs ds={ds} onQuery={onQuery} />}
      {tab === 'traces' && <Traces ds={ds} onQuery={onQuery} />}
    </div>
  );
}

function Dashboard({ ds }: { ds: ObsDataset }) {
  const d = ds.dashboard!;
  return (
    <div className="dash">
      <h3>{d.title}</h3>
      <div className="dash-grid">
        {d.panels.map((p) => {
          const r = evalQuery(p.query, ds);
          return (
            <div key={p.title} className="dash-panel">
              <LineChart title={p.title} series={r.series.map((s) => ({ name: labelsText(s.labels).replace(/^\{\}$/, p.title), values: s.values }))} start={ds.start} step={ds.step} unit={p.unit} threshold={p.threshold} height={170} />
              <details className="small"><summary>Запрос</summary><code className="mono">{p.query}</code></details>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Metrics({ ds, onQuery }: { ds: ObsDataset; onQuery?: Props['onQuery'] }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<{ q: string; r: QueryResult } | null>(null);
  const metrics = useMemo(() => [...new Set(ds.series.map((s) => s.metric))].sort(), [ds]);
  const run = () => {
    if (!q.trim()) return;
    const r = evalQuery(q, ds);
    setRes({ q, r });
    onQuery?.('promql', q, resultSummary(r, ds));
  };
  return (
    <div className="obs-pane">
      <form className="sql-editor" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <label className="sr-only" htmlFor="promql">PromQL-запрос</label>
        <textarea id="promql" className="mono" rows={3} value={q} spellCheck={false} placeholder='sum by (code) (rate(http_requests_total[5m]))   (Ctrl+Enter — выполнить)' onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); } }} />
        <div className="row gap wrap">
          <button className="btn primary small" disabled={!q.trim()}>▶ Выполнить</button>
          <details className="small metric-list"><summary>Метрики ({metrics.length})</summary>
            <div className="chips">{metrics.map((m) => <button type="button" key={m} className="chip btnlike mono" onClick={() => setQ((x) => x || m)}>{m}</button>)}</div>
          </details>
        </div>
      </form>
      {res && (res.r.ok ? (
        <>
          <LineChart series={res.r.series.map((s) => ({ name: labelsText(s.labels) || 'value', values: s.values }))} start={ds.start} step={ds.step} />
          <p className="muted small">Рядов: {res.r.series.length}. Последние значения — во вкладке «Таблица» на графике.</p>
        </>
      ) : <pre className="sql-error" role="alert">Ошибка: {res.r.error}</pre>)}
    </div>
  );
}

function Logs({ ds, onQuery }: { ds: ObsDataset; onQuery?: Props['onQuery'] }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<ReturnType<typeof searchLogs> | null>(null);
  const logs = useMemo(() => (ds.logs ?? []).map((l, i) => ({ ...l, id: i })), [ds]);
  const fields = useMemo(() => [...new Set(logs.flatMap((l) => Object.keys(l)))].filter((f) => f !== 'id' && f !== 'ts'), [logs]);
  const run = () => {
    const r = searchLogs(logs, q);
    setRes(r);
    onQuery?.('logs', q, r.ok ? `${r.hits.length} записей\n` + r.hits.slice(0, 8).map((h) => `${hhmm(h.ts)} ${h.service} ${h.level} ${h.msg}`).join('\n') : 'ERROR: ' + r.error);
  };
  const hist = useMemo(() => {
    if (!res?.ok) return null;
    const buckets = new Array(ds.points).fill(0);
    for (const h of res.hits) {
      const i = Math.floor((h.ts - ds.start) / ds.step);
      if (i >= 0 && i < ds.points) buckets[i]++;
    }
    return buckets;
  }, [res, ds]);
  return (
    <div className="obs-pane">
      <form className="row gap" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <label className="sr-only" htmlFor="kql">Запрос KQL</label>
        <input id="kql" className="mono search" value={q} spellCheck={false} placeholder='service:checkout AND level:error AND "timeout"' onChange={(e) => setQ(e.target.value)} />
        <button className="btn primary small">Найти</button>
      </form>
      <p className="muted small">Поля: {fields.map((f) => <code key={f}>{f}</code>).reduce<React.ReactNode[]>((a, b, i) => (i ? [...a, ' ', b] : [b]), [])}</p>
      {res && !res.ok && <pre className="sql-error">Ошибка: {res.error}</pre>}
      {res?.ok && hist && (
        <>
          <LineChart title={`Найдено: ${res.hits.length}`} series={[{ name: 'записей в минуту', values: hist }]} start={ds.start} step={ds.step} height={120} />
          <div className="table-scroll">
            <table className="table sql-table logs-table">
              <thead><tr><th>Время</th><th>service</th><th>level</th><th>msg</th><th>trace_id</th></tr></thead>
              <tbody>
                {res.hits.slice(0, 200).map((h) => (
                  <tr key={h.id} className={`lvl-${h.level}`}>
                    <td>{hhmm(h.ts)}:{String(Math.floor(h.ts % 60)).padStart(2, '0')}</td><td>{h.service}</td><td>{h.level}</td><td>{h.msg}</td><td>{h.trace_id ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Traces({ ds, onQuery }: { ds: ObsDataset; onQuery?: Props['onQuery'] }) {
  const [q, setQ] = useState('');
  const [minMs, setMinMs] = useState('');
  const [sel, setSel] = useState<Trace | null>(null);
  const reported = useRef('');
  const list = (ds.traces ?? []).filter((t) => {
    const dur = Math.max(...t.spans.map((s) => s.startMs + s.durMs));
    if (minMs && dur < parseFloat(minMs)) return false;
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return t.traceId.toLowerCase().includes(s) || t.root.toLowerCase().includes(s) || t.spans.some((x) => x.service.toLowerCase().includes(s));
  });
  const open = (t: Trace) => {
    setSel(t);
    const sum = t.spans.map((s) => `${s.service} ${s.op} ${s.durMs}ms${s.error ? ' ERROR ' + s.error : ''}`).join('\n');
    if (reported.current !== t.traceId) {
      reported.current = t.traceId;
      onQuery?.('traces', `open ${t.traceId}`, sum);
    }
  };
  return (
    <div className="obs-pane">
      <div className="row gap wrap">
        <input className="mono search" value={q} placeholder="trace id, сервис или операция" onChange={(e) => setQ(e.target.value)} aria-label="Поиск трейсов" />
        <input className="mono" style={{ width: 150 }} value={minMs} placeholder="длительность ≥ мс" onChange={(e) => setMinMs(e.target.value.replace(/\D/g, ''))} aria-label="Минимальная длительность, мс" />
      </div>
      <div className="table-scroll">
        <table className="table sql-table">
          <thead><tr><th>Время</th><th>Trace ID</th><th>Корень</th><th>Спанов</th><th>Длительность</th><th>Ошибки</th></tr></thead>
          <tbody>
            {list.slice(0, 100).map((t) => {
              const dur = Math.max(...t.spans.map((s) => s.startMs + s.durMs));
              return (
                <tr key={t.traceId} className={sel?.traceId === t.traceId ? 'sel' : ''}>
                  <td>{hhmm(t.ts)}</td>
                  <td><button className="linklike mono" onClick={() => open(t)}>{t.traceId}</button></td>
                  <td>{t.root}</td>
                  <td className="num">{t.spans.length}</td>
                  <td className="num">{dur} ms</td>
                  <td>{t.spans.some((s) => s.error) ? '⚠' : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sel && <Waterfall t={sel} />}
    </div>
  );
}

function Waterfall({ t }: { t: Trace }) {
  const total = Math.max(...t.spans.map((s) => s.startMs + s.durMs));
  const depth = (s: Trace['spans'][number]): number => {
    const p = t.spans.find((x) => x.id === s.parent);
    return p ? depth(p) + 1 : 0;
  };
  return (
    <div className="waterfall" aria-label={`Трейс ${t.traceId}`}>
      <h4 className="mono">{t.traceId} · {total} ms</h4>
      {t.spans.map((s) => (
        <div key={s.id} className="wf-row">
          <div className="wf-name" style={{ paddingLeft: depth(s) * 14 }}>
            <strong>{s.service}</strong> <span className="muted">{s.op}</span>
          </div>
          <div className="wf-track">
            <div className={`wf-bar ${s.error ? 'err' : ''}`} style={{ left: `${(s.startMs / total) * 100}%`, width: `${Math.max(0.8, (s.durMs / total) * 100)}%` }} title={`${s.durMs} ms${s.error ? ' — ' + s.error : ''}`} />
          </div>
          <div className="wf-dur">{s.durMs} ms{s.error ? ' ⚠' : ''}</div>
        </div>
      ))}
      {t.spans.filter((s) => s.error).map((s) => <p key={s.id} className="sql-error small">{s.service}: {s.error}</p>)}
    </div>
  );
}
