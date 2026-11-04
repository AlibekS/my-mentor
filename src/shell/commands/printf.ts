import { fail, ok, type CommandDef } from '../types';

const cmd: CommandDef = {
  name: 'printf',
  summary: 'форматированный вывод: printf "%-10s %5d\\n" "$name" "$count" (%s строка, %d число, %f дробное, \\n перевод строки)',
  usage: 'printf ФОРМАТ [аргументы…]',
  run(args) {
    if (!args.length) return fail('printf: usage: printf format [arguments]', 2);
    const [fmt, ...vals] = args;
    let out = '';
    let k = 0;
    // формат повторяется, пока не кончатся аргументы
    do {
      out += fmt
        .replace(/%(-?)(\d*)(?:\.(\d+))?([sdfi%])/g, (_m, left, width, prec, t) => {
          if (t === '%') return '%';
          const v = vals[k++] ?? '';
          let s: string;
          if (t === 'd' || t === 'i') s = String(Math.trunc(Number(v) || 0));
          else if (t === 'f') s = (Number(v) || 0).toFixed(prec ? parseInt(prec, 10) : 6);
          else s = v;
          const w = width ? parseInt(width, 10) : 0;
          return left ? s.padEnd(w) : s.padStart(w);
        })
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t');
    } while (k < vals.length && /%[sdfi]/.test(fmt));
    return ok(out);
  },
};
export default cmd;
