import type { LogEntry } from './types';

/**
 * Упрощённый KQL (как в Kibana): service:checkout AND level:error AND "timeout"
 * — field:value, field:"фраза", field:знач* (шаблон), голые слова и "фразы" ищутся в msg,
 * AND / OR / NOT, скобки; пробел между условиями = AND. Без учёта регистра.
 */
type Pred = (e: LogEntry) => boolean;

/** Условие field:value (value — слово, шаблон*, "фраза") */
function fieldPred(field: string, raw: string): Pred {
  const phrase = raw.startsWith('"');
  const val = raw.replace(/^"|"$/g, '');
  const esc = (x: string) => x.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  const re = new RegExp(`^${esc(val)}$`, 'i');
  // в тексте сообщения шаблон ищется по словам: msg:Connection* найдёт «… Connection is not available»
  const reMsg = new RegExp(`(^|\\W)${esc(val)}`, 'i');
  return (x) => {
    const v = String(x[field] ?? '');
    if (phrase) return v.toLowerCase().includes(val.toLowerCase());
    if (re.test(v)) return true;
    return field === 'msg' && (val.includes('*') ? reMsg.test(v) : v.toLowerCase().includes(val.toLowerCase()));
  };
}

export function compileKql(q: string): Pred {
  // «service : x», «latency_ms > 500» — пробелы вокруг операторов допустимы
  const norm = q.replace(/("[^"]*")|\s*(:|>=|<=|>|<)\s*/g, (m, ph, op) => (ph ? ph : op));
  const toks = norm.match(/[\w.]+(?::|>=|<=|>|<)(?:"[^"]*"|\([^)]*\)|[^\s()]+)|"[^"]*"|\(|\)|[^\s()]+/g) ?? [];
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
    const m = /^([\w.]+)(:|>=|<=|>|<)(.+)$/s.exec(t);
    if (m) {
      const [, field, op, raw] = m;
      if (op !== ':') {
        const n = parseFloat(raw.replace(/^"|"$/g, ''));
        if (Number.isNaN(n)) throw new Error(`после «${field}${op}» ожидалось число`);
        return (x) => {
          const v = Number(x[field]);
          return op === '>' ? v > n : op === '<' ? v < n : op === '>=' ? v >= n : v <= n;
        };
      }
      // service:(payments OR checkout)
      if (raw.startsWith('(') && raw.endsWith(')')) {
        const inner = raw.slice(1, -1).match(/"[^"]*"|[^\s]+/g) ?? [];
        const alts: Pred[][] = [[]];
        for (const w of inner) {
          if (w.toUpperCase() === 'OR') alts.push([]);
          else if (w.toUpperCase() !== 'AND') alts[alts.length - 1].push(fieldPred(field, w));
        }
        return (x) => alts.some((g) => g.length > 0 && g.every((f) => f(x)));
      }
      return fieldPred(field, raw);
    }
    const word = t.replace(/^"|"$/g, '').toLowerCase();
    // голое слово ищется в сообщении, а id (trace_id, request_id …) — точным совпадением
    return (x) => x.msg.toLowerCase().includes(word) || Object.entries(x).some(([k, v]) => /(^|_)id$/.test(k) && String(v).toLowerCase() === word);
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
