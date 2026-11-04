import { useEffect, useMemo, useRef, useState } from 'react';
import { lessonByKey, moduleById } from '../content';
import type { Lesson, Module, Task } from '../content/types';
import { evaluate } from '../engine/checks';
import { checkAnswer } from '../engine/normalize';
import { answerQuestion, completeLesson, ensureLesson, giveUpQuestion, recordCommand, showSolution, solveTask, useHint } from '../game/actions';
import { masteryView } from '../game/mastery';
import { canOpenLesson, nextLessonInModule } from '../game/unlock';
import { mentorContext } from '../mentor/context';
import { Shell } from '../shell/shell';
import type { ExecRecord } from '../shell/types';
import { go, href } from '../state/router';
import { useStore } from '../state/store';
import { Markdown } from '../ui/Markdown';
import { QuestionCard } from '../ui/QuestionCard';
import { Terminal } from '../ui/Terminal';
import { SqlConsole } from '../ui/SqlConsole';
import { gradeSql, resultText, type QueryResult } from '../sql/engine';
import { ProgressBar, plural } from '../ui/common';

/** Запуск SQL-запроса как запись истории (для статистики и ментора) */
export function sqlRecord(query: string, r: QueryResult): ExecRecord {
  return { line: query.trim(), commands: ['sql'], pipes: 0, stdout: r.ok ? resultText(r) : '', stderr: r.ok ? '' : r.error, exitCode: r.ok ? 0 : 1 };
}

type Step = 'theory' | 'practice' | 'quiz' | 'summary';
const STEPS: { id: Step; label: string }[] = [
  { id: 'theory', label: 'Теория' },
  { id: 'practice', label: 'Практика' },
  { id: 'quiz', label: 'Мини-тест' },
  { id: 'summary', label: 'Итоги' },
];

export function LessonPage({ moduleId, lessonId, step = 'theory' }: { moduleId: string; lessonId: string; step?: string }) {
  const { progress } = useStore();
  const module = moduleById.get(moduleId);
  const lesson = lessonByKey.get(`${moduleId}/${lessonId}`);
  const s = (STEPS.some((x) => x.id === step) ? step : 'theory') as Step;

  useEffect(() => {
    if (!module || !lesson) return;
    // эффекты родителя выполняются после дочерних — поэтому сливаем, а не перезаписываем
    mentorContext.set((c) => ({
      ...(!c.lesson || c.lesson.key === lesson.key ? c : { page: 'lesson' }),
      page: 'lesson',
      module: { id: module.id, title: module.title },
      lesson: { key: lesson.key, title: lesson.title, kind: lesson.kind, theory: lesson.theory },
      step: s,
    }));
  }, [module, lesson, s]);

  if (!module || !lesson) return <div className="page"><h1>Урок не найден</h1><a href={href('')}>На карту</a></div>;
  if (!canOpenLesson(module, lesson, progress))
    return (
      <div className="page narrow">
        <h1>🔒 Урок пока закрыт</h1>
        <p>Сначала пройди предыдущие уроки модуля «{module.title}». Порядок можно изменить в «Твоей программе».</p>
        <a className="btn primary" href={href('')}>На карту</a>
      </div>
    );

  const base = `lesson/${module.id}/${lesson.id}`;
  return (
    <div className={`lesson-page ${lesson.kind === 'boss' ? 'boss' : ''}`}>
      <header className="lesson-head">
        <div>
          <a href={href('')} className="crumb">← {module.icon} {module.title}</a>
          <h1>{lesson.kind === 'boss' ? '👹 Босс: ' : ''}{lesson.title}</h1>
        </div>
        <nav className="stepper" aria-label="Этапы урока">
          {STEPS.map((st, i) => (
            <a key={st.id} href={href(`${base}/${st.id}`)} className={st.id === s ? 'active' : ''} aria-current={st.id === s ? 'step' : undefined}>
              <span className="num">{i + 1}</span> {st.label}
            </a>
          ))}
        </nav>
      </header>
      {s === 'theory' && <TheoryStep module={module} lesson={lesson} base={base} />}
      {s === 'practice' && <PracticeStep module={module} lesson={lesson} base={base} />}
      {s === 'quiz' && <QuizStep module={module} lesson={lesson} base={base} />}
      {s === 'summary' && <SummaryStep module={module} lesson={lesson} />}
    </div>
  );
}

function IncidentCard({ lesson }: { lesson: Lesson }) {
  if (!lesson.incident) return null;
  return (
    <div className="incident">
      <span className={`sev ${lesson.incident.severity}`}>{lesson.incident.severity}</span>
      <div>
        <strong>{lesson.incident.ticket}</strong>
        <div className="muted">Клиент: {lesson.incident.customer}</div>
      </div>
    </div>
  );
}

function useTimeTracking(lesson: Lesson) {
  const { update } = useStore();
  useEffect(() => {
    const t0 = Date.now();
    return () => {
      const dt = Math.min(Date.now() - t0, 3 * 3600e3);
      if (dt < 3000) return;
      update((p) => {
        ensureLesson(p, lesson).timeMs += dt;
        p.stats.timeMs += dt;
      });
    };
  }, [lesson, update]);
}

function TheoryStep({ module, lesson, base }: { module: Module; lesson: Lesson; base: string }) {
  const [tab, setTab] = useState<'theory' | 'term'>('theory');
  const shell = useMemo(() => new Shell(lesson.scenario), [lesson]);
  const { update } = useStore();
  useTimeTracking(lesson);
  useEffect(() => mentorContext.set((c) => ({ ...c, step: 'theory', task: undefined, question: undefined, terminal: undefined })), []);
  return (
    <>
      <div className="mobile-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'theory'} onClick={() => setTab('theory')}>Теория</button>
        <button role="tab" aria-selected={tab === 'term'} onClick={() => setTab('term')}>Терминал</button>
      </div>
      <div className="split">
        <section className={`pane theory ${tab === 'theory' ? 'show' : ''}`}>
          <IncidentCard lesson={lesson} />
          <Markdown text={lesson.theory || '_Теория для этого урока ещё пишется._'} />
          {lesson.glossary?.length ? (
            <div className="glossary">
              <h3>Мини-глоссарий RU / EN</h3>
              <dl>
                {lesson.glossary.map((g) => (
                  <div key={g.en}>
                    <dt>{g.ru} <span className="en">({g.en})</span></dt>
                    <dd>{g.def}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
          <div className="pane-footer">
            <a className="btn primary" href={href(`${base}/practice`)}>К практике →</a>
          </div>
        </section>
        <section className={`pane term ${tab === 'term' ? 'show' : ''}`}>
          <div className="term-title">Песочница — пробуй {lesson.sql ? 'запросы' : 'команды'} из теории. Здесь ничего не проверяется.</div>
          {lesson.sql ? (
            <SqlConsole dataset={lesson.sql.dataset} onRun={(q, r) => update((p) => recordCommand(p, sqlRecord(q, r), module.id))} />
          ) : (
            <Terminal shell={shell} banner={'\x1b[2mПесочница урока. help — список команд, man <команда> — справка.\x1b[0m'} onExec={(rec) => update((p) => recordCommand(p, rec, module.id))} />
          )}
        </section>
      </div>
    </>
  );
}

function PracticeStep({ module, lesson, base }: { module: Module; lesson: Lesson; base: string }) {
  const { progress, update } = useStore();
  const lp = progress.lessons[lesson.key];
  const firstUnsolved = Math.max(0, lesson.tasks.findIndex((t) => !lp?.tasks[t.id]?.solved));
  const [idx, setIdx] = useState(firstUnsolved);
  const [tab, setTab] = useState<'task' | 'theory'>('task');
  const [resetN, setResetN] = useState(0);
  const task = lesson.tasks[idx];
  const tp = lp?.tasks[task?.id ?? ''];
  // задания без своего сценария делят одно окружение урока (как на реальном сервере)
  const envKey = task?.scenario ? task.id : 'lesson';
  const shell = useMemo(() => new Shell(task?.scenario ?? lesson.scenario), [envKey, lesson, resetN]); // eslint-disable-line react-hooks/exhaustive-deps
  const [answer, setAnswer] = useState('');
  const [answerState, setAnswerState] = useState<'idle' | 'bad'>('idle');
  const termLog = useRef<ExecRecord[]>([]);
  useTimeTracking(lesson);

  useEffect(() => {
    termLog.current = [];
    setAnswer('');
    setAnswerState('idle');
  }, [task, resetN]);

  // общее окружение: если нужное состояние уже достигнуто раньше (например, сервис поднят) — засчитываем
  useEffect(() => {
    if (task && !tp?.solved && task.check && !task.answer && evaluate(task.check, shell, null)) solve([]);
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // контекст для ментора
  useEffect(() => {
    if (!task) return;
    mentorContext.set((c) => ({
      ...c,
      page: 'lesson',
      step: 'practice',
      task: { id: task.id, prompt: task.prompt, hints: task.hints, solution: task.solution, explanation: task.explanation, index: idx + 1, total: lesson.tasks.length, hintsUsed: tp?.hintsUsed ?? 0, solved: !!tp?.solved },
      question: undefined,
      onSolutionRevealed: () => update((p) => showSolution(p, lesson, task.id)),
      nextHint: () => {
        const used = tp?.hintsUsed ?? 0;
        if (tp?.solved || used >= task.hints.length) return null;
        update((p) => useHint(p, lesson, task.id));
        return task.hints[used];
      },
    }));
  }, [task, idx, tp?.hintsUsed, tp?.solved, lesson, update]);

  if (!lesson.tasks.length) {
    return (
      <div className="page narrow">
        <p>В этом уроке нет заданий в терминале.</p>
        <a className="btn primary" href={href(`${base}/quiz`)}>К мини-тесту →</a>
      </div>
    );
  }

  const solve = (commands: string[]) => update((p) => solveTask(p, module, lesson, task.id, commands));

  const onExec = (rec: ExecRecord) => {
    termLog.current.push(rec);
    mentorContext.set((c) => ({ ...c, terminal: termLog.current.slice(-8).map((r) => ({ line: r.line, output: (r.stdout + r.stderr).slice(0, 600), exitCode: r.exitCode })) }));
    update((p) => recordCommand(p, rec, module.id));
    if (!tp?.solved && task.check && !task.answer && evaluate(task.check, shell, rec)) solve(rec.commands);
  };

  const [sqlFeedback, setSqlFeedback] = useState<string | null>(null);
  useEffect(() => setSqlFeedback(null), [task, resetN]);
  const onSql = async (query: string, r: QueryResult) => {
    const rec = sqlRecord(query, r);
    termLog.current.push(rec);
    mentorContext.set((c) => ({ ...c, terminal: termLog.current.slice(-8).map((x) => ({ line: x.line, output: (x.stdout + x.stderr).slice(0, 800), exitCode: x.exitCode })) }));
    update((p) => recordCommand(p, rec, module.id));
    if (tp?.solved || task.answer || !lesson.sql) return;
    const g = await gradeSql(lesson.sql.dataset, query, task.solution, task.sqlOrdered);
    if (g.ok) {
      setSqlFeedback(null);
      solve(['sql']);
    } else if (r.ok && r.columns.length) setSqlFeedback(g.reason ?? null);
  };

  const submitAnswer = () => {
    if (!task.answer) return;
    if (checkAnswer(answer, task.answer)) {
      const cmds = [...new Set(termLog.current.flatMap((r) => r.commands))];
      solve(cmds);
    } else {
      setAnswerState('bad');
      update((p) => (ensureLesson(p, lesson).tasks[task.id] ??= { solved: false, hintsUsed: 0, solutionShown: false, attempts: 0, xp: 0 }).attempts++);
    }
  };

  const allSolved = lesson.tasks.every((t) => progress.lessons[lesson.key]?.tasks[t.id]?.solved);
  const hintsUsed = tp?.hintsUsed ?? 0;
  return (
    <>
      <div className="mobile-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'task'} onClick={() => setTab('task')}>Задание</button>
        <button role="tab" aria-selected={tab === 'theory'} onClick={() => setTab('theory')}>Теория</button>
      </div>
      <div className="split">
        <section className={`pane theory ${tab === 'theory' ? 'show' : ''}`}>
          <IncidentCard lesson={lesson} />
          <Markdown text={lesson.theory} />
        </section>
        <section className={`pane term ${tab === 'task' ? 'show' : ''}`}>
          <div className="task-tabs" role="tablist" aria-label="Задания">
            {lesson.tasks.map((t, i) => (
              <button key={t.id} role="tab" aria-selected={i === idx} className={`${i === idx ? 'active' : ''} ${progress.lessons[lesson.key]?.tasks[t.id]?.solved ? 'solved' : ''}`} onClick={() => setIdx(i)}>
                {progress.lessons[lesson.key]?.tasks[t.id]?.solved ? '✓' : i + 1}
              </button>
            ))}
            <button className="btn ghost small reset" onClick={() => setResetN((n) => n + 1)} title="Вернуть окружение задания в исходное состояние">↺ Сбросить окружение</button>
          </div>
          <div className="task-panel">
            <Markdown text={`**Задание ${idx + 1}/${lesson.tasks.length}.** ${task.prompt}`} />
            {task.answer && !tp?.solved && (
              <form className="answer-row" onSubmit={(e) => { e.preventDefault(); submitAnswer(); }}>
                <label htmlFor="task-answer">{task.answer.label ?? 'Ответ:'}</label>
                <input id="task-answer" value={answer} onChange={(e) => { setAnswer(e.target.value); setAnswerState('idle'); }} placeholder={task.answer.placeholder ?? 'Введи ответ после исследования'} autoComplete="off" spellCheck={false} />
                <button className="btn primary" disabled={!answer.trim()}>Проверить</button>
              </form>
            )}
            {answerState === 'bad' && <p className="feedback bad" role="status">Не совпадает. Перепроверь в терминале.</p>}
            {tp?.solved ? (
              <div className="feedback ok" role="status">
                <strong>Решено! +{tp.xp} XP</strong>
                {task.explanation && <Markdown text={task.explanation} />}
                <details><summary>Эталонное решение</summary><pre className="mono">{task.solution}</pre></details>
                {idx < lesson.tasks.length - 1 ? (
                  <button className="btn primary" onClick={() => setIdx(idx + 1)} autoFocus>Следующее задание →</button>
                ) : allSolved ? (
                  <a className="btn primary" href={href(`${base}/quiz`)}>К мини-тесту →</a>
                ) : (
                  <button className="btn" onClick={() => setIdx(lesson.tasks.findIndex((t) => !progress.lessons[lesson.key]?.tasks[t.id]?.solved))}>К нерешённому заданию</button>
                )}
              </div>
            ) : (
              <div className="hints">
                {task.hints.slice(0, hintsUsed).map((h, i) => (
                  <div className="hint" key={i}><span className="hint-n">Подсказка {i + 1}</span> <Markdown text={h} /></div>
                ))}
                <div className="hint-actions">
                  {hintsUsed < task.hints.length && !tp?.solutionShown && (
                    <button className="btn ghost small" onClick={() => update((p) => useHint(p, lesson, task.id))}>
                      💡 Подсказка {hintsUsed + 1}/{task.hints.length} <span className="muted">(XP {hintsUsed === 0 ? '30→20' : '→10'})</span>
                    </button>
                  )}
                  {!tp?.solutionShown ? (
                    <button className="btn ghost small" onClick={() => confirm('Показать решение? За задание будет 0 XP, и оно попадёт в повторение.') && update((p) => showSolution(p, lesson, task.id))}>
                      👁 Показать решение
                    </button>
                  ) : (
                    <div className="solution"><span className="muted">Решение (набери его сам — так запоминается):</span><pre className="mono">{task.solution}</pre></div>
                  )}
                </div>
              </div>
            )}
          </div>
          {sqlFeedback && !tp?.solved && <p className="feedback bad small" role="status">Пока не совпадает с ожидаемым: {sqlFeedback}</p>}
          {lesson.sql ? (
            <SqlConsole dataset={lesson.sql.dataset} onRun={onSql} resetKey={resetN} />
          ) : (
          <Terminal key={`${envKey}-${resetN}`} shell={shell} onExec={onExec} autoFocus banner={`\x1b[2m${lesson.kind === 'boss' ? 'Инцидент в процессе — действуй как L3.' : 'Окружение урока.'} help — список команд, man <команда> — справка.\x1b[0m`} />
          )}
        </section>
      </div>
    </>
  );
}

function QuizStep({ module, lesson, base }: { module: Module; lesson: Lesson; base: string }) {
  const { progress, update } = useStore();
  const lp = progress.lessons[lesson.key];
  const done = (id: string) => !!lp?.quiz[id] && (lp.quiz[id].correct || lp.quiz[id].attempts >= 2);
  const [idx, setIdx] = useState(() => Math.max(0, lesson.quiz.findIndex((q) => !done(q.id))));
  useTimeTracking(lesson);
  const q = lesson.quiz[idx];
  const tasksDone = lesson.tasks.every((t) => lp?.tasks[t.id]?.solved);

  useEffect(() => {
    if (!q) return;
    mentorContext.set((c) => ({ ...c, step: 'quiz', task: undefined, question: { id: q.id, prompt: q.prompt, explanation: q.explanation, solution: q.type === 'command' || q.type === 'sql' ? q.solution : q.type === 'text' ? q.answer.accept[0] : q.options[q.correct] } }));
  }, [q]);

  const finish = () => {
    update((p) => {
      completeLesson(p, module, lesson);
    });
    go(`${base}/summary`);
  };

  if (!lesson.quiz.length) {
    return <div className="page narrow"><button className="btn primary" onClick={finish} disabled={!tasksDone}>Завершить урок</button></div>;
  }
  const allDone = lesson.quiz.every((x) => done(x.id));
  return (
    <div className="page narrow quiz">
      <div className="quiz-head">
        <span>Вопрос {Math.min(idx + 1, lesson.quiz.length)} из {lesson.quiz.length}</span>
        <ProgressBar value={(lesson.quiz.filter((x) => done(x.id)).length / lesson.quiz.length) * 100} label="Прогресс теста" />
      </div>
      {!tasksDone && <p className="note">⚠️ Не все задания в практике решены — урок засчитается, когда решишь их и пройдёшь тест.</p>}
      {q && (
        <QuestionCard
          key={q.id}
          q={q}
          dataset={lesson.sql?.dataset}
          solved={lp?.quiz[q.id]?.correct}
          onAttempt={(ok, n) =>
            update((p) => {
              answerQuestion(p, module, lesson, q.id, ok);
              if (!ok && n >= 2) giveUpQuestion(p, lesson, q.id);
            })
          }
          onNext={idx < lesson.quiz.length - 1 ? () => setIdx(idx + 1) : undefined}
        />
      )}
      {allDone && (
        <div className="quiz-finish">
          <button className="btn primary big" onClick={finish} disabled={!tasksDone}>
            {lesson.kind === 'boss' ? '⚔️ Закрыть инцидент' : 'Завершить урок'} →
          </button>
          {!tasksDone && <a href={href(`${base}/practice`)}>Вернуться к заданиям</a>}
        </div>
      )}
    </div>
  );
}

function SummaryStep({ module, lesson }: { module: Module; lesson: Lesson }) {
  const { progress } = useStore();
  const lp = progress.lessons[lesson.key];
  useEffect(() => {
    mentorContext.set((c) => ({ ...c, step: 'summary', task: undefined, question: undefined }));
  }, []);
  if (!lp?.completedAt) {
    return (
      <div className="page narrow">
        <h2>Урок ещё не завершён</h2>
        <p>Реши задания и пройди мини-тест.</p>
        <a className="btn primary" href={href(`lesson/${module.id}/${lesson.id}/practice`)}>К практике</a>
      </div>
    );
  }
  const mv = masteryView(module, progress);
  const before = lp.masteryBefore ?? mv.start;
  const mistakesTasks = lesson.tasks.filter((t: Task) => (lp.tasks[t.id]?.hintsUsed ?? 0) > 0 || lp.tasks[t.id]?.solutionShown);
  const mistakesQuiz = lesson.quiz.filter((q) => !lp.quiz[q.id]?.firstTry);
  const next = nextLessonInModule(module, progress);
  const noHints = lesson.tasks.every((t) => !lp.tasks[t.id]?.hintsUsed && !lp.tasks[t.id]?.solutionShown);
  return (
    <div className="page narrow summary">
      <h2>{lesson.kind === 'boss' ? '⚔️ Инцидент закрыт!' : '✅ Урок пройден'}</h2>
      <div className="summary-grid">
        <div className="stat big"><span className="v">+{lp.xp}</span><span className="l">XP за урок</span></div>
        <div className="stat big"><span className="v">{before}% → {mv.value}%</span><span className="l">освоение темы «{module.title}» (+{Math.max(0, mv.value - before)}%)</span></div>
        <div className="stat big"><span className="v">{Math.round(lp.timeMs / 60000)} мин</span><span className="l">время</span></div>
      </div>
      <ProgressBar value={mv.value} start={mv.start} label="Освоение темы" />
      {noHints && lesson.tasks.length > 0 && <p className="praise">Ни одной подсказки — отлично 💪</p>}
      {(mistakesTasks.length > 0 || mistakesQuiz.length > 0) && (
        <div className="card">
          <h3>Что повторить</h3>
          <ul>
            {mistakesTasks.map((t) => (
              <li key={t.id}>Задание: {t.prompt.replace(/[*`]/g, '').slice(0, 90)}… — {lp.tasks[t.id]?.solutionShown ? 'смотрел решение' : `${lp.tasks[t.id]?.hintsUsed} ${plural(lp.tasks[t.id]?.hintsUsed ?? 0, 'подсказка', 'подсказки', 'подсказок')}`}</li>
            ))}
            {mistakesQuiz.map((q) => (
              <li key={q.id}>Вопрос: {q.prompt.replace(/[*`]/g, '').slice(0, 90)}…</li>
            ))}
          </ul>
          <p className="muted">Ошибки уже добавлены в раздел «Повторение» — вернись к ним завтра.</p>
        </div>
      )}
      <div className="row gap">
        {next ? <a className="btn primary big" href={href(`lesson/${module.id}/${next.id}`)}>{next.kind === 'boss' ? '👹 К боссу модуля' : 'Следующий урок'} →</a> : <a className="btn primary big" href={href('')}>На карту →</a>}
        <a className="btn" href={href('profile')}>Профиль</a>
      </div>
    </div>
  );
}
