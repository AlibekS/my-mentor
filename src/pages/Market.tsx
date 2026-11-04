import { useEffect } from 'react';
import trends from '../../content/market/trends.json';
import { modules } from '../content';
import { MARKET_FRESH_DAYS } from '../game/config';
import { mentorContext } from '../mentor/context';
import { DEMAND_LABEL } from '../ui/common';

type Trend = { name: string; category: string; demand: 'rising' | 'stable' | 'declining'; note: string; inCourse?: string };

export function Market() {
  useEffect(() => mentorContext.set({ page: 'market' }), []);
  const ageDays = Math.floor((Date.now() - Date.parse(trends.updatedAt)) / 86400e3);
  const stale = ageDays > MARKET_FRESH_DAYS;
  const items = trends.items as Trend[];
  const groups = ['rising', 'stable', 'declining'] as const;
  return (
    <div className="page">
      <h1>Рынок и актуальность</h1>
      <p className="muted">
        Чтобы не учить то, что уходит. Данные обновлены: <strong>{new Date(trends.updatedAt).toLocaleDateString('ru-RU')}</strong> ({ageDays} дн. назад) · источники — в <code>docs/curriculum-sources.md</code>.
      </p>
      {stale && (
        <div className="note">
          ⚠️ Данным больше {MARKET_FRESH_DAYS} дней. Обнови их: открой проект в Claude Code и выполни <code>/refresh-curriculum</code> — Claude проверит свежие вакансии, обновит тренды, даты сверки модулей и предложит новые уроки.
        </div>
      )}
      <p>{trends.summary}</p>
      <div className="trend-cols">
        {groups.map((g) => (
          <section key={g} className={`card trend-col t-${g}`}>
            <h2>{DEMAND_LABEL[g]}</h2>
            <ul>
              {items.filter((t) => t.demand === g).map((t) => (
                <li key={t.name}>
                  <strong>{t.name}</strong> <span className="chip small">{t.category}</span>
                  <p className="small">{t.note}</p>
                  {t.inCourse && <p className="small muted">В курсе: {t.inCourse}</p>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <section className="card">
        <h2>Сверка модулей с рынком</h2>
        <table className="table">
          <thead><tr><th>Модуль</th><th>Спрос</th><th>Сверено</th><th>Комментарий</th></tr></thead>
          <tbody>
            {modules.map((m) => (
              <tr key={m.id}>
                <td>{m.icon} {m.title}</td>
                <td><span className={`chip demand-${m.demand}`}>{DEMAND_LABEL[m.demand]}</span></td>
                <td className={Date.now() - Date.parse(m.reviewedAt) > MARKET_FRESH_DAYS * 86400e3 ? 'stale' : ''}>{new Date(m.reviewedAt).toLocaleDateString('ru-RU')}</td>
                <td className="small">{m.marketNote}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
