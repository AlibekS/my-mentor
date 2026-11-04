import type { VFS } from './vfs';

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface Proc {
  pid: number;
  user: string;
  cpu: number;
  mem: number;
  vsz: number;
  rss: number;
  stat: string;
  start: string;
  time: string;
  command: string;
  /** Сервис systemd, которому принадлежит процесс */
  service?: string;
}

export interface Listener {
  proto: 'tcp' | 'udp';
  local: string; // 0.0.0.0:80
  pid: number;
  process: string;
}

export interface JournalEntry {
  time: string; // "2026-11-04 10:15:02"
  priority: 'emerg' | 'alert' | 'crit' | 'err' | 'warning' | 'notice' | 'info' | 'debug';
  message: string;
}

export interface Service {
  name: string; // nginx
  description: string;
  active: 'active' | 'inactive' | 'failed';
  enabled: boolean;
  mainPid?: number;
  since?: string;
  logs: JournalEntry[];
  /** Если задано — при start/restart сервис упадёт с этой ошибкой */
  failOnStart?: string;
  /** Процесс, который создаётся при старте сервиса */
  startProcess?: Omit<Proc, 'pid'>;
  listen?: Omit<Listener, 'pid' | 'process'>[];
  /** Условия успешного старта — проверяются по файловой системе в момент start/restart */
  requires?: { path: string; readableBy?: string; contains?: string; notContains?: string; error: string }[];
}

export interface HttpEndpoint {
  status: number;
  reason?: string;
  headers?: Record<string, string>;
  body?: string;
  /** задержка в мс — для curl -v и timeout */
  timeMs?: number;
  /** Ошибка соединения вместо ответа */
  error?: 'refused' | 'timeout' | 'resolve' | 'ssl';
  /** Ожидаемый заголовок Authorization (например "Bearer abc"); без него — 401, с неверным — 403 */
  auth?: string;
}

export interface Host {
  ip?: string;
  /** NXDOMAIN, если ip не задан */
  reachable?: boolean;
  latencyMs?: number;
  hops?: string[];
  cname?: string;
  cert?: { subject: string; issuer: string; notBefore: string; notAfter: string };
}

export interface NetworkState {
  interfaces: { name: string; ip: string; mac?: string; state: 'UP' | 'DOWN' }[];
  hosts: Record<string, Host>;
  /** "https://api.example.com/health" → ответ */
  http: Record<string, HttpEndpoint>;
}

export interface Resources {
  memTotalMb: number;
  memUsedMb: number;
  swapTotalMb: number;
  swapUsedMb: number;
  load: [number, number, number];
  uptime: string; // "12 days,  3:04"
  disks: { fs: string; sizeGb: number; usedGb: number; mount: string; inodesFull?: boolean }[];
  /** число ядер (nproc) */
  cpus?: number;
  /** доля iowait в top, % */
  iowait?: number;
}

export interface OpenFile {
  path: string;
  pid: number;
  command: string;
  /** размер в байтах (заполняется при удалении файла) */
  size?: number;
}

export interface FileSpec {
  content?: string;
  mode?: number;
  owner?: string;
  group?: string;
  /** Явный размер (для «огромных» файлов без контента) */
  size?: number;
  /** Время изменения: ISO или смещение в днях ("-3d") */
  mtime?: string;
}

/** Описание стартового окружения задания/урока */
export interface Scenario {
  user?: string;
  host?: string;
  cwd?: string;
  env?: Record<string, string>;
  files?: Record<string, string | FileSpec>;
  dirs?: string[];
  processes?: Proc[];
  services?: Service[];
  listeners?: Listener[];
  network?: Partial<NetworkState>;
  resources?: Partial<Resources>;
  /** Новые строки, «прилетающие» в файл при tail -f */
  streams?: Record<string, string[]>;
  /** Файлы, открытые процессами (для lsof и «удалённых, но открытых» файлов) */
  openFiles?: OpenFile[];
  /** Сообщения ядра: journalctl -k, dmesg */
  kernelLog?: JournalEntry[];
  docker?: DockerState;
  kube?: Omit<KubeState, 'pods'> & { pods?: KubePod[] };
}

export interface SystemState {
  user: string;
  host: string;
  processes: Proc[];
  services: Service[];
  listeners: Listener[];
  network: NetworkState;
  resources: Resources;
  streams: Record<string, string[]>;
  docker: DockerState;
  kube: KubeState;
  nextPid: number;
  now: Date;
  openFiles: OpenFile[];
  /** удалены из ФС, но ещё открыты процессом — место не освобождено */
  deletedOpen: OpenFile[];
  kernelLog: JournalEntry[];
  /** суммарный размер ФС в момент старта сценария — база для df */
  fsBaseBytes: number;
}

export interface ExecRecord {
  line: string;
  commands: string[];
  pipes: number;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface CommandContext {
  fs: VFS;
  env: Record<string, string>;
  cwd: string;
  setCwd(path: string): void;
  user: string;
  state: SystemState;
  history: string[];
  /** Выполнить вложенную команду (для sudo) */
  exec(argv: string[], stdin: string, asUser?: string): CommandResult;
  registry: Map<string, CommandDef>;
  /** stdout идёт в терминал (не в пайп/файл/$(...)) — как isatty(1): ls тогда печатает в колонки */
  tty?: boolean;
}

export interface CommandDef {
  name: string;
  /** Краткая справка на русском для man/help */
  summary: string;
  usage?: string;
  man?: string;
  run(args: string[], stdin: string, ctx: CommandContext): CommandResult;
}

export const ok = (stdout = ''): CommandResult => ({ stdout, stderr: '', exitCode: 0 });
export const fail = (stderr: string, exitCode = 1, stdout = ''): CommandResult => ({
  stdout,
  stderr: stderr.endsWith('\n') ? stderr : stderr + '\n',
  exitCode,
});

// ---------------- Docker ----------------
export interface Container {
  id: string;
  name: string;
  image: string;
  /** "Up 2 hours", "Exited (137) 5 minutes ago", "Restarting (1) 10 seconds ago" */
  status: string;
  ports?: string;
  logs?: string;
  env?: Record<string, string>;
  exitCode?: number;
  oomKilled?: boolean;
  restartCount?: number;
  memLimitMb?: number;
  memMb?: number;
  cpu?: number;
  sizeMb?: number;
  /** файлы внутри контейнера для docker exec cat */
  files?: Record<string, string>;
  /** что будет после restart/start */
  onStart?: { status: string; logs?: string; exitCode?: number };
}

export interface DockerState {
  containers: Container[];
  images?: { repo: string; tag: string; id: string; sizeMb: number; dangling?: boolean }[];
}

// ---------------- Kubernetes ----------------
export interface KubePodSpec {
  status: string; // Running | CrashLoopBackOff | ImagePullBackOff | Pending | Error | OOMKilled
  ready?: string;
  restarts?: number;
  logs?: string;
  previousLogs?: string;
  /** Last State: Terminated, Reason / Exit Code */
  lastReason?: string;
  exitCode?: number;
  /** Сообщение для Waiting/ошибок */
  message?: string;
  events?: string[];
}

export interface KubePod extends KubePodSpec {
  name: string;
  namespace?: string;
  deployment?: string;
  image?: string;
  node?: string;
  age: string;
  ip?: string;
  memoryLimit?: string;
  memoryMi?: number;
  cpuM?: number;
  env?: Record<string, string>;
  /** полностью свой вывод describe (иначе генерируется) */
  describe?: string;
}

export interface KubeBehavior {
  /** условия (все заданные должны совпасть) */
  image?: string;
  memoryLimitAtLeastMi?: number;
  envHas?: string;
  spec: KubePodSpec;
}

export interface KubeDeployment {
  name: string;
  namespace?: string;
  image: string;
  container?: string;
  replicas: number;
  memoryLimit?: string;
  env?: Record<string, string>;
  /** история образов по ревизиям (последний = текущий) */
  history?: { image: string; cause?: string }[];
  behaviors: KubeBehavior[];
  labels?: Record<string, string>;
}

export interface KubeService {
  name: string;
  namespace?: string;
  type: string;
  clusterIp: string;
  ports: string;
  age: string;
  /** app=<label> — к каким подам ведёт */
  selector?: string;
}

export interface KubeState {
  namespace?: string;
  pods: KubePod[];
  deployments?: KubeDeployment[];
  services?: KubeService[];
  /** дополнительные строки событий */
  events?: string[];
  nodes?: { name: string; status: string; cpu: string; memory: string; cpuPct?: number; memPct?: number }[];
  counter?: number;
}
