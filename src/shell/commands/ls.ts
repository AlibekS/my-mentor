import { fail, type CommandDef } from '../types';
import { parseArgs, invalidOption, humanSize } from '../args';
import { abs, lsDate } from '../cmdutil';
import { FsErr, errText, modeString, type VNode } from '../vfs';

const cmd: CommandDef = {
  name: 'ls',
  summary: 'список файлов. -l подробно, -a со скрытыми, -h размеры в K/M/G, -t по времени, -S по размеру, -r в обратном порядке',
  usage: 'ls [-lahtrS] [путь...]',
  run(args, _s, ctx) {
    const a = parseArgs(args.map((x) => (x === '-1' ? '--one' : x)), [], ['l', 'a', 'h', 't', 'r', 'S', '1', 'A', 'd', 'i', 'F', 'G', 'one', 'color', 'human-readable', 'all', 'almost-all', 'reverse', 'directory']);
    for (const [long, short] of [['one', '1'], ['human-readable', 'h'], ['all', 'a'], ['almost-all', 'A'], ['reverse', 'r'], ['directory', 'd']]) if (a.flags.has(long)) a.flags.add(short);
    // как в настоящем ls: если вывод не в терминал (пайп, файл) — по одному имени в строке
    if (ctx.tty === false) a.flags.add('1');
    if (a.unknown.length) return fail(invalidOption('ls', a.unknown[0]), 2);
    const long = a.flags.has('l');
    const all = a.flags.has('a') || a.flags.has('A');
    const paths = a.positional.length ? a.positional : ['.'];
    let out = '';
    let err = '';
    let code = 0;
    const fmt = (nodes: { n: VNode; label: string }[]) => {
      let list = nodes;
      if (a.flags.has('t')) list = [...list].sort((x, y) => y.n.mtime - x.n.mtime);
      if (a.flags.has('S')) list = [...list].sort((x, y) => ctx.fs.size(y.n) - ctx.fs.size(x.n));
      if (a.flags.has('r')) list = [...list].reverse();
      if (!long) return list.map((x) => x.label).join(a.flags.has('1') ? '\n' : '  ') + (list.length ? '\n' : '');
      const sizes = list.map((x) => (a.flags.has('h') ? humanSize(ctx.fs.size(x.n)) : String(ctx.fs.size(x.n))));
      const w = Math.max(0, ...sizes.map((s) => s.length));
      const ow = Math.max(0, ...list.map((x) => x.n.owner.length));
      const gw = Math.max(0, ...list.map((x) => x.n.group.length));
      let total = 0;
      for (const x of list) total += Math.ceil(ctx.fs.size(x.n) / 1024);
      const head = list.length > 1 || list[0]?.n.type === 'dir' ? `total ${a.flags.has('h') ? humanSize(total * 1024) : total}\n` : '';
      return (
        head +
        list
          .map(
            (x, i) =>
              `${modeString(x.n)} ${x.n.type === 'dir' ? 2 : 1} ${x.n.owner.padEnd(ow)} ${x.n.group.padEnd(gw)} ${sizes[i].padStart(w)} ${lsDate(x.n.mtime, ctx.fs.now)} ${x.label}`,
          )
          .join('\n') +
        '\n'
      );
    };
    const files: { n: VNode; label: string }[] = [];
    const dirs: { p: string; label: string }[] = [];
    for (const p of paths) {
      const n = ctx.fs.lookup(abs(ctx, p));
      if (!n) {
        err += `ls: cannot access '${p}': No such file or directory\n`;
        code = 2;
      } else if (n.type === 'dir' && !a.flags.has('d')) dirs.push({ p: abs(ctx, p), label: p });
      else files.push({ n, label: p });
    }
    if (files.length) out += fmt(files);
    for (const d of dirs) {
      try {
        let children = ctx.fs.list(d.p, ctx.user).map((n) => ({ n, label: n.name }));
        if (!all) children = children.filter((c) => !c.n.name.startsWith('.'));
        else if (a.flags.has('a')) {
          const self = ctx.fs.get(d.p);
          children = [{ n: self, label: '.' }, { n: self, label: '..' }, ...children];
        }
        if (paths.length > 1) out += (out ? '\n' : '') + d.label + ':\n';
        out += fmt(children);
      } catch (e) {
        if (e instanceof FsErr) {
          err += `ls: cannot open directory '${d.label}': ${errText[e.code]}\n`;
          code = 2;
        } else throw e;
      }
    }
    return { stdout: out, stderr: err, exitCode: code };
  },
};
export default cmd;
