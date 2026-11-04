import { FsErr, errText, normalizePath } from './vfs';
import type { CommandContext } from './types';

export function abs(ctx: CommandContext, p: string) {
  return normalizePath(p, ctx.cwd, ctx.env.HOME);
}

/** Прочитать файлы (или stdin, если файлов нет / указан "-") */
export function readInputs(
  name: string,
  files: string[],
  stdin: string,
  ctx: CommandContext,
): { inputs: { name: string; content: string }[]; stderr: string; failed: boolean } {
  if (!files.length) return { inputs: [{ name: '(standard input)', content: stdin }], stderr: '', failed: false };
  const inputs: { name: string; content: string }[] = [];
  let stderr = '';
  let failed = false;
  for (const f of files) {
    if (f === '-') {
      inputs.push({ name: '(standard input)', content: stdin });
      continue;
    }
    try {
      inputs.push({ name: f, content: ctx.fs.read(abs(ctx, f), ctx.user) });
    } catch (e) {
      failed = true;
      if (e instanceof FsErr) stderr += `${name}: ${f}: ${errText[e.code]}\n`;
      else throw e;
    }
  }
  return { inputs, stderr, failed };
}

export function fsErrMsg(cmd: string, path: string, e: unknown, prefix = ''): string {
  if (e instanceof FsErr) return `${cmd}: ${prefix}${prefix ? "'" + path + "'" : path}: ${errText[e.code]}\n`;
  throw e;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function lsDate(ms: number, now: number): string {
  const d = new Date(ms);
  const day = String(d.getDate()).padStart(2, ' ');
  const sixMonths = 182 * 86400e3;
  const tail = now - ms > sixMonths ? ' ' + String(d.getFullYear()).padStart(4, ' ') : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return `${MONTHS[d.getMonth()]} ${day} ${tail}`;
}

export const pad2 = (n: number) => String(n).padStart(2, '0');

export function fmtDateTime(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
