import { useEffect, useMemo, useState } from 'react';
import { modules, placementTopics } from '../content';
import type { PlacementQuestion } from '../content/types';
import { PLACEMENT } from '../game/config';
import { answerTopic, buildPlan, maxQuestions, nextQuestion, startTopic, topicResult, type TopicRun } from '../game/placement';
import type { GeneralLevel, SelfLevel, Survey } from '../game/progress';
import { mentorContext } from '../mentor/context';
import { Shell } from '../shell/shell';
import { go } from '../state/router';
import { useStore } from '../state/store';
import { Avatar } from '../ui/Avatar';
import { Markdown } from '../ui/Markdown';
import { QuestionCard } from '../ui/QuestionCard';
import { Terminal } from '../ui/Terminal';
import { ProgressBar } from '../ui/common';

const GENERAL: { id: GeneralLevel; label: string }[] = [
  { id: 'newbie', label: 'Новичок в поддержке' },
  { id: 'l1', label: 'Работал на L1' },
  { id: 'l2', label: 'Работал на L2' },
  { id: 'sysadmin', label: 'Сисадмин без опыта L3' },
  { id: 'l3', label: 'Уже работаю на L3' },
];

const SELF: { id: SelfLevel; label: string }[] = [
  { id: 'none', label: 'Не знаю совсем' },
  { id: 'heard', label: 'Слышал, не применял' },
  { id: 'hints', label: 'С подсказками' },
  { id: 'confident', label: 'Уверенно' },
  { id: 'unknown', label: 'Не знаю, проверьте меня' },
];

/** Значения самооценки по умолчанию в зависимости от общего уровня */
const DEFAULTS: Record<GeneralLevel, SelfLevel> = { newbie: 'none', l1: 'heard', l2: 'hints', sysadmin: 'hints', l3: 'confident' };

export function Onboarding() {
  const { progress, update } = useStore();
  const [stage, setStage] = useState<'welcome' | 'survey' | 'test' | 'done'>('welcome');
  const [survey, setSurvey] = useState<Survey>(() => progress.onboarding.survey ?? { general: 'sysadmin', topics: Object.fromEntries(modules.map((m) => [m.id, DEFAULTS.sysadmin])), minutesPerDay: 30 });
  useEffect(() => mentorContext.set({ page: 'onboarding' }), []);

  if (stage === 'welcome')
    return (
      <div className="page narrow onboarding">
        <div className="welcome">
          <Avatar stage={1} size={120} />
          <div>
            <h1>Привет, {progress.profile.name}! Это L3 Quest.</h1>
            <p>Тренажёр, который готовит к роли <strong>L3 Support / Production Support Engineer</strong> в международной компании: от тикета клиента до первопричины (root cause).</p>
            <p>Сначала соберём персональную программу — это займёт ~10 минут:</p>
            <ol>
              <li><strong>Опрос</strong> — как ты сам оцениваешь свои навыки (3–5 минут).</li>
              <li><strong>Входной тест</strong> — 2–4 вопроса по каждой теме, ответы вводятся руками. «Не знаю» — не штраф, а честный сигнал.</li>
              <li><strong>Твоя программа</strong> — порядок модулей, стартовые проценты и срок.</li>
            </ol>
            <p className="muted">Справа внизу живёт ментор 👾 — его можно спросить о чём угодно по ходу.</p>
            <button className="btn primary big" onClick={() => setStage('survey')} autoFocus>Начать →</button>
          </div>
        </div>
      </div>
    );

  if (stage === 'survey')
    return (
      <SurveyStep
        survey={survey}
        setSurvey={setSurvey}
        onDone={() => {
          update((p) => (p.onboarding.survey = survey));
          setStage('test');
        }}
      />
    );

  if (stage === 'test')
    return (
      <PlacementStep
        survey={survey}
        onDone={(runs) => {
          const results = runs.map(topicResult);
          const plan = buildPlan(modules, results, placementTopics, survey);
          update((p) => {
            p.onboarding = { done: true, survey, results };
            p.plan = plan;
            for (const r of results) p.masteryBest[r.moduleId] = Math.max(p.masteryBest[r.moduleId] ?? 0, r.startPct);
          });
          go('plan');
        }}
      />
    );
  return null;
}

function SurveyStep({ survey, setSurvey, onDone }: { survey: Survey; setSurvey: (s: Survey) => void; onDone: () => void }) {
  const set = (patch: Partial<Survey>) => setSurvey({ ...survey, ...patch });
  const answered = modules.filter((m) => survey.topics[m.id]).length;
  return (
    <div className="page narrow onboarding">
      <h1>Шаг 1 из 3. Опрос</h1>
      <section className="card">
        <h2>Твой общий уровень</h2>
        <div className="seg">
          {GENERAL.map((g) => (
            <label key={g.id} className={`seg-item ${survey.general === g.id ? 'sel' : ''}`}>
              <input
                type="radio"
                name="general"
                checked={survey.general === g.id}
                onChange={() => set({ general: g.id, topics: Object.fromEntries(modules.map((m) => [m.id, survey.topics[m.id] ?? DEFAULTS[g.id]])) })}
              />
              {g.label}
            </label>
          ))}
        </div>
      </section>
      <section className="card">
        <h2>Самооценка по темам <span className="muted small">{answered}/{modules.length}</span></h2>
        <p className="muted small">Примеры навыков помогут оценить честно. Сомневаешься — выбери «проверьте меня», тему определит тест.</p>
        {modules.map((m) => (
          <fieldset key={m.id} className="topic-q">
            <legend>
              <span aria-hidden="true">{m.icon}</span> {m.title} <span className="en">({m.titleEn})</span>
            </legend>
            <ul className="skills">{m.skills.map((s) => <li key={s}><Markdown text={s} /></li>)}</ul>
            <div className="seg small">
              {SELF.map((s) => (
                <label key={s.id} className={`seg-item ${survey.topics[m.id] === s.id ? 'sel' : ''}`}>
                  <input type="radio" name={`t-${m.id}`} checked={survey.topics[m.id] === s.id} onChange={() => set({ topics: { ...survey.topics, [m.id]: s.id } })} />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </section>
      <section className="card">
        <h2>Цель и темп</h2>
        <div className="seg">
          {[15, 30, 60, 90].map((n) => (
            <label key={n} className={`seg-item ${survey.minutesPerDay === n ? 'sel' : ''}`}>
              <input type="radio" name="pace" checked={survey.minutesPerDay === n} onChange={() => set({ minutesPerDay: n })} />
              {n === 90 ? '90+ мин' : `${n} мин`} в день
            </label>
          ))}
        </div>
        <label className="row gap">
          К какой дате хочу быть готов к собеседованию (необязательно):
          <input type="date" value={survey.targetDate ?? ''} onChange={(e) => set({ targetDate: e.target.value || undefined })} />
        </label>
      </section>
      <div className="row gap">
        <button className="btn primary big" disabled={answered < modules.length} onClick={onDone}>
          К входному тесту →
        </button>
        {answered < modules.length && <span className="muted">Оцени все темы ({modules.length - answered} осталось)</span>}
      </div>
    </div>
  );
}

function PlacementStep({ survey, onDone }: { survey: Survey; onDone: (runs: TopicRun[]) => void }) {
  const topics = useMemo(() => modules.map((m) => ({ m, topic: placementTopics.find((t) => t.moduleId === m.id) })).filter((x) => x.topic && x.topic.questions.length), []);
  const [runs, setRuns] = useState<TopicRun[]>(() => topics.map(({ m }) => startTopic(m.id, survey.topics[m.id] ?? 'unknown')));
  const [ti, setTi] = useState(0);
  const [qn, setQn] = useState(0); // счётчик для key
  const cur = topics[ti];
  const run = runs[ti];
  const q = cur && run && !run.done ? nextQuestion(run, cur.topic!) : null;

  // переход к следующей теме, когда текущая завершена
  useEffect(() => {
    if (!cur) {
      onDone(runs);
      return;
    }
    if (!q) setTi((i) => i + 1);
  }, [cur, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const asked = runs.reduce((s, r) => s + r.answers.length, 0);
  const expected = runs.reduce((s, r, i) => s + (i < ti ? r.answers.length : i === ti ? Math.max(r.answers.length, Math.min(2, maxQuestions(r.self))) : Math.min(2, maxQuestions(r.self))), 0);
  const remainingSec = Math.max(0, expected - asked) * PLACEMENT.secondsPerQuestion;

  const answer = (question: PlacementQuestion, ok: boolean, skipped = false) => {
    setRuns((rs) => rs.map((r, i) => (i === ti ? answerTopic(r, question, ok, skipped) : r)));
    setQn((n) => n + 1);
  };

  if (!cur || !q) return <div className="page narrow"><p>Считаем результаты…</p></div>;
  return (
    <div className="page narrow onboarding">
      <h1>Шаг 2 из 3. Входной тест</h1>
      <div className="quiz-head">
        <span>Тема {ti + 1}/{topics.length}: <strong>{cur.m.icon} {cur.m.title}</strong></span>
        <ProgressBar value={(asked / Math.max(expected, 1)) * 100} label="Прогресс теста" />
        <span className="muted small">≈ {Math.ceil(remainingSec / 60)} мин осталось</span>
      </div>
      <p className="muted small">Сложность: {'●'.repeat(q.difficulty)}{'○'.repeat(3 - q.difficulty)} · не знаешь — жми «Не знаю», это честный сигнал для программы.</p>
      {q.scenario && q.answer ? (
        <PlacementTerminalTask key={qn} q={q} onResult={(ok, skipped) => answer(q, ok, skipped)} />
      ) : (
        <QuestionCard key={qn} q={{ ...q, hint: undefined }} dataset={q.dataset} maxAttempts={1} hideAnswer allowSkip onSkip={() => answer(q, false, true)} onAttempt={(ok) => setTimeout(() => answer(q, ok), ok ? 500 : 900)} />
      )}
    </div>
  );
}

function PlacementTerminalTask({ q, onResult }: { q: PlacementQuestion; onResult: (ok: boolean, skipped: boolean) => void }) {
  const shell = useMemo(() => new Shell(q.scenario), [q]);
  return (
    <div className="placement-term">
      <QuestionCard q={{ prompt: q.prompt, answer: q.answer }} maxAttempts={1} hideAnswer allowSkip onSkip={() => onResult(false, true)} onAttempt={(ok) => setTimeout(() => onResult(ok, false), ok ? 500 : 900)} />
      <div className="term-box">
        <Terminal shell={shell} banner={'\x1b[2mИсследуй сервер, затем введи ответ выше.\x1b[0m'} />
      </div>
    </div>
  );
}
