import { useEffect } from 'react';
import { modules } from '../content';
import { masteryView, overallReadiness } from '../game/mastery';
import { lessonStates, moduleStates, nextLesson, orderedModules, planItem } from '../game/unlock';
import { dueReviews } from '../game/review';
import { mentorContext } from '../mentor/context';
import { href } from '../state/router';
import { useStore } from '../state/store';
import { DEMAND_LABEL, ProgressBar, plural } from '../ui/common';

const MODE_LABEL = { full: 'полностью', partial: 'частично', exam: 'экзамен' } as const;

export function Home() {
  const { progress } = useStore();
  const states = moduleStates(modules, progress);
  const next = nextLesson(modules, progress);
  const due = dueReviews(progress).length;
  const readiness = overallReadiness(modules, progress);
  useEffect(() => mentorContext.set({ page: 'map' }), []);

  return (
    <div className="page">
      <section className="hero">
        <div>
          <h1>Карта обучения</h1>
          <p className="muted">Путь от тикета до первопричины. Готовность к роли L3: <strong className="neon">{readiness}%</strong></p>
        </div>
        <div className="hero-actions">
          {next && (
            <a className="btn primary big" href={href(`lesson/${next.moduleId}/${next.id}`)}>
              ▶ Продолжить: {next.title}
            </a>
          )}
          {due > 0 && <a className="btn" href={href('review')}>🔁 Повторить ({due})</a>}
        </div>
      </section>
      <ol className="path">
        {orderedModules(modules, progress).map((m, i) => {
          const st = states.get(m.id)!;
          const mv = masteryView(m, progress);
          const pi = planItem(progress, m.id);
          const ls = lessonStates(m, progress);
          return (
            <li key={m.id} className={`node node-${st}`}>
              <div className="node-dot" aria-hidden="true">{st === 'done' ? '✓' : st === 'locked' ? '🔒' : st === 'soon' ? '…' : i + 1}</div>
              <div className="node-card">
                <div className="node-head">
                  <span className="node-icon" aria-hidden="true">{m.icon}</span>
                  <div className="node-titles">
                    <h2>{m.title}</h2>
                    <span className="en">{m.titleEn}</span>
                  </div>
                  <div className="node-badges">
                    {pi && <span className={`chip mode-${pi.mode}`}>{MODE_LABEL[pi.mode]}</span>}
                    <span className={`chip demand-${m.demand}`} title={m.marketNote}>{DEMAND_LABEL[m.demand]}</span>
                  </div>
                </div>
                <p className="muted">{m.short}</p>
                <div className="node-mastery">
                  <ProgressBar value={mv.value} start={mv.start} label={`Освоение ${m.title}`} tone={mv.status === 'review-due' ? 'amber' : st === 'done' ? 'green' : 'cyan'} />
                  <span>{mv.value}%</span>
                </div>
                {st === 'soon' ? (
                  <details>
                    <summary>Что будет в модуле (контент готовится)</summary>
                    <p>{m.description}</p>
                    <ul className="topics">{m.topics.map((t) => <li key={t}>{t}</li>)}</ul>
                  </details>
                ) : (
                  <ul className="lessons">
                    {[...m.lessons, ...(m.boss ? [m.boss] : [])].map((l) => {
                      const s = ls.get(l.id)!;
                      const locked = st === 'locked' || s === 'locked';
                      return (
                        <li key={l.id} className={`lesson-item ls-${s} ${l.kind === 'boss' ? 'boss' : ''}`}>
                          {locked ? (
                            <span className="lesson-link disabled" aria-disabled="true">🔒 {l.title}</span>
                          ) : (
                            <a className="lesson-link" href={href(`lesson/${m.id}/${l.id}`)}>
                              {s === 'done' ? '✓' : l.kind === 'boss' ? '👹' : '○'} {l.title}
                              {s === 'skippable' && <span className="chip small">можно пропустить</span>}
                            </a>
                          )}
                          <span className="muted small">{l.minutes} мин</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {mv.reviewDue > 0 && <p className="note small">Пора повторить: {mv.reviewDue} {plural(mv.reviewDue, 'задание', 'задания', 'заданий')}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
