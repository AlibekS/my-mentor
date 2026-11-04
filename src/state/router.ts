import { useEffect, useState } from 'react';

/** Мини-роутер на hash: #/lesson/01-l3-role/01-levels */
export function useRoute(): string[] {
  const get = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [route, setRoute] = useState(get);
  useEffect(() => {
    const on = () => {
      setRoute(get());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(path: string) {
  window.location.hash = '#/' + path.replace(/^\//, '');
}

export function href(path: string) {
  return '#/' + path.replace(/^\//, '');
}
