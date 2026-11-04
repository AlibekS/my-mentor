import { describe, it, expect } from 'vitest';
import { buildPrompt, validateRequest } from './mentor-prompt';

describe('mentor prompt', () => {
  it('includes context, progress and solution policy', () => {
    const req = validateRequest({ messages: [{ role: 'user', text: 'Что делать?' }], context: { task: { prompt: 'найди 502' } }, progress: { readinessPct: 12 }, allowSolution: false });
    const p = buildPrompt(req);
    expect(p).toContain('найди 502');
    expect(p).toContain('readinessPct');
    expect(p).toContain('НЕ просил готовое решение');
    expect(buildPrompt({ ...req, allowSolution: true })).toContain('ЯВНО попросил');
  });
  it('rejects bad payloads', () => {
    expect(() => validateRequest({})).toThrow();
  });
});
