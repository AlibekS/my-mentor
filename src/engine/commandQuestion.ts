import { Shell } from '../shell/shell';
import type { Check } from '../content/types';
import type { Scenario } from '../shell/types';
import { evaluate } from './checks';

const squashLines = (s: string) =>
  s
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');

/**
 * Проверка вопроса «напиши команду»: запускаем команду ученика и эталон
 * в двух одинаковых чистых окружениях и сравниваем результат.
 * Поэтому `grep -c x f` и `grep x f | wc -l` засчитываются одинаково.
 */
export function checkCommandAnswer(input: string, scenario: Scenario, solution: string, check?: Check): { ok: boolean; output: string } {
  const student = new Shell(scenario);
  const res = student.run(input);
  if (check) return { ok: evaluate(check, student), output: res.output };
  if (res.exitCode !== 0 && res.exitCode !== 1) return { ok: false, output: res.output };
  const ref = new Shell(scenario);
  const refRes = ref.run(solution);
  const same = squashLines(res.stdout) === squashLines(refRes.stdout);
  // числовые ответы: "2" и "      2" и "2 file"
  const num = (s: string) => /^\s*(\d+)\b/.exec(s.trim())?.[1];
  const sameNum = num(res.stdout) !== undefined && num(res.stdout) === num(refRes.stdout) && res.stdout.trim().split('\n').length === 1 && refRes.stdout.trim().split('\n').length === 1;
  return { ok: (same || sameNum) && res.stdout.trim() !== '', output: res.output };
}
