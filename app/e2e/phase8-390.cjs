#!/usr/bin/env node
/**
 * Test e2e 390px : phase 8 — les 6 modules (classeur, audit, amortissements,
 * assurances, convertisseur, config) + menu hamburger.
 *
 * Même infrastructure que e2e/sync-390.cjs : bundle de test (clés Supabase
 * factices), serveur statique, chrome-headless-shell via playwright-core,
 * Supabase REST mocké en page (window.__fmMockDB), session via
 * window.__fmSetSession (mémoire uniquement).
 *
 * Scénarios (session mockée) :
 *  D. Hamburger : ouvre le tiroir -> 13 entrées -> clic « Audit Readiness »
 *     -> navigation #/audit, tiroir refermé.
 *  E. Audit : page + bascule d'un élément -> fm_audit persisté (mock).
 *  F. Amortissements : nouvelle immo -> plan -> génération dotation ->
 *     écriture 681/284 dans fm_entries.
 *  G. Assurances : nouvelle police -> paiement prime -> écriture 625/521.
 *  H. Convertisseur : conversion XOF->EUR -> édition taux -> fm_settings.
 *  I. Config : entreprise + paramètres fiscaux -> fm_settings.
 *  J. Classeur : notice OCR gracieuse -> texte collé -> analyse ->
 *     écritures proposées -> passation -> fm_entries.
 * Captures : migration/app/screenshots/.
 *
 * Usage : node e2e/phase8-390.cjs   (depuis migration/app)
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

function mockInitScript() {
  /* eslint-disable */
  const DB = { fm_entries: [], fm_journals: [], fm_chat: [], fm_settings: [], fm_audit: [], fm_immos: [], fm_assurances: [] };
  window.__fmMockDB = DB;
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
    if (window.__fmMockFail === 'network') {
      return Promise.reject(new TypeError('Failed to fetch'));
    }
    const parsed = new URL(raw);
    const table = parsed.pathname.split('/rest/v1/')[1].split('?')[0];
    const method = String(opts.method || 'GET').toUpperCase();
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
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await ctx.addInitScript(mockInitScript);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGEERROR: ' + e.message));
    await blockFonts(page);

    await page.goto(base + '#/', { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.__fmSessionSet === true, null, { timeout: 10000 });
    await renderRoute(page, '#/accueil');
    await page.waitForSelector('[data-testid="dashboard-page"],[data-testid="journal-page"],[data-testid="accueil-page"]', { timeout: 15000 }).catch(() => {});

    /* ---------------- D. Hamburger ---------------- */
    await page.click('#drawerBtn');
    await page.waitForSelector('#drawer.open', { timeout: 5000 });
    const drawerItems = await page.$$('.drawer-item');
    check('D1 tiroir ouvert avec 13 entrées', drawerItems.length === 13, drawerItems.length + ' entrées');
    await noOverflow(page, 'D2 tiroir');
    await page.screenshot({ path: path.join(SHOTS, 'phase8-drawer-390.png') });
    await page.click('.drawer-item[data-route="audit"]');
    await page.waitForSelector('[data-testid="audit-page"]', { timeout: 10000 });
    const drawerClosed = await page.evaluate(() => !document.getElementById('drawer').classList.contains('open'));
    check('D3 clic Audit -> navigation #/audit + tiroir refermé', page.url().includes('#/audit') && drawerClosed, page.url());

    /* ---------------- E. Audit ---------------- */
    await page.waitForSelector('[data-testid="audit-group-fisc"]', { timeout: 10000 });
    await noOverflow(page, 'E1 audit');
    await page.screenshot({ path: path.join(SHOTS, 'phase8-audit-390.png') });
    await page.click('[data-testid="audit-group-fisc"] [data-toggle]');
    await page.waitForTimeout(800);
    const auditSaved = await page.evaluate(() => {
      const row = window.__fmMockDB.fm_audit[0];
      return row && row.items && row.items.some((it) => it.done);
    });
    check('E2 bascule persistée en fm_audit (mock)', !!auditSaved);

    /* ---------------- F. Amortissements ---------------- */
    await renderRoute(page, '#/amortissements');
    await page.waitForSelector('[data-testid="amort-page"]', { timeout: 10000 });
    await page.click('[data-testid="immo-new"]');
    await page.waitForSelector('[data-testid="immo-form"]', { timeout: 5000 });
    await page.fill('#im-designation', 'Véhicule e2e');
    await page.fill('#im-compte', '245');
    await page.fill('#im-compteAmort', '284');
    await page.fill('#im-valeur', '6000000');
    await page.fill('#im-duree', '5');
    await page.fill('#im-date', '2026-03-15');
    await page.click('#imSave');
    await page.waitForSelector('[data-testid^="immo-card-"]', { timeout: 8000 });
    const immoCount = await page.evaluate(() => window.__fmMockDB.fm_immos.length);
    check('F1 immobilisation persistée en fm_immos (mock)', immoCount === 1, 'fm_immos=' + immoCount);
    await noOverflow(page, 'F2 amortissements');
    await page.screenshot({ path: path.join(SHOTS, 'phase8-amortissements-390.png') });
    // Plan + génération dotation
    await page.click('[data-plan]');
    await page.waitForSelector('[data-testid="immo-plan"]', { timeout: 5000 });
    await page.click('[data-testid="gen-dotation-2027"]');
    await page.waitForFunction(() => window.__fmMockDB.fm_entries.length === 1, null, { timeout: 8000 });
    const dot = await page.evaluate(() => (window.__fmMockDB.fm_entries[0] || {}).entry);
    const dotOk = dot && dot.journal === 'OD'
      && dot.lignes.some((l) => l.compte === '681' && l.debit > 0)
      && dot.lignes.some((l) => l.compte === '284' && l.credit > 0);
    check('F3 dotation 681 -> 284 passée au journal', !!dotOk, dot ? JSON.stringify(dot.lignes) : 'rien');

    /* ---------------- G. Assurances ---------------- */
    await renderRoute(page, '#/assurances');
    await page.waitForSelector('[data-testid="assur-page"]', { timeout: 10000 });
    await page.click('[data-testid="pol-new"]');
    await page.waitForSelector('[data-testid="pol-form"]', { timeout: 5000 });
    await page.fill('#po-assureur', 'NSIA e2e');
    await page.fill('#po-numero', 'P-E2E-1');
    await page.fill('#po-prime', '150000');
    await page.fill('#po-debut', '2026-01-01');
    await page.fill('#po-fin', '2026-12-31');
    await page.click('#poSave');
    await page.waitForSelector('[data-testid^="pol-card-"]', { timeout: 8000 });
    const polCount = await page.evaluate(() => window.__fmMockDB.fm_assurances.length);
    check('G1 police persistée en fm_assurances (mock)', polCount === 1, 'fm_assurances=' + polCount);
    await noOverflow(page, 'G2 assurances');
    await page.screenshot({ path: path.join(SHOTS, 'phase8-assurances-390.png') });
    await page.click('[data-testid^="pol-pay-"]');
    await page.waitForFunction(() => window.__fmMockDB.fm_entries.length === 2, null, { timeout: 8000 });
    const prime = await page.evaluate(() => (window.__fmMockDB.fm_entries[1] || {}).entry);
    const primeOk = prime && prime.journal === 'BQ'
      && prime.lignes.some((l) => l.compte === '625' && l.debit === 150000)
      && prime.lignes.some((l) => l.compte === '521' && l.credit === 150000);
    check('G3 prime 625 -> 521 passée au journal', !!primeOk);

    /* ---------------- H. Convertisseur ---------------- */
    await renderRoute(page, '#/convertisseur');
    await page.waitForSelector('[data-testid="fx-page"]', { timeout: 10000 });
    const fxResult = await page.inputValue('[data-testid="fx-result"]');
    check('H1 1 000 000 XOF -> EUR = 1 520,00', /1[\s\u00a0]?520/.test(fxResult || ''), fxResult);
    await noOverflow(page, 'H2 convertisseur');
    await page.screenshot({ path: path.join(SHOTS, 'phase8-convertisseur-390.png') });
    await page.click('[data-testid="fx-edit"]');
    await page.waitForSelector('[data-testid="fx-save"]', { timeout: 5000 });
    await page.fill('[data-fxrate="USD"]', '650');
    await page.click('[data-testid="fx-save"]');
    await page.waitForTimeout(800);
    const fxSaved = await page.evaluate(() => {
      const row = window.__fmMockDB.fm_settings.find((r) => r.key === 'fx_rates');
      return row && row.value && Number(row.value.USD.XOF) === 650;
    });
    check('H3 taux modifiés persistés en fm_settings', !!fxSaved);

    /* ---------------- I. Config ---------------- */
    await renderRoute(page, '#/config');
    await page.waitForSelector('[data-testid="config-page"]', { timeout: 10000 });
    await page.fill('[data-testid="cfg-company"]', 'ETS E2E Test');
    await page.click('[data-testid="cfg-save-company"]');
    await page.waitForTimeout(800);
    const compSaved = await page.evaluate(() => {
      const row = window.__fmMockDB.fm_settings.find((r) => r.key === 'company');
      return row && row.value === 'ETS E2E Test';
    });
    check('I1 entreprise persistée en fm_settings', !!compSaved);
    await page.fill('[data-testid="cfg-tax-tva"]', '19');
    await page.click('[data-testid="cfg-save-tax"]');
    await page.waitForTimeout(800);
    const taxSaved = await page.evaluate(() => {
      const row = window.__fmMockDB.fm_settings.find((r) => r.key === 'tax_overrides');
      return row && row.value && row.value.tva === '19';
    });
    check('I2 surcharge TVA persistée', !!taxSaved);
    await noOverflow(page, 'I3 config');
    await page.screenshot({ path: path.join(SHOTS, 'phase8-config-390.png') });
    const demoSection = await page.$('[data-testid="cfg-demo-section"]');
    check('I4 section démo masquée pour non-admin', demoSection === null);

    /* ---------------- J. Classeur ---------------- */
    await renderRoute(page, '#/classeur');
    await page.waitForSelector('[data-testid="classeur-page"]', { timeout: 10000 });
    const notice = await page.textContent('[data-testid="classeur-page"]');
    check('J1 notice OCR + bouton lecture affichés', /Lecture automatique/.test(notice || '')
      && await page.$('[data-testid="classeur-ocr"]') !== null);
    await page.fill('[data-testid="classeur-text"]',
      'ETS YANNICK\nFacture n° 8 du 06/10/2026\nTotal TTC : 1 180 000 F CFA\nTVA : 180 000 F CFA');
    await page.click('[data-testid="classeur-analyze"]');
    await page.waitForSelector('[data-testid="classeur-propose"]', { timeout: 5000 });
    const tiersVal = await page.inputValue('#cl-tiers');
    check('J2 extraction : tiers + total', /YANNICK/.test(tiersVal || ''), 'tiers=' + tiersVal);
    await noOverflow(page, 'J3 classeur (révision)');
    await page.screenshot({ path: path.join(SHOTS, 'phase8-classeur-390.png') });
    await page.click('[data-testid="classeur-propose"]');
    await page.waitForSelector('[data-testid="classeur-entry-0"]', { timeout: 5000 });
    const badge = await page.textContent('[data-testid="classeur-entry-0"]');
    check('J4 écriture proposée équilibrée', /Équilibrée/.test(badge || ''));
    await page.click('[data-testid="classeur-post"]');
    await page.waitForFunction(() => window.__fmMockDB.fm_entries.length === 3, null, { timeout: 8000 });
    const cl = await page.evaluate(() => (window.__fmMockDB.fm_entries[2] || {}).entry);
    const clOk = cl && cl.journal === 'AC'
      && cl.lignes.some((l) => l.compte === '601')
      && cl.lignes.some((l) => l.compte === '4452')
      && cl.lignes.some((l) => /^401/.test(l.compte)); // 401 ou sous-compte 401001 (nouveau tiers)
    check('J5 écriture classeur 601/4452/401 passée au journal', !!clOk);

    await ctx.close();
  } finally {
    if (browser) await browser.close();
    srv.close();
  }
  const failed = results.filter((r) => !r.ok);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' contrôles verts'
    + (failed.length ? ' — ÉCHECS : ' + failed.map((f) => f.name).join(' ; ') : ''));
  process.exit(failed.length ? 1 : 0);
})();
