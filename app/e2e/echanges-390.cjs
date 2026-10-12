#!/usr/bin/env node
/**
 * Test e2e 390px : Échanges DGI — Export XML + Import CSV (Phase 7).
 *
 * Même harnais que tft-390.cjs : bundle de test (clés Supabase factices,
 * dist-e2e), serveur statique, chrome-headless-shell via playwright-core,
 * émulation mobile 390x844, Supabase MOCKÉ EN PAGE (mini-base mémoire
 * window.__fmMockDB), session injectée via window.__fmSetSession.
 *
 * NOTE : la route '#/echanges' et son import sont INJECTÉS TEMPORAIREMENT
 * dans app/src/app.js pour le build e2e, puis le fichier est RESTAURÉ à
 * l'identique (le câblage définitif sera fait par le coordinateur).
 *
 * Données : montage comptable équilibré sur 2025 (N) :
 *  capital 2 000 000, vente 1 000 000 (TVA 180 000), achat 200 000 payé.
 * Réglages : période 2025, entreprise « E2E Test SARL »,
 *  NCC/IFU « BF-OUA-2025-B00123 ».
 *
 * Scénarios :
 * T1. #/echanges -> page visible (guard OK), 2 sections présentes.
 * T2. Export : aperçu des champs + nom NO-2025-… ; clic -> téléchargement
 *     .xml non vide, nom conforme NO-{exercice}-{ncc}-{aaaammjj}.xml.
 * T3. Import CSV ddMMyy : 2 écritures valides + 1 ligne en erreur ->
 *     2 écritures importées (mock DB +2), erreur affichée avec n° de ligne.
 * T4. Pas de débordement horizontal à 390 px.
 * Captures : migration/app/screenshots/ (echanges-export-390.png,
 *  echanges-import-390.png).
 *
 * Usage : node e2e/echanges-390.cjs   (depuis migration/app)
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

const APPJS = path.join(APP, 'src', 'app.js');
const ROUTE_IMPORT = "import { renderEchangesPage } from './pages/echanges.js';\n";
const ROUTE_LINE = "  'echanges': { guard: true, render: () => { showShell(); markNav('echanges'); renderEchangesPage(); setHeader('Échanges DGI'); } },\n";
let appjsOriginal = null;

function patchApp() {
  appjsOriginal = fs.readFileSync(APPJS, 'utf8');
  if (appjsOriginal.includes('./pages/echanges.js')) return; // déjà câblé : pas de patch
  let s = appjsOriginal;
  s = s.replace(
    "import { renderConfigPage } from './pages/config.js';\n",
    "import { renderConfigPage } from './pages/config.js';\n" + ROUTE_IMPORT
  );
  s = s.replace(
    "  'config': { guard: true, render: () => { showShell(); markNav('config'); renderConfigPage(); setHeader('Configuration'); } },\n",
    "  'config': { guard: true, render: () => { showShell(); markNav('config'); renderConfigPage(); setHeader('Configuration'); } },\n" + ROUTE_LINE
  );
  if (!s.includes(ROUTE_LINE.trim())) throw new Error('injection de la route echanges impossible');
  fs.writeFileSync(APPJS, s);
  console.log('route #/echanges injectée TEMPORAIREMENT dans app.js (restauration après le test)');
}

function restoreApp() {
  if (appjsOriginal !== null) {
    fs.writeFileSync(APPJS, appjsOriginal);
    const ok = fs.readFileSync(APPJS, 'utf8') === appjsOriginal;
    console.log('app.js restauré : ' + (ok ? 'IDENTIQUE' : '!!! DIFFÉRENT !!!'));
    if (!ok) throw new Error('restauration de app.js échouée');
  }
}

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

async function renderRoute(page, hash) {
  const cur = await page.evaluate(() => window.location.hash);
  if (cur === hash) {
    await page.evaluate(() => window.dispatchEvent(new HashChangeEvent('hashchange')));
  } else {
    await page.evaluate((h) => { window.location.hash = h; }, hash);
  }
  await page.waitForTimeout(500);
}

async function blockFonts(page) {
  await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com/, (r) => r.abort());
}

function mockInitScript() {
  /* eslint-disable */
  const UID = 'e2e-uid';
  const Lg = (compte, debit, credit) => ({ compte, debit, credit });
  const mk = (id, date, lignes) => ({ id, date, journal: 'OD', piece: id, libelle: id, lignes });
  const entries = [
    mk('e1', '2025-01-10', [Lg('521', 2000000, 0), Lg('101', 0, 2000000)]),
    mk('e2', '2025-03-01', [Lg('411', 1180000, 0), Lg('701', 0, 1000000), Lg('443', 0, 180000)]),
    mk('e3', '2025-04-01', [Lg('601', 200000, 0), Lg('401', 0, 200000)]),
    mk('e4', '2025-04-02', [Lg('401', 200000, 0), Lg('521', 0, 200000)]),
  ];
  const DB = {
    fm_entries: entries.map((entry, i) => ({ user_id: UID, entry_id: 'e2e-ech-' + i, entry })),
    fm_journals: [],
    fm_chat: [],
    fm_settings: [
      { user_id: UID, key: 'periode', value: { debut: '2025-01-01', fin: '2025-12-31' } },
      { user_id: UID, key: 'company', value: 'E2E Test SARL' },
      { user_id: UID, key: 'company_ifu', value: 'BF-OUA-2025-B00123' },
      { user_id: UID, key: 'country', value: 'BF' },
    ],
    fm_audit: [], fm_immos: [], fm_assurances: [],
  };
  window.__fmMockDB = DB;
  const KEYS = {
    fm_entries: ['user_id', 'entry_id'],
    fm_journals: ['user_id', 'code'],
    fm_chat: ['user_id'],
    fm_settings: ['user_id', 'key'],
    fm_audit: ['user_id'],
    fm_immos: ['user_id'],
    fm_assurances: ['user_id'],
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
    const parsed = new URL(raw);
    const table = parsed.pathname.split('/rest/v1/')[1].split('?')[0];
    const method = String(opts.method || 'GET').toUpperCase();
    if (!DB[table]) return json([], 200);
    if (method === 'GET') {
      const c = conds(parsed.searchParams);
      const rows = DB[table].filter((r) => c.every(([k, v]) => String(r[k]) === v));
      const h = JSON.stringify(opts.headers || {});
      if (/vnd\.pgrst\.object/.test(h)) return json(rows[0] || null);
      return json(rows);
    }
    if (method === 'POST' || method === 'PATCH') {
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
      window.__fmSetSession({ uid: UID, email: 'e2e@test.fr' });
      window.__fmSessionSet = true;
      clearInterval(t);
    }
  }, 50);
  /* eslint-enable */
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  try {
    patchApp();
    buildTestBundle();
  } catch (e) {
    console.log('ERREUR build : ' + e.message);
    try { restoreApp(); } catch (_) { /* noop */ }
    process.exitCode = 1;
    return;
  }
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

    await page.goto(base + '#/echanges', { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.__fmSessionSet === true, null, { timeout: 10000 });
    await renderRoute(page, '#/echanges');
    await page.waitForSelector('[data-testid="echanges-page"]', { timeout: 15000 });

    /* ---- T1 : page + 2 sections ---- */
    check('T1a page Échanges DGI visible', (await page.$('[data-testid="echanges-page"]')) !== null);
    check('T1b section Export présente', (await page.$('[data-testid="ech-export-preview"]')) !== null);
    check('T1c section Import présente', (await page.$('[data-testid="ech-csv-preview"]')) !== null);

    /* ---- T2 : export XML ---- */
    const stats = await page.textContent('[data-testid="ech-export-stats"]');
    const fileMatch = (stats || '').match(/NO-2025-BFOUA2025B00123-\d{8}\.xml/);
    check('T2a aperçu : nom NO-2025-BFOUA2025B00123-aaaammjj.xml',
      !!fileMatch, fileMatch ? fileMatch[0] : (stats || '').slice(0, 60));
    check('T2b aperçu : lignes bilan/CR/TFT exportées',
      /bilan\s*\d+/.test(stats || '') && /compte de résultat\s*\d+/.test(stats || ''),
      (stats || '').replace(/\s+/g, ' ').slice(0, 140));
    check('T2c rappel NCC affiché', /Vérifiez votre NCC/.test(await page.textContent('[data-testid="ech-export-id"]') || ''));
    const dlPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    await page.click('[data-testid="ech-dl-xml"]');
    const dl = await dlPromise;
    check('T2d clic -> téléchargement .xml', !!dl && /\.xml$/.test(dl.suggestedFilename() || ''),
      dl ? dl.suggestedFilename() : 'aucun download');
    let dlSize = 0;
    if (dl) {
      const p = await dl.path();
      if (p && fs.existsSync(p)) dlSize = fs.statSync(p).size;
    }
    check('T2e fichier XML non vide', dlSize > 200, dlSize + ' octets');
    await page.screenshot({ path: path.join(SHOTS, 'echanges-export-390.png') });

    /* ---- T3 : import CSV ---- */
    const before = await page.evaluate(() => window.__fmMockDB.fm_entries.length);
    const csv = [
      '521;010126;BQ;A1;Capital;2000000;',
      '101;010126;BQ;A1;Capital;;2000000',
      '411;150326;VT;A2;Vente;1180000;',
      '701;150326;VT;A2;Vente;;1000000',
      '443;150326;VT;A2;Vente;;180000',
      '52X;150326;VT;A2;Vente;;180000',
    ].join('\n');
    await page.fill('[data-testid="ech-csv-text"]', csv);
    await page.waitForTimeout(400);
    const previewTxt = await page.textContent('[data-testid="ech-csv-preview"]');
    check('T3a aperçu : 2 écritures valides / 1 ligne en erreur',
      /Écritures valides :\s*2/.test(previewTxt || '') && /lignes en erreur :\s*1/.test(previewTxt || ''),
      (previewTxt || '').replace(/\s+/g, ' ').slice(0, 120));
    check('T3b erreur localisée (Ligne 6, compte)',
      /Ligne 6/.test(previewTxt || '') && /Compte/.test(previewTxt || ''));
    await page.click('[data-testid="ech-import"]');
    await page.waitForSelector('[data-testid="ech-import-report"]', { timeout: 10000 });
    const report = await page.textContent('[data-testid="ech-import-report"]');
    check('T3c rapport : 2 écritures importées', /2.*importée/.test(report || ''), (report || '').trim().slice(0, 80));
    const after = await page.evaluate(() => window.__fmMockDB.fm_entries.length);
    check('T3d mock DB : +2 écritures', after === before + 2, before + ' -> ' + after);
    const imported = await page.evaluate(() =>
      window.__fmMockDB.fm_entries.slice(-2).map((r) => r.entry));
    const dates = imported.map((e) => e.date);
    check('T3e dates ddMMyy converties (2026-01-01, 2026-03-15)',
      dates.includes('2026-01-01') && dates.includes('2026-03-15'), dates.join(','));

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOTS, 'echanges-import-390.png') });

    /* ---- T4 : pas de débordement ---- */
    await noOverflow(page, 'T4 Échanges');

    await ctx.close();
  } finally {
    if (browser) await browser.close();
    srv.close();
    try { restoreApp(); } catch (e) { console.log('RESTAURATION ÉCHOUÉE : ' + e.message); process.exitCode = 1; }
  }
  const failed = results.filter((r) => !r.ok);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' contrôles verts');
  if (failed.length > 0) process.exitCode = 1;
})();
