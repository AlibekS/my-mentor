import type { Check, Task } from '../content/types';
import type { Shell } from '../shell/shell';
import type { ExecRecord } from '../shell/types';
import { normalizePath } from '../shell/vfs';

const arr = (v: string | string[]) => (Array.isArray(v) ? v : [v]);
const squash = (s: string) => s.replace(/[ \t]+/g, ' ').trim();

/** Оценить проверку по текущему состоянию оболочки и последней выполненной строке */
export function evaluate(check: Check, shell: Shell, last: ExecRecord | undefined = shell.log[shell.log.length - 1]): boolean {
  const out = last?.stdout ?? '';
  switch (check.type) {
    case 'outputContains': {
      const o = check.ci ? out.toLowerCase() : out;
      return !!last && arr(check.value).every((v) => o.includes(check.ci ? v.toLowerCase() : v));
    }
    case 'outputNotContains':
      return !!last && arr(check.value).every((v) => !out.includes(v));
    case 'outputMatches':
      return !!last && new RegExp(check.pattern, check.flags ?? 'm').test(out);
    case 'outputEquals':
      return !!last && squash(out) === squash(check.value);
    case 'outputNumber': {
      if (!last) return false;
      const t = out.trim();
      if (!t || t.includes('\n')) return false;
      const m = /^(?:\S+:)?\s*(\d+)(?:\s+\S+)?$/.exec(t);
      return !!m && parseInt(m[1], 10) === check.value;
    }
    case 'outputLines':
      return !!last && out.split('\n').filter((l) => l.trim()).length === check.value;
    case 'fileExists':
      return shell.fs.exists(check.path) !== !!check.negate;
    case 'fileContains': {
      const n = shell.fs.lookup(check.path);
      return !!n && n.type === 'file' && arr(check.value).every((v) => n.content.includes(v));
    }
    case 'fileMode': {
      const n = shell.fs.lookup(check.path);
      return !!n && (n.mode & 0o777) === check.mode;
    }
    case 'fileOwner': {
      const n = shell.fs.lookup(check.path);
      return !!n && n.owner === check.owner && (check.group === undefined || n.group === check.group);
    }
    case 'cwd':
      return shell.cwd === normalizePath(check.path, '/', shell.home);
    case 'serviceState':
      return shell.state.services.find((s) => s.name === check.name)?.active === check.state;
    case 'processGone':
      return !shell.state.processes.some((p) => p.pid === check.pid);
    case 'commandUsed':
      return !!last && arr(check.name).some((n) => last.commands.includes(n));
    case 'minPipes':
      return !!last && last.pipes >= check.value;
    case 'exitCode':
      return !!last && last.exitCode === check.value;
    case 'custom':
      return check.fn(shell, last);
    case 'all':
      return check.checks.every((c) => evaluate(c, shell, last));
    case 'any':
      return check.checks.some((c) => evaluate(c, shell, last));
  }
}

/** Задание с проверкой по терминалу засчитывается сразу после подходящей команды */
export function taskSolvedByTerminal(task: Task, shell: Shell): boolean {
  return !!task.check && !task.answer && evaluate(task.check, shell);
}
