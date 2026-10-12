#!/usr/bin/env node
/**
 * Test e2e 390px : Classeur Intelligent — OCR + factures de démo + sous-comptes.
 *
 * Même infrastructure que e2e/phase8-390.cjs : bundle de test (clés Supabase
 * factices), serveur statique, chrome-headless-shell via playwright-core,
 * Supabase REST mocké en page (window.__fmMockDB), session via
 * window.__fmSetSession (mémoire uniquement).
 *
 * Scénarios (session mockée) :
 *  K. Démo achat : 3 boutons démo -> clic « achat » -> analyse auto ->
 *     révision (tiers, total, notice nouveau tiers + sélecteur) ->
 *     écritures (601/4452/401, équilibrée) -> passation ->
 *     fm_entries (sous-compte 401001, doc=demo-facture-achat.pdf) +
 *     fm_settings tiers persisté.
 *  L. Journal : l'écriture apparaît avec le badge 📎 du document source.
 *  M. Démo bordereau DGI : 441/646/521, tiers DGI (pas de sous-compte).
 *  N. OCR : sans fichier -> erreur gracieuse (toast) ; consentement requis.
 * Captures : migration/app/screenshots/.
 *
 * Usage : node e2e/classeur-ocr-390.cjs   (depuis migration/app)
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
    await page.waitForSelector('[data-testid="dashboard-page"],[data-testid="journal-page"]', { timeout: 15000 }).catch(() => {});

    /* ---------------- K. Démo achat : flux complet ---------------- */
    await renderRoute(page, '#/classeur');
    await page.waitForSelector('[data-testid="classeur-page"]', { timeout: 10000 });
    const demos = await page.$$('[data-testid^="classeur-demo-"]');
    check('K1 3 boutons de factures de démo', demos.length === 3, demos.length + ' boutons');
    await noOverflow(page, 'K2 classeur (import)');
    await page.screenshot({ path: path.join(SHOTS, 'classeur-ocr-import-390.png') });

    await page.click('[data-testid="classeur-demo-achat"]');
    await page.waitForSelector('[data-testid="classeur-propose"]', { timeout: 5000 });
    const tiersVal = await page.inputValue('#cl-tiers');
    const totalVal = await page.inputValue('#cl-total');
    check('K3 démo achat : tiers + total extraits', /YANNICK/.test(tiersVal || '') && totalVal === '1180000',
      'tiers=' + tiersVal + ' total=' + totalVal);
    const typeSel = await page.$('#cl-tiers-type');
    check('K4 notice nouveau tiers + sélecteur de type', typeSel !== null);
    await noOverflow(page, 'K5 classeur (révision)');
    await page.screenshot({ path: path.join(SHOTS, 'classeur-ocr-review-390.png') });

    await page.click('[data-testid="classeur-propose"]');
    await page.waitForSelector('[data-testid="classeur-entry-0"]', { timeout: 5000 });
    const entryHtml = await page.innerHTML('[data-testid="classeur-entry-0"]');
    check('K6 écriture proposée équilibrée (601/4452/401)', /Équilibrée/.test(entryHtml || '')
      && /value="601"/.test(entryHtml || '') && /value="4452"/.test(entryHtml || '')
      && /value="401"/.test(entryHtml || ''));
    await page.screenshot({ path: path.join(SHOTS, 'classeur-ocr-entries-390.png') });

    await page.click('[data-testid="classeur-post"]');
    await page.waitForFunction(() => window.__fmMockDB.fm_entries.length === 1, null, { timeout: 8000 });
    const posted = await page.evaluate(() => (window.__fmMockDB.fm_entries[0] || {}).entry);
    const k7ok = posted && posted.journal === 'AC'
      && posted.lignes.some((l) => l.compte === '401001')
      && posted.lignes.some((l) => l.compte === '601')
      && posted.lignes.some((l) => l.compte === '4452')
      && posted.doc === 'demo-facture-achat.pdf';
    check('K7 passation : sous-compte 401001 + doc tracé', !!k7ok, JSON.stringify(posted && posted.lignes.map((l) => l.compte)));
    const tiersSaved = await page.evaluate(() => {
      const row = window.__fmMockDB.fm_settings.find((r) => r.key === 'tiers');
      return row && row.value;
    });
    check('K8 registre tiers persisté (fm_settings)', Array.isArray(tiersSaved)
      && tiersSaved.some((t) => t.nom === 'ETS YANNICK COMMERCE' && t.compte === '401001'),
      JSON.stringify(tiersSaved));

    /* ---------------- L. Journal : traçabilité ---------------- */
    await renderRoute(page, '#/journal');
    await page.waitForSelector('[data-testid="entry-card"]', { timeout: 10000 });
    const journalTxt = await page.textContent('[data-testid="journal-page"]');
    check('L1 écriture visible au journal avec badge document', /demo-facture-achat\.pdf/.test(journalTxt || ''));
    await noOverflow(page, 'L2 journal');

    /* ---------------- M. Démo bordereau DGI ---------------- */
    await renderRoute(page, '#/classeur');
    await page.waitForSelector('[data-testid="classeur-demo-dgi"]', { timeout: 10000 });
    await page.click('[data-testid="classeur-demo-dgi"]');
    await page.waitForSelector('[data-testid="classeur-propose"]', { timeout: 5000 });
    const dgiTiers = await page.inputValue('#cl-tiers');
    check('M1 bordereau DGI : tiers=DGI, pas de sélecteur de sous-compte',
      dgiTiers === 'DGI' && await page.$('#cl-tiers-type') === null, 'tiers=' + dgiTiers);
    await page.click('[data-testid="classeur-propose"]');
    await page.waitForSelector('[data-testid="classeur-entry-0"]', { timeout: 5000 });
    await page.click('[data-testid="classeur-post"]');
    await page.waitForFunction(() => window.__fmMockDB.fm_entries.length === 2, null, { timeout: 8000 });
    const dgi = await page.evaluate(() => (window.__fmMockDB.fm_entries[1] || {}).entry);
    const m2ok = dgi && dgi.journal === 'BQ'
      && dgi.lignes.some((l) => l.compte === '441' && l.debit === 500000)
      && dgi.lignes.some((l) => l.compte === '646' && l.debit === 25000)
      && dgi.lignes.some((l) => l.compte === '521' && l.credit === 525000);
    check('M2 bordereau DGI : 441/646 au débit, 521 au crédit', !!m2ok);
    await page.screenshot({ path: path.join(SHOTS, 'classeur-ocr-dgi-390.png') });

    /* ---------------- N. OCR : gardes gracieuses ---------------- */
    await renderRoute(page, '#/classeur');
    await page.waitForSelector('[data-testid="classeur-ocr"]', { timeout: 10000 });
    await page.click('[data-testid="classeur-ocr"]'); // sans fichier
    await page.waitForTimeout(700);
    const bodyTxt = await page.textContent('body');
    check('N1 OCR sans fichier -> message gracieux', /Choisissez d.abord un fichier/.test(bodyTxt || ''));
    await noOverflow(page, 'N2 classeur (import, final)');

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
