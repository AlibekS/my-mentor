import { describe, it, expect } from 'vitest';
import { evalQuery, sameResult } from './promql';
import { searchLogs } from './kql';
import type { ObsDataset } from './types';

// счётчики растут: 200 — +60/мин, 500 — +6/мин (5 в секунду=... ) ; шаг 60с, 10 точек
const counter = (perMin: number) => Array.from({ length: 10 }, (_, i) => i * perMin);
const ds: ObsDataset = {
  start: 13 * 3600,
  step: 60,
  points: 10,
  series: [
    { metric: 'http_requests_total', labels: { service: 'api', code: '200' }, values: counter(600) },
    { metric: 'http_requests_total', labels: { service: 'api', code: '500' }, values: counter(60) },
    { metric: 'http_requests_total', labels: { service: 'web', code: '200' }, values: counter(120) },
    ...['0.1', '0.5', '1', '+Inf'].map((le, k) => ({ metric: 'lat_bucket', labels: { service: 'api', le }, values: counter([50, 90, 99, 100][k] * 60) })),
    { metric: 'mem_bytes', labels: { pod: 'a' }, values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  ],
};
const last = (q: string) => evalQuery(q, ds).series.map((s) => [s.labels, Math.round(s.values[9] * 1000) / 1000]);

describe('promql', () => {
  it('selectors and rate', () => {
    expect(evalQuery('http_requests_total{code="500"}', ds).series).toHaveLength(1);
    expect(last('rate(http_requests_total{service="api",code="500"}[5m])')).toEqual([[{ service: 'api', code: '500' }, 1]]);
    expect(evalQuery('http_requests_total{code=~"5.."}', ds).series).toHaveLength(1);
  });
  it('aggregation and error ratio', () => {
    expect(last('sum by (service) (rate(http_requests_total[5m]))')).toEqual([[{ service: 'api' }, 11], [{ service: 'web' }, 2]]);
    expect(last('sum(rate(http_requests_total{code="500"}[5m])) / sum(rate(http_requests_total[5m]))')).toEqual([[{}, 0.077]]);
    expect(last('sum(rate(http_requests_total[5m])) by (code)')).toHaveLength(2);
  });
  it('histogram_quantile', () => {
    const v = last('histogram_quantile(0.95, sum by (le) (rate(lat_bucket[5m])))')[0][1] as number;
    expect(v).toBeGreaterThan(0.5);
    expect(v).toBeLessThan(1);
  });
  it('comparison filter, topk, over_time', () => {
    expect(last('sum by (service) (rate(http_requests_total[5m])) > 5')).toEqual([[{ service: 'api' }, 11]]);
    expect(last('topk(1, rate(http_requests_total[5m]))')[0][1]).toBe(10);
    expect(last('max_over_time(mem_bytes[3m])')).toEqual([[{ pod: 'a' }, 10]]);
  });
  it('errors and equivalence', () => {
    expect(evalQuery('rate(http_requests_total)', ds).ok).toBe(false);
    expect(evalQuery('sum(', ds).ok).toBe(false);
    expect(sameResult(evalQuery('sum(rate(http_requests_total[5m])) by (service)', ds), evalQuery('sum by (service) (rate(http_requests_total[5m]))', ds)).ok).toBe(true);
    expect(sameResult(evalQuery('sum(rate(http_requests_total[5m]))', ds), evalQuery('sum by (service) (rate(http_requests_total[5m]))', ds)).ok).toBe(false);
  });
});

describe('kql', () => {
  const logs = [
    { ts: 1, service: 'checkout', level: 'error', msg: 'db timeout after 30s', trace_id: 't1' },
    { ts: 2, service: 'checkout', level: 'info', msg: 'order created' },
    { ts: 3, service: 'payments', level: 'error', msg: 'provider timeout' },
    { ts: 4, service: 'payments', level: 'warn', msg: 'retrying', latency_ms: 900 },
  ];
  it('fields, phrases, boolean ops', () => {
    expect(searchLogs(logs, 'service:checkout AND level:error').hits).toHaveLength(1);
    expect(searchLogs(logs, 'level:error timeout').hits).toHaveLength(2);
    expect(searchLogs(logs, 'service:pay* AND NOT level:error').hits).toHaveLength(1);
    expect(searchLogs(logs, '"order created" OR trace_id:t1').hits).toHaveLength(2);
    expect(searchLogs(logs, 'latency_ms>500').hits).toHaveLength(1);
    expect(searchLogs(logs, '(level:warn OR level:error) AND service:payments').hits).toHaveLength(2);
  });
});
