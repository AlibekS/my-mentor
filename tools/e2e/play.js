// Сквозной прогон: решает каждое задание и вопрос каждого урока через настоящий интерфейс (Playwright).
//
//   SPEC_OUT=/tmp/spec.json npx vitest run content/__tests__/e2e-spec.test.ts     # решения и ответы
//   L3_DATA_DIR=/tmp/e2e-data npx vite --port 5180                                # сервер с отдельным прогрессом
//   node tools/e2e/play.js 5180 0 1 /tmp/spec.json                                # порт, шард, всего шардов, spec
//
// Прогресс в L3_DATA_DIR должен разрешать открыть все уроки (все уроки completedAt, tasks/quiz пустые,
// seenRank: 8 — чтобы окно «Новый ранг» не перекрывало страницу). ONLY=key1,key2 — только эти уроки.
// Результат: play-<шард>.txt рядом со spec. Пусто — значит, всё решается.
const { chromium } = require('playwright');
const fs = require('fs');
const [, , port, shard = '0', shards = '1', specPath = __dirname + '/../spec.json'] = process.argv;
const BASE = `http://127.0.0.1:${port}/`;
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8')).filter((l, i) => (process.env.ONLY ? process.env.ONLY.split(',').includes(l.key) : i % Number(shards) === Number(shard)));

process.on('unhandledRejection', (e) => { console.log('FATAL', String(e).split('\n')[0]); process.exit(1); });
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const fails = [];
  let where = '';
  page.on('pageerror', (e) => fails.push(`${where} PAGEERROR ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) fails.push(`${where} CONSOLE ${m.text().slice(0, 160)}`); });
  await page.goto(BASE);
  await page.waitForTimeout(1500);

  // окно «Новый ранг» перекрывает страницу — закрываем
  const closeModal = async () => { const m = page.locator('.modal-backdrop button'); if (await m.count()) { await m.first().click().catch(() => {}); await page.waitForTimeout(150); } };
  const typeTerm = async (cmd) => {
    const host = page.locator('.terminal-host:visible');
    if (!(await host.count())) return false;
    await host.first().locator('.xterm-helper-textarea').focus();
    for (const line of cmd.split('\n')) {
      if (!line.trim()) continue;
      await page.keyboard.type(line);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(40);
    }
    return true;
  };
  const solved = async (ms = 3500) => {
    try { await page.locator('.task-panel .feedback.ok').first().waitFor({ state: 'visible', timeout: ms }); return true; } catch { return false; }
  };

  for (const l of spec) {
    await page.goto(BASE + '#/lesson/' + l.key + '/practice');
    await page.waitForTimeout(700);
    for (let i = 0; i < l.tasks.length; i++) {
      const t = l.tasks[i];
      where = `${l.key}/${t.id}`;
      await closeModal();
      await page.locator('.task-tabs button[role=tab]').nth(i).click();
      await page.waitForTimeout(250);
      if (await page.locator('.task-panel .feedback.ok').count()) { fails.push(`${where} AUTOSOLVED before any action (${t.kind})`); continue; }
      try {
        if (t.kind === 'terminal') {
          if (!(await typeTerm(t.solution))) fails.push(`${where} terminal not visible`);
        } else if (t.kind === 'answer') {
          if (t.tool === 'terminal') await typeTerm(t.solution.split('\n').filter((x) => !x.trim().startsWith('#')).join('\n'));
          if (t.tool === 'devtools' && !(await page.locator('.devtools:visible').count())) fails.push(`${where} devtools not visible`);
          if (t.tool === 'sql' && !(await page.locator('#sql-input:visible').count())) fails.push(`${where} sql console not visible`);
          if (t.tool === 'obs' && !(await page.locator('.obs:visible').count())) fails.push(`${where} obs console not visible`);
          await page.fill('#task-answer', t.answer);
          await page.press('#task-answer', 'Enter');
        } else if (t.kind === 'sql') {
          const inp = page.locator('#sql-input:visible');
          await inp.waitFor({ timeout: 4000 });
          await page.waitForFunction(() => !document.querySelector('.sql-console button.primary')?.hasAttribute('disabled') || true);
          await inp.fill(t.solution);
          await page.waitForTimeout(250);
          await inp.press('Control+Enter');
        } else if (t.kind === 'promql') {
          await page.locator('.obs:visible .obs-tabs button', { hasText: 'PromQL' }).click();
          await page.locator('#promql').fill(t.solution);
          await page.locator('#promql').press('Control+Enter');
        } else if (t.kind === 'logs') {
          await page.locator('.obs:visible .obs-tabs button', { hasText: 'KQL' }).click();
          await page.locator('#kql').fill(t.solution);
          await page.locator('#kql').press('Enter');
        } else if (t.kind === 'write') {
          await page.fill('#write-area', t.solution);
          await page.getByRole('button', { name: 'Проверить по чек-листу' }).click();
        }
        if (!(await solved())) {
          // SQL: база могла ещё грузиться — вторая попытка
          if (t.kind === 'sql') { await page.locator('#sql-input:visible').press('Control+Enter'); if (await solved(2500)) continue; }
          const fb = await page.locator('.feedback.bad').allTextContents();
          fails.push(`${where} NOT SOLVED (${t.kind}/${t.tool}) ${fb.join(' | ').slice(0, 200)}`);
        }
      } catch (e) {
        fails.push(`${where} EXCEPTION ${String(e.message).split('\n')[0].slice(0, 200)}`);
      }
    }
    // мини-тест
    await page.goto(BASE + '#/lesson/' + l.key + '/quiz');
    await page.waitForTimeout(500);
    for (let i = 0; i < l.quiz.length; i++) {
      const q = l.quiz[i];
      where = `${l.key}/quiz#${i + 1}(${q.type})`;
      try {
        await closeModal();
        if (q.type === 'choice') {
          await page.locator('.choices label').nth(Number(q.input)).click();
          await page.getByRole('button', { name: 'Проверить' }).click();
        } else if (q.type === 'sql' || q.type === 'promql') {
          await page.fill('#qinput', q.input);
          await page.press('#qinput', 'Control+Enter');
        } else {
          await page.fill('#qinput', q.input);
          await page.press('#qinput', 'Enter');
        }
        try { await page.locator('.qcard-ok').waitFor({ timeout: 3500 }); } catch { fails.push(`${where} QUIZ NOT ACCEPTED: ${q.input.slice(0, 80)}`); }
        await page.waitForTimeout(200);
        await closeModal();
        const next = page.locator('.qactions button', { hasText: 'Дальше' });
        if (await next.count()) await next.click();
        else if (i < l.quiz.length - 1) {
          // после 1-й неудачной попытки кнопки «Дальше» нет — добиваем вторую попытку
          await page.getByRole('button', { name: 'Проверить' }).click().catch(() => {});
          await page.locator('.qactions button', { hasText: 'Дальше' }).click({ timeout: 2000 }).catch(() => fails.push(`${where} cannot advance`));
        }
        await page.waitForTimeout(120);
      } catch (e) {
        fails.push(`${where} EXCEPTION ${String(e.message).split('\n')[0].slice(0, 200)}`);
      }
    }
    where = `${l.key}/finish`;
    await closeModal();
    const fin = page.locator('.quiz-finish button');
    if (!(await fin.count())) fails.push(`${where} no finish button`);
    else if (await fin.isDisabled()) fails.push(`${where} finish disabled (not all tasks solved)`);
    else {
      await fin.click();
      await page.waitForTimeout(400);
      const h = (await page.locator('h2').first().textContent().catch(() => '')) || '';
      if (!/пройден|закрыт/i.test(h)) fails.push(`${where} summary shows: ${h}`);
    }
  }
  fs.writeFileSync(`${require('path').dirname(specPath)}/play-${shard}.txt`, fails.join('\n') + '\n');
  console.log(`shard ${shard}: lessons ${spec.length}, problems ${fails.length}`);
  await browser.close();
})();
