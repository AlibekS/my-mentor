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
    const flags = args.filter((a) => a.startsWith('-')).join('');
    const h = /h|H/.test(flags.replace(/--\w+/g, '')) || args.includes('--human-readable');
    const typeCol = /T/.test(flags) || args.includes('--print-type');
    const delta = rootDeltaBytes(ctx.state, ctx.fs.totalSize(ctx.fs.root)) / 1024 ** 3;
    let disks = ctx.state.resources.disks.map((d) => (d.mount === '/' ? { ...d, usedGb: Math.min(d.sizeGb, Math.max(0, d.usedGb + delta)) } : d));
    // df ПУТЬ — только файловая система, где лежит путь (самая длинная точка монтирования)
    const paths = args.filter((a) => !a.startsWith('-'));
    if (paths.length) {
      const chosen = new Set<(typeof disks)[number]>();
      for (const p of paths) {
        const ap = abs(ctx, p);
        if (!ctx.fs.lookup(ap)) return fail(`df: ${p}: No such file or directory`);
        const best = disks.filter((d) => ap === d.mount || ap.startsWith(d.mount === '/' ? '/' : d.mount + '/')).sort((x, y) => y.mount.length - x.mount.length)[0];
        if (best) chosen.add(best);
      }
      disks = disks.filter((d) => chosen.has(d));
    }
    const fsType = (d: (typeof disks)[number]) => (d.fs === 'tmpfs' ? 'tmpfs' : 'ext4');
    // df --output=pcent,target и т.п. — только выбранные колонки
    const outArg = args.find((a) => a.startsWith('--output'));
    if (outArg) {
      const fields = (outArg.split('=')[1] ?? 'source,fstype,size,used,avail,pcent,target').split(',');
      const g = (gb: number) => (h ? (gb >= 10 ? Math.round(gb) + 'G' : gb.toFixed(1) + 'G') : String(Math.round(gb * 1024 * 1024)));
      const cols: Record<string, [string, (d: (typeof disks)[number]) => string]> = {
        source: ['Filesystem', (d) => d.fs],
        fstype: ['Type', (d) => fsType(d)],
        size: [h ? 'Size' : '1K-blocks', (d) => g(d.sizeGb)],
        used: ['Used', (d) => g(d.usedGb)],
        avail: ['Avail', (d) => g(Math.max(0, d.sizeGb - d.usedGb))],
        pcent: ['Use%', (d) => Math.round((d.usedGb / d.sizeGb) * 100) + '%'],
        target: ['Mounted on', (d) => d.mount],
        ipcent: ['IUse%', (d) => (d.inodesFull ? '100%' : '13%')],
      };
      const bad = fields.find((f) => !cols[f]);
      if (bad) return fail(`df: option --output: field '${bad}' unknown`);
      return ok(joinLines([fields.map((f) => cols[f][0]).join(' '), ...disks.map((d) => fields.map((f) => cols[f][1](d).padStart(cols[f][0].length)).join(' '))]));
    }
    if (typeCol) {
      const fmtT = (gb: number) => (h ? (gb >= 10 ? Math.round(gb) + 'G' : gb.toFixed(1) + 'G') : String(Math.round(gb * 1024 * 1024)));
      return ok(`Filesystem     Type   ${h ? ' Size  Used Avail' : ' 1K-blocks      Used Available'} Use% Mounted on\n` + joinLines(disks.map((d) => `${d.fs.padEnd(15)}${fsType(d).padEnd(6)} ${fmtT(d.sizeGb).padStart(h ? 5 : 10)} ${fmtT(d.usedGb).padStart(h ? 5 : 10)} ${fmtT(Math.max(0, d.sizeGb - d.usedGb)).padStart(h ? 5 : 10)} ${(Math.round((d.usedGb / d.sizeGb) * 100) + '%').padStart(4)} ${d.mount}`)));
    }
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
    const a = parseArgs(args, ['d', 'max-depth'], ['s', 'h', 'a', 'c', 'd', 'max-depth', 'x', 'm', 'k', 'b', 'summarize', 'human-readable', 'one-file-system', 'L', 'P']);
    const paths = a.positional.length ? a.positional : ['.'];
    const h = a.flags.has('h') || a.flags.has('human-readable');
    const depth = a.flags.has('s') || a.flags.has('summarize') ? 0 : parseInt(a.values.d ?? a.values['max-depth'] ?? '99', 10);
    const fmt = (b: number) => (h ? humanSize(b) : a.flags.has('m') ? String(Math.ceil(b / 1024 ** 2)) : a.flags.has('b') ? String(b) : String(Math.ceil(b / 1024)));
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

/** Одна формула памяти для free и top: buff/cache, free и available согласованы */
export function memView(r: { memTotalMb: number; memUsedMb: number }) {
  const cache = Math.min(r.memTotalMb - r.memUsedMb, Math.round(r.memTotalMb * 0.15));
  const freeMb = r.memTotalMb - r.memUsedMb - cache;
  const avail = freeMb + Math.round(cache * 0.8);
  return { cache, freeMb, avail };
}

const free: CommandDef = {
  name: 'free',
  summary: 'память и swap. -h в удобных единицах, -m в мегабайтах. Смотрите на available, а не на free!',
  usage: 'free [-h|-m]',
  run(args, _s, ctx) {
    const r = ctx.state.resources;
    const fl = args.join(' ');
    const h = /(^|\s)-\w*h|--human/.test(fl);
    const { cache, freeMb, avail } = memView(r);
    const unit = /(^|\s)-\w*g|--giga|--gibi/.test(fl) ? 'g' : /(^|\s)-\w*m|--mega|--mebi/.test(fl) ? 'm' : /(^|\s)-\w*b|--bytes/.test(fl) ? 'b' : 'k';
    const f = (mb: number) => (h ? (mb >= 1024 ? (mb / 1024).toFixed(1) + 'Gi' : Math.round(mb) + 'Mi') : String(unit === 'g' ? Math.floor(mb / 1024) : unit === 'm' ? Math.round(mb) : unit === 'b' ? Math.round(mb * 1024 * 1024) : Math.round(mb * 1024)));
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
  run(argsIn, _s, ctx) {
    // -n -P (без DNS/имён портов) ничего не меняют; -nP, -Pn тоже
    const args = argsIn.filter((a) => !/^-[nPlV]+$/.test(a));
    const fileArgs = args.filter((a) => a.startsWith('/'));
    const pIdx = args.indexOf('-p');
    if (pIdx >= 0 || fileArgs.length) {
      const pid = pIdx >= 0 ? parseInt(args[pIdx + 1] ?? '', 10) : NaN;
      const all = [...ctx.state.openFiles.map((f) => ({ ...f, del: false })), ...ctx.state.deletedOpen.map((f) => ({ ...f, del: true }))].filter((f) => (pIdx < 0 || f.pid === pid) && (!fileArgs.length || fileArgs.some((fa) => f.path === abs(ctx, fa) || f.path.startsWith(abs(ctx, fa) + '/'))));
      const socks = pIdx >= 0 ? ctx.state.listeners.filter((l) => l.pid === pid) : [];
      if (!all.length && !socks.length) return { stdout: '', stderr: '', exitCode: 1 };
      return ok(
        'COMMAND     PID     USER   FD   TYPE DEVICE     SIZE/OFF NLINK     NODE NAME\n' +
          joinLines([
            ...all.map((f) => {
              const p = ctx.state.processes.find((x) => x.pid === f.pid);
              const size = f.del ? f.size ?? 0 : (() => { const n = ctx.fs.lookup(f.path); return n ? ctx.fs.size(n) : 0; })();
              return `${f.command.slice(0, 9).padEnd(9)} ${String(f.pid).padStart(6)} ${(p?.user ?? 'root').padEnd(8)}    3w   REG    8,1 ${String(size).padStart(12)}     ${f.del ? 0 : 1}   131074 ${f.path}${f.del ? ' (deleted)' : ''}`;
            }),
            ...socks.map((l) => `${l.process.slice(0, 9).padEnd(9)} ${String(l.pid).padStart(6)} ${(ctx.state.processes.find((x) => x.pid === l.pid)?.user ?? 'root').padEnd(8)}    6u  IPv4  12345          0t0       ${l.proto.toUpperCase()} ${l.local.replace('0.0.0.0', '*')} (LISTEN)`),
          ]),
      );
    }
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
      // -i :80, -i tcp:80, -i TCP, -i (все)
      const spec = args[i + 1] && !args[i + 1].startsWith('-') ? args[i + 1] : '';
      const port = /:(\d+)$/.exec(spec)?.[1] ?? (/^\d+$/.test(spec) ? spec : '');
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
