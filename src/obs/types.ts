/** Данные «наблюдаемости» урока: метрики, логи, трейсы, дашборд */
export interface Series {
  metric: string;
  labels: Record<string, string>;
  /** значения по шагам (NaN — нет данных) */
  values: number[];
}

export interface LogEntry {
  id?: number;
  ts: number; // секунды от начала суток
  service: string;
  level: string;
  msg: string;
  trace_id?: string;
  [k: string]: string | number | undefined;
}

export interface Span {
  id: string;
  parent?: string;
  service: string;
  op: string;
  startMs: number;
  durMs: number;
  error?: string;
}

export interface Trace {
  traceId: string;
  /** время начала, секунды от начала суток */
  ts: number;
  root: string;
  spans: Span[];
}

export interface Panel {
  title: string;
  query: string;
  unit?: 's' | 'ms' | '%' | 'req/s' | 'bytes' | '';
  /** порог алерта — пунктирная линия */
  threshold?: number;
}

export interface ObsDataset {
  /** начало диапазона, секунды от начала суток (например 13*3600) */
  start: number;
  step: number;
  points: number;
  series: Series[];
  logs?: LogEntry[];
  traces?: Trace[];
  dashboard?: { title: string; panels: Panel[] };
}

export const hhmm = (sec: number) => `${String(Math.floor(sec / 3600) % 24).padStart(2, '0')}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}`;
