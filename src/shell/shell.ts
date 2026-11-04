import { VFS, FsErr, errText, normalizePath, dirname, basename } from './vfs';
import { parse, splitList, tokenize, ParseError, globToRegExp, EXIT_PLACEHOLDER, type SimpleCommand, type Word } from './parser';
import { isCompound, parseScript, type Node } from './script';
import { initKube } from './kube';
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
  /** открыть редактор для файла (nano/vim) */
  editFile?: string;
}

interface Exec {
  output: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  /** ошибка, прерывающая скрипт (set -u) */
  fatal?: boolean;
}

class ExitSignal {
  constructor(public code: number) {}
}
class ReturnSignal {
  constructor(public code: number) {}
}

const MAX_LOOP = 5000;

export class Shell {
  fs: VFS;
  env: Record<string, string>;
  cwd: string;
  state: SystemState;
  history: string[] = [];
  log: ExecRecord[] = [];
  registry: Map<string, CommandDef>;
  scenario: Scenario;
  functions: Record<string, Node[]> = {};
  opts = { errexit: false, nounset: false, pipefail: false };
  /** глубина вложенности скриптов/функций (exit внутри скрипта завершает скрипт) */
  private depth = 0;
  private pendingEdit?: string;
  private substCode = 0;
  private clearFlag = false;
  private names: string[] = [];
  private maxPipes = 0;

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
      kube: { pods: [], ...structuredClone(scenario.kube ?? {}) } as SystemState['kube'],
      nextPid: 4000,
      now: SIM_NOW,
      openFiles: structuredClone(scenario.openFiles ?? []),
      deletedOpen: [],
      kernelLog: structuredClone(scenario.kernelLog ?? []),
      fsBaseBytes: 0,
    };
    this.state.fsBaseBytes = this.fs.totalSize(this.fs.root);
    initKube(this.state.kube);
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

  private ok(stdout = '', exitCode = 0): CommandResult & { output?: string } {
    return { stdout, stderr: '', exitCode };
  }

  /** Встроенные команды оболочки, которым нужен доступ к её состоянию */
  private builtin(words: string[], stdin: string): (CommandResult & { output?: string }) | null {
    const [name, ...args] = words;
    switch (name) {
      case 'exit': {
        const code = args[0] ? parseInt(args[0], 10) || 0 : parseInt(this.env['?'] ?? '0', 10);
        if (this.depth > 0) throw new ExitSignal(code);
        return this.ok('logout\n', code);
      }
      case 'return':
        if (this.depth > 0) throw new ReturnSignal(args[0] ? parseInt(args[0], 10) || 0 : 0);
        return { stdout: '', stderr: 'bash: return: can only `return\' from a function or sourced script\n', exitCode: 1 };
      case 'set': {
        for (let i = 0; i < args.length; i++) {
          const a = args[i];
          if (!/^[-+]/.test(a)) continue;
          const on = a.startsWith('-');
          for (const f of a.slice(1)) {
            if (f === 'e') this.opts.errexit = on;
            else if (f === 'u') this.opts.nounset = on;
            else if (f === 'o') {
              if (args[i + 1] === 'pipefail') this.opts.pipefail = on;
              i++;
            }
          }
        }
        return this.ok();
      }
      case 'local':
      case 'declare':
      case 'readonly':
        for (const a of args.filter((x) => !x.startsWith('-'))) {
          const i = a.indexOf('=');
          if (i > 0) this.env[a.slice(0, i)] = a.slice(i + 1);
          else if (!(a in this.env)) this.env[a] = '';
        }
        return this.ok();
      case 'unset':
        for (const a of args) delete this.env[a];
        return this.ok();
      case 'read': {
        const vars = args.filter((x) => !x.startsWith('-'));
        const line = stdin.split('\n')[0] ?? '';
        if (!stdin) return { stdout: '', stderr: '', exitCode: 1 };
        this.assignRead(vars, line);
        return this.ok();
      }
      case 'shift': {
        const n = parseInt(args[0] ?? '1', 10);
        const all = (this.env['@'] ?? '').split(' ').filter(Boolean).slice(n);
        this.setPositional(this.env['0'] ?? 'bash', all);
        return this.ok();
      }
      case 'nano':
      case 'vim':
      case 'vi':
      case 'mcedit': {
        if (!args[0]) return { stdout: '', stderr: `${name}: укажи файл: ${name} script.sh\n`, exitCode: 1 };
        const p = this.resolve(args[args.length - 1]);
        const n = this.fs.lookup(p);
        if (n && n.type === 'dir') return { stdout: '', stderr: `${name}: ${args[0]}: Is a directory\n`, exitCode: 1 };
        if (n && !this.fs.can(n, this.state.user, 2)) return { stdout: '', stderr: `${name}: ${args[0]}: Permission denied (нужен sudo)\n`, exitCode: 1 };
        this.pendingEdit = p;
        return this.ok();
      }
      case 'source':
      case '.': {
        if (!args[0]) return { stdout: '', stderr: `bash: ${name}: filename argument required\n`, exitCode: 2 };
        let text: string;
        try {
          text = this.fs.read(this.resolve(args[0]), this.state.user);
        } catch (e) {
          if (e instanceof FsErr) return { stdout: '', stderr: `bash: ${args[0]}: ${errText[e.code]}\n`, exitCode: 1 };
          throw e;
        }
        return this.runScriptText(text, args.slice(1), false, args[0]);
      }
      case 'bash':
      case 'sh': {
        if (args[0] === '-c') return this.runScriptText(args[1] ?? '', args.slice(2), true, name);
        const flags = args.filter((a) => /^-[nxeu]+$/.test(a));
        const rest = args.filter((a) => !/^-[nxeu]+$/.test(a));
        if (!rest[0]) return { stdout: '', stderr: `${name}: интерактивный запуск в тренажёре не поддерживается — укажи скрипт: ${name} script.sh\n`, exitCode: 2 };
        let text: string;
        try {
          text = this.fs.read(this.resolve(rest[0]), this.state.user);
        } catch (e) {
          if (e instanceof FsErr) return { stdout: '', stderr: `${name}: ${rest[0]}: ${errText[e.code]}\n`, exitCode: 127 };
          throw e;
        }
        if (flags.some((f) => f.includes('n'))) {
          try {
            parseScript(text);
            return this.ok();
          } catch (e) {
            return { stdout: '', stderr: `${rest[0]}: ${(e as Error).message}\n`, exitCode: 2 };
          }
        }
        const pre = flags.some((f) => f.includes('e')) ? 'set -e\n' : '';
        return this.runScriptText(pre + text, rest.slice(1), true, rest[0]);
      }
    }
    // функции
    if (this.functions[name]) return this.callFunction(name, args);
    // запуск файла по пути: ./check.sh, /opt/bin/x.sh
    if (name.includes('/')) {
      const p = this.resolve(name);
      const n = this.fs.lookup(p);
      if (!n) return { stdout: '', stderr: `bash: ${name}: No such file or directory\n`, exitCode: 127 };
      if (n.type === 'dir') return { stdout: '', stderr: `bash: ${name}: Is a directory\n`, exitCode: 126 };
      if (!this.fs.can(n, this.state.user, 1) || !this.fs.can(n, this.state.user, 4)) return { stdout: '', stderr: `bash: ${name}: Permission denied\n`, exitCode: 126 };
      return this.runScriptText(n.content, args, true, name);
    }
    return null;
  }

  private assignRead(vars: string[], line: string) {
    const names = vars.length ? vars : ['REPLY'];
    const parts = line.trim().split(/\s+/);
    names.forEach((v, i) => {
      this.env[v] = i === names.length - 1 ? parts.slice(i).join(' ') : parts[i] ?? '';
    });
  }

  private setPositional(zero: string, args: string[]) {
    for (const k of Object.keys(this.env)) if (/^\d+$/.test(k)) delete this.env[k];
    this.env['0'] = zero;
    args.forEach((a, i) => (this.env[String(i + 1)] = a));
    this.env['#'] = String(args.length);
    this.env['@'] = args.join(' ');
  }

  private callFunction(name: string, args: string[]): CommandResult & { output?: string } {
    const saved = Object.fromEntries(Object.entries(this.env).filter(([k]) => /^(\d+|#|@)$/.test(k)));
    this.setPositional(this.env['0'] ?? 'bash', args);
    this.depth++;
    const acc: Exec = { output: '', stdout: '', stderr: '', exitCode: 0 };
    try {
      acc.exitCode = this.runNodes(this.functions[name], acc);
    } catch (e) {
      if (e instanceof ReturnSignal) acc.exitCode = e.code;
      else throw e;
    } finally {
      this.depth--;
      for (const k of Object.keys(this.env)) if (/^(\d+|#|@)$/.test(k)) delete this.env[k];
      Object.assign(this.env, saved);
    }
    return acc;
  }

  /**
   * Выполнить текст скрипта. subshell=true — как отдельный процесс: переменные,
   * функции, cwd и опции не «протекают» наружу (так ведёт себя ./script.sh).
   */
  runScriptText(text: string, args: string[], subshell: boolean, name = 'bash'): CommandResult & { output: string } {
    const acc: Exec = { output: '', stdout: '', stderr: '', exitCode: 0 };
    let nodes: Node[];
    try {
      nodes = parseScript(text);
    } catch (e) {
      const msg = `${name}: ${(e as Error).message}\n`;
      return { output: msg, stdout: '', stderr: msg, exitCode: 2 };
    }
    const saved = subshell ? { env: { ...this.env }, cwd: this.cwd, functions: { ...this.functions }, opts: { ...this.opts } } : null;
    if (subshell || args.length) this.setPositional(name, args);
    this.depth++;
    try {
      acc.exitCode = this.runNodes(nodes, acc);
    } catch (e) {
      if (e instanceof ExitSignal || e instanceof ReturnSignal) acc.exitCode = e.code;
      else throw e;
    } finally {
      this.depth--;
      if (saved) {
        this.env = saved.env;
        this.cwd = saved.cwd;
        this.functions = saved.functions;
        this.opts = saved.opts;
      }
    }
    this.env['?'] = String(acc.exitCode);
    return acc;
  }

  private add(acc: Exec, r: Exec) {
    acc.output += r.output;
    acc.stdout += r.stdout;
    acc.stderr += r.stderr;
  }

  /** Выполнить узлы скрипта; вернуть код выхода последней команды */
  private runNodes(nodes: Node[], acc: Exec, cond = false, input?: { lines: string[] }): number {
    let code = 0;
    for (const n of nodes) {
      switch (n.t) {
        case 'cmd': {
          // read внутри while с перенаправлением ввода
          const rm = /^read(\s+-r)?(\s+.*)?$/.exec(n.line);
          if (rm && input) {
            if (!input.lines.length) {
              code = 1;
              break;
            }
            const vars = (rm[2] ?? '').trim().split(/\s+/).filter((x) => x && !x.startsWith('-'));
            this.assignRead(vars, input.lines.shift()!);
            code = 0;
            break;
          }
          const r = this.execLine(n.line);
          this.add(acc, r);
          code = r.exitCode;
          if (r.fatal) throw new ExitSignal(code);
          this.env['?'] = String(code);
          if (code !== 0 && this.opts.errexit && !cond && !/(\|\||&&)/.test(n.line)) throw new ExitSignal(code);
          break;
        }
        case 'func':
          this.functions[n.name] = n.body;
          code = 0;
          break;
        case 'if': {
          let done = false;
          for (const b of n.branches) {
            if (this.runNodes(b.cond, acc, true, input) === 0) {
              code = this.runNodes(b.body, acc, cond, input);
              done = true;
              break;
            }
          }
          if (!done) code = n.else ? this.runNodes(n.else, acc, cond, input) : 0;
          break;
        }
        case 'for': {
          const words = this.expandList(n.list);
          let k = 0;
          code = 0;
          for (const w of words) {
            if (++k > MAX_LOOP) break;
            this.env[n.v] = w;
            code = this.runNodes(n.body, acc, cond, input);
          }
          break;
        }
        case 'while': {
          let src = input;
          if (n.input || n.pipeFrom) {
            let text = '';
            if (n.input) {
              try {
                text = this.fs.read(this.resolve(n.input), this.state.user);
              } catch (e) {
                const msg = `bash: ${n.input}: ${e instanceof FsErr ? errText[e.code] : String(e)}\n`;
                this.add(acc, { output: msg, stdout: '', stderr: msg, exitCode: 1 });
                code = 1;
                break;
              }
            } else {
              const r = this.execLine(n.pipeFrom!);
              acc.output += r.stderr;
              acc.stderr += r.stderr;
              text = stripAnsi(r.stdout);
            }
            src = { lines: text.split('\n').filter((l, i, a) => i < a.length - 1 || l !== '') };
          }
          let k = 0;
          code = 0;
          for (;;) {
            if (++k > MAX_LOOP) {
              const msg = 'тренажёр: цикл прерван — больше 5000 итераций (бесконечный цикл?)\n';
              this.add(acc, { output: msg, stdout: '', stderr: msg, exitCode: 1 });
              break;
            }
            const c = this.runNodes(n.cond, acc, true, src);
            if ((c === 0) === n.until) break;
            code = this.runNodes(n.body, acc, cond, src);
          }
          break;
        }
      }
    }
    return code;
  }

  /** Раскрыть список слов для for: переменные, $(...), glob, разбиение по пробелам */
  private expandList(list: string): string[] {
    const quotedAll = /^"\$@"$/.test(list.trim());
    if (quotedAll) return (this.env['@'] ?? '').split(' ').filter(Boolean);
    const toks = tokenize(list, this.env, { subst: (c) => this.execLine(c).stdout, nounset: this.opts.nounset });
    const out: string[] = [];
    const hasQuotes = /["']/.test(list);
    for (const t of toks) {
      if (t.kind !== 'word') continue;
      for (const w of this.expandWord(t.word)) {
        if (hasQuotes) out.push(w);
        else out.push(...w.split(/\s+/).filter(Boolean));
      }
    }
    return out;
  }

  private runSimple(cmd: SimpleCommand, stdin: string): CommandResult & { output?: string } {
    // присваивания VAR=value (только без команды)
    const words = cmd.words.flatMap((w) => this.expandWord(w)).map((w) => w.split(EXIT_PLACEHOLDER).join(this.env['?'] ?? '0'));
    if (words.length && words.every((w) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(w))) {
      for (const w of words) {
        const i = w.indexOf('=');
        this.env[w.slice(0, i)] = w.slice(i + 1);
      }
      // код выхода присваивания = код последней подстановки $(...)
      return { stdout: '', stderr: '', exitCode: this.substCode };
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
    const res: CommandResult & { output?: string } = words.length ? this.builtin(words, input) ?? this.execArgv(words, input) : { stdout: '', stderr: '', exitCode: 0 };
    let { stdout, stderr } = res;
    let output = res.output;
    for (const r of cmd.redirects) {
      if (r.type === '<') continue;
      output = undefined;
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
    return { stdout, stderr, exitCode: res.exitCode, output };
  }

  private subst(cmd: string): string {
    const r = this.execLine(cmd);
    this.substCode = r.exitCode;
    return r.stdout;
  }

  /** Выполнить одну «простую» строку: пайпы, && || ;, перенаправления. Без истории и лога. */
  execLine(line: string): Exec {
    // синтаксис проверяем целиком (без выполнения $(...)), а раскрываем — по элементам при выполнении
    try {
      parse(line, {}, {});
    } catch (e) {
      const msg = e instanceof ParseError ? `bash: ${e.message}\n` : `bash: ${String((e as Error).message ?? e)}\n`;
      return { output: msg, stdout: '', stderr: msg, exitCode: 2 };
    }
    const acc: Exec = { output: '', stdout: '', stderr: '', exitCode: 0 };
    let exitCode = 0;
    for (const part of splitList(line)) {
      if (part.op === '&&' && exitCode !== 0) continue;
      if (part.op === '||' && exitCode === 0) continue;
      let parsed;
      try {
        this.substCode = 0;
        parsed = parse(part.text, this.env, { subst: (c) => this.subst(c), nounset: this.opts.nounset });
      } catch (e) {
        const msg = e instanceof ParseError ? `bash: ${e.message}\n` : `bash: ${String((e as Error).message ?? e)}\n`;
        acc.output += msg;
        acc.stderr += msg;
        exitCode = e instanceof ParseError && /unbound/.test(e.message) ? 1 : 2;
        this.env['?'] = String(exitCode);
        if (/unbound/.test(msg) && this.depth > 0) {
          acc.exitCode = exitCode;
          acc.fatal = true;
          return acc;
        }
        continue;
      }
      const item = parsed[0];
      if (!item) continue;
      let stdin = '';
      const cmds = item.pipeline.commands;
      this.maxPipes = Math.max(this.maxPipes, cmds.length - 1);
      let lastOut = '';
      let pipeCode = 0;
      for (let k = 0; k < cmds.length; k++) {
        const c = cmds[k];
        if (c.words[0] && this.depth === 0) this.names.push(c.words[0].value === 'sudo' && c.words[1] ? c.words[1].value : c.words[0].value);
        if (c.words[0]?.value === 'clear') this.clearFlag = true;
        const r = this.runSimple(c, stdin);
        if (r.output !== undefined && cmds.length === 1) acc.output += r.output;
        else acc.output += r.stderr;
        acc.stderr += r.stderr;
        exitCode = r.exitCode;
        if (r.exitCode !== 0) pipeCode = r.exitCode;
        stdin = stripAnsi(r.stdout);
        lastOut = k === cmds.length - 1 ? r.stdout : '';
        if (k === cmds.length - 1 && r.output !== undefined && cmds.length === 1) lastOut = '\u0000' + r.stdout;
      }
      if (this.opts.pipefail && pipeCode !== 0) exitCode = pipeCode;
      if (lastOut.startsWith('\u0000')) {
        acc.stdout += lastOut.slice(1);
      } else {
        acc.output += lastOut;
        acc.stdout += lastOut;
      }
      this.env['?'] = String(exitCode);
    }
    acc.exitCode = exitCode;
    return acc;
  }

  /** Выполнить строку целиком (то, что ввёл пользователь) */
  run(line: string): RunOutput {
    const trimmed = line.trim();
    if (!trimmed) return { output: '', stdout: '', stderr: '', exitCode: 0 };
    this.history.push(trimmed);
    this.names = [];
    this.maxPipes = 0;
    this.clearFlag = false;
    this.pendingEdit = undefined;
    let r: Exec;
    let compound = false;
    try {
      compound = isCompound(trimmed);
    } catch {
      compound = false;
    }
    if (compound) {
      const nodes = (() => {
        try {
          return parseScript(trimmed);
        } catch (e) {
          return e as Error;
        }
      })();
      if (nodes instanceof Error) {
        const msg = `bash: ${nodes.message}\n`;
        r = { output: msg, stdout: '', stderr: msg, exitCode: 2 };
      } else {
        const acc: Exec = { output: '', stdout: '', stderr: '', exitCode: 0 };
        this.names.push(...trimmed.split(/[\s;|&()]+/).filter((w) => this.registry.has(w)));
        try {
          acc.exitCode = this.runNodes(nodes, acc);
        } catch (e) {
          if (e instanceof ExitSignal) acc.exitCode = e.code;
          else throw e;
        }
        r = acc;
      }
    } else r = this.execLine(trimmed);
    this.env['?'] = String(r.exitCode);
    this.log.push({ line: trimmed, commands: [...this.names], pipes: this.maxPipes, stdout: stripAnsi(r.stdout), stderr: stripAnsi(r.stderr), exitCode: r.exitCode });
    return { output: r.output, stdout: r.stdout, stderr: r.stderr, exitCode: r.exitCode, clear: this.clearFlag, editFile: this.pendingEdit };
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
