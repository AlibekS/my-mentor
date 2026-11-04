import { fail, ok, type CommandDef } from '../types';
import { abs } from '../cmdutil';
import { globToRegExp } from '../parser';
import { FsErr, type VNode } from '../vfs';

function sizeMatch(spec: string, bytes: number): boolean {
  const m = /^([+-]?)(\d+)([ckMG]?)$/.exec(spec);
  if (!m) return false;
  const mult = { '': 512, c: 1, k: 1024, M: 1024 ** 2, G: 1024 ** 3 }[m[3] as '' | 'c' | 'k' | 'M' | 'G'];
  const n = parseInt(m[2], 10);
  const units = Math.ceil(bytes / mult);
  if (m[1] === '+') return units > n;
  if (m[1] === '-') return units < n;
  return units === n;
}

const cmd: CommandDef = {
  name: 'find',
  summary: 'поиск файлов. -name "*.log", -iname, -type f|d, -size +100M, -mtime -1 (изменён за сутки), -maxdepth N, -user, -perm',
  usage: 'find [путь] [-name шаблон] [-type f|d] [-size ±N[kMG]] [-mtime ±N]',
  run(args, _s, ctx) {
    const paths: string[] = [];
    let i = 0;
    while (i < args.length && !args[i].startsWith('-')) paths.push(args[i++]);
    if (!paths.length) paths.push('.');
    const tests: ((p: string, n: VNode, depth: number) => boolean)[] = [];
    let maxdepth = Infinity;
    let mindepth = 0;
    let neg = false;
    for (; i < args.length; i++) {
      const opt = args[i];
      const val = args[i + 1];
      const needVal = () => {
        if (val === undefined) throw new Error(`missing argument to \`${opt}'`);
        i++;
        return val;
      };
      let t: ((p: string, n: VNode, d: number) => boolean) | null = null;
      switch (opt) {
        case '!':
        case '-not':
          neg = true;
          continue;
        case '-name': {
          const re = globToRegExp(needVal());
          t = (_p, n) => re.test(n.name);
          break;
        }
        case '-iname': {
          const re = new RegExp(globToRegExp(needVal()).source, 'i');
          t = (_p, n) => re.test(n.name);
          break;
        }
        case '-path': {
          const re = new RegExp(globToRegExp(needVal()).source.replace(/\[\^\/\]\*/g, '.*'));
          t = (p) => re.test(p);
          break;
        }
        case '-type': {
          const v = needVal();
          if (v !== 'f' && v !== 'd') return fail(`find: Unknown argument to -type: ${v}`);
          t = (_p, n) => (v === 'f' ? n.type === 'file' : n.type === 'dir');
          break;
        }
        case '-size': {
          const v = needVal();
          t = (_p, n) => n.type === 'file' && sizeMatch(v, ctx.fs.size(n));
          break;
        }
        case '-mtime':
        case '-mmin': {
          const v = needVal();
          const unit = opt === '-mtime' ? 86400e3 : 60e3;
          const m = /^([+-]?)(\d+)$/.exec(v);
          if (!m) return fail(`find: invalid argument \`${v}' to \`${opt}'`);
          const n0 = parseInt(m[2], 10);
          t = (_p, n) => {
            const age = Math.floor((ctx.fs.now - n.mtime) / unit);
            return m[1] === '+' ? age > n0 : m[1] === '-' ? age < n0 : age === n0;
          };
          break;
        }
        case '-user': {
          const v = needVal();
          t = (_p, n) => n.owner === v;
          break;
        }
        case '-perm': {
          const v = parseInt(needVal().replace(/^[-/]/, ''), 8);
          t = (_p, n) => (n.mode & v) === v;
          break;
        }
        case '-maxdepth':
          maxdepth = parseInt(needVal(), 10);
          continue;
        case '-mindepth':
          mindepth = parseInt(needVal(), 10);
          continue;
        case '-print':
          continue;
        case '-empty':
          t = (_p, n) => (n.type === 'file' ? ctx.fs.size(n) === 0 : n.children.size === 0);
          break;
        default:
          return fail(`find: unknown predicate \`${opt}'`);
      }
      if (neg) {
        const inner = t;
        t = (p, n, d) => !inner(p, n, d);
        neg = false;
      }
      tests.push(t);
    }
    let out = '';
    let err = '';
    for (const start of paths) {
      const root = abs(ctx, start);
      if (!ctx.fs.lookup(root)) {
        err += `find: '${start}': No such file or directory\n`;
        continue;
      }
      const visit = (p: string, label: string, depth: number) => {
        const n = ctx.fs.get(p);
        if (depth >= mindepth && tests.every((t) => t(p, n, depth))) out += label + '\n';
        if (n.type === 'dir' && depth < maxdepth) {
          if (!ctx.fs.can(n, ctx.user, 4) || !ctx.fs.can(n, ctx.user, 1)) {
            if (depth > 0 || true) err += `find: '${label}': Permission denied\n`;
            return;
          }
          for (const c of [...n.children.values()].sort((a, b) => a.name.localeCompare(b.name))) {
            visit((p === '/' ? '' : p) + '/' + c.name, (label === '/' ? '' : label.replace(/\/$/, '')) + '/' + c.name, depth + 1);
          }
        }
      };
      try {
        visit(root, start, 0);
      } catch (e) {
        if (!(e instanceof FsErr)) throw e;
      }
    }
    return err ? { stdout: out, stderr: err, exitCode: 1 } : ok(out);
  },
};
export default cmd;
