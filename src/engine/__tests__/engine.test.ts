import { describe, it, expect } from 'vitest';
import { checkAnswer } from '../normalize';
import { evaluate } from '../checks';
import { checkCommandAnswer } from '../commandQuestion';
import { Shell } from '../../shell/shell';

const scenario = { files: { '/var/log/app.log': 'INFO ok\nERROR db timeout\nERROR db timeout\nWARN slow\n' } };

describe('answers', () => {
  it('normalizes case, spaces and number formats', () => {
    expect(checkAnswer('  ERROR  ', { accept: ['error'] })).toBe(true);
    expect(checkAnswer('всего 42 строки', { accept: ['42'], normalize: 'number' })).toBe(true);
    expect(checkAnswer('Ёлка', { accept: ['елка'] })).toBe(true);
    expect(checkAnswer('закончилось место на диске', { accept: [], normalize: 'keywords', keywords: [['диск', 'disk'], ['мест', 'space', 'заполн']] })).toBe(true);
    expect(checkAnswer('', { accept: [''] })).toBe(false);
  });
  it('accepts a flag written together with its command', () => {
    expect(checkAnswer('grep -v', { accept: ['-v'] })).toBe(true);
    expect(checkAnswer('sudo journalctl -f', { accept: ['-f'] })).toBe(true);
    expect(checkAnswer('grep -A 5', { accept: ['-A 5'], normalize: 'exact' })).toBe(true);
    expect(checkAnswer('grep -c', { accept: ['-v'] })).toBe(false);
    expect(checkAnswer('nginx restart', { accept: ['restart'] })).toBe(false);
  });
});

describe('checks', () => {
  it('accepts different correct solutions', () => {
    const a = new Shell(scenario);
    a.run('grep -c ERROR /var/log/app.log');
    const b = new Shell(scenario);
    b.run('grep ERROR /var/log/app.log | wc -l');
    const c = new Shell(scenario);
    c.run('cat /var/log/app.log | grep ERROR | wc -l');
    for (const sh of [a, b, c]) expect(evaluate({ type: 'outputNumber', value: 2 }, sh)).toBe(true);
    expect(evaluate({ type: 'minPipes', value: 2 }, c)).toBe(true);
    expect(evaluate({ type: 'commandUsed', name: 'grep' }, b)).toBe(true);
  });
  it('state checks', () => {
    const sh = new Shell(scenario);
    sh.run('mkdir -p /tmp/backup && cp /var/log/app.log /tmp/backup/');
    expect(evaluate({ type: 'fileExists', path: '/tmp/backup/app.log' }, sh)).toBe(true);
    sh.run('chmod 600 /tmp/backup/app.log');
    expect(evaluate({ type: 'fileMode', path: '/tmp/backup/app.log', mode: 0o600 }, sh)).toBe(true);
    sh.run('cd /var/log');
    expect(evaluate({ type: 'cwd', path: '/var/log' }, sh)).toBe(true);
  });
  it('command questions compare by result', () => {
    expect(checkCommandAnswer('grep ERROR /var/log/app.log | wc -l', scenario, 'grep -c ERROR /var/log/app.log').ok).toBe(true);
    expect(checkCommandAnswer('grep -c WARN /var/log/app.log', scenario, 'grep -c ERROR /var/log/app.log').ok).toBe(false);
    expect(checkCommandAnswer('sort /var/log/app.log | uniq -d', scenario, 'sort /var/log/app.log | uniq -d').ok).toBe(true);
  });
});
