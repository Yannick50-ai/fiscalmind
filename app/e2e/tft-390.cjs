#!/usr/bin/env node
/**
 * Test e2e 390px : TFT — Tableau des Flux de Trésorerie (méthode directe, Phase 3).
 *
 * Même harnais que cr-sig-390.cjs : bundle de test (clés Supabase factices,
 * dist-e2e), serveur statique, chrome-headless-shell via playwright-core,
 * émulation mobile 390x844, Supabase MOCKÉ EN PAGE (mini-base mémoire
 * window.__fmMockDB), session injectée via window.__fmSetSession.
 *
 * Données : montage comptable équilibré sur 2024 (N-1) et 2025 (N).
 * Attendus : ZA = 800 000 / 0 ; ZG = 580 000 / 800 000 ;
 * ZH = 1 380 000 / 800 000 ; FA (CAFG) = 120 000 / 150 000 ;
 * contrôles ZH = trésorerie nette et ZG = ZB+ZC+ZF verts.
 *
 * Scénarios :
 * T1. #/etats?tab=tft -> table TFT visible (data-testid="tft-table").
 * T2. Refs officielles visibles : ZA, ZB, ZC, ZD, ZE, ZF, ZG, ZH, FA, FQ.
 * T3. Valeurs vérifiées à l'écran : ZA, ZG, ZH (N et N-1).
 * T4. Ligne FQ : badge « ⚠ à valider » + note des deux hypothèses.
 * T5. Bouton de téléchargement = « ⬇️ Excel » sur l'onglet TFT ;
 *     le clic déclenche un téléchargement .xls (module app/src/exports.js).
 * T6. Détail TBFT repliable : ouverture + contenu visible.
 * T7. Pas de débordement horizontal à 390 px.
 * Captures : migration/app/screenshots/ (tft-390.png, tft-tbft-390.png).
 *
 * Usage : node e2e/tft-390.cjs   (depuis migration/app)
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

/**
 * Script injecté AVANT le chargement de l'appli :
 * - mock Supabase REST en page (mini-base mémoire window.__fmMockDB),
 *   PRÉ-CHARGÉ avec le montage TFT (fm_entries) + réglages
 *   (fm_settings : période 2025, entreprise « E2E Test SARL ») ;
 * - session mémoire via window.__fmSetSession (hook de test de auth.js).
 */
function mockInitScript() {
  /* eslint-disable */
  const UID = 'e2e-uid';
  const Lg = (compte, debit, credit) => ({ compte, debit, credit });
  const mk = (id, date, lignes) => ({
    id, date, journal: 'OD', piece: id, libelle: id, lignes,
  });
  const entries = [
    // ---- 2024 (N-1) ----
    mk('e1', '2024-01-15', [Lg('521', 2000000, 0), Lg('101', 0, 2000000)]),
    mk('e2', '2024-02-01', [Lg('244', 600000, 0), Lg('4042', 0, 600000)]),
    mk('e3', '2024-03-01', [Lg('4042', 400000, 0), Lg('521', 0, 400000)]),
    mk('e4', '2024-04-01', [Lg('411', 1180000, 0), Lg('701', 0, 1000000), Lg('443', 0, 180000)]),
    mk('e5', '2024-06-01', [Lg('601', 500000, 0), Lg('401', 0, 500000)]),
    mk('e6', '2024-07-01', [Lg('401', 500000, 0), Lg('521', 0, 500000)]),
    mk('e7', '2024-08-01', [Lg('661', 300000, 0), Lg('421', 0, 300000)]),
    mk('e8', '2024-08-02', [Lg('421', 300000, 0), Lg('521', 0, 300000)]),
    mk('e9', '2024-12-31', [Lg('6813', 60000, 0), Lg('284', 0, 60000)]),
    mk('e10', '2024-12-31', [Lg('891', 50000, 0), Lg('441', 0, 50000)]),
    // ---- 2025 (N) ----
    mk('f1', '2025-01-10', [Lg('521', 1180000, 0), Lg('411', 0, 1180000)]),
    mk('f2', '2025-03-01', [Lg('411', 590000, 0), Lg('701', 0, 500000), Lg('443', 0, 90000)]),
    mk('f3', '2025-04-01', [Lg('601', 200000, 0), Lg('401', 0, 200000)]),
    mk('f4', '2025-04-02', [Lg('401', 200000, 0), Lg('521', 0, 200000)]),
    mk('f5', '2025-05-01', [Lg('661', 150000, 0), Lg('421', 0, 150000)]),
    mk('f6', '2025-05-02', [Lg('421', 150000, 0), Lg('521', 0, 150000)]),
    mk('f7', '2025-06-01', [Lg('6813', 60000, 0), Lg('284', 0, 60000)]),
    mk('f8', '2025-07-01', [Lg('891', 30000, 0), Lg('441', 0, 30000)]),
    mk('f9', '2025-08-01', [Lg('441', 50000, 0), Lg('521', 0, 50000)]),
    mk('f10', '2025-10-01', [Lg('4042', 200000, 0), Lg('521', 0, 200000)]),
  ];
  const DB = {
    fm_entries: entries.map((entry, i) => ({ user_id: UID, entry_id: 'e2e-tft-' + i, entry })),
    fm_journals: [],
    fm_chat: [],
    fm_settings: [
      { user_id: UID, key: 'periode', value: { debut: '2025-01-01', fin: '2025-12-31' } },
      { user_id: UID, key: 'company', value: 'E2E Test SARL' },
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
      if (/vnd\.pgrst\.object/.test(h)) return json(rows[0] || null); // maybeSingle
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

    await page.goto(base + '#/etats?tab=tft', { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.__fmSessionSet === true, null, { timeout: 10000 });
    await renderRoute(page, '#/etats?tab=tft');
    await page.waitForSelector('[data-testid="etats-page"]', { timeout: 15000 });
    await page.waitForSelector('[data-testid="tft-table"]', { timeout: 15000 });

    // fmt() utilise l'espace insécable étroit (U+202F) comme séparateur de
    // milliers en fr-FR : on normalise avant les contrôles.
    const norm = (s) => (s || '').replace(/[  ]/g, ' ');
    const rowText = async (ref) => norm(await page.textContent('[data-ref="' + ref + '"]'));
    // Cellules numériques d'une ligne (index 0 = N, 1 = N-1).
    const cellText = async (ref, idx) => norm(await page.$eval(
      '[data-ref="' + ref + '"] td.num:nth-of-type(' + (idx + 3) + ')',
      (el) => el.textContent));

    /* ---- T1 : onglet TFT visible ---- */
    const tab = await page.$('[data-testid="tab-tft"]');
    check('T1 onglet « 💧 TFT » visible', tab !== null);
    const tbl = await page.$('[data-testid="tft-table"]');
    check('T1b table TFT visible', tbl !== null);

    /* ---- T2 : refs officielles ---- */
    for (const ref of ['ZA', 'ZB', 'ZC', 'ZD', 'ZE', 'ZF', 'ZG', 'ZH', 'FA', 'FQ']) {
      const el = await page.$('[data-ref="' + ref + '"]');
      check('T2 réf ' + ref + ' visible', el !== null);
    }

    /* ---- T3 : valeurs N et N-1 ---- */
    const za = await rowText('ZA');
    const zaN1 = await cellText('ZA', 1);
    check('T3a ZA = 800 000 (N) / 0 (N-1)',
      /800 000,00/.test(za || '') && zaN1.trim() === '0,00',
      (za || '').trim().replace(/\s+/g, ' ').slice(0, 100));
    const zg = await rowText('ZG');
    check('T3b ZG = 580 000 (N) / 800 000 (N-1)',
      /580 000,00/.test(zg || '') && /800 000,00/.test(zg || ''),
      (zg || '').trim().replace(/\s+/g, ' ').slice(0, 100));
    const zh = await rowText('ZH');
    check('T3c ZH = 1 380 000 (N) / 800 000 (N-1)',
      /1 380 000,00/.test(zh || '') && /800 000,00/.test(zh || ''),
      (zh || '').trim().replace(/\s+/g, ' ').slice(0, 100));
    const fa = await rowText('FA');
    check('T3d FA (CAFG) = 120 000 (N) / 150 000 (N-1)',
      /120 000,00/.test(fa || '') && /150 000,00/.test(fa || ''),
      (fa || '').trim().replace(/\s+/g, ' ').slice(0, 100));
    const thCount = await page.$$eval('[data-testid="tft-table"] thead th', (ths) => ths.length);
    check('T3e table TFT : 4 colonnes (Réf, Rubrique, N, N-1)', thCount === 4, 'th=' + thCount);

    /* ---- T4 : FQ à valider ---- */
    const badge = await page.textContent('[data-testid="tft-fq-badge"]');
    check('T4a badge « ⚠ à valider » sur la ligne FQ', /à valider/.test(badge || ''), (badge || '').trim());
    const fqNote = norm(await page.textContent('[data-testid="tft-fq-note"]'));
    check('T4b note FQ : deux hypothèses exposées',
      /Hypothèse affichée/.test(fqNote || '') && /alternative/.test(fqNote || ''),
      (fqNote || '').trim().replace(/\s+/g, ' ').slice(0, 120));

    /* ---- T5 : bouton Excel + téléchargement .xls ---- */
    const dlLabel = await page.textContent('[data-testid="etats-download"]');
    check('T5a bouton « ⬇️ Excel » sur l’onglet TFT', /Excel/.test(dlLabel || ''), (dlLabel || '').trim());
    const dlPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    await page.click('[data-testid="etats-download"]');
    const dl = await dlPromise;
    check('T5b clic -> téléchargement .xls', !!dl && /\.xls$/.test(dl.suggestedFilename() || ''),
      dl ? dl.suggestedFilename() : 'aucun download');
    check('T5c nom de fichier tft_2025.xls',
      !!dl && dl.suggestedFilename() === 'tft_2025.xls',
      dl ? dl.suggestedFilename() : 'aucun download');

    /* ---- T6 : détail TBFT repliable ---- */
    const det = await page.$('[data-testid="tft-tbft"]');
    check('T6a bloc TBFT présent', det !== null);
    await page.click('[data-testid="tft-tbft"] summary');
    await page.waitForTimeout(300);
    const detOpen = await page.$eval('[data-testid="tft-tbft"]', (el) => el.open);
    check('T6b TBFT ouvert au clic', detOpen === true);
    const detText = norm(await page.textContent('[data-testid="tft-tbft"]'));
    check('T6c détail TBFT : FA — CAFG et sections A/B/C',
      /FA — CAFG/.test(detText || '') && /Flux d.investissement/.test(detText || ''),
      (detText || '').trim().replace(/\s+/g, ' ').slice(0, 120));

    await noOverflow(page, 'T7 TFT');
    await page.screenshot({ path: path.join(SHOTS, 'tft-390.png') });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOTS, 'tft-tbft-390.png') });

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
