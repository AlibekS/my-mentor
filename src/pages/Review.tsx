import { useEffect, useMemo, useState } from 'react';
import { lessonByKey, moduleById } from '../content';
import { taskTool, type Lesson, type Question, type Task, type Tool } from '../content/types';
import { shellForTask } from '../engine/replay';
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
import { WriteBox } from '../ui/WriteBox';
import { SqlConsole } from '../ui/SqlConsole';
import { gradeSql } from '../sql/engine';
import { ObsConsole } from '../ui/ObsConsole';
import type { ObsDataset } from '../obs/types';
import { evalQuery, sameResult } from '../obs/promql';
import { searchLogs } from '../obs/kql';
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
            <ReviewQuestion key={item.key} q={lesson.quiz.find((x) => x.id === item.itemId)} dataset={lesson.sql?.dataset} obs={lesson.obs} onDone={finish} />
          ) : (
            <ReviewTask key={item.key} task={lesson.tasks.find((t) => t.id === item.itemId)} lesson={lesson} dataset={lesson.sql?.dataset} obs={lesson.obs} tool={lesson.tasks.find((t) => t.id === item.itemId) ? taskTool(lesson, lesson.tasks.find((t) => t.id === item.itemId)!) : 'terminal'} moduleId={lesson.moduleId} onDone={finish} />
          )}
        </div>
      )}
    </div>
  );
}

function ReviewQuestion({ q, onDone, dataset, obs }: { q?: Question; onDone: (ok: boolean) => void; dataset?: string; obs?: ObsDataset }) {
  const [ok, setOk] = useState(false);
  if (!q) return <button className="btn" onClick={() => onDone(true)}>Пропустить (вопрос удалён)</button>;
  return <QuestionCard q={q} dataset={dataset} obs={obs} maxAttempts={1} onAttempt={(r) => setOk(r)} onNext={() => onDone(ok)} />;
}

function ReviewTask({ task, lesson, moduleId, onDone, dataset, obs, tool }: { task?: Task; lesson: Lesson; moduleId: string; onDone: (ok: boolean) => void; dataset?: string; obs?: ObsDataset; tool: Tool }) {
  const { update } = useStore();
  // задание из общего окружения урока: сначала применяем предыдущие шаги (иначе, например, «перезапусти сервис» не пройдёт)
  const { shell, replayed } = useMemo(() => (task ? shellForTask(lesson, task) : { shell: new Shell(lesson.scenario), replayed: [] as number[] }), [task, lesson]);
  const [solved, setSolved] = useState(false);
  const [ans, setAns] = useState('');
  const [showSol, setShowSol] = useState(false);
  if (!task) return <button className="btn" onClick={() => onDone(true)}>Пропустить (задание удалено)</button>;
  return (
    <div className="card">
      <Markdown text={task.prompt} />
      {task.write && !solved && <WriteBox spec={task.write} taskPrompt={task.prompt} solved={false} storageKey={`l3quest.review.${task.id}`} onSolved={() => setSolved(true)} />}
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
      {tool === 'obs' && obs ? (
        <ObsConsole
          ds={obs}
          onQuery={(kind, q) => {
            if (task.answer || task.obs !== kind) return;
            if (kind === 'promql' && sameResult(evalQuery(q, obs), evalQuery(task.solution, obs)).ok) setSolved(true);
            if (kind === 'logs' && searchLogs(obs.logs ?? [], q).hits.length === searchLogs(obs.logs ?? [], task.solution).hits.length) setSolved(true);
          }}
        />
      ) : tool === 'sql' && dataset ? (
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
          banner={replayed.length ? `\x1b[2mПредыдущие шаги урока (${replayed.join(', ')}) уже выполнены.\x1b[0m` : undefined}
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
