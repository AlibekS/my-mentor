import { useEffect, useState } from 'react';
import type { WriteSpec } from '../content/types';
import { checkRubric } from '../engine/rubric';
import { askMentor } from '../mentor/ask';
import { mentorContext } from '../mentor/context';

interface Props {
  spec: WriteSpec;
  taskPrompt: string;
  solved: boolean;
  onSolved: (text: string) => void;
  storageKey: string;
}

/** Редактор письменного ответа с живым чек-листом и разбором у ментора */
export function WriteBox({ spec, taskPrompt, solved, onSolved, storageKey }: Props) {
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(storageKey) ?? spec.template ?? '';
    } catch {
      return spec.template ?? '';
    }
  });
  const [tried, setTried] = useState(false);
  const res = checkRubric(text, spec);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, text);
    } catch {
      /* приватный режим */
    }
    mentorContext.set((c) => ({ ...c, draft: text }));
  }, [text, storageKey]);

  return (
    <div className="writebox">
      <label className="sr-only" htmlFor="write-area">Твой текст</label>
      <textarea id="write-area" className={spec.lang === 'en' ? '' : ''} lang={spec.lang ?? 'ru'} rows={spec.rows ?? 9} value={text} onChange={(e) => setText(e.target.value)} spellCheck placeholder={spec.lang === 'en' ? 'Write in English…' : 'Пиши здесь…'} disabled={solved} />
      <div className="rubric" aria-live="polite">
        {res.items.map((i) => (
          <span key={i.label} className={`rub ${i.ok ? 'ok' : tried ? 'miss' : ''}`}>{i.ok ? '✓' : '○'} {i.label}</span>
        ))}
        {spec.minWords ? <span className={`rub ${res.enoughWords ? 'ok' : tried ? 'miss' : ''}`}>{res.enoughWords ? '✓' : '○'} не меньше {spec.minWords} слов ({res.words})</span> : null}
      </div>
      {!solved && (
        <div className="row gap wrap">
          <button
            className="btn primary small"
            onClick={() => {
              setTried(true);
              if (res.ok) onSolved(text);
            }}
          >
            Проверить по чек-листу
          </button>
          <button
            className="btn ghost small"
            disabled={res.words < 5}
            onClick={() =>
              askMentor(`Разбери мой текст для задания: «${taskPrompt.replace(/[*`]/g, '').slice(0, 300)}». Что улучшить по содержанию и формулировкам${spec.lang === 'en' ? ' (английский — как для международной команды)' : ''}? Не переписывай целиком — укажи 2–4 конкретные правки.\n\n---\n${text}`)
            }
          >
            👾 Разбор ментором
          </button>
        </div>
      )}
      {tried && !res.ok && !solved && <p className="feedback bad small" role="status">Чек-лист ещё не закрыт — допиши отмеченные пункты.</p>}
    </div>
  );
}
