import type { ObsDataset } from './types';

/**
 * Мини-PromQL для тренажёра. Поддерживает:
 *  селекторы metric{a="x", b=~"re", c!="y"}[5m], числа, ( ),
 *  + - * / %, сравнения > < >= <= == != (фильтр; с bool — 0/1), on(...)/ignoring(...)
 *  sum|avg|min|max|count [by|without (l1, l2)] (expr), topk/bottomk(k, expr)
 *  rate, irate, increase, avg_over_time, max_over_time, min_over_time, sum_over_time (range)
 *  histogram_quantile(q, expr), abs, round, clamp_min, clamp_max, vector, scalar-литералы
 */
export type Labels = Record<string, string>;
export interface Sample {
  labels: Labels;
  value: number;
}
export interface MatrixSeries {
  labels: Labels;
  values: number[];
}
export interface QueryResult {
  ok: boolean;
  error?: string;
  series: MatrixSeries[];
  scalar?: boolean;
}

type Node =
  | { t: 'num'; v: number }
  | { t: 'sel'; name: string; matchers: { l: string; op: string; v: string }[]; range?: number }
  | { t: 'bin'; op: string; l: Node; r: Node; bool?: boolean; on?: string[]; ignoring?: string[] }
  | { t: 'agg'; op: string; by?: string[]; without?: string[]; param?: Node; e: Node }
  | { t: 'fn'; name: string; args: Node[] };

class PErr extends Error {}

const DUR: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
const AGG = ['sum', 'avg', 'min', 'max', 'count', 'topk', 'bottomk'];
const RANGE_FN = ['rate', 'irate', 'increase', 'avg_over_time', 'max_over_time', 'min_over_time', 'sum_over_time', 'count_over_time'];
const FNS = [...RANGE_FN, 'histogram_quantile', 'abs', 'round', 'clamp_min', 'clamp_max', 'vector', 'ceil', 'floor'];

function tokenize(s: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      const end = s.indexOf(c, i + 1);
      if (end < 0) throw new PErr('незакрытая кавычка');
      out.push(s.slice(i, end + 1));
      i = end + 1;
      continue;
    }
    const two = s.slice(i, i + 2);
    if (['=~', '!~', '!=', '>=', '<=', '=='].includes(two)) {
      out.push(two);
      i += 2;
      continue;
    }
    if ('(){}[],+-*/%<>='.includes(c)) {
      out.push(c);
      i++;
      continue;
    }
    const m = /^(\d+(?:\.\d+)?(?:[smhd])?|[A-Za-z_:][\w:]*)/.exec(s.slice(i));
    if (!m) throw new PErr(`неожиданный символ «${c}»`);
    // ключевые слова PromQL без учёта регистра: SUM … BY (…)
    const low = m[0].toLowerCase();
    out.push(AGG.includes(low) || FNS.includes(low) || low === 'by' || low === 'without' ? low : m[0]);
    i += m[0].length;
  }
  return out;
}

function parse(src: string): Node {
  const tk = tokenize(src);
  let p = 0;
  const peek = () => tk[p];
  const eat = (t?: string) => {
    const v = tk[p];
    if (t !== undefined && v !== t) throw new PErr(`ожидалось «${t}», а встретилось «${v ?? 'конец запроса'}»`);
    p++;
    return v;
  };
  const labelList = (): string[] => {
    eat('(');
    const ls: string[] = [];
    while (peek() !== ')') {
      ls.push(eat());
      if (peek() === ',') eat(',');
    }
    eat(')');
    return ls;
  };
  const binLevel = (ops: string[], next: () => Node) => (): Node => {
    let l = next();
    while (ops.includes(peek())) {
      const op = eat();
      let bool = false;
      let on: string[] | undefined;
      let ignoring: string[] | undefined;
      if (peek() === 'bool') {
        eat();
        bool = true;
      }
      if (peek() === 'on') {
        eat();
        on = labelList();
      } else if (peek() === 'ignoring') {
        eat();
        ignoring = labelList();
      }
      const r = next();
      l = { t: 'bin', op, l, r, bool, on, ignoring };
    }
    return l;
  };
  const primary = (): Node => {
    const t = peek();
    if (t === undefined) throw new PErr('запрос оборвался');
    if (t === '(') {
      eat('(');
      const e = expr();
      eat(')');
      return withRange(e);
    }
    if (t === '-') {
      eat();
      return { t: 'bin', op: '*', l: { t: 'num', v: -1 }, r: primary() };
    }
    if (/^\d/.test(t) && !/[smhd]$/.test(t)) {
      eat();
      return { t: 'num', v: parseFloat(t) };
    }
    if (AGG.includes(t)) {
      eat();
      let by: string[] | undefined;
      let without: string[] | undefined;
      if (peek() === 'by') {
        eat();
        by = labelList();
      } else if (peek() === 'without') {
        eat();
        without = labelList();
      }
      eat('(');
      let param: Node | undefined;
      if (t === 'topk' || t === 'bottomk') {
        param = expr();
        eat(',');
      }
      const e = expr();
      eat(')');
      if (peek() === 'by') {
        eat();
        by = labelList();
      } else if (peek() === 'without') {
        eat();
        without = labelList();
      }
      return { t: 'agg', op: t, by, without, param, e };
    }
    if (FNS.includes(t) && tk[p + 1] === '(') {
      eat();
      eat('(');
      const args: Node[] = [];
      while (peek() !== ')') {
        args.push(expr());
        if (peek() === ',') eat(',');
      }
      eat(')');
      return { t: 'fn', name: t, args };
    }
    if (/^[A-Za-z_]\w*$/.test(t) && tk[p + 1] === '(') throw new PErr(`функция «${t}» в тренажёре не поддерживается (есть: ${[...AGG, ...FNS].join(', ')})`);
    if (/^[A-Za-z_:]/.test(t) || t === '{') {
      let name = '';
      if (t !== '{') name = eat();
      const matchers: { l: string; op: string; v: string }[] = [];
      if (peek() === '{') {
        eat('{');
        while (peek() !== '}') {
          const l = eat();
          const op = eat();
          if (!['=', '!=', '=~', '!~'].includes(op)) throw new PErr(`неизвестный оператор метки «${op}»`);
          const v = eat();
          if (!/^["']/.test(v)) throw new PErr('значение метки должно быть в кавычках: {code="500"}');
          matchers.push({ l, op, v: v.slice(1, -1) });
          if (peek() === ',') eat(',');
        }
        eat('}');
      }
      return withRange({ t: 'sel', name, matchers });
    }
    throw new PErr(`неожиданный токен «${t}»`);
  };
  const withRange = (n: Node): Node => {
    if (peek() === '[') {
      eat('[');
      const d = eat();
      const m = /^(\d+)([smhd])$/.exec(d);
      if (!m) throw new PErr('диапазон пишется так: [5m], [1h]');
      eat(']');
      if (n.t !== 'sel') throw new PErr('диапазон [..] можно указать только у селектора метрики');
      return { ...n, range: parseInt(m[1], 10) * DUR[m[2]] };
    }
    return n;
  };
  const mul = binLevel(['*', '/', '%'], primary);
  const add = binLevel(['+', '-'], mul);
  const cmp = binLevel(['>', '<', '>=', '<=', '==', '!='], add);
  const expr = cmp;
  const e = expr();
  if (p < tk.length) throw new PErr(`лишнее в конце запроса: «${tk.slice(p).join(' ')}»`);
  return e;
}

const key = (l: Labels) =>
  Object.keys(l)
    .sort()
    .map((k) => `${k}=${l[k]}`)
    .join(',');

const dropName = (l: Labels) => {
  const { __name__: _n, ...rest } = l;
  return rest;
};

type Val = { kind: 'scalar'; v: number } | { kind: 'vector'; s: Sample[] };

export function evalQuery(query: string, ds: ObsDataset): QueryResult {
  let ast: Node;
  try {
    ast = parse(query.trim());
  } catch (e) {
    return { ok: false, error: e instanceof PErr ? e.message : String(e), series: [] };
  }
  const idx = new Map<string, number>();
  const out: MatrixSeries[] = [];
  let scalar = false;
  try {
    for (let i = 0; i < ds.points; i++) {
      const v = evalAt(ast, i, ds);
      if (v.kind === 'scalar') {
        scalar = true;
        if (!out.length) out.push({ labels: {}, values: new Array(ds.points).fill(NaN) });
        out[0].values[i] = v.v;
        continue;
      }
      for (const s of v.s) {
        const k = key(s.labels);
        let j = idx.get(k);
        if (j === undefined) {
          j = out.length;
          idx.set(k, j);
          out.push({ labels: s.labels, values: new Array(ds.points).fill(NaN) });
        }
        out[j].values[i] = s.value;
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof PErr ? e.message : String(e), series: [] };
  }
  return { ok: true, series: out, scalar };
}

function match(l: Labels, m: { l: string; op: string; v: string }): boolean {
  const val = l[m.l] ?? '';
  switch (m.op) {
    case '=':
      return val === m.v;
    case '!=':
      return val !== m.v;
    case '=~':
      return new RegExp(`^(?:${m.v})$`).test(val);
    default:
      return !new RegExp(`^(?:${m.v})$`).test(val);
  }
}

function select(n: Extract<Node, { t: 'sel' }>, ds: ObsDataset) {
  return ds.series.filter((s) => (!n.name || s.metric === n.name) && n.matchers.every((m) => match({ ...s.labels, __name__: s.metric }, m)));
}

function evalAt(n: Node, i: number, ds: ObsDataset): Val {
  switch (n.t) {
    case 'num':
      return { kind: 'scalar', v: n.v };
    case 'sel': {
      if (n.range) throw new PErr('range vector (с [..]) нельзя вывести напрямую — оберни в rate(), increase() или *_over_time()');
      const s = select(n, ds)
        .filter((x) => !Number.isNaN(x.values[i]))
        .map((x) => ({ labels: { __name__: x.metric, ...x.labels }, value: x.values[i] }));
      return { kind: 'vector', s };
    }
    case 'fn':
      return evalFn(n, i, ds);
    case 'agg':
      return evalAgg(n, i, ds);
    case 'bin':
      return evalBin(n, i, ds);
  }
}

function rangeArg(n: Node | undefined, fn: string): Extract<Node, { t: 'sel' }> & { range: number } {
  if (!n || n.t !== 'sel' || !n.range) throw new PErr(`${fn}() ожидает range vector, например ${fn}(metric[5m])`);
  return n as Extract<Node, { t: 'sel' }> & { range: number };
}

function evalFn(n: Extract<Node, { t: 'fn' }>, i: number, ds: ObsDataset): Val {
  if (RANGE_FN.includes(n.name)) {
    const sel = rangeArg(n.args[0], n.name);
    const w = Math.max(1, Math.round(sel.range / ds.step));
    const out: Sample[] = [];
    for (const s of select(sel, ds)) {
      const from = Math.max(0, i - w);
      const win = s.values.slice(from, i + 1).filter((x) => !Number.isNaN(x));
      if (!win.length) continue;
      let v: number;
      switch (n.name) {
        case 'rate':
        case 'increase': {
          if (win.length < 2) continue;
          let inc = 0;
          for (let k = 1; k < win.length; k++) inc += win[k] >= win[k - 1] ? win[k] - win[k - 1] : win[k];
          const span = (win.length - 1) * ds.step;
          v = n.name === 'rate' ? inc / span : (inc * sel.range) / span;
          break;
        }
        case 'irate':
          if (win.length < 2) continue;
          v = Math.max(0, win[win.length - 1] - win[win.length - 2]) / ds.step;
          break;
        case 'avg_over_time':
          v = win.reduce((a, b) => a + b, 0) / win.length;
          break;
        case 'max_over_time':
          v = Math.max(...win);
          break;
        case 'min_over_time':
          v = Math.min(...win);
          break;
        case 'count_over_time':
          v = win.length;
          break;
        default:
          v = win.reduce((a, b) => a + b, 0);
      }
      out.push({ labels: { ...s.labels }, value: v });
    }
    return { kind: 'vector', s: out };
  }
  if (n.name === 'histogram_quantile') {
    const q = evalAt(n.args[0], i, ds);
    if (q.kind !== 'scalar') throw new PErr('histogram_quantile(q, …): первый аргумент — число, например 0.95');
    const v = evalAt(n.args[1], i, ds);
    if (v.kind !== 'vector') throw new PErr('histogram_quantile: второй аргумент — вектор бакетов');
    const groups = new Map<string, { labels: Labels; b: { le: number; c: number }[] }>();
    for (const s of v.s) {
      if (s.labels.le === undefined) throw new PErr('histogram_quantile: в бакетах нет метки le — сохрани её в by (le)');
      const rest = dropName(s.labels);
      delete rest.le;
      const k = key(rest);
      if (!groups.has(k)) groups.set(k, { labels: rest, b: [] });
      groups.get(k)!.b.push({ le: s.labels.le === '+Inf' ? Infinity : parseFloat(s.labels.le), c: s.value });
    }
    const out: Sample[] = [];
    for (const g of groups.values()) {
      const b = g.b.sort((x, y) => x.le - y.le);
      const total = b[b.length - 1]?.c ?? 0;
      if (!total) continue;
      const rank = q.v * total;
      let prevLe = 0;
      let prevC = 0;
      let val = NaN;
      for (const x of b) {
        if (x.c >= rank) {
          val = x.le === Infinity ? prevLe : prevLe + ((x.le - prevLe) * (rank - prevC)) / Math.max(1e-12, x.c - prevC);
          break;
        }
        prevLe = x.le;
        prevC = x.c;
      }
      out.push({ labels: g.labels, value: val });
    }
    return { kind: 'vector', s: out };
  }
  const a = n.args.map((x) => evalAt(x, i, ds));
  const apply = (f: (x: number) => number): Val => {
    const v = a[0];
    if (!v) throw new PErr(`${n.name}() без аргумента`);
    return v.kind === 'scalar' ? { kind: 'scalar', v: f(v.v) } : { kind: 'vector', s: v.s.map((s) => ({ labels: dropName(s.labels), value: f(s.value) })) };
  };
  const num = (k: number) => {
    const x = a[k];
    if (!x || x.kind !== 'scalar') throw new PErr(`${n.name}(): аргумент ${k + 1} должен быть числом`);
    return x.v;
  };
  switch (n.name) {
    case 'abs':
      return apply(Math.abs);
    case 'ceil':
      return apply(Math.ceil);
    case 'floor':
      return apply(Math.floor);
    case 'round': {
      const to = a[1] ? num(1) : 1;
      return apply((x) => Math.round(x / to) * to);
    }
    case 'clamp_min':
      return apply((x) => Math.max(x, num(1)));
    case 'clamp_max':
      return apply((x) => Math.min(x, num(1)));
    case 'vector':
      return { kind: 'vector', s: [{ labels: {}, value: num(0) }] };
  }
  throw new PErr(`функция ${n.name} не поддерживается`);
}

function evalAgg(n: Extract<Node, { t: 'agg' }>, i: number, ds: ObsDataset): Val {
  const v = evalAt(n.e, i, ds);
  if (v.kind !== 'vector') throw new PErr(`${n.op}() ожидает вектор`);
  if (n.op === 'topk' || n.op === 'bottomk') {
    const k = n.param ? evalAt(n.param, i, ds) : { kind: 'scalar', v: 1 };
    if (k.kind !== 'scalar') throw new PErr('topk(k, …): k — число');
    const sorted = [...v.s].sort((a, b) => (n.op === 'topk' ? b.value - a.value : a.value - b.value));
    return { kind: 'vector', s: sorted.slice(0, k.v) };
  }
  const groups = new Map<string, { labels: Labels; vals: number[] }>();
  for (const s of v.s) {
    const base = dropName(s.labels);
    let gl: Labels = {};
    if (n.by) for (const l of n.by) {
      if (base[l] !== undefined) gl[l] = base[l];
    }
    else if (n.without) {
      gl = { ...base };
      for (const l of n.without) delete gl[l];
    }
    const k = key(gl);
    if (!groups.has(k)) groups.set(k, { labels: gl, vals: [] });
    groups.get(k)!.vals.push(s.value);
  }
  const f = (xs: number[]) => {
    switch (n.op) {
      case 'sum':
        return xs.reduce((a, b) => a + b, 0);
      case 'avg':
        return xs.reduce((a, b) => a + b, 0) / xs.length;
      case 'min':
        return Math.min(...xs);
      case 'max':
        return Math.max(...xs);
      default:
        return xs.length;
    }
  };
  return { kind: 'vector', s: [...groups.values()].map((g) => ({ labels: g.labels, value: f(g.vals) })) };
}

function op(o: string, a: number, b: number): number {
  switch (o) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      return a / b;
    case '%':
      return a % b;
    case '>':
      return a > b ? 1 : 0;
    case '<':
      return a < b ? 1 : 0;
    case '>=':
      return a >= b ? 1 : 0;
    case '<=':
      return a <= b ? 1 : 0;
    case '==':
      return a === b ? 1 : 0;
    default:
      return a !== b ? 1 : 0;
  }
}

function evalBin(n: Extract<Node, { t: 'bin' }>, i: number, ds: ObsDataset): Val {
  const l = evalAt(n.l, i, ds);
  const r = evalAt(n.r, i, ds);
  const isCmp = ['>', '<', '>=', '<=', '==', '!='].includes(n.op);
  if (l.kind === 'scalar' && r.kind === 'scalar') return { kind: 'scalar', v: op(n.op, l.v, r.v) };
  const vecScalar = (vec: Sample[], s: number, vecLeft: boolean): Val => {
    const out: Sample[] = [];
    for (const x of vec) {
      const res = vecLeft ? op(n.op, x.value, s) : op(n.op, s, x.value);
      if (isCmp && !n.bool) {
        if (res) out.push({ labels: x.labels, value: x.value });
      } else out.push({ labels: isCmp ? x.labels : dropName(x.labels), value: res });
    }
    return { kind: 'vector', s: out };
  };
  if (l.kind === 'vector' && r.kind === 'scalar') return vecScalar(l.s, r.v, true);
  if (l.kind === 'scalar' && r.kind === 'vector') return vecScalar(r.s, l.v, false);
  const L = l as Extract<Val, { kind: 'vector' }>;
  const R = r as Extract<Val, { kind: 'vector' }>;
  const sig = (lab: Labels) => {
    const b = dropName(lab);
    if (n.on) return key(Object.fromEntries(n.on.filter((k) => b[k] !== undefined).map((k) => [k, b[k]])));
    if (n.ignoring) {
      for (const k of n.ignoring) delete b[k];
    }
    return key(b);
  };
  const rmap = new Map<string, Sample>();
  for (const x of R.s) rmap.set(sig(x.labels), x);
  const out: Sample[] = [];
  for (const x of L.s) {
    const y = rmap.get(sig(x.labels));
    if (!y) continue;
    const res = op(n.op, x.value, y.value);
    if (isCmp && !n.bool) {
      if (res) out.push({ labels: x.labels, value: x.value });
    } else out.push({ labels: dropName(x.labels), value: res });
  }
  return { kind: 'vector', s: out };
}

/** Сравнить результат ученика с эталоном: метки (без __name__) и значения по всем точкам */
export function sameResult(a: QueryResult, b: QueryResult): { ok: boolean; reason?: string } {
  if (!a.ok) return { ok: false, reason: a.error };
  if (!b.ok) return { ok: false, reason: 'эталон с ошибкой: ' + b.error };
  if (a.series.length !== b.series.length) return { ok: false, reason: `Ожидалось рядов: ${b.series.length}, у тебя: ${a.series.length}.` };
  // метка, которой нет на другой стороне и которая одинакова во всех рядах, ничего не меняет:
  // rate(x{service="checkout"}[5m]) и sum(rate(x{service="checkout"}[5m])) — один и тот же ряд
  const keysOf = (r: QueryResult) => new Set(r.series.flatMap((x) => Object.keys(dropName(x.labels))));
  const constant = (r: QueryResult, k: string) => new Set(r.series.map((x) => x.labels[k])).size === 1;
  const aKeys = keysOf(a);
  const bKeys = keysOf(b);
  const norm = (r: QueryResult, other: Set<string>) => (l: Labels) => Object.fromEntries(Object.entries(dropName(l)).filter(([k]) => other.has(k) || !constant(r, k))) as Labels;
  const na = norm(a, bKeys);
  const nb = norm(b, aKeys);
  const map = new Map(b.series.map((s) => [key(nb(s.labels)), s]));
  for (const s of a.series) {
    const t = map.get(key(na(s.labels)));
    if (!t) return { ok: false, reason: `Набор меток не совпадает: {${key(na(s.labels))}}` };
    for (let i = 0; i < s.values.length; i++) {
      const x = s.values[i];
      const y = t.values[i];
      if (Number.isNaN(x) !== Number.isNaN(y)) return { ok: false, reason: 'Значения не совпадают.' };
      if (!Number.isNaN(x) && Math.abs(x - y) > Math.max(1e-6, Math.abs(y) * 1e-6)) return { ok: false, reason: 'Значения не совпадают.' };
    }
  }
  return { ok: true };
}

export const labelsText = (l: Labels) => {
  const { __name__: name, ...rest } = l;
  const body = Object.entries(rest)
    .map(([k, v]) => `${k}="${v}"`)
    .join(', ');
  return `${name ?? ''}{${body}}`;
};
