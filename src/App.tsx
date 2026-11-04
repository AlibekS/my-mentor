import { useEffect } from 'react';
import { useRoute, href, go } from './state/router';
import { useStore } from './state/store';
import { levelProgress, rankForLevel } from './game/levels';
import { RANKS } from './game/config';
import { dueReviews } from './game/review';
import { Avatar } from './ui/Avatar';
import { Modal, ProgressBar } from './ui/common';
import { MentorWidget } from './mentor/MentorWidget';
import { Home } from './pages/Home';
import { LessonPage } from './pages/LessonPage';
import { Onboarding } from './pages/Onboarding';
import { PlanView } from './pages/PlanView';
import { Profile } from './pages/Profile';
import { Reference } from './pages/Reference';
import { Review } from './pages/Review';
import { Market } from './pages/Market';

export function App() {
  const route = useRoute();
  const { progress, toasts, dismissToast, rankUp, ackRankUp } = useStore();
  const onboarded = progress.onboarding.done;
  const [page, ...rest] = route;

  useEffect(() => {
    if (!onboarded && page !== 'onboarding') go('onboarding');
  }, [onboarded, page]);

  const lv = levelProgress(progress.xp);
  const rank = rankForLevel(lv.level);
  const due = dueReviews(progress).length;

  let content;
  if (!onboarded) content = <Onboarding />;
  else if (page === 'lesson') content = <LessonPage moduleId={rest[0]} lessonId={rest[1]} step={rest[2]} key={rest.slice(0, 2).join('/')} />;
  else if (page === 'profile') content = <Profile />;
  else if (page === 'plan') content = <PlanView />;
  else if (page === 'reference') content = <Reference />;
  else if (page === 'review') content = <Review />;
  else if (page === 'market') content = <Market />;
  else if (page === 'onboarding') content = <Onboarding />;
  else content = <Home />;

  const nav = [
    { id: '', label: 'Карта' },
    { id: 'review', label: `Повторение${due ? ` (${due})` : ''}` },
    { id: 'reference', label: 'Справочник' },
    { id: 'market', label: 'Рынок' },
    { id: 'profile', label: 'Профиль' },
  ];
  const active = page ?? '';
  return (
    <div className="app">
      <a className="skip" href="#main">К содержимому</a>
      <header className="topbar">
        <a className="logo" href={href('')}>
          <span className="logo-mark">L3</span> Quest
        </a>
        {onboarded && (
          <nav aria-label="Основная навигация">
            {nav.map((n) => (
              <a key={n.id} href={href(n.id)} className={active === n.id || (n.id === '' && active === 'lesson') ? 'active' : ''} aria-current={active === n.id ? 'page' : undefined}>
                {n.label}
              </a>
            ))}
          </nav>
        )}
        {onboarded && (
          <a className="mini-profile" href={href('profile')} title={`${rank.title}, уровень ${lv.level}`}>
            <Avatar stage={rank.id} size={26} />
            <div className="mp-text">
              <span>Ур. {lv.level} · {rank.title}</span>
              <ProgressBar value={lv.pct} tone="magenta" label="XP до следующего уровня" />
            </div>
          </a>
        )}
      </header>
      <main id="main">{content}</main>
      <MentorWidget />
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <button key={t.id} className={`toast toast-${t.kind}`} onClick={() => dismissToast(t.id)}>
            {t.icon && <span aria-hidden="true">{t.icon}</span>} {t.text}
          </button>
        ))}
      </div>
      {rankUp && (
        <Modal onClose={ackRankUp} label="Новый ранг">
          <div className="rankup">
            <div className="evolve">
              <div className="evo-old"><Avatar stage={rankUp - 1} size={110} /></div>
              <div className="evo-arrow" aria-hidden="true">➜</div>
              <div className="evo-new"><Avatar stage={rankUp} size={130} /></div>
            </div>
            <h2>Новый ранг: {RANKS[rankUp - 1].title}</h2>
            <p className="muted">{RANKS[rankUp - 1].titleEn} · {RANKS[rankUp - 1].look}</p>
            <button className="btn primary big" onClick={ackRankUp}>Вперёд!</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
