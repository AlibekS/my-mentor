import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from 'sql.js';

/**
 * SQL-песочница на SQLite (sql.js, WebAssembly) — работает прямо в браузере и в тестах (Node).
 */
let sqlPromise: Promise<SqlJsStatic> | null = null;

export function getSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    if (typeof window === 'undefined') sqlPromise = initSqlJs();
    else
      sqlPromise = import('sql.js/dist/sql-wasm.wasm?url').then((m: { default: string }) => initSqlJs({ locateFile: () => m.default }));
  }
  return sqlPromise;
}

const snapshots = new Map<string, Uint8Array>();

/** Новая независимая копия БД из датасета (CREATE + INSERT); датасет собирается один раз и кешируется */
export async function openDb(dataset: string): Promise<Database> {
  const SQL = await getSql();
  let snap = snapshots.get(dataset);
  if (!snap) {
    const db = new SQL.Database();
    db.exec(dataset);
    snap = db.export();
    db.close();
    snapshots.set(dataset, snap);
  }
  return new SQL.Database(snap);
}

export type QueryResult =
  | { ok: true; columns: string[]; rows: SqlValue[][]; changes: number; ms: number }
  | { ok: false; error: string };

export function runQuery(db: Database, sql: string): QueryResult {
  const t0 = performance.now();
  try {
    // iterateStatements, а не exec: у пустого результата тоже нужны имена столбцов
    let columns: string[] = [];
    let rows: SqlValue[][] = [];
    let changes = 0;
    for (const stmt of db.iterateStatements(sql)) {
      try {
        const cols = stmt.getColumnNames();
        const got: SqlValue[][] = [];
        while (stmt.step()) got.push(stmt.get());
        if (cols.length) {
          columns = cols;
          rows = got;
        } else changes += db.getRowsModified();
      } finally {
        stmt.free();
      }
    }
    return { ok: true, columns, rows, changes, ms: Math.round(performance.now() - t0) };
  } catch (e) {
    return { ok: false, error: String((e as Error).message ?? e) };
  }
}

const norm = (v: SqlValue): string => {
  if (v === null) return 'NULL';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
  if (v instanceof Uint8Array) return '[blob]';
  const s = String(v).trim();
  // числа, пришедшие строками: '10' и 10 считаем одинаковыми
  return /^-?\d+(\.\d+)?$/.test(s) ? norm(Number(s)) : s;
};

export interface Comparison {
  ok: boolean;
  reason?: string;
}

/** Сравнить результат ученика с эталоном: значения важны, имена столбцов — нет */
export function compareResults(student: QueryResult, expected: QueryResult, ordered = false): Comparison {
  if (!student.ok) return { ok: false, reason: `Ошибка SQL: ${student.error}` };
  if (!expected.ok) return { ok: false, reason: `Эталонный запрос с ошибкой: ${expected.error}` };
  if (!student.columns.length) return { ok: false, reason: 'Запрос ничего не вернул — нужен SELECT.' };
  if (student.columns.length !== expected.columns.length)
    return { ok: false, reason: `Ожидалось столбцов: ${expected.columns.length}, у тебя: ${student.columns.length}.` };
  if (student.rows.length !== expected.rows.length) return { ok: false, reason: `Ожидалось строк: ${expected.rows.length}, у тебя: ${student.rows.length}.` };
  const b = expected.rows.map((r) => r.map(norm).join('\u0001'));
  if (!ordered) b.sort();
  const same = (perm: number[]) => {
    const a = student.rows.map((r) => perm.map((k) => norm(r[k])).join('\u0001'));
    if (!ordered) a.sort();
    return a.every((x, i) => x === b[i]);
  };
  const n = student.columns.length;
  const identity = [...Array(n).keys()];
  if (same(identity)) return { ok: true };
  // порядок столбцов не важен: SELECT country, email = SELECT email, country
  const key = (c: string) => c.toLowerCase().replace(/^.*\./, '');
  const byName = expected.columns.map((c) => student.columns.findIndex((x) => key(x) === key(c)));
  if (byName.every((k) => k >= 0) && new Set(byName).size === n && same(byName)) return { ok: true };
  if (n <= 5) for (const perm of permutations(identity)) if (same(perm)) return { ok: true };
  return { ok: false, reason: ordered ? 'Данные или порядок строк не совпадают.' : 'Данные не совпадают.' };
}

function permutations(xs: number[]): number[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}

/** Проверка: оба запроса выполняются на свежих копиях БД */
export async function gradeSql(dataset: string, studentSql: string, solutionSql: string, ordered = false): Promise<Comparison & { result: QueryResult }> {
  const [db1, db2] = await Promise.all([openDb(dataset), openDb(dataset)]);
  try {
    const result = runQuery(db1, studentSql);
    const expected = runQuery(db2, solutionSql);
    // EXPLAIN QUERY PLAN: номера узлов плана зависят от формы запроса — сравниваем только detail (SCAN/SEARCH …)
    const isPlan = (r: QueryResult) => r.ok && r.columns.join(',') === 'id,parent,notused,detail';
    if (isPlan(result) && isPlan(expected) && result.ok && expected.ok) {
      const det = (r: typeof result & { ok: true }) => ({ ...r, columns: ['detail'], rows: r.rows.map((x) => [String(x[3]).replace(/ USING (COVERING )?INDEX .*$/, (m) => m)]) });
      return { ...compareResults(det(result), det(expected), false), result };
    }
    return { ...compareResults(result, expected, ordered), result };
  } finally {
    db1.close();
    db2.close();
  }
}

export interface TableInfo {
  name: string;
  rows: number;
  columns: { name: string; type: string; pk: boolean }[];
}

export function schemaOf(db: Database): TableInfo[] {
  const t = runQuery(db, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  if (!t.ok) return [];
  return t.rows.map(([name]) => {
    const cols = runQuery(db, `PRAGMA table_info(${String(name)})`);
    const cnt = runQuery(db, `SELECT COUNT(*) FROM ${String(name)}`);
    return {
      name: String(name),
      rows: cnt.ok ? Number(cnt.rows[0][0]) : 0,
      columns: cols.ok ? cols.rows.map((r) => ({ name: String(r[1]), type: String(r[2]), pk: Number(r[5]) > 0 })) : [],
    };
  });
}

/** Текстовое представление результата (для ментора и истории) */
export function resultText(r: QueryResult, maxRows = 10): string {
  if (!r.ok) return 'ERROR: ' + r.error;
  if (!r.columns.length) return `OK, изменено строк: ${r.changes}`;
  const lines = [r.columns.join(' | '), ...r.rows.slice(0, maxRows).map((row) => row.map((v) => (v === null ? 'NULL' : String(v))).join(' | '))];
  if (r.rows.length > maxRows) lines.push(`… всего строк: ${r.rows.length}`);
  return lines.join('\n');
}
