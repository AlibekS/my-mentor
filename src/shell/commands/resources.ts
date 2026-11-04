import { fail, ok, type CommandDef } from '../types';
import { humanSize, joinLines, parseArgs } from '../args';
import { abs } from '../cmdutil';
import { FsErr, errText } from '../vfs';
import { rootDeltaBytes } from '../procstate';

const df: CommandDef = {
  name: 'df',
  summary: 'занятость файловых систем. -h в K/M/G, -i — inode',
  usage: 'df [-h] [-i]',
  run(args, _s, ctx) {
    const h = args.some((a) => a.includes('h'));
    const delta = rootDeltaBytes(ctx.state, ctx.fs.totalSize(ctx.fs.root)) / 1024 ** 3;
    const disks = ctx.state.resources.disks.map((d) => (d.mount === '/' ? { ...d, usedGb: Math.min(d.sizeGb, Math.max(0, d.usedGb + delta)) } : d));
    if (args.includes('-i')) {
      return ok('Filesystem      Inodes  IUsed   IFree IUse% Mounted on\n' + joinLines(disks.map((d) => `${d.fs.padEnd(15)} 3276800 ${d.inodesFull ? '3276800       0  100%' : ' 412032 2864768   13%'} ${d.mount}`)));
    }
    const head = h ? 'Filesystem      Size  Used Avail Use% Mounted on\n' : 'Filesystem     1K-blocks     Used Available Use% Mounted on\n';
    const fmt = (gb: number) => (h ? (gb >= 10 ? Math.round(gb) + 'G' : gb.toFixed(1) + 'G') : String(Math.round(gb * 1024 * 1024)));
    return ok(
      head +
        joinLines(
          disks.map((d) => {
            const pct = Math.round((d.usedGb / d.sizeGb) * 100);
            const w = h ? 5 : 10;
            return `${d.fs.padEnd(15)}${fmt(d.sizeGb).padStart(w)} ${fmt(d.usedGb).padStart(w)} ${fmt(Math.max(0, d.sizeGb - d.usedGb)).padStart(w)} ${(pct + '%').padStart(4)} ${d.mount}`;
          }),
        ),
    );
  },
};

const du: CommandDef = {
  name: 'du',
  summary: 'размер каталогов/файлов. -s итог, -h в K/M/G, --max-depth=1 / -d 1 — по подкаталогам. Классика: du -sh /var/log/* | sort -h',
  usage: 'du [-sh] [-d N] путь...',
  run(args, _s, ctx) {
    const a = parseArgs(args, ['d', 'max-depth'], ['s', 'h', 'a', 'c', 'd', 'max-depth']);
    const paths = a.positional.length ? a.positional : ['.'];
    const h = a.flags.has('h');
    const depth = a.flags.has('s') ? 0 : parseInt(a.values.d ?? a.values['max-depth'] ?? '99', 10);
    const fmt = (b: number) => (h ? humanSize(b) : String(Math.ceil(b / 1024)));
    let out = '';
    let err = '';
    let total = 0;
    for (const p of paths) {
      const root = abs(ctx, p);
      try {
        const n = ctx.fs.get(root);
        const rows: string[] = [];
        const visit = (path: string, label: string, d: number): number => {
          const node = ctx.fs.get(path);
          if (node.type === 'file') {
            const s = ctx.fs.size(node);
            if (d === 0 || a.flags.has('a')) rows.push(`${fmt(s)}\t${label}`);
            return s;
          }
          if (!ctx.fs.can(node, ctx.user, 4)) {
            err += `du: cannot read directory '${label}': Permission denied\n`;
            return 4096;
          }
          let s = 4096;
          for (const c of node.children.values()) s += visit(path + '/' + c.name, label.replace(/\/$/, '') + '/' + c.name, d + 1);
          if (d <= depth) rows.push(`${fmt(s)}\t${label}`);
          return s;
        };
        total += visit(root === '/' ? '' : root, p, 0);
        void n;
        out += joinLines(rows);
      } catch (e) {
        if (e instanceof FsErr) err += `du: cannot access '${p}': ${errText[e.code]}\n`;
        else throw e;
      }
    }
    if (a.flags.has('c')) out += `${fmt(total)}\ttotal\n`;
    return { stdout: out, stderr: err, exitCode: err ? 1 : 0 };
  },
};

const free: CommandDef = {
  name: 'free',
  summary: 'память и swap. -h в удобных единицах, -m в мегабайтах. Смотрите на available, а не на free!',
  usage: 'free [-h|-m]',
  run(args, _s, ctx) {
    const r = ctx.state.resources;
    const h = args.includes('-h');
    const cache = Math.min(r.memTotalMb - r.memUsedMb, Math.round(r.memTotalMb * 0.15));
    const freeMb = r.memTotalMb - r.memUsedMb - cache;
    const avail = freeMb + Math.round(cache * 0.8);
    const f = (mb: number) => (h ? (mb >= 1024 ? (mb / 1024).toFixed(1) + 'Gi' : Math.round(mb) + 'Mi') : String(args.includes('-m') ? Math.round(mb) : Math.round(mb * 1024)));
    const w = 11;
    return ok(
      `${''.padEnd(15)}${'total'.padStart(w)}${'used'.padStart(w)}${'free'.padStart(w)}${'shared'.padStart(w)}${'buff/cache'.padStart(w)}${'available'.padStart(w)}\n` +
        `Mem:${''.padEnd(11)}${f(r.memTotalMb).padStart(w)}${f(r.memUsedMb).padStart(w)}${f(freeMb).padStart(w)}${f(12).padStart(w)}${f(cache).padStart(w)}${f(avail).padStart(w)}\n` +
        `Swap:${''.padEnd(10)}${f(r.swapTotalMb).padStart(w)}${f(r.swapUsedMb).padStart(w)}${f(r.swapTotalMb - r.swapUsedMb).padStart(w)}\n`,
    );
  },
};

const lsof: CommandDef = {
  name: 'lsof',
  summary: 'открытые файлы и порты: lsof -i :8080, lsof +L1 (удалённые, но открытые файлы — держат место на диске)',
  run(args, _s, ctx) {
    if (args.includes('+L1') || args.length === 0) {
      if (ctx.user !== 'root' && ctx.state.deletedOpen.some((f) => ctx.state.processes.find((p) => p.pid === f.pid)?.user !== ctx.user))
        return { stdout: '', stderr: 'lsof: WARNING: не все процессы видны — запусти через sudo\n', exitCode: 1 };
      const rows = (args.includes('+L1') ? ctx.state.deletedOpen.map((f) => ({ ...f, del: true })) : [...ctx.state.openFiles.map((f) => ({ ...f, del: false })), ...ctx.state.deletedOpen.map((f) => ({ ...f, del: true }))]);
      if (!rows.length) return { stdout: '', stderr: '', exitCode: 1 };
      return ok(
        'COMMAND     PID     USER   FD   TYPE DEVICE     SIZE/OFF NLINK     NODE NAME\n' +
          joinLines(rows.map((f) => {
            const p = ctx.state.processes.find((x) => x.pid === f.pid);
            const size = f.del ? f.size ?? 0 : (() => { const n = ctx.fs.lookup(f.path); return n ? ctx.fs.size(n) : 0; })();
            return `${f.command.slice(0, 9).padEnd(9)} ${String(f.pid).padStart(6)} ${(p?.user ?? 'root').padEnd(8)}    3w   REG    8,1 ${String(size).padStart(12)}     ${f.del ? 0 : 1}   131074 ${f.path}${f.del ? ' (deleted)' : ''}`;
          })),
      );
    }
    const i = args.indexOf('-i');
    if (i >= 0) {
      const port = (args[i + 1] ?? '').replace(':', '');
      const ls = ctx.state.listeners.filter((l) => !port || l.local.endsWith(':' + port));
      if (!ls.length) return { stdout: '', stderr: '', exitCode: 1 };
      return ok('COMMAND     PID     USER   FD   TYPE DEVICE SIZE/OFF NODE NAME\n' + joinLines(ls.map((l) => {
        const p = ctx.state.processes.find((x) => x.pid === l.pid);
        return `${l.process.slice(0, 9).padEnd(9)} ${String(l.pid).padStart(6)} ${(p?.user ?? 'root').padEnd(8)}    6u  IPv4  12345      0t0  ${l.proto.toUpperCase()} ${l.local.replace('0.0.0.0', '*')} (LISTEN)`;
      })));
    }
    return fail('lsof: в тренажёре поддерживается только lsof -i :PORT');
  },
};

export default [df, du, free, lsof];
