import { useState } from 'react';
import { grade, kindOf, type Gradable } from '../engine/evaluateQuestion';
import { Markdown } from './Markdown';

interface Props {
  q: Gradable & { prompt: string; explanation?: string; hint?: string };
  /** вызывается после каждой попытки */
  onAttempt: (ok: boolean, attempt: number) => void;
  maxAttempts?: number;
  allowSkip?: boolean;
  onSkip?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  /** не показывать правильный ответ (входной тест) */
  hideAnswer?: boolean;
  /** уже решён ранее */
  solved?: boolean;
  /** в состоянии «верно» сразу переходить дальше */
  autoNext?: boolean;
}

export function QuestionCard({ q, onAttempt, maxAttempts = 2, allowSkip, onSkip, onNext, nextLabel = 'Дальше →', hideAnswer, solved, autoNext }: Props) {
  const [input, setInput] = useState('');
  const [choice, setChoice] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<'idle' | 'ok' | 'bad' | 'failed'>(solved ? 'ok' : 'idle');
  const [output, setOutput] = useState<string>();
  const kind = kindOf(q);

  const submit = () => {
    const val = kind === 'choice' ? String(choice ?? '') : input;
    if (!val.trim()) return;
    const n = attempt + 1;
    const r = grade(q, val);
    setAttempt(n);
    setOutput(r.output);
    onAttempt(r.ok, n);
    if (r.ok) {
      setState('ok');
      if (autoNext) onNext?.();
    } else setState(n >= maxAttempts ? 'failed' : 'bad');
  };

  const finished = state === 'ok' || state === 'failed';
  return (
    <div className={`qcard qcard-${state}`}>
      <Markdown text={q.prompt} className="qprompt" />
      {kind === 'choice' ? (
        <fieldset className="choices" disabled={finished}>
          <legend className="sr-only">Варианты ответа</legend>
          {q.options!.map((o, i) => (
            <label key={i} className={`choice ${choice === i ? 'sel' : ''}`}>
              <input type="radio" name={`q-${q.prompt.length}`} checked={choice === i} onChange={() => setChoice(i)} />
              <span>{o}</span>
            </label>
          ))}
        </fieldset>
      ) : (
        <form
          className="answer-row"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="sr-only" htmlFor="qinput">
            Ответ
          </label>
          <input
            id="qinput"
            className={kind === 'command' ? 'mono' : ''}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={finished}
            autoComplete="off"
            spellCheck={false}
            placeholder={kind === 'command' ? '$ введите команду' : q.answer?.placeholder ?? 'Ваш ответ'}
            autoFocus
          />
        </form>
      )}
      {output && kind === 'command' && <pre className="cmd-output">{output.replace(/\x1b\[[0-9;]*m/g, '').slice(0, 1200)}</pre>}
      {state === 'bad' && (
        <p className="feedback bad" role="status">
          Пока не то. Попробуй ещё раз{q.hint ? <> — подсказка: {q.hint}</> : '.'}
        </p>
      )}
      {state === 'ok' && (
        <div className="feedback ok" role="status">
          <strong>Верно!</strong>
          {q.explanation && !hideAnswer && <Markdown text={q.explanation} />}
        </div>
      )}
      {state === 'failed' && (
        <div className="feedback bad" role="status">
          {hideAnswer ? (
            <span>Засчитано как пробел — программа это учтёт.</span>
          ) : (
            <>
              <strong>Не получилось — разберём:</strong>
              {q.explanation && <Markdown text={q.explanation} />}
              <p className="muted">Вопрос попадёт в «Повторение».</p>
            </>
          )}
        </div>
      )}
      <div className="qactions">
        {!finished && (
          <button className="btn primary" onClick={submit} disabled={kind === 'choice' ? choice === null : !input.trim()}>
            Проверить
          </button>
        )}
        {!finished && allowSkip && (
          <button className="btn ghost" onClick={onSkip}>
            Не знаю
          </button>
        )}
        {finished && onNext && !autoNext && (
          <button className="btn primary" onClick={onNext} autoFocus>
            {nextLabel}
          </button>
        )}
      </div>
    </div>
  );
}
