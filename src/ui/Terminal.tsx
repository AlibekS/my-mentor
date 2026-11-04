import { useEffect, useRef, useState } from 'react';
import { FsErr, errText } from '../shell/vfs';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type { Shell, RunOutput } from '../shell/shell';
import type { ExecRecord } from '../shell/types';

interface Props {
  shell: Shell;
  onExec?: (rec: ExecRecord, out: RunOutput) => void;
  banner?: string;
  /** Внешняя команда «вставить в строку» (например, из кнопки примера) */
  autoFocus?: boolean;
}

const THEME = {
  background: '#07080f',
  foreground: '#d7e0f5',
  cursor: '#00f0ff',
  cursorAccent: '#07080f',
  selectionBackground: '#00f0ff44',
  black: '#1a1d2e',
  red: '#ff4d6d',
  green: '#3dffa2',
  yellow: '#ffd166',
  blue: '#5aa9ff',
  magenta: '#ff3df2',
  cyan: '#00f0ff',
  white: '#d7e0f5',
  brightBlack: '#5b6178',
};

export function Terminal({ shell, onExec, banner, autoFocus }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const onExecRef = useRef(onExec);
  onExecRef.current = onExec;
  const bannerRef = useRef(banner);
  const [editing, setEditing] = useState<{ path: string; text: string } | null>(null);
  const termApi = useRef<{ write: (s: string) => void; prompt: () => void; focus: () => void } | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const term = new XTerm({
      fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, Menlo, Consolas, monospace',
      fontSize: 14,
      lineHeight: 1.25,
      cursorBlink: !reduce,
      theme: THEME,
      scrollback: 3000,
      convertEol: true,
      allowProposedApi: false,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host.current!);
    let disposed = false;
    const doFit = () => {
      if (disposed || !host.current?.offsetParent) return;
      try {
        fit.fit();
      } catch {
        /* скрытый контейнер */
      }
    };
    doFit();
    const ro = new ResizeObserver(() => requestAnimationFrame(doFit));
    ro.observe(host.current!);

    let buf = '';
    let cur = 0;
    let hIdx = -1;
    let draft = '';
    const promptStr = () => shell.prompt();
    const colorPrompt = () => {
      const p = promptStr();
      const m = /^(.*?@.*?):(.*)([$#] )$/.exec(p);
      return m ? `\x1b[1;32m${m[1]}\x1b[0m:\x1b[1;34m${m[2]}\x1b[0m${m[3]}` : p;
    };
    // строка ввода может переноситься на несколько экранных строк — помним, на какой строке курсор
    let cursorRow = 0;
    const visLen = (x: string) => x.replace(/\x1b\[[0-9;]*m/g, '').length;
    const redraw = () => {
      const cols = Math.max(10, term.cols);
      const p = colorPrompt();
      if (cursorRow > 0) term.write(`\x1b[${cursorRow}A`);
      term.write('\r\x1b[J' + p + buf);
      const plen = visLen(p);
      const endPos = plen + buf.length;
      const pos = plen + cur;
      // xterm переносит строку лениво: при endPos кратном cols курсор остаётся в конце строки
      const endRow = endPos > 0 && endPos % cols === 0 ? endPos / cols - 1 : Math.floor(endPos / cols);
      const row = Math.floor(pos / cols);
      const col = pos % cols;
      if (endRow > row) term.write(`\x1b[${endRow - row}A`);
      term.write(`\x1b[${col + 1}G`);
      cursorRow = row;
    };
    if (bannerRef.current) term.writeln(bannerRef.current);
    term.write(colorPrompt());

    const exec = () => {
      cur = buf.length;
      redraw();
      cursorRow = 0;
      term.write('\r\n');
      const line = buf;
      buf = '';
      cur = 0;
      hIdx = -1;
      if (line.trim()) {
        const out = shell.run(line);
        if (out.editFile) {
          const node = shell.fs.lookup(out.editFile);
          setEditing({ path: out.editFile, text: node && node.type === 'file' ? node.content : '' });
        }
        if (out.clear) term.clear();
        else if (out.output) term.write(out.output.replace(/\n/g, '\r\n'));
        const rec = shell.log[shell.log.length - 1];
        if (rec) onExecRef.current?.(rec, out);
      }
      term.write(colorPrompt());
    };

    const complete = () => {
      const before = buf.slice(0, cur);
      const { replaceFrom, options } = shell.complete(before);
      if (!options.length) return;
      if (options.length === 1) {
        const add = options[0] + (options[0].endsWith('/') ? '' : ' ');
        buf = before.slice(0, replaceFrom) + add + buf.slice(cur);
        cur = replaceFrom + add.length;
        redraw();
        return;
      }
      // общий префикс
      let pre = options[0];
      for (const o of options) while (!o.startsWith(pre)) pre = pre.slice(0, -1);
      if (pre.length > before.length - replaceFrom) {
        buf = before.slice(0, replaceFrom) + pre + buf.slice(cur);
        cur = replaceFrom + pre.length;
        redraw();
        return;
      }
      const keep = cur;
      cur = buf.length;
      redraw();
      cur = keep;
      cursorRow = 0;
      term.write('\r\n' + options.map((o) => o.replace(/.*\/(?=.)/, '')).join('  ') + '\r\n');
      redraw();
    };

    const disp = term.onData((data) => {
      // вставка нескольких строк
      if (data.length > 1 && !data.startsWith('\x1b')) {
        const parts = data.replace(/\r\n/g, '\n').split(/[\r\n]/);
        parts.forEach((part, i) => {
          buf = buf.slice(0, cur) + part + buf.slice(cur);
          cur += part.length;
          if (i < parts.length - 1) {
            redraw();
            exec();
          }
        });
        redraw();
        return;
      }
      switch (data) {
        case '\r':
          exec();
          return;
        case '\x7f':
        case '\b':
          if (cur > 0) {
            buf = buf.slice(0, cur - 1) + buf.slice(cur);
            cur--;
            redraw();
          }
          return;
        case '\x1b[3~':
          buf = buf.slice(0, cur) + buf.slice(cur + 1);
          redraw();
          return;
        case '\t':
          complete();
          return;
        case '\x03': // Ctrl+C
          cur = buf.length;
          redraw();
          cursorRow = 0;
          term.write('^C\r\n');
          buf = '';
          cur = 0;
          term.write(colorPrompt());
          return;
        case '\x0c': // Ctrl+L
          term.clear();
          cursorRow = 0;
          redraw();
          return;
        case '\x01':
        case '\x1b[H':
          cur = 0;
          redraw();
          return;
        case '\x05':
        case '\x1b[F':
          cur = buf.length;
          redraw();
          return;
        case '\x15': // Ctrl+U
          buf = buf.slice(cur);
          cur = 0;
          redraw();
          return;
        case '\x1b[A': {
          const h = shell.history;
          if (!h.length) return;
          if (hIdx === -1) {
            draft = buf;
            hIdx = h.length - 1;
          } else if (hIdx > 0) hIdx--;
          buf = h[hIdx];
          cur = buf.length;
          redraw();
          return;
        }
        case '\x1b[B': {
          const h = shell.history;
          if (hIdx === -1) return;
          if (hIdx < h.length - 1) {
            hIdx++;
            buf = h[hIdx];
          } else {
            hIdx = -1;
            buf = draft;
          }
          cur = buf.length;
          redraw();
          return;
        }
        case '\x1b[D':
          if (cur > 0) {
            cur--;
            redraw();
          }
          return;
        case '\x1b[C':
          if (cur < buf.length) {
            cur++;
            redraw();
          }
          return;
      }
      if (data.startsWith('\x1b')) return;
      const printable = data.replace(/[\x00-\x1f]/g, '');
      if (!printable) return;
      buf = buf.slice(0, cur) + printable + buf.slice(cur);
      cur += printable.length;
      redraw();
    });
    termApi.current = {
      write: (s2: string) => term.write(s2),
      prompt: () => {
        cursorRow = 0;
        term.write('\r\x1b[K' + colorPrompt());
      },
      focus: () => term.focus(),
    };
    if (autoFocus) term.focus();
    return () => {
      disposed = true;
      disp.dispose();
      ro.disconnect();
      // xterm 5.5 планирует syncScrollArea таймером после open(): dispose откладываем, чтобы не падать
      setTimeout(() => term.dispose(), 50);
    };
  }, [shell, autoFocus]);

  const close = (save: boolean) => {
    if (!editing) return;
    let msg = '';
    if (save) {
      try {
        shell.fs.write(editing.path, editing.text.endsWith('\n') || !editing.text ? editing.text : editing.text + '\n', shell.state.user);
        msg = `\x1b[2m[ Сохранено: ${editing.path} ]\x1b[0m`;
      } catch (e) {
        msg = `\x1b[31m[ Не удалось сохранить: ${e instanceof FsErr ? errText[e.code] : String(e)} ]\x1b[0m`;
      }
    } else msg = '\x1b[2m[ Изменения не сохранены ]\x1b[0m';
    termApi.current?.write('\r\x1b[K' + msg + '\r\n');
    termApi.current?.prompt();
    setEditing(null);
    setTimeout(() => termApi.current?.focus(), 0);
  };

  return (
    <div className="terminal-wrap">
      <div className="terminal-host" ref={host} role="region" aria-label="Эмулятор терминала. Введите команду и нажмите Enter." />
      {editing && (
        <div className="editor-overlay" role="dialog" aria-modal="true" aria-label={`Редактор ${editing.path}`}>
          <div className="editor-bar">
            <span className="mono">nano {editing.path}</span>
            <span className="muted small">Ctrl+S — сохранить и выйти · Esc — выйти без сохранения</span>
          </div>
          <textarea
            className="editor-area mono"
            value={editing.text}
            autoFocus
            spellCheck={false}
            onChange={(e) => setEditing({ ...editing, text: e.target.value })}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'o' || e.key === 'ы')) {
                e.preventDefault();
                close(true);
              } else if (e.key === 'Escape' || ((e.ctrlKey || e.metaKey) && e.key === 'x')) {
                e.preventDefault();
                close(false);
              } else if (e.key === 'Tab') {
                e.preventDefault();
                const t = e.currentTarget;
                const p = t.selectionStart;
                const v = editing.text.slice(0, p) + '  ' + editing.text.slice(t.selectionEnd);
                setEditing({ ...editing, text: v });
                requestAnimationFrame(() => t.setSelectionRange(p + 2, p + 2));
              }
            }}
          />
          <div className="editor-actions">
            <button className="btn primary small" onClick={() => close(true)}>Сохранить (Ctrl+S)</button>
            <button className="btn ghost small" onClick={() => close(false)}>Выйти без сохранения (Esc)</button>
          </div>
        </div>
      )}
    </div>
  );
}
