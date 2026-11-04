/** Простой разбор флагов в стиле getopt */
export interface ParsedArgs {
  flags: Set<string>;
  values: Record<string, string>;
  positional: string[];
  unknown: string[];
}

/**
 * @param withValue — короткие/длинные флаги, принимающие значение (например ['n','since'])
 * @param known — допустимые флаги (если не задано — любые)
 */
export function parseArgs(args: string[], withValue: string[] = [], known?: string[]): ParsedArgs {
  const res: ParsedArgs = { flags: new Set(), values: {}, positional: [], unknown: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') {
      res.positional.push(...args.slice(i + 1));
      break;
    }
    if (a.startsWith('--') && a.length > 2) {
      const [name, val] = a.slice(2).split(/=(.*)/s);
      if (known && !known.includes(name)) res.unknown.push(a);
      if (withValue.includes(name)) {
        res.values[name] = val ?? args[++i] ?? '';
      } else res.flags.add(name);
      continue;
    }
    if (a.startsWith('-') && a.length > 1 && !/^-\d+$/.test(a)) {
      for (let j = 1; j < a.length; j++) {
        const f = a[j];
        if (known && !known.includes(f)) res.unknown.push('-' + f);
        if (withValue.includes(f)) {
          const rest = a.slice(j + 1);
          res.values[f] = rest || args[++i] || '';
          break;
        }
        res.flags.add(f);
      }
      continue;
    }
    res.positional.push(a);
  }
  return res;
}

export function invalidOption(cmd: string, opt: string): string {
  const o = opt.replace(/^-+/, '');
  return opt.startsWith('--')
    ? `${cmd}: unrecognized option '${opt}'\nTry '${cmd} --help' for more information.\n`
    : `${cmd}: invalid option -- '${o}'\nTry '${cmd} --help' for more information.\n`;
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return String(bytes);
  const units = ['K', 'M', 'G', 'T'];
  let v = bytes;
  let u = -1;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return (v < 10 ? Math.ceil(v * 10) / 10 : Math.ceil(v)).toString() + units[u];
}

export function lines(text: string): string[] {
  if (!text) return [];
  const l = text.split('\n');
  if (l[l.length - 1] === '') l.pop();
  return l;
}

export const joinLines = (l: string[]) => (l.length ? l.join('\n') + '\n' : '');
