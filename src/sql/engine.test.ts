import { describe, it, expect } from 'vitest';
import { gradeSql, openDb, runQuery, schemaOf } from './engine';

const ds = "CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT, v REAL); INSERT INTO t VALUES (1,'a',1.5),(2,'b',2.25),(3,'c',NULL);";

describe('sql engine', () => {
  it('runs queries and keeps columns of empty results', async () => {
    const db = await openDb(ds);
    const r = runQuery(db, 'SELECT * FROM t WHERE id > 100');
    expect(r.ok && r.columns).toEqual(['id', 'name', 'v']);
    expect(runQuery(db, 'SELEC x').ok).toBe(false);
    expect(schemaOf(db)[0]).toMatchObject({ name: 't', rows: 3 });
  });
  it('fresh copies are isolated', async () => {
    const a = await openDb(ds);
    runQuery(a, 'DELETE FROM t');
    const b = await openDb(ds);
    const r = runQuery(b, 'SELECT COUNT(*) FROM t');
    expect(r.ok && r.rows[0][0]).toBe(3);
  });
  it('grades by result, not by text', async () => {
    expect((await gradeSql(ds, 'SELECT name FROM t WHERE v IS NOT NULL', "SELECT name FROM t WHERE id IN (1,2)")).ok).toBe(true);
    expect((await gradeSql(ds, 'SELECT name AS n FROM t ORDER BY id DESC', 'SELECT name FROM t')).ok).toBe(true);
    expect((await gradeSql(ds, 'SELECT name FROM t ORDER BY id DESC', 'SELECT name FROM t ORDER BY id', true)).ok).toBe(false);
    const bad = await gradeSql(ds, 'SELECT name, v FROM t', 'SELECT name FROM t');
    expect(bad.ok).toBe(false);
    expect(bad.reason).toContain('столбцов');
    // порядок столбцов не важен
    expect((await gradeSql(ds, 'SELECT v, name FROM t', 'SELECT name, v FROM t')).ok).toBe(true);
    expect((await gradeSql(ds, 'SELECT v, id FROM t', 'SELECT name, v FROM t')).ok).toBe(false);
  });
});
