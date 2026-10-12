#!/usr/bin/env node
/**
 * Test e2e 390px : phase 5 (copilote + admin).
 * - Build dédié avec fausses clés Supabase (https://test.supabase.co) vers /tmp/fm-e2e5.
 * - Session supabase-js seedée en localStorage (sb-test-auth-token) + fm2_session.
 * - page.route() sur les URLs des Edge Functions : mocks copilot / admin-users / admin-stats.
 * - (a) Copilote : envoi message -> réponse affichée (comptes en valeur).
 * - (b) Quota 402 -> message adapté + bouton abonnement.
 * - (c) Non-admin sur #/admin -> redirigé vers #/journal.
 * - (d) Admin : vue globale + utilisateurs affichés ; suppression de soi impossible.
 * - Captures : copilote-390.png, admin-390.png. Pas de débordement horizontal.
 *
 * Usage : node e2e/phase5-390.cjs   (depuis migration/app)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { chromium } = require('/home/hatch/workspace/fiscalmind-migration/e2e/node_modules/playwright-core');

const APP = '/home/hatch/workspace/goals/fiscalmind-africa-saas-launch/migration/app';
const DIST = '/tmp/fm-e2e5';
const SHOTS = APP + '/screenshots';
const SHELL = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const W = 390, H = 844;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : ''));
  if (!ok) process.exitCode = 1;
}
async function noOverflow(page, name) {
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  check(name + ' : pas de débordement horizontal', sw <= W, 'scrollWidth=' + sw);
}

function serve(dir) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
      fs.readFile(path.join(dir, p), (err, data) => {
        if (err) { res.writeHead(404); res.end('nf'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'text/plain' }); res.end(data);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

// État des mocks, modifiable pendant le test
const mock = {
  quota: { plan: 'starter', remaining: 42 },
  answer: { answer: 'Le compte **411** (clients) se solde au débit. Voir aussi le 521.', plan: 'starter', remaining: 41 },
  copilotStatus: 200,
  users: { users: [
    { id: 'admin1', email: 'admin@test.bf', created_at: '2026-01-05T00:00:00Z', last_sign_in_at: '2026-10-08T10:00:00Z', plan: 'admin', is_admin: true },
    { id: 'u2', email: 'client@test.bf', created_at: '2026-10-01T00:00:00Z', last_sign_in_at: '2026-10-07T10:00:00Z', plan: 'starter', plan_expires_at: '2026-11-01T00:00:00Z', is_admin: false },
  ]},
  stats: {
    users: { total: 2, new_7d: 1, active_30d: 2, new_today: 0, by_plan: { demo: 0, starter: 1, pro: 0, enterprise: 0, admin: 1 }, latest: [{ email: 'client@test.bf', created_at: '2026-10-01T00:00:00Z', plan: 'starter' }] },
    copilot: { questions_month: 10, questions_today: 2, top_users: [{ email: 'client@test.bf', questions: 10 }] },
    revenue: { total_xof: 29900, count_done: 1, count_pending: 0 },
    storage: { total_bytes: 123456, users_with_docs: 1, top: [] },
    alerts: { unmatched_rows: [] },
  },
};

async function seedSession(page, uid, email) {
  await page.evaluate(({ uid, email }) => {
    localStorage.setItem('fm2_session', JSON.stringify({ uid, email, demo: false }));
    // Session supabase-js (clé sb-<ref>-auth-token, ref=test pour https://test.supabase.co)
    localStorage.setItem('sb-test-auth-token', JSON.stringify({
      access_token: 'mock-access-token', refresh_token: 'mock-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer',
      user: { id: uid, email },
    }));
  }, { uid, email });
}

(async () => {
  console.log('Build dédié e2e (fausses clés)…');
  execSync('VITE_SUPABASE_URL=https://test.supabase.co VITE_SUPABASE_ANON_KEY=e2e-dummy-key npx vite build --outDir /tmp/fm-e2e5', { cwd: APP, stdio: 'pipe' });
  fs.mkdirSync(SHOTS, { recursive: true });
  const { srv, port } = await serve(DIST);
  const base = `http://127.0.0.1:${port}/`;
  const browser = await chromium.launch({ executablePath: SHELL });
  const page = await browser.newPage({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true });

  // Interception des Edge Functions
  await page.route('**/functions/v1/copilot', async (route) => {
    const req = route.request();
    let body = {};
    try { body = JSON.parse(req.postData() || '{}'); } catch (e) {}
    if (body.action === 'quota') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mock.quota) });
    }
    if (mock.copilotStatus === 402) {
      return route.fulfill({ status: 402, contentType: 'application/json', body: JSON.stringify({ error: 'Quota mensuel épuisé.', plan: 'starter' }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 200, ...mock.answer }) });
  });
  await page.route('**/functions/v1/admin-users', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mock.users) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.route('**/functions/v1/admin-stats', async (route) => {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mock.stats) });
  });

  try {
    // ---------- (a) Copilote : envoi -> réponse ----------
    await page.goto(base, { waitUntil: 'load', timeout: 30000 });
    await seedSession(page, 'u2', 'client@test.bf');
    await page.evaluate(() => { location.hash = '#/copilote'; });
    await page.waitForSelector('[data-testid="chat-input"]', { timeout: 10000 });
    check('copilote : page affichée', true);
    await noOverflow(page, 'copilote');
    await page.fill('[data-testid="chat-input"]', 'Comment solder le compte 411 ?');
    await page.click('[data-testid="chat-send"]');
    // Après envoi : 1 message user + 1 réponse assistant (le message d'accueil disparaît dès que l'historique existe)
    await page.waitForFunction(() => document.querySelectorAll('#chatMessages .message.user').length >= 1 && document.querySelectorAll('#chatMessages .message.assistant').length >= 1, { timeout: 10000 });
    const lastHtml = await page.evaluate(() => {
      const all = document.querySelectorAll('#chatMessages .message.assistant');
      return all[all.length - 1].innerHTML;
    });
    check('copilote : réponse affichée', /solde au débit/.test(lastHtml));
    check('copilote : numéro de compte mis en valeur', /<span class="acct">411<\/span>/.test(lastHtml) || /<span class="acct">521<\/span>/.test(lastHtml));
    const badge = await page.evaluate(() => document.getElementById('copilotQuota').textContent);
    check('copilote : badge quota affiché', /42 restantes/.test(badge), badge);
    await page.screenshot({ path: SHOTS + '/copilote-390.png' });

    // ---------- (b) Quota épuisé (402) ----------
    mock.copilotStatus = 402;
    await page.fill('[data-testid="chat-input"]', 'Autre question');
    await page.click('[data-testid="chat-send"]');
    await page.waitForFunction(() => document.querySelector('#chatMessages [data-goto-plan]'), { timeout: 10000 });
    const quotaHtml = await page.evaluate(() => document.getElementById('chatMessages').innerHTML);
    check('copilote : quota épuisé -> message + bouton abonnement', /Quota mensuel épuisé/.test(quotaHtml) && /Choisir mon abonnement/.test(quotaHtml));
    mock.copilotStatus = 200;

    // ---------- (c) Non-admin -> redirection ----------
    await page.evaluate(() => { location.hash = '#/admin'; });
    await page.waitForFunction(() => location.hash === '#/journal', { timeout: 10000 });
    check('admin : non-admin redirigé vers journal', true);

    // ---------- (d) Admin : vue globale + utilisateurs ----------
    mock.quota = { plan: 'admin', remaining: null };
    await seedSession(page, 'admin1', 'admin@test.bf');
    await page.evaluate(() => { location.hash = '#/admin'; });
    await page.waitForFunction(() => document.querySelector('[data-atab]'), { timeout: 10000 });
    const ovText = await page.evaluate(() => document.getElementById('adminContent').innerText);
    check('admin : vue globale (inscrits, revenus)', /2/.test(ovText) && /XOF/.test(ovText));
    await noOverflow(page, 'admin vue globale');
    await page.click('[data-atab="users"]');
    await page.waitForSelector('#usersBody tr', { timeout: 10000 });
    const usersHtml = await page.evaluate(() => document.getElementById('usersBody').innerHTML);
    check('admin : liste utilisateurs', /client@test\.bf/.test(usersHtml) && /STARTER/.test(usersHtml));
    // Pas de bouton Gérer/Supprimer sur sa propre ligne (admin)
    const selfRow = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#usersBody tr')];
      const r = rows.find((tr) => tr.innerHTML.includes('admin@test.bf'));
      return r ? r.innerHTML : '';
    });
    check('admin : aucune action sur son propre compte', !/data-manage|data-deluser/.test(selfRow));
    // Boutons présents sur le client
    const clientRow = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#usersBody tr')];
      const r = rows.find((tr) => tr.innerHTML.includes('client@test.bf'));
      return r ? r.innerHTML : '';
    });
    check('admin : actions Gérer/Supprimer sur un client', /data-manage/.test(clientRow) && /data-deluser/.test(clientRow));
    await noOverflow(page, 'admin utilisateurs');
    await page.screenshot({ path: SHOTS + '/admin-390.png' });

    console.log('Terminé.');
  } catch (e) {
    console.error('ERREUR e2e:', e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
    srv.close();
  }
})();
