import { useMemo } from 'react';
import { Marked } from 'marked';

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Контент курса — наш собственный (из репозитория). */
const trusted = new Marked({ gfm: true });

/** Внешний текст (ответы ментора): сырой HTML экранируется, ссылки только http(s) */
const untrusted = new Marked({
  gfm: true,
  renderer: {
    html(token) {
      return escapeHtml(token.text);
    },
  },
});

export function Markdown({ text, className, safe }: { text: string; className?: string; safe?: boolean }) {
  const html = useMemo(() => {
    if (!safe) return trusted.parse(text, { async: false }) as string;
    return (untrusted.parse(text, { async: false }) as string)
      .replace(/<img[^>]*>/gi, '')
      .replace(/href="(?!https?:)[^"]*"/gi, 'href="#"')
      .replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
  }, [text, safe]);
  return <div className={'md ' + (className ?? '')} dangerouslySetInnerHTML={{ __html: html }} />;
}
