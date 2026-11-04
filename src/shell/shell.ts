import { VFS, FsErr, errText, normalizePath, dirname, basename } from './vfs';
import { parse, ParseError, globToRegExp, EXIT_PLACEHOLDER, type SimpleCommand, type Word } from './parser';
import type { CommandContext, CommandDef, CommandResult, ExecRecord, Scenario, SystemState } from './types';
import { BASE_DIRS, BASE_FILES, DEFAULT_HOST, DEFAULT_NETWORK, DEFAULT_RESOURCES, DEFAULT_USER, SIM_NOW } from './defaults';
import { registry as defaultRegistry } from './registry';

export interface RunOutput {
  /** stdout и stderr в порядке появления (для терминала) */
  output: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  /** Особые действия для терминала */
  clear?: boolean;
}

export class Shell {
  fs: VFS;
  env: Record<string, string>;
  cwd: string;
  state: SystemState;
  history: string[] = [];
  log: ExecRecord[] = [];
  registry: Map<string, CommandDef>;
  scenario: Scenario;

  constructor(scenario: Scenario = {}, registry: Map<string, CommandDef> = defaultRegistry) {
    this.scenario = scenario;
    this.registry = registry;
    const user = scenario.user ?? DEFAULT_USER;
    const host = scenario.host ?? DEFAULT_HOST;
    this.fs = new VFS(SIM_NOW.getTime());
    this.fs.setUserGroups(user, [user, 'adm', 'sudo']);
    for (const d of BASE_DIRS) this.fs.mkdir(d, 'root', true);
    this.fs.get('/tmp').mode = 0o777;
    this.fs.get('/root').mode = 0o700;
    const home = user === 'root' ? '/root' : `/home/${user}`;
    this.fs.mkdir(home, 'root', true);
    const h = this.fs.get(home);
    h.owner = user;
    h.group = user;
    for (const [p, spec] of Object.entries({ ...BASE_FILES, ...(scenario.files ?? {}) })) this.fs.seed(p, spec);
    for (const d of scenario.dirs ?? []) this.fs.mkdir(d, 'root', true);
    if (host !== DEFAULT_HOST) this.fs.seed('/etc/hostname', host + '\n');

    this.env = {
      HOME: home,
      USER: user,
      SHELL: '/bin/bash',
      PATH: '/usr/local/bin:/usr/bin:/bin',
      LANG: 'en_US.UTF-8',
      TERM: 'xterm-256color',
      HOSTNAME: host,
      ...(scenario.env ?? {}),
    };
    this.cwd = scenario.cwd ? normalizePath(scenario.cwd, '/', home) : home;
    this.env.PWD = this.cwd;

    const services = structuredClone(scenario.services ?? []);
    this.state = {
      user,
      host,
      processes: structuredClone(scenario.processes ?? defaultProcesses(user)),
      services,
      listeners: structuredClone(scenario.listeners ?? []),
      network: {
        ...DEFAULT_NETWORK,
        ...(scenario.network ?? {}),
        hosts: { ...DEFAULT_NETWORK.hosts, ...(scenario.network?.hosts ?? {}) },
      },
      resources: { ...DEFAULT_RESOURCES, ...(scenario.resources ?? {}) },
      streams: structuredClone(scenario.streams ?? {}),
      docker: structuredClone(scenario.docker ?? { containers: [] }),
      kube: structuredClone(scenario.kube ?? { pods: [] }),
      nextPid: 4000,
      now: SIM_NOW,
      openFiles: structuredClone(scenario.openFiles ?? []),
      deletedOpen: [],
      kernelLog: structuredClone(scenario.kernelLog ?? []),
      fsBaseBytes: 0,
    };
    this.state.fsBaseBytes = this.fs.totalSize(this.fs.root);
  }

  get home() {
    return this.env.HOME;
  }

  prompt(): string {
    const p = this.cwd === this.home ? '~' : this.cwd.startsWith(this.home + '/') ? '~' + this.cwd.slice(this.home.length) : this.cwd;
    const sign = this.state.user === 'root' ? '#' : '$';
    return `${this.state.user}@${this.state.host}:${p}${sign} `;
  }

  resolve(p: string) {
    return normalizePath(p, this.cwd, this.home);
  }

  private expandWord(w: Word): string[] {
    if (!w.glob) return [w.value];
    const abs = w.value.startsWith('/');
    const parts = w.value.split('/');
    let candidates: string[] = [abs ? '/' : ''];
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i];
      if (seg === '' && i === 0) continue;
      const isLast = i === parts.length - 1;
      const next: string[] = [];
      for (const base of candidates) {
        const join = (name: string) => (base === '' ? name : base === '/' ? '/' + name : base + '/' + name);
        if (!/[*?[]/.test(seg)) {
          next.push(join(seg));
          continue;
        }
        const dir = this.resolve(base || '.');
        const node = this.fs.lookup(dir);
        if (!node || node.type !== 'dir') continue;
        const re = globToRegExp(seg);
        for (const name of [...node.children.keys()].sort()) {
          if (name.startsWith('.') && !seg.startsWith('.')) continue;
          if (re.test(name)) {
            const child = node.children.get(name)!;
            if (!isLast && child.type !== 'dir') continue;
            next.push(join(name));
          }
        }
      }
      candidates = next;
    }
    return candidates.length ? candidates : [w.value];
  }

  /** Выполнить argv (одну команду) */
  execArgv(argv: string[], stdin: string, asUser?: string): CommandResult {
    const [name, ...args] = argv;
    const def = this.registry.get(name);
    if (!def) {
      if (name.includes('/')) return { stdout: '', stderr: `bash: ${name}: No such file or directory\n`, exitCode: 127 };
      return { stdout: '', stderr: `${name}: command not found\n`, exitCode: 127 };
    }
    const savedUser = this.state.user;
    if (asUser) this.state.user = asUser;
    const ctx: CommandContext = {
      fs: this.fs,
      env: this.env,
      cwd: this.cwd,
      setCwd: (p) => {
        this.cwd = p;
        this.env.OLDPWD = this.env.PWD;
        this.env.PWD = p;
      },
      user: this.state.user,
      state: this.state,
      history: this.history,
      exec: (a, s, u) => this.execArgv(a, s, u),
      registry: this.registry,
    };
    try {
      return def.run(args, stdin, ctx);
    } catch (e) {
      if (e instanceof FsErr) {
        return { stdout: '', stderr: `${name}: ${e.path}: ${errText[e.code]}\n`, exitCode: 1 };
      }
      return { stdout: '', stderr: `${name}: ${(e as Error).message}\n`, exitCode: 1 };
    } finally {
      this.state.user = savedUser;
    }
  }

  private runSimple(cmd: SimpleCommand, stdin: string): { stdout: string; stderr: string; exitCode: number } {
    // присваивания VAR=value (только без команды)
    const words = cmd.words.flatMap((w) => this.expandWord(w)).map((w) => w.split(EXIT_PLACEHOLDER).join(this.env['?'] ?? '0'));
    if (words.length && words.every((w) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(w))) {
      for (const w of words) {
        const i = w.indexOf('=');
        this.env[w.slice(0, i)] = w.slice(i + 1);
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    }
    let input = stdin;
    for (const r of cmd.redirects) {
      if (r.type === '<') {
        try {
          input = this.fs.read(this.resolve(r.target), this.state.user);
        } catch (e) {
          if (e instanceof FsErr) return { stdout: '', stderr: `bash: ${r.target}: ${errText[e.code]}\n`, exitCode: 1 };
          throw e;
        }
      }
    }
    let res: CommandResult = words.length ? this.execArgv(words, input) : { stdout: '', stderr: '', exitCode: 0 };
    let { stdout, stderr } = res;
    for (const r of cmd.redirects) {
      if (r.type === '<') continue;
      if (r.type === '2>&1') {
        stdout += stderr;
        stderr = '';
        continue;
      }
      const target = r.target;
      const data = r.type === '2>' || r.type === '2>>' ? stderr : r.type === '&>' ? stdout + stderr : stdout;
      if (target === '/dev/null') {
        if (r.type.startsWith('2')) stderr = '';
        else if (r.type === '&>') stdout = stderr = '';
        else stdout = '';
        continue;
      }
      try {
        const path = this.resolve(target);
        this.fs.write(path, data, this.state.user, r.type === '>>' || r.type === '2>>');
        if (r.type.startsWith('2')) stderr = '';
        else if (r.type === '&>') stdout = stderr = '';
        else stdout = '';
      } catch (e) {
        if (e instanceof FsErr) {
          return { stdout: '', stderr: `bash: ${target}: ${errText[e.code]}\n`, exitCode: 1 };
        }
        throw e;
      }
    }
    return { stdout, stderr, exitCode: res.exitCode };
  }

  /** Выполнить строку целиком */
  run(line: string): RunOutput {
    const trimmed = line.trim();
    if (!trimmed) return { output: '', stdout: '', stderr: '', exitCode: 0 };
    this.history.push(trimmed);
    let items;
    try {
      items = parse(trimmed, this.env);
    } catch (e) {
      const msg = e instanceof ParseError ? `bash: ${e.message}\n` : String(e);
      this.env['?'] = '2';
      return { output: msg, stdout: '', stderr: msg, exitCode: 2 };
    }
    let output = '';
    let allOut = '';
    let allErr = '';
    let exitCode = 0;
    let clear = false;
    const names: string[] = [];
    let pipes = 0;
    for (const item of items) {
      if (item.op === '&&' && exitCode !== 0) continue;
      if (item.op === '||' && exitCode === 0) continue;
      let stdin = '';
      const cmds = item.pipeline.commands;
      pipes = Math.max(pipes, cmds.length - 1);
      let lastOut = '';
      for (let k = 0; k < cmds.length; k++) {
        const c = cmds[k];
        if (c.words[0]) names.push(c.words[0].value === 'sudo' && c.words[1] ? c.words[1].value : c.words[0].value);
        if (c.words[0]?.value === 'clear') clear = true;
        const r = this.runSimple(c, stdin);
        output += r.stderr;
        allErr += r.stderr;
        exitCode = r.exitCode;
        stdin = stripAnsi(r.stdout);
        lastOut = k === cmds.length - 1 ? r.stdout : '';
      }
      output += lastOut;
      allOut += lastOut;
      this.env['?'] = String(exitCode);
    }
    this.env['?'] = String(exitCode);
    this.log.push({ line: trimmed, commands: names, pipes, stdout: stripAnsi(allOut), stderr: stripAnsi(allErr), exitCode });
    return { output, stdout: allOut, stderr: allErr, exitCode, clear };
  }

  /** Варианты для Tab-дополнения */
  complete(line: string): { replaceFrom: number; options: string[] } {
    const m = /(\S*)$/.exec(line)!;
    const word = m[1];
    const from = line.length - word.length;
    const before = line.slice(0, from).trim();
    const isCommand = before === '' || /[|;&]$/.test(before) || before === 'sudo' || before === 'man';
    if (isCommand && !word.includes('/')) {
      return { replaceFrom: from, options: [...this.registry.keys()].filter((k) => k.startsWith(word)).sort() };
    }
    const slash = word.lastIndexOf('/');
    const dirPart = slash >= 0 ? word.slice(0, slash + 1) : '';
    const namePart = word.slice(slash + 1);
    const dirAbs = this.resolve(dirPart || '.');
    const node = this.fs.lookup(dirAbs);
    if (!node || node.type !== 'dir') return { replaceFrom: from, options: [] };
    const opts = [...node.children.values()]
      .filter((c) => c.name.startsWith(namePart) && (namePart.startsWith('.') || !c.name.startsWith('.')))
      .map((c) => dirPart + c.name + (c.type === 'dir' ? '/' : ''))
      .sort();
    return { replaceFrom: from, options: opts };
  }
}

export const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

function defaultProcesses(user: string) {
  return [
    { pid: 1, user: 'root', cpu: 0, mem: 0.1, vsz: 168000, rss: 12000, stat: 'Ss', start: 'Oct12', time: '0:41', command: '/sbin/init' },
    { pid: 512, user: 'root', cpu: 0, mem: 0.2, vsz: 72000, rss: 6500, stat: 'Ss', start: 'Oct12', time: '0:03', command: '/usr/sbin/sshd -D' },
    { pid: 3101, user, cpu: 0, mem: 0.1, vsz: 10000, rss: 5200, stat: 'Ss', start: '14:02', time: '0:00', command: '-bash' },
  ];
}

export { dirname, basename };
