#!/usr/bin/env node
/**
 * Test e2e 390px : page Pilotage — CE / PT réels + prévisionnels (phase 5).
 *
 * Même harnais que e2e/sync-390.cjs : bundle de test (clés Supabase factices,
 * dist-e2e), chrome-headless-shell via playwright-core, Supabase REST mocké en
 * page (window.__fmMockDB), session via window.__fmSetSession. 4 écritures
 * 2025 pré-chargées dans le mock (vente, achat, salaires, encaissement client).
 *
 * Scénarios :
 * A. Sans session -> #/pilotage redirige vers #/connexion.
 * B. Avec session mockée :
 *    B1  les 4 vues (CE réel, CE prévision, PT réel, PT prévisionnel) s'affichent ;
 *    B2  CE réel : TA total = 1 000 000, XI = −300 000 ;
 *    B3  CE prévision : objectif TA +10 % -> total prévisionnel TA = 1 100 000
 *        (recalcul instantané) ET objectif persisté en fm_settings (mock) ;
 *    B4  PT réel : E1 (avril) = 1 180 000 ;
 *    B5  boutons Excel (téléchargement .xls) et PDF (window.print) présents ;
 *    B6  entrée « Pilotage » au menu hamburger.
 * Captures : migration/app/screenshots/.
 *
 * Usage : node e2e/pilotage-390.cjs   (depuis migration/app)
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

const norm = (s) => String(s || '').replace(/[\s\u00a0\u202f]/g, '');

/**
 * Mock Supabase REST + session, avec 4 écritures 2025 pré-chargées :
 *  2025-01-20 vente 1 000 000 (701) / 411 / 443
 *  2025-02-12 achat 500 000 (601) / 401
 *  2025-03-31 salaires 800 000 (6611) / 422
 *  2025-04-15 encaissement client 1 180 000 (521 / 411)
 *  2025-05-10 paiement fournisseur 500 000 (401 / 521)
 */
function mockInitScript() {
  /* eslint-disable */
  const E = (id, date, journal, piece, libelle, lignes) => ({ id, date, journal, piece, libelle, lignes });
  const L = (compte, debit, credit) => ({ compte, debit, credit });
  const seed = [
    E('e1', '2025-01-20', 'VT', 'VT2025-0001', 'Vente marchandises', [
      L('411', 1180000, 0), L('701', 0, 1000000), L('443', 0, 180000)]),
    E('e2', '2025-02-12', 'AC', 'AC2025-0001', 'Achat marchandises', [
      L('601', 500000, 0), L('401', 0, 500000)]),
    E('e3', '2025-03-31', 'PA', 'PA2025-0001', 'Salaires mars', [
      L('6611', 800000, 0), L('422', 0, 800000)]),
    E('e4', '2025-04-15', 'BQ', 'BQ2025-0001', 'Encaissement client', [
      L('521', 1180000, 0), L('411', 0, 1180000)]),
    E('e5', '2025-05-10', 'BQ', 'BQ2025-0002', 'Paiement fournisseur', [
      L('401', 500000, 0), L('521', 0, 500000)]),
  ];
  window.__fmMockDB = {
    fm_entries: seed.map((e) => ({ user_id: 'e2e-uid', entry_id: e.id, entry: e })),
    fm_journals: [], fm_chat: [], fm_settings: [],
    fm_audit: [], fm_immos: [], fm_assurances: [],
  };
  window.__fmMockFail = null;
  const KEYS = {
    fm_entries: ['user_id', 'entry_id'],
    fm_journals: ['user_id', 'code'],
    fm_chat: ['user_id'],
    fm_settings: ['user_id', 'key'],
    fm_audit: ['user_id'],
    fm_immos: ['user_id', 'immo_id'],
    fm_assurances: ['user_id', 'assurance_id'],
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
    if (window.__fmMockFail === 'network') return Promise.reject(new TypeError('Failed to fetch'));
    const parsed = new URL(raw);
    const table = parsed.pathname.split('/rest/v1/')[1].split('?')[0];
    const method = String(opts.method || 'GET').toUpperCase();
    const DB = window.__fmMockDB;
    if (!DB[table]) return json({ message: 'table inconnue' }, 404);
    if (method === 'GET') {
      const c = conds(parsed.searchParams);
      const rows = DB[table].filter((r) => c.every(([k, v]) => String(r[k]) === v));
      const h = JSON.stringify(opts.headers || {});
      if (/vnd\.pgrst\.object/.test(h)) return json(rows[0] || null);
      return json(rows);
    }
    if (method === 'POST') {
      const body = JSON.parse(opts.body || '{}');
      const items = Array.isArray(body) ? body : [body];
      const out = items.map((obj) => {
        const keyCols = KEYS[table] || ['user_id'];
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

async function renderRoute(page, hash) {
  const cur = await page.evaluate(() => window.location.hash);
  if (cur === hash) {
    await page.evaluate(() => window.dispatchEvent(new HashChangeEvent('hashchange')));
  } else {
    await page.evaluate((h) => { window.location.hash = h; }, hash);
  }
  await page.waitForTimeout(500);
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  buildTestBundle();
  const { srv, port } = await serve();
  const base = `http://127.0.0.1:${port}/`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: SHELL, args: ['--no-sandbox'] });

    /* ---------------- Scénario A : sans session -> redirection -------------- */
    {
      const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => console.log('PAGEERROR(A): ' + e.message));
      await blockFonts(page);
      await page.goto(base + '#/pilotage', { waitUntil: 'load', timeout: 30000 });
      await page.waitForSelector('[data-testid="auth-page"]', { timeout: 10000 });
      check('A1 sans session -> redirection vers la connexion', page.url().includes('#/connexion'), page.url());
      await ctx.close();
    }

    /* ---------------- Scénario B : session mockée -> pilotage --------------- */
    {
      const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      await ctx.addInitScript(mockInitScript);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => console.log('PAGEERROR(B): ' + e.message));
      await blockFonts(page);

      await page.goto(base + '#/pilotage', { waitUntil: 'load', timeout: 30000 });
      await page.waitForFunction(() => window.__fmSessionSet === true, null, { timeout: 10000 });
      await renderRoute(page, '#/pilotage');
      await page.waitForSelector('[data-testid="pilotage-page"]', { timeout: 15000 });
      check('B1 page pilotage affichée', page.url().includes('#/pilotage'));

      // Les 4 onglets existent et affichent leur vue
      const tabs = ['ce-reel', 'ce-prev', 'pt-reel', 'pt-prev'];
      for (const t of tabs) {
        await page.click('[data-testid="pilotage-tab-' + t + '"]');
        await page.waitForTimeout(600);
        const title = await page.textContent('.stmt-title');
        check('B2.' + t + ' vue affichée', /Compte d’exploitation|Plan de trésorerie/.test(title || ''), (title || '').slice(0, 50));
      }
      await noOverflow(page, 'B3 onglets');
      await page.screenshot({ path: path.join(SHOTS, 'pilotage-onglets-390.png') });

      // CE réel : TA = 1 000 000, XI = 1 000 000 − 500 000 − 800 000 = −300 000
      await page.click('[data-testid="pilotage-tab-ce-reel"]');
      await page.waitForTimeout(600);
      const xiText = await page.textContent('.stmt-head .badge-ok');
      check('B4 CE réel : résultat net −300 000 F', norm(xiText).includes('-300000'), norm(xiText));
      await page.screenshot({ path: path.join(SHOTS, 'pilotage-ce-reel-390.png') });
      await noOverflow(page, 'B5 CE réel');

      // CE prévision : objectif TA +10 % -> TA prévisionnel = 1 100 000
      await page.click('[data-testid="pilotage-tab-ce-prev"]');
      await page.waitForSelector('[data-testid="obj-ce-TA"]', { timeout: 8000 });
      await page.selectOption('[data-testid="objtype-ce-TA"]', 'pct');
      await page.fill('[data-testid="obj-ce-TA"]', '10');
      await page.waitForFunction(() => {
        const el = document.querySelector('[data-testid="prevtotal-ce-TA"]');
        return el && el.textContent.replace(/[\s\u00a0\u202f]/g, '').includes('1100000');
      }, null, { timeout: 8000 });
      const taPrev = await page.textContent('[data-testid="prevtotal-ce-TA"]');
      check('B6 objectif TA +10 % -> TA prévisionnel recalculé', norm(taPrev).includes('1100000'), norm(taPrev));
      // Persistance en fm_settings (mock Supabase)
      await page.waitForTimeout(1500);
      const saved = await page.evaluate(() => {
        const row = (window.__fmMockDB.fm_settings || []).find((r) => r.key === 'pilotage_objectifs');
        return row ? row.value : null;
      });
      check('B7 objectif persisté en fm_settings (cloud)', saved && saved.ce && saved.ce.TA
        && saved.ce.TA.type === 'pct' && String(saved.ce.TA.value) === '10', JSON.stringify(saved && saved.ce && saved.ce.TA));
      await page.screenshot({ path: path.join(SHOTS, 'pilotage-ce-prevision-390.png') });
      await noOverflow(page, 'B8 CE prévision');

      // PT réel : E1 (avril) = 1 180 000
      await page.click('[data-testid="pilotage-tab-pt-reel"]');
      await page.waitForTimeout(600);
      const ptText = await page.textContent('[data-testid="pilotage-page"]');
      check('B9 PT réel : E1 = 1 180 000', norm(ptText).includes('1180000'), 'E1 présent');
      const chartPt = await page.$('[data-testid="pilotage-chart-pt-reel"]');
      check('B10 graphique PT (barres SVG)', chartPt !== null);
      await page.screenshot({ path: path.join(SHOTS, 'pilotage-pt-reel-390.png') });
      await noOverflow(page, 'B11 PT réel');

      // PT prévisionnel : objectif D1 +50 % en montant
      await page.click('[data-testid="pilotage-tab-pt-prev"]');
      await page.waitForSelector('[data-testid="obj-pt-D1"]', { timeout: 8000 });
      await page.selectOption('[data-testid="objtype-pt-D1"]', 'pct');
      await page.fill('[data-testid="obj-pt-D1"]', '50');
      await page.waitForFunction(() => {
        const el = document.querySelector('[data-testid="prevtotal-pt-D1"]');
        return el && el.textContent.replace(/[\s\u00a0\u202f]/g, '').includes('750000');
      }, null, { timeout: 8000 });
      const d1Prev = await page.textContent('[data-testid="prevtotal-pt-D1"]');
      check('B12 PT prévision : D1 +50 % -> 750 000', norm(d1Prev).includes('750000'), norm(d1Prev));
      await page.screenshot({ path: path.join(SHOTS, 'pilotage-pt-prevision-390.png') });
      await noOverflow(page, 'B13 PT prévision');

      // Boutons Excel / PDF
      const excelBtn = await page.$('[data-testid="pilotage-excel"]');
      const pdfBtn = await page.$('[data-testid="pilotage-pdf"]');
      check('B14 boutons Excel et PDF présents', excelBtn !== null && pdfBtn !== null);
      // Excel -> téléchargement .xls proposé
      const dlPromise = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
      await page.click('[data-testid="pilotage-excel"]');
      const dl = await dlPromise;
      check('B15 Excel -> fichier .xls téléchargé', dl !== null && /\.xls$/.test(dl ? dl.suggestedFilename() : ''),
        dl ? dl.suggestedFilename() : 'aucun téléchargement');
      // PDF -> window.print appelé + en-tête d'impression renseigné
      await page.evaluate(() => { window.__printed = false; window.print = () => { window.__printed = true; }; });
      await page.click('[data-testid="pilotage-pdf"]');
      await page.waitForTimeout(400);
      const printed = await page.evaluate(() => window.__printed === true);
      const printHead = await page.textContent('#printHeader');
      check('B16 PDF -> impression déclenchée avec en-tête', printed && /Plan de trésorerie/.test(printHead || ''),
        norm(printHead).slice(0, 60));

      // Entrée au menu hamburger
      await page.click('#drawerBtn');
      await page.waitForTimeout(400);
      const menuItem = await page.$('[data-goto="/pilotage"]');
      const menuVisible = menuItem ? await menuItem.isVisible() : false;
      check('B17 entrée « Pilotage » au menu hamburger', menuVisible);
      await page.screenshot({ path: path.join(SHOTS, 'pilotage-menu-390.png') });

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
