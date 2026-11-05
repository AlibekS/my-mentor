import { useEffect, useMemo, useState } from 'react';
import { allModules as modules } from '../content';
import { registry } from '../shell/registry';
import { mentorContext } from '../mentor/context';
import { useStore } from '../state/store';

export function Reference() {
  const { progress } = useStore();
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  useEffect(() => mentorContext.set({ page: 'reference' }), []);
  const studied = useMemo(() => {
    const done = new Set<string>();
    for (const m of modules) for (const l of [...m.lessons, ...(m.boss ? [m.boss] : [])]) if (progress.lessons[l.key]) for (const c of l.commands ?? []) done.add(c);
    for (const c of Object.keys(progress.stats.commandCounts)) if (registry.has(c)) done.add(c);
    return done;
  }, [progress]);
  const cmds = [...registry.values()]
    .filter((c) => all || studied.has(c.name))
    .filter((c) => !q || c.name.includes(q.toLowerCase()) || c.summary.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  const glossary = modules
    .flatMap((m) => [...m.lessons, ...(m.boss ? [m.boss] : [])].flatMap((l) => l.glossary ?? []))
    .filter((g, i, arr) => arr.findIndex((x) => x.en === g.en) === i)
    .filter((g) => !q || (g.ru + g.en + g.def).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.ru.localeCompare(b.ru, 'ru'));
  return (
    <div className="page">
      <h1>Справочник</h1>
      <div className="row gap wrap">
        <input className="search" type="search" placeholder="Поиск: grep, SLA, root cause…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Поиск по справочнику" />
        <label className="row gap small"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> показать все команды тренажёра</label>
      </div>
      <section>
        <h2>Команды {all ? '' : '(которые ты уже пробовал)'}</h2>
        {cmds.length === 0 && <p className="muted">Пока пусто — команды появятся по мере прохождения уроков.</p>}
        <div className="cheats">
          {cmds.map((c) => (
            <div className="cheat card" key={c.name}>
              <code className="mono neon">{c.name}</code>
              <p>{c.summary}</p>
              {c.usage && <pre className="mono small">{c.usage}</pre>}
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2>Глоссарий RU / EN</h2>
        <dl className="gloss">
          {glossary.map((g) => (
            <div key={g.en}>
              <dt>{g.ru} <span className="en">— {g.en}</span></dt>
              <dd>{g.def}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
