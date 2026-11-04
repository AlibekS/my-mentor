import type { LogEntry } from './types';

/**
 * Упрощённый KQL (как в Kibana): service:checkout AND level:error AND "timeout"
 * — field:value, field:"фраза", field:знач* (шаблон), голые слова и "фразы" ищутся в msg,
 * AND / OR / NOT, скобки; пробел между условиями = AND. Без учёта регистра.
 */
type Pred = (e: LogEntry) => boolean;

export function compileKql(q: string): Pred {
  const toks = q.match(/"[^"]*"|\(|\)|[^\s()]+/g) ?? [];
  let p = 0;
  const peek = () => toks[p]?.toUpperCase();
  const term = (): Pred => {
    const t = toks[p++];
    if (t === undefined) throw new Error('запрос оборвался');
    if (t === '(') {
      const e = orExpr();
      if (toks[p++] !== ')') throw new Error('ожидалась «)»');
      return e;
    }
    if (t.toUpperCase() === 'NOT') {
      const e = term();
      return (x) => !e(x);
    }
    const m = /^([\w.]+)(:|>=|<=|>|<)(.+)$/.exec(t);
    if (m) {
      const [, field, op, raw] = m;
      const val = raw.replace(/^"|"$/g, '');
      if (op !== ':') {
        const n = parseFloat(val);
        return (x) => {
          const v = Number(x[field]);
          return op === '>' ? v > n : op === '<' ? v < n : op === '>=' ? v >= n : v <= n;
        };
      }
      const re = new RegExp(`^${val.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`, 'i');
      const phrase = raw.startsWith('"');
      return (x) => {
        const v = String(x[field] ?? '');
        return phrase ? v.toLowerCase().includes(val.toLowerCase()) : re.test(v) || (field === 'msg' && v.toLowerCase().includes(val.toLowerCase()));
      };
    }
    const word = t.replace(/^"|"$/g, '').toLowerCase();
    return (x) => x.msg.toLowerCase().includes(word);
  };
  const andExpr = (): Pred => {
    let l = term();
    while (p < toks.length && peek() !== 'OR' && toks[p] !== ')') {
      if (peek() === 'AND') p++;
      const r = term();
      const a = l;
      l = (x) => a(x) && r(x);
    }
    return l;
  };
  const orExpr = (): Pred => {
    let l = andExpr();
    while (peek() === 'OR') {
      p++;
      const r = andExpr();
      const a = l;
      l = (x) => a(x) || r(x);
    }
    return l;
  };
  if (!toks.length) return () => true;
  const e = orExpr();
  if (p < toks.length) throw new Error(`лишнее: ${toks.slice(p).join(' ')}`);
  return e;
}

export function searchLogs(logs: LogEntry[], q: string): { ok: boolean; error?: string; hits: LogEntry[] } {
  try {
    const f = compileKql(q.trim());
    return { ok: true, hits: logs.filter(f) };
  } catch (e) {
    return { ok: false, error: (e as Error).message, hits: [] };
  }
}
