import { useEffect } from 'react';
import { currentTrack, TRACK_INFO, trackModules, trackPlan } from '../game/tracks';
import { finalizePlan, moduleMinutes, planMode } from '../game/placement';
import type { PlanItem } from '../game/progress';
import { mentorContext } from '../mentor/context';
import { go, href } from '../state/router';
import { useStore } from '../state/store';
import { ProgressBar, fmtMinutes, plural } from '../ui/common';

const MODE = {
  full: { label: 'полностью', desc: 'все уроки' },
  partial: { label: 'частично', desc: 'уроки с пробелами + босс' },
  exam: { label: 'экзамен', desc: 'освоена на входе — только босс' },
} as const;
const SELF_LABEL: Record<string, string> = { none: 'не знаю', heard: 'слышал', hints: 'с подсказками', confident: 'уверенно', unknown: 'проверьте меня' };

export function PlanView() {
  const { progress, update } = useStore();
  const track = currentTrack(progress);
  const modules = trackModules(progress);
  const plan = trackPlan(progress);
  useEffect(() => mentorContext.set({ page: 'plan' }), []);
  if (!plan) {
    return (
      <div className="page narrow">
        <h1>Программы пока нет</h1>
        <a className="btn primary" href={href('onboarding')}>Пройти онбординг</a>
      </div>
    );
  }
  const results = track === 'l3' ? progress.onboarding.results ?? [] : [];
  const edit = (fn: (items: PlanItem[]) => PlanItem[]) =>
    update((p) => {
      const cur = (track === 'l2' ? p.l2Plan : p.plan)!;
      const next = { ...finalizePlan(modules, fn(structuredClone(cur.items)), cur.minutesPerDay, cur.targetDate), createdAt: cur.createdAt };
      if (track === 'l2') p.l2Plan = next;
      else p.plan = next;
    });
  const move = (i: number, d: -1 | 1) => edit((items) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return items;
    [items[i], items[j]] = [items[j], items[i]];
    return items;
  });
  const adjust = (i: number, delta: number) => edit((items) => {
    const it = items[i];
    it.startPct = Math.max(0, Math.min(100, it.startPct + delta));
    it.mode = planMode(it.startPct);
    if (it.mode !== 'partial') it.skippable = [];
    return items;
  });
  const eta = new Date(Date.now() + plan.etaDays * 86400e3);
  const late = plan.targetDate && eta > new Date(plan.targetDate);
  return (
    <div className="page plan">
      <h1>Твоя программа · {TRACK_INFO[track].title}</h1>
      <div className="plan-summary card">
        <div className="stat big"><span className="v">{fmtMinutes(plan.totalMinutes)}</span><span className="l">всего обучения</span></div>
        <div className="stat big"><span className="v">≈ {plan.etaDays} {plural(plan.etaDays, 'день', 'дня', 'дней')}</span><span className="l">при {plan.minutesPerDay} мин в день</span></div>
        <div className="stat big"><span className="v">{eta.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span><span className="l">ожидаемая дата готовности</span></div>
      </div>
      {late && <p className="note">⚠️ К цели {new Date(plan.targetDate!).toLocaleDateString('ru-RU')} не успеваем — увеличь темп или переведи хорошо знакомые темы в «экзамен».</p>}
      <ol className="plan-list">
        {plan.items.map((it, i) => {
          const m = modules.find((x) => x.id === it.moduleId)!;
          const r = results.find((x) => x.moduleId === it.moduleId);
          return (
            <li key={it.moduleId} className="card plan-item">
              <div className="pi-head">
                <span className="pi-num">{i + 1}</span>
                <span aria-hidden="true">{m.icon}</span>
                <strong>{m.title}</strong>
                <span className={`chip mode-${it.mode}`} title={MODE[it.mode].desc}>{MODE[it.mode].label}</span>
                {m.status !== 'ready' && <span className="chip">контент готовится</span>}
                <span className="muted small">{fmtMinutes(moduleMinutes(m, it))}</span>
              </div>
              <div className="pi-bar"><ProgressBar value={it.startPct} label={`Старт ${m.title}`} /> <span>{it.startPct}%</span></div>
              {r && (
                <p className="small muted">
                  Самооценка: {SELF_LABEL[r.self]}{r.testPct !== null ? `, тест: ${r.testPct}%` : ', без теста'}
                  {r.mismatch && <span className="mismatch"> — {r.testPct! < 50 ? 'рекомендуем пройти тему полностью' : 'ты знаешь больше, чем думаешь'}</span>}
                </p>
              )}
              {it.skippable.length > 0 && <p className="small">Можно пропустить (подтверждено тестом): {it.skippable.map((id) => m.lessons.find((l) => l.id === id)?.title ?? id).join(', ')}</p>}
              <div className="pi-actions">
                <button className="btn small ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Выше">↑</button>
                <button className="btn small ghost" onClick={() => move(i, 1)} disabled={i === plan.items.length - 1} aria-label="Ниже">↓</button>
                <button className="btn small ghost" onClick={() => adjust(i, -10)}>−10%</button>
                <button className="btn small ghost" onClick={() => adjust(i, 10)}>+10%</button>
                {m.status === 'ready' && (
                  <button className="btn small ghost" onClick={() => edit((items) => ((items[i].forceUnlocked = !items[i].forceUnlocked), items))}>
                    {it.forceUnlocked ? '🔓 открыт вручную' : 'Открыть раньше'}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="row gap">
        <button className="btn primary big" onClick={() => go('')}>Начать обучение →</button>
        <span className="muted small">Порядок и проценты можно менять кнопками выше — это и есть «Изменить вручную».</span>
      </div>
    </div>
  );
}
