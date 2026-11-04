import { fail, type CommandDef } from '../types';
import { parseArgs, invalidOption, lines, joinLines } from '../args';
import { abs, readInputs } from '../cmdutil';
import { FsErr } from '../vfs';
import { globToRegExp } from '../parser';

/** Перевод базового regex (BRE) в JS: \| \( \) \+ \? → операторы */
function breToJs(p: string): string {
  let out = '';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '\\' && i + 1 < p.length) {
      const n = p[i + 1];
      if ('|()+?{}'.includes(n)) out += n;
      else out += c + n;
      i++;
    } else if ('|()+?{}'.includes(c)) out += '\\' + c;
    else out += c;
  }
  return out;
}

function posixClasses(p: string) {
  return p
    .replace(/\[:digit:\]/g, '0-9')
    .replace(/\[:alpha:\]/g, 'A-Za-z')
    .replace(/\[:alnum:\]/g, 'A-Za-z0-9')
    .replace(/\[:space:\]/g, '\\s')
    .replace(/\[:upper:\]/g, 'A-Z')
    .replace(/\[:lower:\]/g, 'a-z');
}

const LONG: Record<string, string> = {
  'ignore-case': 'i', 'invert-match': 'v', count: 'c', 'line-number': 'n', 'extended-regexp': 'E', 'fixed-strings': 'F',
  'basic-regexp': 'G', 'perl-regexp': 'P', 'word-regexp': 'w', 'line-regexp': 'x', 'only-matching': 'o', 'files-with-matches': 'l',
  'files-without-match': 'L', recursive: 'r', 'dereference-recursive': 'R', quiet: 'q', silent: 'q', 'no-messages': 's',
  'no-filename': 'h', 'with-filename': 'H', 'max-count': 'm', 'after-context': 'A', 'before-context': 'B', context: 'C', regexp: 'e',
};

const cmd: CommandDef = {
  name: 'grep',
  summary:
    'поиск строк по шаблону. -i без учёта регистра, -n номера строк, -v инвертировать, -c посчитать, -E расширенные regex, -r рекурсивно, -l только имена файлов, -o только совпадение, -w слово целиком, -A/-B/-C N контекст',
  usage: 'grep [-inv cErlowF] [-A N] шаблон [файл...]',
  run(rawArgs, stdin, ctx) {
    // длинные флаги → короткие (--ignore-case → -i, --max-count=5 → -m 5)
    const args: string[] = [];
    let include: RegExp | undefined;
    let exclude: RegExp | undefined;
    for (const x of rawArgs) {
      const m = /^--([a-z-]+)(?:=(.*))?$/s.exec(x);
      if (m && m[1] in LONG) {
        args.push('-' + LONG[m[1]]);
        if (m[2] !== undefined) args.push(m[2]);
      } else if (m && (m[1] === 'include' || m[1] === 'exclude') && m[2] !== undefined) {
        const re = globToRegExp(m[2]);
        if (m[1] === 'include') include = re;
        else exclude = re;
      } else if (m && (m[1] === 'line-buffered' || m[1] === 'text' || m[1] === 'color' || m[1] === 'colour')) continue;
      else args.push(x);
    }
    const a = parseArgs(args, ['A', 'B', 'C', 'e', 'm'], ['i', 'n', 'v', 'c', 'E', 'r', 'R', 'l', 'L', 'o', 'w', 'F', 'G', 'h', 'H', 'q', 's', 'a', 'I', 'A', 'B', 'C', 'e', 'm', 'P', 'x']);
    if (a.unknown.length) return fail(invalidOption('grep', a.unknown[0]), 2);
    const pos = [...a.positional];
    const pattern = a.values.e ?? pos.shift();
    if (pattern === undefined) return fail("Usage: grep [OPTION]... PATTERNS [FILE]...\nTry 'grep --help' for more information.", 2);
    let src: string;
    if (a.flags.has('F')) src = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    else if (a.flags.has('E') || a.flags.has('P')) src = posixClasses(pattern);
    else src = breToJs(posixClasses(pattern));
    if (a.flags.has('w')) src = `(?<![A-Za-z0-9_])(?:${src})(?![A-Za-z0-9_])`;
    if (a.flags.has('x')) src = `^(?:${src})$`;
    let re: RegExp;
    try {
      re = new RegExp(src, a.flags.has('i') ? 'i' : '');
    } catch {
      return fail(`grep: Invalid regular expression`, 2);
    }
    const recursive = a.flags.has('r') || a.flags.has('R');
    let files = pos;
    let stderr = '';
    if (recursive) {
      if (!files.length) files = ['.'];
      const expanded: string[] = [];
      for (const f of files) {
        const p = abs(ctx, f);
        const n = ctx.fs.lookup(p);
        if (!n) {
          stderr += `grep: ${f}: No such file or directory\n`;
          continue;
        }
        if (n.type === 'file') {
          expanded.push(f);
          continue;
        }
        try {
          ctx.fs.walk(p, (path, node) => {
            const base = path.slice(path.lastIndexOf('/') + 1);
            if (node.type === 'file' && (!include || include.test(base)) && !(exclude && exclude.test(base))) expanded.push(f === '.' ? path.replace(ctx.cwd === '/' ? '/' : ctx.cwd + '/', '') : f.replace(/\/$/, '') + path.slice(p.length));
          });
        } catch (e) {
          if (!(e instanceof FsErr)) throw e;
        }
      }
      files = expanded;
    } else {
      // каталоги без -r
      files = files.filter((f) => {
        if (ctx.fs.isDir(abs(ctx, f))) {
          stderr += `grep: ${f}: Is a directory\n`;
          return false;
        }
        return true;
      });
    }
    const r = readInputs('grep', files, stdin, ctx);
    if (a.flags.has('s')) r.stderr = '';
    const multi = (files.length > 1 || recursive) && !a.flags.has('h') || a.flags.has('H');
    const invert = a.flags.has('v');
    const ctxA = parseInt(a.values.A ?? a.values.C ?? '0', 10);
    const ctxB = parseInt(a.values.B ?? a.values.C ?? '0', 10);
    const max = a.values.m ? parseInt(a.values.m, 10) : Infinity;
    let out = '';
    let any = false;
    for (const inp of r.inputs) {
      const l = lines(inp.content);
      const prefix = multi ? inp.name + ':' : '';
      const matchIdx: number[] = [];
      for (let i = 0; i < l.length && matchIdx.length < max; i++) if (re.test(l[i]) !== invert) matchIdx.push(i);
      if (matchIdx.length) any = true;
      if (a.flags.has('q')) continue;
      if (a.flags.has('l') || a.flags.has('L')) {
        if (!!matchIdx.length !== a.flags.has('L')) out += inp.name + '\n';
        continue;
      }
      if (a.flags.has('c')) {
        out += prefix + matchIdx.length + '\n';
        continue;
      }
      if (a.flags.has('o') && !invert) {
        const g = new RegExp(re.source, re.flags + 'g');
        for (const i of matchIdx) for (const m of l[i].matchAll(g)) if (m[0]) out += prefix + (a.flags.has('n') ? i + 1 + ':' : '') + m[0] + '\n';
        continue;
      }
      if (ctxA || ctxB) {
        const show = new Set<number>();
        for (const i of matchIdx) for (let k = Math.max(0, i - ctxB); k <= Math.min(l.length - 1, i + ctxA); k++) show.add(k);
        const sorted = [...show].sort((x, y) => x - y);
        const ms = new Set(matchIdx);
        sorted.forEach((k, j) => {
          if (j && sorted[j - 1] !== k - 1) out += '--\n';
          out += prefix + (a.flags.has('n') ? `${k + 1}${ms.has(k) ? ':' : '-'}` : '') + l[k] + '\n';
        });
        continue;
      }
      out += joinLines(matchIdx.map((i) => prefix + (a.flags.has('n') ? i + 1 + ':' : '') + l[i]));
    }
    const code = r.failed || stderr ? (any ? 0 : 2) : any ? 0 : 1;
    return { stdout: out, stderr: stderr + r.stderr, exitCode: r.failed && !any ? 2 : code };
  },
};
export default cmd;
