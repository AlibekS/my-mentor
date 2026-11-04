import type { Shell } from '../../../src/shell/shell';

/** Запустить скрипт ученика «в сторонке» (как подпроцесс) и вернуть вывод и код — для проверок */
export function runUserScript(sh: Shell, path: string, args: string[] = []): { out: string; code: number; ok: boolean } {
  const n = sh.fs.lookup(path);
  if (!n || n.type !== 'file') return { out: '', code: 127, ok: false };
  const r = sh.runScriptText(n.content, args, true, path);
  return { out: r.output, code: r.exitCode, ok: true };
}

export const isExecutable = (sh: Shell, path: string) => {
  const n = sh.fs.lookup(path);
  return !!n && (n.mode & 0o100) !== 0;
};

/** Допустимые записи строки «строгого режима» bash */
export const STRICT_MODE_VARIANTS = [
  'set -euo pipefail',
  'set -eu -o pipefail',
  'set -e -u -o pipefail',
  'set -ueo pipefail',
  'set -Eeuo pipefail',
  'set -eEuo pipefail',
  'set -euEo pipefail',
  'set -o errexit -o nounset -o pipefail',
  'set -o errexit; set -o nounset; set -o pipefail',
];
