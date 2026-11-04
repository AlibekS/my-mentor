import type { Plugin, Connect } from 'vite';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { MENTOR_SYSTEM, buildPrompt, validateRequest } from './mentor-prompt';

/**
 * Ментор на базе Claude. Работает внутри dev/preview-сервера Vite (отдельный бэкенд не нужен).
 *
 * Вызывает локальный Claude Code CLI (`claude -p`), поэтому используется ваш вход в Claude Code:
 * подписка Pro/Max (через `claude` → /login) или ANTHROPIC_API_KEY, если он задан.
 *
 * Переменные окружения:
 *   MENTOR_CLAUDE_BIN — путь к claude (по умолчанию "claude")
 *   MENTOR_MODEL      — модель (по умолчанию — модель Claude Code по умолчанию)
 *   MENTOR_DISABLED=1 — выключить ментора (останется офлайн-режим)
 */
const BIN = process.env.MENTOR_CLAUDE_BIN || 'claude';
let statusCache: { available: boolean; detail: string; at: number } | null = null;

function checkCli(): Promise<{ available: boolean; detail: string }> {
  if (process.env.MENTOR_DISABLED === '1') return Promise.resolve({ available: false, detail: 'MENTOR_DISABLED=1' });
  if (statusCache && Date.now() - statusCache.at < 60_000) return Promise.resolve(statusCache);
  return new Promise((resolve) => {
    const p = spawn(BIN, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const timer = setTimeout(() => p.kill(), 8000);
    p.stdout.on('data', (d) => (out += d));
    p.on('error', () => {
      clearTimeout(timer);
      statusCache = { available: false, detail: 'Claude Code CLI не найден. Установите: npm i -g @anthropic-ai/claude-code, затем выполните claude и /login.', at: Date.now() };
      resolve(statusCache);
    });
    p.on('close', (code) => {
      clearTimeout(timer);
      statusCache = { available: code === 0, detail: out.trim() || `exit ${code}`, at: Date.now() };
      resolve(statusCache);
    });
  });
}

function readBody(req: IncomingMessage, limit = 400_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > limit) {
        reject(new Error('body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function handleAsk(req: IncomingMessage, res: ServerResponse) {
  let body;
  try {
    body = validateRequest(JSON.parse(await readBody(req)));
  } catch (e) {
    res.statusCode = 400;
    res.end(`bad request: ${(e as Error).message}`);
    return;
  }
  const args = [
    '-p',
    '--output-format', 'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--system-prompt', MENTOR_SYSTEM,
    '--tools', '',
    '--strict-mcp-config',
    '--no-session-persistence',
  ];
  if (process.env.MENTOR_MODEL) args.push('--model', process.env.MENTOR_MODEL);
  // cwd = временный каталог: CLAUDE.md проекта не подмешивается в ответы ментора
  const child = spawn(BIN, args, { cwd: tmpdir(), stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env } });
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  let streamed = false;
  let buf = '';
  let stderr = '';
  let finalText = '';
  let errorText = '';
  const killTimer = setTimeout(() => child.kill('SIGTERM'), 120_000);
  req.on('close', () => {
    if (!res.writableEnded) child.kill('SIGTERM');
  });
  child.stdout.on('data', (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      try {
        const ev = JSON.parse(line);
        if (ev.type === 'stream_event' && ev.event?.type === 'content_block_delta' && ev.event.delta?.type === 'text_delta') {
          streamed = true;
          res.write(ev.event.delta.text);
        } else if (ev.type === 'result') {
          if (ev.is_error) errorText = String(ev.result ?? ev.error ?? 'error');
          else finalText = String(ev.result ?? '');
        }
      } catch {
        /* не JSON — пропускаем */
      }
    }
  });
  child.stderr.on('data', (d) => (stderr += d));
  child.on('error', (e) => {
    clearTimeout(killTimer);
    if (!res.headersSent) res.statusCode = 503;
    res.end(`Не удалось запустить Claude Code CLI (${e.message}).`);
  });
  child.on('close', (code) => {
    clearTimeout(killTimer);
    if (!streamed && finalText) res.write(finalText);
    if (!streamed && !finalText) {
      if (!res.headersSent) res.statusCode = 502;
      res.write(errorText || stderr.trim().slice(0, 600) || `claude завершился с кодом ${code}. Проверьте вход: запустите \`claude\` и выполните /login.`);
    }
    res.end();
  });
  child.stdin.end(buildPrompt(body));
}

const isLocalHost = (host: string) => /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);

export function isLocalOrigin(origin: string): boolean {
  try {
    return isLocalHost(new URL(origin).host);
  } catch {
    return false;
  }
}

function middleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = req.url ?? '';
    if (url === '/api/mentor/status' && req.method === 'GET') {
      checkCli().then((s) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ available: s.available, detail: s.detail }));
      });
      return;
    }
    if (url === '/api/mentor' && req.method === 'POST') {
      // только локальные запросы
      const host = req.headers.host ?? '';
      const origin = req.headers.origin;
      // чужой сайт в браузере не должен тратить вашу подписку: Origin (если есть) — только локальный,
      // а application/json заставляет браузер делать preflight для кросс-доменных запросов
      if (!isLocalHost(host) || (origin && !isLocalOrigin(origin)) || !/^application\/json\b/i.test(req.headers['content-type'] ?? '')) {
        res.statusCode = 403;
        res.end('mentor is available only on localhost');
        return;
      }
      handleAsk(req, res).catch((e) => {
        res.statusCode = 500;
        res.end(String(e));
      });
      return;
    }
    next();
  };
}

export function mentorPlugin(): Plugin {
  return {
    name: 'l3-mentor',
    configureServer(server) {
      server.middlewares.use(middleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware());
    },
  };
}
