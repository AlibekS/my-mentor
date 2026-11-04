import { useEffect, useRef, useState } from 'react';
import { mentorContext } from './context';
import { asksForSolution, progressSummary, publicContext } from './summary';
import { OFFLINE_NOTE, offlineAnswer } from './offline';
import { useStore } from '../state/store';
import { Markdown } from '../ui/Markdown';
import type { MentorMessage } from '../game/progress';

type Status = { available: boolean; detail?: string } | null;

const CHIPS_TASK = ['Что от меня требуется в этом задании?', 'Дай наводящий вопрос', 'Почему моя команда не сработала?', 'Покажи решение'];
const CHIPS_GENERAL = ['Как у меня прогресс?', 'Что учить дальше?', 'Объясни теорию урока проще', 'Это востребовано на рынке?'];

export function MentorWidget() {
  const { progress, update } = useStore();
  const ctx = mentorContext.use();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const threadKey = ctx.lesson?.key ?? 'general';
  const messages: MentorMessage[] = progress.mentor[threadKey] ?? [];

  useEffect(() => {
    if (!open || status) return;
    fetch('/api/mentor/status')
      .then((r) => (r.ok ? r.json() : { available: false }))
      .then(setStatus)
      .catch(() => setStatus({ available: false }));
  }, [open, status]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length, streaming, open]);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [open]);

  const push = (m: MentorMessage) =>
    update((p) => {
      const arr = (p.mentor[threadKey] ??= []);
      arr.push(m);
      if (arr.length > 40) arr.splice(0, arr.length - 40);
    });

  const send = async (text: string, forceSolution = false) => {
    if (!text.trim() || busy) return;
    const allowSolution = forceSolution || asksForSolution(text);
    if (allowSolution && ctx.task && !ctx.task.solved && !confirm('Ментор покажет готовое решение — за это задание будет 0 XP. Продолжить?')) return;
    setInput('');
    const userMsg: MentorMessage = { role: 'user', text, ts: Date.now() };
    push(userMsg);
    update((p) => p.stats.mentorQuestions++);
    if (allowSolution) ctx.onSolutionRevealed?.();
    const summary = progressSummary(progress);
    if (!status?.available) {
      push({ role: 'assistant', text: offlineAnswer(text, ctx, allowSolution, summary), ts: Date.now() });
      return;
    }
    setBusy(true);
    setStreaming('');
    const ac = new AbortController();
    abortRef.current = ac;
    let full = '';
    try {
      const res = await fetch('/api/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages.slice(-12), userMsg].map(({ role, text }) => ({ role, text })), context: publicContext(ctx, allowSolution), progress: summary, allowSolution }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += dec.decode(value, { stream: true });
        setStreaming(full);
      }
      push({ role: 'assistant', text: full.trim() || '…', ts: Date.now() });
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        if (full) push({ role: 'assistant', text: full + ' …', ts: Date.now() });
      } else {
        push({ role: 'assistant', text: `Не получилось связаться с Claude: ${(e as Error).message.slice(0, 300)}\n\n${offlineAnswer(text, ctx, allowSolution, summary)}`, ts: Date.now() });
      }
    } finally {
      setBusy(false);
      setStreaming('');
      abortRef.current = null;
    }
  };

  const where = ctx.task ? `Задание ${ctx.task.index}/${ctx.task.total} · ${ctx.lesson?.title}` : ctx.question ? `Мини-тест · ${ctx.lesson?.title}` : ctx.lesson ? `Урок · ${ctx.lesson.title}` : 'Общий чат';
  return (
    <>
      <button className={`mentor-fab ${open ? 'open' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="mentor-panel" title="Спросить ментора">
        <img src="/mentor.png" alt="" width={44} height={32} />
        <span className="sr-only">Ментор</span>
      </button>
      {open && (
        <aside id="mentor-panel" className="mentor-panel" aria-label="Чат с ментором">
          <header>
            <img src="/mentor.png" alt="" width={36} height={26} />
            <div>
              <strong>Ментор</strong>
              <div className="muted small">{where}</div>
            </div>
            <span className={`dot ${status?.available ? 'on' : 'off'}`} title={status?.available ? 'Claude подключён' : 'Офлайн-режим'} />
            <button className="btn ghost small" onClick={() => update((p) => delete p.mentor[threadKey])} title="Очистить этот чат">⟲</button>
            <button className="btn ghost small" onClick={() => setOpen(false)} aria-label="Закрыть">✕</button>
          </header>
          <div className="mentor-list" ref={listRef} aria-live="polite">
            {messages.length === 0 && (
              <div className="msg assistant">
                <Markdown text={`Привет, ${progress.profile.name}! Я вижу, где ты сейчас (${where.toLowerCase()}) и что уже прошёл. Спрашивай — буду наводить на решение. Готовый ответ дам, только если сам попросишь.${status && !status.available ? `\n\n_${OFFLINE_NOTE}_` : ''}`} safe />
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                <Markdown text={m.text} safe />
              </div>
            ))}
            {busy && (
              <div className="msg assistant">
                {streaming ? <Markdown text={streaming} safe /> : <span className="typing">думаю…</span>}
              </div>
            )}
          </div>
          <div className="chips">
            {(ctx.task || ctx.question ? CHIPS_TASK : CHIPS_GENERAL).map((c) => (
              <button key={c} className="chip btnlike" onClick={() => send(c, c === 'Покажи решение')} disabled={busy}>
                {c}
              </button>
            ))}
          </div>
          <form
            className="mentor-input"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Спроси ментора… (Enter — отправить)"
              rows={2}
              aria-label="Сообщение ментору"
            />
            {busy ? (
              <button type="button" className="btn small" onClick={() => abortRef.current?.abort()}>Стоп</button>
            ) : (
              <button className="btn primary small" disabled={!input.trim()}>➤</button>
            )}
          </form>
        </aside>
      )}
    </>
  );
}
