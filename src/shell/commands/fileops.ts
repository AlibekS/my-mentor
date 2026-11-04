import { fail, ok, type CommandDef } from '../types';
import { parseArgs, invalidOption } from '../args';
import { abs } from '../cmdutil';
import { FsErr, errText } from '../vfs';

const touch: CommandDef = {
  name: 'touch',
  summary: 'создать пустой файл или обновить время изменения',
  usage: 'touch файл...',
  run(args, _s, ctx) {
    if (!args.length) return fail("touch: missing file operand\nTry 'touch --help' for more information.");
    let err = '';
    for (const f of args.filter((x) => !x.startsWith('-'))) {
      try {
        ctx.fs.touch(abs(ctx, f), ctx.user);
      } catch (e) {
        if (e instanceof FsErr) err += `touch: cannot touch '${f}': ${errText[e.code]}\n`;
        else throw e;
      }
    }
    return err ? fail(err) : ok();
  },
};

const mkdir: CommandDef = {
  name: 'mkdir',
  summary: 'создать каталог. -p — вместе с родительскими, без ошибки если уже есть',
  usage: 'mkdir [-p] каталог...',
  run(args, _s, ctx) {
    const a = parseArgs(args, ['m'], ['p', 'v', 'm']);
    if (a.unknown.length) return fail(invalidOption('mkdir', a.unknown[0]));
    if (!a.positional.length) return fail("mkdir: missing operand\nTry 'mkdir --help' for more information.");
    let err = '';
    for (const d of a.positional) {
      try {
        ctx.fs.mkdir(abs(ctx, d), ctx.user, a.flags.has('p'));
      } catch (e) {
        if (e instanceof FsErr) err += `mkdir: cannot create directory '${d}': ${errText[e.code]}\n`;
        else throw e;
      }
    }
    return err ? fail(err) : ok();
  },
};

const rm: CommandDef = {
  name: 'rm',
  summary: 'удалить файлы. -r каталоги рекурсивно, -f без вопросов и ошибок. Осторожно на проде!',
  usage: 'rm [-rf] путь...',
  run(args, _s, ctx) {
    const a = parseArgs(args, [], ['r', 'R', 'f', 'i', 'v', 'recursive', 'force']);
    if (a.unknown.length) return fail(invalidOption('rm', a.unknown[0]));
    const rec = a.flags.has('r') || a.flags.has('R') || a.flags.has('recursive');
    const force = a.flags.has('f') || a.flags.has('force');
    if (!a.positional.length) return force ? ok() : fail("rm: missing operand\nTry 'rm --help' for more information.");
    let err = '';
    for (const f of a.positional) {
      const p = abs(ctx, f);
      if (p === '/') {
        err += "rm: it is dangerous to operate recursively on '/'\nrm: use --no-preserve-root to override this failsafe\n";
        continue;
      }
      const n = ctx.fs.lookup(p);
      if (!n) {
        if (!force) err += `rm: cannot remove '${f}': No such file or directory\n`;
        continue;
      }
      if (n.type === 'dir' && !rec) {
        err += `rm: cannot remove '${f}': Is a directory\n`;
        continue;
      }
      try {
        ctx.fs.remove(p, ctx.user, rec);
      } catch (e) {
        if (e instanceof FsErr) err += `rm: cannot remove '${f}': ${errText[e.code]}\n`;
        else throw e;
      }
    }
    return err ? fail(err) : ok();
  },
};

const rmdir: CommandDef = {
  name: 'rmdir',
  summary: 'удалить пустой каталог',
  usage: 'rmdir каталог',
  run(args, _s, ctx) {
    let err = '';
    for (const d of args) {
      try {
        ctx.fs.rmdir(abs(ctx, d), ctx.user);
      } catch (e) {
        if (e instanceof FsErr) err += `rmdir: failed to remove '${d}': ${errText[e.code]}\n`;
        else throw e;
      }
    }
    return err ? fail(err) : ok();
  },
};

const cp: CommandDef = {
  name: 'cp',
  summary: 'копировать. -r каталоги рекурсивно. Перед правкой конфига: cp nginx.conf nginx.conf.bak',
  usage: 'cp [-r] откуда куда',
  run(args, _s, ctx) {
    const a = parseArgs(args, [], ['r', 'R', 'a', 'p', 'v', 'f']);
    if (a.unknown.length) return fail(invalidOption('cp', a.unknown[0]));
    if (a.positional.length < 2) return fail(`cp: missing destination file operand after '${a.positional[0] ?? ''}'\nTry 'cp --help' for more information.`);
    const dst = a.positional[a.positional.length - 1];
    let err = '';
    for (const s of a.positional.slice(0, -1)) {
      try {
        if (ctx.fs.isDir(abs(ctx, s)) && !(a.flags.has('r') || a.flags.has('R') || a.flags.has('a'))) {
          err += `cp: -r not specified; omitting directory '${s}'\n`;
          continue;
        }
        ctx.fs.copy(abs(ctx, s), abs(ctx, dst), ctx.user, true);
      } catch (e) {
        if (e instanceof FsErr) err += `cp: cannot stat '${s}': ${errText[e.code]}\n`;
        else throw e;
      }
    }
    return err ? fail(err) : ok();
  },
};

const mv: CommandDef = {
  name: 'mv',
  summary: 'переместить или переименовать',
  usage: 'mv откуда куда',
  run(args, _s, ctx) {
    const pos = args.filter((x) => !x.startsWith('-'));
    if (pos.length < 2) return fail(`mv: missing destination file operand after '${pos[0] ?? ''}'`);
    const dst = pos[pos.length - 1];
    let err = '';
    for (const s of pos.slice(0, -1)) {
      try {
        ctx.fs.move(abs(ctx, s), abs(ctx, dst), ctx.user);
      } catch (e) {
        if (e instanceof FsErr) err += `mv: cannot stat '${s}': ${errText[e.code]}\n`;
        else throw e;
      }
    }
    return err ? fail(err) : ok();
  },
};

const chmod: CommandDef = {
  name: 'chmod',
  summary: 'изменить права: chmod 640 файл, chmod u+x скрипт.sh, chmod -R 755 каталог',
  usage: 'chmod [-R] режим файл...',
  run(args, _s, ctx) {
    const a = parseArgs(args, [], ['R', 'v']);
    const [mode, ...files] = a.positional;
    if (!mode || !files.length) return fail(`chmod: missing operand${mode ? ` after '${mode}'` : ''}`);
    let err = '';
    for (const f of files) {
      const p = abs(ctx, f);
      const n = ctx.fs.lookup(p);
      if (!n) {
        err += `chmod: cannot access '${f}': No such file or directory\n`;
        continue;
      }
      if (ctx.user !== 'root' && n.owner !== ctx.user) {
        err += `chmod: changing permissions of '${f}': Operation not permitted\n`;
        continue;
      }
      const apply = (node: typeof n) => {
        if (/^[0-7]{3,4}$/.test(mode)) node.mode = parseInt(mode, 8) & 0o777;
        else {
          for (const part of mode.split(',')) {
            const m = /^([ugoa]*)([+\-=])([rwx]*)$/.exec(part);
            if (!m) throw new Error(`invalid mode: '${mode}'`);
            const who = m[1] || 'a';
            let bits = 0;
            for (const c of m[3]) bits |= c === 'r' ? 4 : c === 'w' ? 2 : 1;
            let mask = 0;
            if (who.includes('u') || who.includes('a')) mask |= bits << 6;
            if (who.includes('g') || who.includes('a')) mask |= bits << 3;
            if (who.includes('o') || who.includes('a')) mask |= bits;
            if (m[2] === '+') node.mode |= mask;
            else if (m[2] === '-') node.mode &= ~mask;
            else {
              let clear = 0;
              if (who.includes('u') || who.includes('a')) clear |= 0o700;
              if (who.includes('g') || who.includes('a')) clear |= 0o070;
              if (who.includes('o') || who.includes('a')) clear |= 0o007;
              node.mode = (node.mode & ~clear) | mask;
            }
          }
        }
        if (a.flags.has('R')) for (const c of node.children.values()) apply(c);
      };
      try {
        apply(n);
      } catch (e) {
        return fail(`chmod: ${(e as Error).message}`);
      }
    }
    return err ? fail(err) : ok();
  },
};

const chown: CommandDef = {
  name: 'chown',
  summary: 'сменить владельца: chown user:group файл (нужен root → sudo chown ...)',
  usage: 'chown [-R] пользователь[:группа] файл...',
  run(args, _s, ctx) {
    const a = parseArgs(args, [], ['R', 'v']);
    const [spec, ...files] = a.positional;
    if (!spec || !files.length) return fail(`chown: missing operand${spec ? ` after '${spec}'` : ''}`);
    const [user, group] = spec.split(':');
    const known = ctx.fs.read('/etc/passwd', 'root').split('\n').map((l) => l.split(':')[0]);
    if (user && !known.includes(user)) return fail(`chown: invalid user: '${spec}'`);
    let err = '';
    for (const f of files) {
      const n = ctx.fs.lookup(abs(ctx, f));
      if (!n) {
        err += `chown: cannot access '${f}': No such file or directory\n`;
        continue;
      }
      if (ctx.user !== 'root') {
        err += `chown: changing ownership of '${f}': Operation not permitted\n`;
        continue;
      }
      const apply = (node: typeof n) => {
        if (user) node.owner = user;
        if (group !== undefined) node.group = group || user;
        if (a.flags.has('R')) for (const c of node.children.values()) apply(c);
      };
      apply(n);
    }
    return err ? fail(err) : ok();
  },
};

const tee: CommandDef = {
  name: 'tee',
  summary: 'вывести stdin на экран и одновременно записать в файл. -a — дописать',
  usage: 'tee [-a] файл',
  run(args, stdin, ctx) {
    const a = parseArgs(args, [], ['a']);
    for (const f of a.positional) ctx.fs.write(abs(ctx, f), stdin, ctx.user, a.flags.has('a'));
    return ok(stdin);
  },
};

export default [touch, mkdir, rm, rmdir, cp, mv, chmod, chown, tee];
