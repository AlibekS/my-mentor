import { useMemo, useState } from 'react';
import type { DevtoolsDataset, NetRequest } from '../devtools/types';

const REASONS: Record<number, string> = { 200: 'OK', 201: 'Created', 204: 'No Content', 301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed', 409: 'Conflict', 413: 'Payload Too Large', 422: 'Unprocessable Entity', 429: 'Too Many Requests', 500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout' };

const nameOf = (r: NetRequest) => r.name ?? (r.url.replace(/[?#].*$/, '').split('/').filter(Boolean).pop() || r.url);
const sizeText = (b?: number) => (b === undefined ? '—' : b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} kB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const timeText = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`);

function pretty(body?: string): string {
  if (!body) return '';
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

/** curl-команда для запроса — как «Copy as cURL» в настоящем DevTools */
export function asCurl(r: NetRequest): string {
  const parts = [`curl '${r.url}'`];
  if (r.method !== 'GET') parts.push(`-X ${r.method}`);
  for (const [k, v] of Object.entries(r.requestHeaders ?? {})) parts.push(`-H '${k}: ${v}'`);
  if (r.payload) parts.push(`--data-raw '${r.payload}'`);
  return parts.join(' \\\n  ');
}

type Tab = 'network' | 'console' | 'application';
type Detail = 'headers' | 'payload' | 'response' | 'timing' | 'curl';

/**
 * Тренажёр DevTools: вкладки Network (таблица запросов, фильтр, детали запроса), Console и Application
 * (cookies, localStorage). Ученик исследует «что видит браузер клиента» и отвечает в поле задания.
 */
export function DevtoolsConsole({ ds, onAction }: { ds: DevtoolsDataset; onAction?: (what: string) => void }) {
  const [tab, setTab] = useState<Tab>('network');
  const [filter, setFilter] = useState('');
  const [kind, setKind] = useState<'all' | 'fetch' | 'doc' | 'js' | 'errors'>('all');
  const [sel, setSel] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail>('headers');
  const [levels, setLevels] = useState<'all' | 'errors'>('all');

  const rows = useMemo(
    () =>
      ds.requests
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => {
          if (filter && !(r.url + ' ' + r.method + ' ' + r.status).toLowerCase().includes(filter.toLowerCase())) return false;
          if (kind === 'fetch') return r.type === 'fetch' || r.type === 'xhr';
          if (kind === 'doc') return r.type === 'document';
          if (kind === 'js') return r.type === 'script';
          if (kind === 'errors') return r.status >= 400 || r.status === 0;
          return true;
        }),
    [ds.requests, filter, kind],
  );
  const cur = sel !== null ? ds.requests[sel] : null;
  const totalMs = Math.max(1, ...ds.requests.map((r) => (r.startMs ?? 0) + r.timeMs));
  const errors = (ds.console ?? []).filter((m) => m.level === 'error').length;
  const warns = (ds.console ?? []).filter((m) => m.level === 'warn').length;

  const pick = (i: number) => {
    setSel(i === sel ? null : i);
    onAction?.(`открыл запрос ${ds.requests[i].method} ${ds.requests[i].url} → ${ds.requests[i].status || ds.requests[i].error}`);
  };

  return (
    <div className="devtools">
      <div className="dt-page">
        <span className="dt-url" title="Адрес страницы у клиента">🔒 {ds.page}</span>
        {ds.screen && <p className="dt-screen">{ds.screen}</p>}
      </div>
      <div className="obs-tabs" role="tablist" aria-label="Вкладки DevTools">
        <button role="tab" aria-selected={tab === 'network'} className={tab === 'network' ? 'active' : ''} onClick={() => setTab('network')}>Network</button>
        <button role="tab" aria-selected={tab === 'console'} className={tab === 'console' ? 'active' : ''} onClick={() => { setTab('console'); onAction?.('открыл Console'); }}>
          Console {errors > 0 && <span className="dt-badge err">{errors}</span>} {warns > 0 && <span className="dt-badge warn">{warns}</span>}
        </button>
        {(ds.cookies?.length || ds.storage) && (
          <button role="tab" aria-selected={tab === 'application'} className={tab === 'application' ? 'active' : ''} onClick={() => { setTab('application'); onAction?.('открыл Application'); }}>Application</button>
        )}
      </div>

      {tab === 'network' && (
        <div className="dt-network">
          <div className="dt-toolbar">
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Фильтр: часть URL, метод или статус" aria-label="Фильтр запросов" />
            <div className="seg small" role="group" aria-label="Тип запросов">
              {([['all', 'Все'], ['fetch', 'Fetch/XHR'], ['doc', 'Doc'], ['js', 'JS'], ['errors', 'Ошибки']] as const).map(([k, l]) => (
                <button key={k} className={`seg-item ${kind === k ? 'sel' : ''}`} onClick={() => setKind(k)} aria-pressed={kind === k}>{l}</button>
              ))}
            </div>
          </div>
          <div className="table-wrap dt-table-wrap">
            <table className="table dt-table">
              <thead>
                <tr><th>Name</th><th>Status</th><th>Method</th><th>Type</th><th>Size</th><th>Time</th><th className="dt-wf">Waterfall</th></tr>
              </thead>
              <tbody>
                {rows.map(({ r, i }) => {
                  const bad = r.status >= 400 || r.status === 0;
                  return (
                    <tr key={i} className={`${bad ? 'dt-bad' : ''} ${sel === i ? 'dt-sel' : ''}`} onClick={() => pick(i)} tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pick(i))} aria-selected={sel === i}>
                      <td className="mono" title={r.url}>{nameOf(r)}</td>
                      <td className="mono">{r.status === 0 ? '(failed)' : r.status}</td>
                      <td className="mono">{r.method}</td>
                      <td>{r.type}</td>
                      <td className="mono">{r.fromCache ? '(disk cache)' : sizeText(r.size)}</td>
                      <td className="mono">{r.status === 0 && !r.timeMs ? '—' : timeText(r.timeMs)}</td>
                      <td className="dt-wf"><span className="dt-bar" style={{ marginLeft: `${((r.startMs ?? 0) / totalMs) * 100}%`, width: `${Math.max(2, (r.timeMs / totalMs) * 100)}%` }} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted small">{rows.length} из {ds.requests.length} запросов · кликни по строке, чтобы увидеть детали</p>
          {cur && (
            <div className="dt-detail">
              <div className="obs-tabs" role="tablist" aria-label="Детали запроса">
                {(['headers', 'payload', 'response', 'timing', 'curl'] as Detail[]).map((d) => (
                  <button key={d} role="tab" aria-selected={detail === d} className={detail === d ? 'active' : ''} onClick={() => setDetail(d)}>
                    {{ headers: 'Headers', payload: 'Payload', response: 'Response', timing: 'Timing', curl: 'Copy as cURL' }[d]}
                  </button>
                ))}
              </div>
              {detail === 'headers' && (
                <div className="dt-headers">
                  <h4>General</h4>
                  <dl>
                    <dt>Request URL</dt><dd className="mono">{cur.url}</dd>
                    <dt>Request Method</dt><dd className="mono">{cur.method}</dd>
                    <dt>Status Code</dt><dd className="mono">{cur.status === 0 ? `(failed) ${cur.error ?? ''}` : `${cur.status} ${cur.statusText ?? REASONS[cur.status] ?? ''}`}</dd>
                    {cur.remoteAddress && (<><dt>Remote Address</dt><dd className="mono">{cur.remoteAddress}</dd></>)}
                  </dl>
                  {cur.responseHeaders && (<><h4>Response Headers</h4><dl>{Object.entries(cur.responseHeaders).map(([k, v]) => (<div key={k}><dt>{k}</dt><dd className="mono">{v}</dd></div>))}</dl></>)}
                  {cur.requestHeaders && (<><h4>Request Headers</h4><dl>{Object.entries(cur.requestHeaders).map(([k, v]) => (<div key={k}><dt>{k}</dt><dd className="mono">{v}</dd></div>))}</dl></>)}
                </div>
              )}
              {detail === 'payload' && <pre className="dt-pre">{cur.payload ? pretty(cur.payload) : 'У запроса нет тела (payload).'}</pre>}
              {detail === 'response' && <pre className="dt-pre">{cur.status === 0 ? `Ответа нет: ${cur.error ?? 'запрос не дошёл до сервера'}` : pretty(cur.response) || '(пустой ответ)'}</pre>}
              {detail === 'timing' && (
                <dl className="dt-timing">
                  {Object.entries(cur.timing ?? { waiting: cur.timeMs }).map(([k, v]) => (
                    <div key={k}><dt>{{ dns: 'DNS Lookup', connect: 'Initial connection', ssl: 'SSL', waiting: 'Waiting for server response (TTFB)', download: 'Content Download' }[k] ?? k}</dt><dd className="mono">{timeText(v ?? 0)}</dd></div>
                  ))}
                  <div><dt><strong>Total</strong></dt><dd className="mono"><strong>{timeText(cur.timeMs)}</strong></dd></div>
                </dl>
              )}
              {detail === 'curl' && <pre className="dt-pre">{asCurl(cur)}</pre>}
            </div>
          )}
        </div>
      )}

      {tab === 'console' && (
        <div className="dt-console">
          <div className="seg small" role="group" aria-label="Уровни">
            <button className={`seg-item ${levels === 'all' ? 'sel' : ''}`} onClick={() => setLevels('all')} aria-pressed={levels === 'all'}>Все уровни</button>
            <button className={`seg-item ${levels === 'errors' ? 'sel' : ''}`} onClick={() => setLevels('errors')} aria-pressed={levels === 'errors'}>Только ошибки</button>
          </div>
          {(ds.console ?? []).filter((m) => levels === 'all' || m.level === 'error').map((m, i) => (
            <div key={i} className={`dt-msg dt-${m.level}`}>
              <span className="dt-msg-text mono">{m.level === 'error' ? '⛔ ' : m.level === 'warn' ? '⚠ ' : ''}{m.text}</span>
              {m.source && <span className="dt-src mono">{m.source}</span>}
              {m.stack && <pre className="dt-stack">{m.stack.map((s) => '    at ' + s).join('\n')}</pre>}
            </div>
          ))}
          {!ds.console?.length && <p className="muted small">Консоль пуста.</p>}
        </div>
      )}

      {tab === 'application' && (
        <div className="dt-app">
          {ds.cookies?.length ? (
            <>
              <h4>Cookies</h4>
              <div className="table-wrap">
                <table className="table dt-table">
                  <thead><tr><th>Name</th><th>Value</th><th>Domain</th><th>Expires</th><th>HttpOnly</th><th>Secure</th></tr></thead>
                  <tbody>{ds.cookies.map((c) => (<tr key={c.name}><td className="mono">{c.name}</td><td className="mono dt-val">{c.value}</td><td>{c.domain ?? ''}</td><td>{c.expires ?? 'Session'}</td><td>{c.httpOnly ? '✓' : ''}</td><td>{c.secure ? '✓' : ''}</td></tr>))}</tbody>
                </table>
              </div>
            </>
          ) : null}
          {ds.storage && (
            <>
              <h4>Local Storage</h4>
              <div className="table-wrap">
                <table className="table dt-table">
                  <thead><tr><th>Key</th><th>Value</th></tr></thead>
                  <tbody>{Object.entries(ds.storage).map(([k, v]) => (<tr key={k}><td className="mono">{k}</td><td className="mono dt-val">{v}</td></tr>))}</tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
