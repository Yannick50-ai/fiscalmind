#!/usr/bin/env node
/**
 * Test e2e 390px : pivot SaaS 100 % cloud (phase 7).
 *
 * Construit un bundle de test avec des clés Supabase factices (dist-e2e),
 * sert app/dist-e2e en statique, pilote chrome-headless-shell via playwright-core.
 * Émulation mobile : 390x844, isMobile, tactile.
 *
 * Le « serveur » Supabase est MOCKÉ EN PAGE : un addInitScript intercepte
 * window.fetch pour tout /rest/v1/ et répond depuis une mini-base en mémoire
 * (window.__fmMockDB). La session est injectée via le hook de test
 * window.__fmSetSession (mémoire uniquement, comme en prod).
 *
 * Scénarios :
 * A. Sans session -> #/journal redirige vers #/connexion (pas de bouton démo).
 * B. Avec session mockée :
 *    - le journal affiche la pastille « ● Connecté » ;
 *    - création d'une écriture équilibrée -> la ligne apparaît ET le mock
 *      Supabase contient la ligne (preuve : l'écriture passe par le cloud) ;
 *    - suppression (double confirmation) -> ligne absente du mock ;
 *    - panne réseau simulée -> panneau d'erreur en français + bouton Réessayer.
 * Captures : migration/app/screenshots/.
 *
 * Usage : node e2e/sync-390.cjs   (depuis migration/app)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { chromium } = require('/home/hatch/workspace/fiscalmind-migration/e2e/node_modules/playwright-core');

const APP = '/home/hatch/workspace/goals/fiscalmind-africa-saas-launch/migration/app';
const DIST = path.join(APP, 'dist-e2e');
const SHOTS = path.join(APP, 'screenshots');
const SHELL = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const W = 390, H = 844;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };

function buildTestBundle() {
  console.log('construction du bundle e2e (clés Supabase factices)…');
  execSync('npx vite build --outDir dist-e2e', {
    cwd: APP,
    stdio: 'pipe',
    env: {
      ...process.env,
      VITE_SUPABASE_URL: 'https://e2e-test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'e2e-dummy-anon-key',
    },
  });
}

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const f = path.join(DIST, p);
      fs.readFile(f, (err, data) => {
        if (err) { res.writeHead(404); res.end('nf'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || '' });
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : ''));
}

async function noOverflow(page, name) {
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  check(name + ' : pas de débordement horizontal', sw <= W, 'scrollWidth=' + sw);
}

/**
 * Script injecté AVANT le chargement de l'appli (scénario B) :
 * - mock Supabase REST en page (mini-base mémoire window.__fmMockDB)
 * - session mémoire via window.__fmSetSession (hook de test de auth.js)
 */
function mockInitScript() {
  /* eslint-disable */
  const DB = { fm_entries: [], fm_journals: [], fm_chat: [], fm_settings: [] };
  window.__fmMockDB = DB;
  window.__fmMockFail = null; // 'network' | 'db'
  const KEYS = {
    fm_entries: ['user_id', 'entry_id'],
    fm_journals: ['user_id', 'code'],
    fm_chat: ['user_id'],
    fm_settings: ['user_id', 'key'],
  };
  const SKIP = { select: 1, order: 1, on_conflict: 1, limit: 1, offset: 1, or: 1, and: 1 };
  function conds(sp) {
    const out = [];
    sp.forEach((v, k) => {
      if (SKIP[k]) return;
      if (String(v).startsWith('eq.')) out.push([k, String(v).slice(3)]);
    });
    return out;
  }
  function json(data, status) {
    return Promise.resolve(new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' },
    }));
  }
  const realFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    opts = opts || {};
    const raw = url && url.url ? url.url : String(url);
    if (raw.indexOf('/rest/v1/') === -1) return realFetch(url, opts);
    if (window.__fmMockFail === 'network') {
      return Promise.reject(new TypeError('Failed to fetch'));
    }
    if (window.__fmMockFail === 'db') {
      return json({ code: '42P01', message: 'relation "public.fm_entries" does not exist', details: '', hint: '' }, 404);
    }
    const parsed = new URL(raw);
    const table = parsed.pathname.split('/rest/v1/')[1].split('?')[0];
    const method = String(opts.method || 'GET').toUpperCase();
    if (!DB[table]) return json({ message: 'table inconnue' }, 404);
    if (method === 'GET') {
      const c = conds(parsed.searchParams);
      const rows = DB[table].filter((r) => c.every(([k, v]) => String(r[k]) === v));
      const h = JSON.stringify(opts.headers || {});
      if (/vnd\.pgrst\.object/.test(h)) return json(rows[0] || null); // maybeSingle
      return json(rows);
    }
    if (method === 'POST') {
      const body = JSON.parse(opts.body || '{}');
      const items = Array.isArray(body) ? body : [body];
      const out = items.map((obj) => {
        const keyCols = KEYS[table];
        const i = DB[table].findIndex((r) => keyCols.every((k) => r[k] === obj[k]));
        if (i >= 0) { DB[table][i] = Object.assign({}, DB[table][i], obj); return DB[table][i]; }
        DB[table].push(Object.assign({}, obj));
        return obj;
      });
      return json(out, 201);
    }
    if (method === 'DELETE') {
      const c = conds(parsed.searchParams);
      DB[table] = DB[table].filter((r) => !c.every(([k, v]) => String(r[k]) === v));
      return json([]);
    }
    return json({ message: 'méthode non supportée' }, 405);
  };
  // La session mémoire n'existe qu'après le chargement du module auth.js : on attend.
  const t = setInterval(() => {
    if (window.__fmSetSession) {
      window.__fmSetSession({ uid: 'e2e-uid', email: 'e2e@test.fr' });
      window.__fmSessionSet = true;
      clearInterval(t);
    }
  }, 50);
  /* eslint-enable */
}

async function blockFonts(page) {
  await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com/, (r) => r.abort());
}

/**
 * Navigation intra-page déterministe : contrairement à page.goto(), ceci ne
 * recharge jamais la page (goto recharge le document même pour un simple
 * changement de hash dans ce headless, ce qui réinitialiserait le mock).
 * Si on est déjà sur la route, on redéclenche le rendu via un hashchange
 * synthétique (sans passer par une autre page : deux rendus async en
 * concurrence s'écraseraient mutuellement).
 */
async function renderRoute(page, hash) {
  const cur = await page.evaluate(() => window.location.hash);
  if (cur === hash) {
    await page.evaluate(() => window.dispatchEvent(new HashChangeEvent('hashchange')));
  } else {
    await page.evaluate((h) => { window.location.hash = h; }, hash);
  }
  await page.waitForTimeout(400);
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  buildTestBundle();
  const { srv, port } = await serve();
  const base = `http://127.0.0.1:${port}/`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: SHELL, args: ['--no-sandbox'] });

    /* ---------------- Scénario A : sans session -> redirection login -------- */
    {
      const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => console.log('PAGEERROR(A): ' + e.message));
      await blockFonts(page);
      await page.goto(base + '#/journal', { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('[data-testid="auth-page"]', { timeout: 10000 });
      check('A1 sans session -> redirection vers la connexion', page.url().includes('#/connexion'), page.url());
      const demoBtn = await page.$('[data-testid="demo-btn"]');
      check('A2 aucun bouton démo (SaaS strict)', demoBtn === null);
      await noOverflow(page, 'A3 connexion');
      await page.screenshot({ path: path.join(SHOTS, 'sync-connexion-390.png') });
      await ctx.close();
    }

    /* ---------------- Scénario B : session mockée -> cloud ------------------ */
    {
      const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      await ctx.addInitScript(mockInitScript);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => console.log('PAGEERROR(B): ' + e.message));
      await blockFonts(page);

      await page.goto(base + '#/journal', { waitUntil: 'load', timeout: 30000 });
      await page.waitForFunction(() => window.__fmSessionSet === true, null, { timeout: 10000 });
      // Navigation intra-page (pas de rechargement -> le mock et la session persistent)
      await renderRoute(page, '#/journal');
      await page.waitForSelector('[data-testid="journal-page"]', { timeout: 15000 });
      check('B1 session mockée -> page journal', page.url().includes('#/journal'));

      const badge = await page.textContent('[data-testid="conn-badge"]');
      check('B2 pastille « ● Connecté »', /Connecté/.test(badge || ''), (badge || '').trim());
      await noOverflow(page, 'B3 journal (vide, cloud)');
      await page.screenshot({ path: path.join(SHOTS, 'sync-journal-connecte-390.png') });

      // Création d'une écriture équilibrée
      await page.click('[data-testid="new-entry-btn"]');
      await page.waitForSelector('[data-testid="entry-modal"]', { timeout: 5000 });
      await page.selectOption('[data-testid="entry-journal"]', 'AC');
      await page.fill('[data-testid="entry-piece"]', 'AC-001');
      await page.fill('[data-testid="entry-lib"]', 'Achat cloud e2e');
      await page.fill('[data-testid="line-compte-0"]', '601');
      await page.fill('[data-testid="line-debit-0"]', '100000');
      await page.fill('[data-testid="line-compte-1"]', '401');
      await page.fill('[data-testid="line-credit-1"]', '100000');
      await page.click('[data-testid="entry-save"]');
      await page.waitForSelector('[data-testid="entry-card"]', { timeout: 8000 });
      const cardText = await page.textContent('[data-testid="entry-card"]');
      check('B4 écriture enregistrée et affichée', /Achat cloud e2e/.test(cardText || ''));

      // Preuve : la ligne est bien passée par le mock Supabase (pas du local)
      const dbCount = await page.evaluate(() => window.__fmMockDB.fm_entries.length);
      const dbEntry = await page.evaluate(() => (window.__fmMockDB.fm_entries[0] || {}).entry);
      check('B5 écriture persistée via Supabase (mock)', dbCount === 1 && dbEntry && dbEntry.libelle === 'Achat cloud e2e',
        'fm_entries=' + dbCount);
      const lsKeys = await page.evaluate(() => Object.keys(window.localStorage || {}).filter((k) => k.indexOf('fm2_') === 0));
      check('B6 zéro clé fm2_* en localStorage', lsKeys.length === 0, JSON.stringify(lsKeys));
      await noOverflow(page, 'B7 journal (1 écriture cloud)');
      await page.screenshot({ path: path.join(SHOTS, 'sync-journal-ecriture-390.png') });

      // Suppression (double confirmation) -> absente du mock
      await page.click('[data-testid="delete-entry-btn"]');
      await page.click('[data-testid="delete-entry-btn"]'); // 2e clic = confirmation
      await page.waitForFunction(() => !document.querySelector('[data-testid="entry-card"]'), null, { timeout: 8000 });
      const dbCount2 = await page.evaluate(() => window.__fmMockDB.fm_entries.length);
      check('B8 suppression propagée au cloud', dbCount2 === 0, 'fm_entries=' + dbCount2);

      await ctx.close();
    }

    /* ---------------- Scénario C : panne réseau -> erreur explicite --------- */
    {
      const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      await ctx.addInitScript(mockInitScript);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => console.log('PAGEERROR(C): ' + e.message));
      await blockFonts(page);
      await page.goto(base + '#/journal', { waitUntil: 'load', timeout: 30000 });
      await page.waitForFunction(() => window.__fmSessionSet === true, null, { timeout: 10000 });
      // Panne réseau AVANT le chargement des données (re-rendu sans changer de page).
      // Note : postgrest-js retente 3 fois avec backoff (1s+2s+4s) avant d'échouer.
      await page.evaluate(() => { window.__fmMockFail = 'network'; });
      await renderRoute(page, '#/journal');
      await page.waitForSelector('[data-testid="journal-error"]', { timeout: 25000 });
      const errText = await page.textContent('[data-testid="journal-error"]');
      check('C1 panne réseau -> message explicite en français',
        /connexion|réseau/i.test(errText || ''), (errText || '').trim().slice(0, 90));
      const retryBtn = await page.$('[data-testid="journal-retry"]');
      check('C2 bouton Réessayer présent', retryBtn !== null);
      await noOverflow(page, 'C3 état erreur');
      await page.screenshot({ path: path.join(SHOTS, 'sync-erreur-reseau-390.png') });
      // Rétablissement -> Réessayer recharge le journal
      await page.evaluate(() => { window.__fmMockFail = null; });
      await page.click('[data-testid="journal-retry"]');
      await page.waitForSelector('[data-testid="journal-page"]', { timeout: 15000 });
      const badge = await page.textContent('[data-testid="conn-badge"]');
      check('C4 après Réessayer : journal rechargé', /Connecté/.test(badge || ''));
      await ctx.close();
    }
  } finally {
    if (browser) await browser.close();
    srv.close();
  }
  const failed = results.filter((r) => !r.ok);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' contrôles verts'
    + (failed.length ? ' — ÉCHECS : ' + failed.map((f) => f.name).join(' ; ') : ''));
  process.exit(failed.length ? 1 : 0);
})();
