import { useEffect, useRef, useState } from 'react';
import { modules } from '../content';
import { ACHIEVEMENTS } from '../game/achievements';
import { levelProgress, rankForLevel } from '../game/levels';
import { masteryView, overallReadiness } from '../game/mastery';
import { exportProgress, importProgress } from '../game/progress';
import { moduleStates, nextLessonInModule, orderedModules } from '../game/unlock';
import { mentorContext } from '../mentor/context';
import { go, href } from '../state/router';
import { useStore } from '../state/store';
import { Avatar } from '../ui/Avatar';
import { ProgressBar, fmtDate } from '../ui/common';
import { RANKS } from '../game/config';

const STATUS_LABEL = { 'not-started': 'не начата', 'in-progress': 'в процессе', mastered: 'освоена', 'review-due': 'пора повторить' } as const;

export function Profile() {
  const { progress, update, replace, reset, toast, sync } = useStore();
  const lv = levelProgress(progress.xp);
  const rank = rankForLevel(lv.level);
  const readiness = overallReadiness(modules, progress);
  const states = moduleStates(modules, progress);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(progress.profile.name);
  useEffect(() => mentorContext.set({ page: 'profile' }), []);

  const s = progress.stats;
  const accuracy = s.quizAnswered ? Math.round((s.quizFirstTry / s.quizAnswered) * 100) : 0;
  const fav = Object.entries(s.commandCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const nextRank = RANKS.find((r) => r.minLevel > lv.level);

  const doExport = () => {
    const blob = new Blob([exportProgress(progress)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `l3-quest-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const doImport = async (f: File) => {
    try {
      replace(importProgress(await f.text()));
      toast({ kind: 'info', text: 'Прогресс импортирован' });
    } catch (e) {
      toast({ kind: 'error', text: `Не удалось импортировать: ${(e as Error).message}` });
    }
  };

  return (
    <div className="page profile">
      <section className="profile-top card">
        <div className="avatar-wrap"><Avatar stage={rank.id} size={150} title={`${rank.title}: ${rank.look}`} /></div>
        <div className="profile-main">
          <h1>{progress.profile.name}</h1>
          <div className="rank">{rank.title} <span className="en">({rank.titleEn})</span></div>
          <div className="level-row">
            <span className="lvl">Ур. {lv.level}</span>
            <ProgressBar value={lv.pct} tone="magenta" label="Прогресс уровня" />
            <span className="muted small">{lv.into}/{lv.need} XP</span>
          </div>
          <p className="muted small">Всего {progress.xp} XP{nextRank ? ` · следующий ранг «${nextRank.title}» на ${nextRank.minLevel} уровне` : ''}</p>
          <div className="readiness">Готовность к роли L3: <strong className="neon">{readiness}%</strong></div>
        </div>
      </section>

      <section className="card">
        <h2>Освоение тем</h2>
        <div className="mastery-list">
          {orderedModules(modules, progress).map((m) => {
            const mv = masteryView(m, progress);
            const next = nextLessonInModule(m, progress);
            const st = states.get(m.id);
            return (
              <div className="mastery-row" key={m.id}>
                <div className="mr-title"><span aria-hidden="true">{m.icon}</span> {m.title}</div>
                <div className="mr-bar">
                  <ProgressBar value={mv.value} start={mv.start} label={m.title} tone={mv.status === 'review-due' ? 'amber' : mv.status === 'mastered' ? 'green' : 'cyan'} />
                  <span className="mr-pct">{mv.value}%</span>
                </div>
                <div className="mr-meta small">
                  <span className={`status st-${mv.status}`}>{STATUS_LABEL[mv.status]}</span>
                  <span className="muted">старт {mv.start}%{mv.value > mv.start ? `, +${mv.value - mv.start}%` : ''}</span>
                </div>
                <div>
                  {mv.status === 'review-due' ? (
                    <a className="btn small" href={href('review')}>Повторить</a>
                  ) : st === 'open' && next ? (
                    <a className="btn small" href={href(`lesson/${m.id}/${next.id}`)}>Продолжить</a>
                  ) : st === 'soon' ? (
                    <span className="muted small">скоро</span>
                  ) : st === 'locked' ? (
                    <span className="muted small">🔒</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <h2>Статистика</h2>
          <div className="stats">
            <div className="stat"><span className="v">{s.tasksSolved}</span><span className="l">заданий решено</span></div>
            <div className="stat"><span className="v">{s.tasksNoHints}</span><span className="l">без подсказок</span></div>
            <div className="stat"><span className="v">{accuracy}%</span><span className="l">точность тестов</span></div>
            <div className="stat"><span className="v">{Math.round(s.timeMs / 60000)} мин</span><span className="l">время в уроках</span></div>
            <div className="stat"><span className="v">{progress.streak.current} 🔥</span><span className="l">серия (рекорд {progress.streak.best})</span></div>
            <div className="stat"><span className="v">{s.commandsRun}</span><span className="l">команд выполнено</span></div>
          </div>
          {fav.length > 0 && (
            <>
              <h3>Любимые команды</h3>
              <div className="chips">{fav.map(([c, n]) => <span className="chip mono" key={c}>{c} ×{n}</span>)}</div>
            </>
          )}
        </div>
        <div className="card">
          <h2>История</h2>
          {progress.history.length ? (
            <ul className="history">
              {progress.history.slice(0, 12).map((h, i) => (
                <li key={i}><span className="muted small">{fmtDate(h.ts)}</span> {h.text} {h.xp ? <span className="xp">+{h.xp}</span> : null}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">Пока пусто — начни первый урок.</p>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Ачивки <span className="muted small">{Object.keys(progress.achievements).length}/{ACHIEVEMENTS.length}</span></h2>
        <div className="badges">
          {ACHIEVEMENTS.map((a) => {
            const got = progress.achievements[a.id];
            return (
              <div key={a.id} className={`badge ${got ? 'got' : 'locked'}`} title={got ? `Получено ${fmtDate(got)}` : a.hint}>
                <span className="b-icon" aria-hidden="true">{got ? a.icon : '🔒'}</span>
                <span className="b-title">{a.title}</span>
                <span className="b-hint">{got ? fmtDate(got) : a.hint}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>Ранги</h2>
        <div className="ranks">
          {RANKS.map((r) => (
            <div key={r.id} className={`rank-item ${r.id <= rank.id ? 'got' : ''}`}>
              <Avatar stage={r.id} size={48} title={r.title} />
              <div><strong>{r.title}</strong><div className="muted small">с {r.minLevel} ур. · {r.look}</div></div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Настройки</h2>
        <form className="row gap wrap" onSubmit={(e) => { e.preventDefault(); update((p) => (p.profile.name = name.trim() || 'Алибек')); toast({ kind: 'info', text: 'Имя сохранено' }); }}>
          <label htmlFor="pname">Имя</label>
          <input id="pname" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn small">Сохранить</button>
        </form>
        <div className="row gap wrap">
          <button className="btn" onClick={() => update((p) => (p.profile.theme = p.profile.theme === 'dark' ? 'light' : 'dark'))}>
            Тема: {progress.profile.theme === 'dark' ? 'тёмная' : 'светлая'}
          </button>
          <a className="btn" href={href('plan')}>Твоя программа</a>
          <button className="btn" onClick={() => confirm('Пройти онбординг заново? Программа пересоберётся, XP и ачивки сохранятся.') && (update((p) => (p.onboarding = { done: false })), go('onboarding'))}>
            Пройти онбординг заново
          </button>
        </div>
        <div className="row gap wrap">
          <button className="btn" onClick={doExport}>⬇ Экспорт прогресса (JSON)</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>⬆ Импорт из JSON</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
          <button className="btn danger" onClick={() => confirm('Сбросить ВЕСЬ прогресс? Копия «до сброса» останется в папке backups рядом с файлом прогресса.') && confirm('Точно сбросить?') && (reset(), go('onboarding'))}>
            Сбросить прогресс
          </button>
        </div>
        <p className="small muted" role="status">
          {sync.kind === 'ok' ? (
            <>💾 Прогресс сохраняется в файл <code>{sync.dir}{sync.dir.includes('\\') ? '\\' : '/'}progress.json</code>{sync.savedAt ? ` · последнее сохранение ${new Date(sync.savedAt).toLocaleString('ru-RU')}` : ''}. Ежедневные копии — в папке <code>backups</code> рядом.</>
          ) : sync.kind === 'error' ? (
            <span className="stale">⚠ Не удалось сохранить в файл{sync.dir ? ` (${sync.dir})` : ''}: {sync.error}. Прогресс пока хранится только в браузере.</span>
          ) : sync.kind === 'off' ? (
            <>Прогресс хранится только в браузере: {sync.reason}. Запускай сайт через <code>npm run dev</code> или <code>start.bat</code>, чтобы он сохранялся в файл.</>
          ) : null}
        </p>
      </section>
    </div>
  );
}
