import { useEffect, useMemo, useState } from 'react';
import { lessonByKey, moduleById } from '../content';
import type { Question, Task } from '../content/types';
import { evaluate } from '../engine/checks';
import { checkAnswer } from '../engine/normalize';
import { completeReview, recordCommand } from '../game/actions';
import { dueReviews } from '../game/review';
import { mentorContext } from '../mentor/context';
import { Shell } from '../shell/shell';
import { useStore } from '../state/store';
import { Markdown } from '../ui/Markdown';
import { QuestionCard } from '../ui/QuestionCard';
import { Terminal } from '../ui/Terminal';
import { SqlConsole } from '../ui/SqlConsole';
import { gradeSql } from '../sql/engine';
import { fmtDate } from '../ui/common';

export function Review() {
  const { progress, update } = useStore();
  const due = dueReviews(progress);
  const upcoming = Object.values(progress.review).filter((r) => r.due > Date.now()).sort((a, b) => a.due - b.due);
  const [cur, setCur] = useState(0);
  useEffect(() => mentorContext.set({ page: 'review' }), []);
  const item = due[Math.min(cur, due.length - 1)];
  const lesson = item && lessonByKey.get(item.lessonKey);
  const module = lesson && moduleById.get(lesson.moduleId);

  const finish = (ok: boolean) => {
    update((p) => completeReview(p, module, item.key, ok));
    setCur(0);
  };

  return (
    <div className="page narrow">
      <h1>Повторение</h1>
      <p className="muted">Простое интервальное повторение: задания с ошибками и подсказками возвращаются через 1, 3, 7, 14, 30 и 60 дней.</p>
      {!item || !lesson ? (
        <div className="card">
          <p>🎉 На сегодня повторять нечего.</p>
          {upcoming.length > 0 && (
            <>
              <h3>Ближайшие</h3>
              <ul>{upcoming.slice(0, 8).map((r) => <li key={r.key}>{lessonByKey.get(r.lessonKey)?.title} — {fmtDate(r.due)}</li>)}</ul>
            </>
          )}
        </div>
      ) : (
        <div>
          <p className="small muted">Осталось на сегодня: {due.length} · из урока «{lesson.title}»</p>
          {item.kind === 'question' ? (
            <ReviewQuestion key={item.key} q={lesson.quiz.find((x) => x.id === item.itemId)} dataset={lesson.sql?.dataset} onDone={finish} />
          ) : (
            <ReviewTask key={item.key} task={lesson.tasks.find((t) => t.id === item.itemId)} scenario={lesson.scenario} dataset={lesson.sql?.dataset} moduleId={lesson.moduleId} onDone={finish} />
          )}
        </div>
      )}
    </div>
  );
}

function ReviewQuestion({ q, onDone, dataset }: { q?: Question; onDone: (ok: boolean) => void; dataset?: string }) {
  const [ok, setOk] = useState(false);
  if (!q) return <button className="btn" onClick={() => onDone(true)}>Пропустить (вопрос удалён)</button>;
  return <QuestionCard q={q} dataset={dataset} maxAttempts={1} onAttempt={(r) => setOk(r)} onNext={() => onDone(ok)} />;
}

function ReviewTask({ task, scenario, moduleId, onDone, dataset }: { task?: Task; scenario: object; moduleId: string; onDone: (ok: boolean) => void; dataset?: string }) {
  const { update } = useStore();
  const shell = useMemo(() => new Shell(task?.scenario ?? scenario), [task, scenario]);
  const [solved, setSolved] = useState(false);
  const [ans, setAns] = useState('');
  const [showSol, setShowSol] = useState(false);
  if (!task) return <button className="btn" onClick={() => onDone(true)}>Пропустить (задание удалено)</button>;
  return (
    <div className="card">
      <Markdown text={task.prompt} />
      {task.answer && !solved && (
        <form className="answer-row" onSubmit={(e) => { e.preventDefault(); if (checkAnswer(ans, task.answer!)) setSolved(true); }}>
          <input value={ans} onChange={(e) => setAns(e.target.value)} placeholder="Ответ" aria-label="Ответ" />
          <button className="btn primary">Проверить</button>
        </form>
      )}
      {solved ? (
        <div className="feedback ok">
          <strong>Верно!</strong>
          <button className="btn primary" onClick={() => onDone(!showSol)} autoFocus>Дальше →</button>
        </div>
      ) : (
        <div className="row gap">
          {!showSol ? <button className="btn ghost small" onClick={() => setShowSol(true)}>Показать решение</button> : <pre className="mono">{task.solution}</pre>}
          <button className="btn ghost small" onClick={() => onDone(false)}>Не помню — повторить позже</button>
        </div>
      )}
      {dataset ? (
        <SqlConsole
          dataset={dataset}
          onRun={async (q) => {
            if (task.answer) return;
            if ((await gradeSql(dataset, q, task.solution, task.sqlOrdered)).ok) setSolved(true);
          }}
        />
      ) : (
      <div className="term-box">
        <Terminal
          shell={shell}
          onExec={(rec) => {
            update((p) => recordCommand(p, rec, moduleId));
            if (task.check && !task.answer && evaluate(task.check, shell, rec)) setSolved(true);
          }}
        />
      </div>
      )}
    </div>
  );
}
