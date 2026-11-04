import { useEffect, useRef, useState } from 'react';
import type { Database } from 'sql.js';
import { openDb, runQuery, schemaOf, type QueryResult, type TableInfo } from '../sql/engine';

export function ResultTable({ r, max = 200 }: { r: QueryResult; max?: number }) {
  if (!r.ok) return <pre className="sql-error" role="alert">Ошибка: {r.error}</pre>;
  if (!r.columns.length) return <p className="muted small">Выполнено. Изменено строк: {r.changes}.</p>;
  return (
    <div className="sql-result">
      <div className="table-scroll">
        <table className="table sql-table">
          <thead>
            <tr>{r.columns.map((c, i) => <th key={i}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {r.rows.slice(0, max).map((row, i) => (
              <tr key={i}>{row.map((v, j) => <td key={j} className={v === null ? 'null' : typeof v === 'number' ? 'num' : ''}>{v === null ? 'NULL' : String(v)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        {r.rows.length} {r.rows.length === 1 ? 'строка' : r.rows.length % 10 >= 2 && r.rows.length % 10 <= 4 && (r.rows.length % 100 < 10 || r.rows.length % 100 >= 20) ? 'строки' : 'строк'}
        {r.rows.length > max ? ` (показаны первые ${max})` : ''} · {r.ms} мс
      </p>
    </div>
  );
}

interface Props {
  dataset: string;
  onRun?: (query: string, result: QueryResult) => void;
  /** меняется — консоль пересоздаёт БД («Сбросить окружение») */
  resetKey?: unknown;
  placeholder?: string;
}

/** SQL-консоль: схема слева, редактор, результат. Ctrl+Enter — выполнить. */
export function SqlConsole({ dataset, onRun, resetKey, placeholder }: Props) {
  const [db, setDb] = useState<Database | null>(null);
  const [schema, setSchema] = useState<TableInfo[]>([]);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const [loadErr, setLoadErr] = useState('');
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;

  useEffect(() => {
    let alive = true;
    let opened: Database | null = null;
    setDb(null);
    setResult(null);
    openDb(dataset)
      .then((d) => {
        opened = d;
        if (!alive) return d.close();
        setDb(d);
        setSchema(schemaOf(d));
      })
      .catch((e) => setLoadErr(String(e)));
    return () => {
      alive = false;
      opened?.close();
    };
  }, [dataset, resetKey]);

  const run = () => {
    if (!db || !query.trim()) return;
    const r = runQuery(db, query);
    setResult(r);
    setHistory((h) => [query, ...h.filter((x) => x !== query)].slice(0, 30));
    setHIdx(-1);
    if (r.ok && r.changes) setSchema(schemaOf(db));
    onRunRef.current?.(query, r);
  };

  return (
    <div className="sql-console">
      <form
        className="sql-editor"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <label htmlFor="sql-input" className="sr-only">SQL-запрос</label>
        <textarea
          id="sql-input"
          className="mono"
          value={query}
          spellCheck={false}
          rows={6}
          placeholder={placeholder ?? 'SELECT … FROM … WHERE …;   (Ctrl+Enter — выполнить, Ctrl+↑/↓ — история)'}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              run();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowUp' && history.length) {
              e.preventDefault();
              const i = Math.min(hIdx + 1, history.length - 1);
              setHIdx(i);
              setQuery(history[i]);
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowDown' && hIdx >= 0) {
              e.preventDefault();
              const i = hIdx - 1;
              setHIdx(i);
              setQuery(i >= 0 ? history[i] : '');
            }
          }}
        />
        <div className="row gap">
          <button className="btn primary small" disabled={!db || !query.trim()}>▶ Выполнить</button>
          <span className="muted small">Ctrl+Enter · диалект SQLite</span>
        </div>
      </form>
      {result && <ResultTable r={result} />}
      <details className="sql-schema">
        <summary>Схема БД{schema.length ? ` · ${schema.map((t) => t.name).join(', ')}` : ''}</summary>
        {loadErr && <p className="sql-error">Не удалось загрузить SQLite: {loadErr}</p>}
        {!db && !loadErr && <p className="muted small">Загружаю SQLite…</p>}
        <div className="schema-tables">
          {schema.map((t) => (
            <div key={t.name} className="schema-table">
              <button type="button" className="schema-name" onClick={() => setQuery((q) => (q.trim() ? q : `SELECT * FROM ${t.name} LIMIT 10;`))} title="Вставить SELECT * … LIMIT 10">
                {t.name} <span className="muted small">({t.rows})</span>
              </button>
              <div className="schema-cols small">{t.columns.map((c) => <span key={c.name} title={c.type + (c.pk ? ', PRIMARY KEY' : '')}>{c.pk ? <u>{c.name}</u> : c.name}</span>)}</div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
