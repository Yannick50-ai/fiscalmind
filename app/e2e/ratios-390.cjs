#!/usr/bin/env node
/**
 * Test e2e 390px : Ratios de gestion (20 ratios, 5 catégories) — Phase 6.
 *
 * Même harnais que cr-sig-390.cjs : bundle de test (clés Supabase
 * factices, dist-e2e), serveur statique, chrome-headless-shell via
 * playwright-core, émulation mobile 390x844, Supabase MOCKÉ EN PAGE
 * (mini-base mémoire window.__fmMockDB), session injectée via
 * window.__fmSetSession.
 *
 * Particularité : la route #/ratios n'est PAS câblée dans app.js (un autre
 * agent travaille dessus en parallèle). La page est donc compilée en
 * bundle autonome (esbuild, IIFE, window.__fmRatiosPage) et invoquée
 * directement : window.__fmRatiosPage.renderRatiosPage().
 *
 * Données : montage comptable équilibré pré-chargé dans le mock
 * fm_entries, conçu pour exercer autonomie financière, liquidité
 * générale, marge nette, DSO (base 306 j), DPO, BFR, CAF — en N et N-1.
 * Attendus : AUTONOMIE = 72,1 % (N) / 94,3 % (N-1) ; LIQUIDITE = 2,54 ;
 * MARGE-NETTE = 70,0 % ; DSO = 408,0 j ; BFR = 210 000 F.
 *
 * Scénarios :
 * R1. Page rendue : [data-testid="ratios-page"], 5 catégories, 20 cartes.
 * R2. Badges « ⚠ à valider » visibles sur DSO, BFR, DPO (+ formule 306 j
 *     en légende du DSO).
 * R3. Valeurs N vérifiées à l'écran : AUTONOMIE, LIQUIDITE, MARGE-NETTE,
 *     DSO, BFR (+ N-1 de l'autonomie).
 * R4. Jauges vs norme affichées (verdicts ✓/⚠).
 * R5. Bouton « ⬇️ Excel » -> téléchargement ratios_gestion_2025.xls ;
 *     bouton « 🖨️ PDF » présent.
 * R6. Pas de débordement horizontal à 390 px.
 * Captures : migration/app/screenshots/ratios-390.png (+ viewport).
 *
 * Usage : node e2e/ratios-390.cjs   (depuis migration/app)
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
  console.log('construction du bundle autonome de la page ratios…');
  execSync(
    'npx esbuild src/pages/ratios.js --bundle --format=iife '
    + '--global-name=__fmRatiosPage --outfile=dist-e2e/ratios-page.js --log-level=error '
    + '--define:import.meta.env=\'{"VITE_SUPABASE_URL":"https://e2e-test.supabase.co",'
    + '"VITE_SUPABASE_ANON_KEY":"e2e-dummy-anon-key"}\'',
    { cwd: APP, stdio: 'pipe' },
  );
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
 * Script injecté AVANT le chargement de l'appli : mock Supabase REST
 * (mini-base mémoire) pré-chargé avec le montage ratios + réglages
 * (fm_settings : période 2025, entreprise « E2E Test SARL »).
 */
function mockInitScript() {
  /* eslint-disable */
  const UID = 'e2e-uid';
  const Lg = (compte, debit, credit) => ({ compte, debit, credit });
  const mk = (id, date, lignes) => ({ id, date, journal: 'OD', piece: id, libelle: id, lignes });
  const entries = [
    mk('n1', '2024-01-05', [Lg('101', 0, 200000), Lg('521', 200000, 0)]),
    mk('n2', '2024-03-01', [Lg('411', 118000, 0), Lg('701', 0, 100000), Lg('4431', 0, 18000)]),
    mk('e1', '2025-01-05', [Lg('101', 0, 400000), Lg('521', 400000, 0)]),
    mk('e2', '2025-02-01', [Lg('164', 0, 100000), Lg('521', 100000, 0)]),
    mk('e3', '2025-03-01', [Lg('411', 354000, 0), Lg('701', 0, 300000), Lg('4431', 0, 54000)]),
    mk('e4', '2025-04-01', [Lg('601', 120000, 0), Lg('4452', 21600, 0), Lg('401', 0, 141600)]),
    mk('e5', '2025-05-01', [Lg('681', 20000, 0), Lg('281', 0, 20000)]),
    mk('e6', '2025-06-01', [Lg('311', 50000, 0), Lg('6031', 0, 50000)]),
  ];
  const DB = {
    fm_entries: entries.map((entry, i) => ({ user_id: UID, entry_id: 'e2e-ratios-' + i, entry })),
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
    await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com/, (r) => r.abort());

    // Charge l'appli (landing), puis le bundle autonome de la page ratios.
    await page.goto(base, { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => typeof window.__fmSetSession === 'function', null, { timeout: 10000 });
    await page.addScriptTag({ url: '/ratios-page.js' });
    await page.waitForFunction(() => window.__fmRatiosPage && typeof window.__fmRatiosPage.renderRatiosPage === 'function',
      null, { timeout: 15000 });

    // Session dans le contexte du bundle autonome + affichage de la coquille.
    await page.evaluate(() => {
      window.__fmSetSession({ uid: 'e2e-uid', email: 'e2e@test.fr' });
      document.querySelectorAll('.page-section').forEach((s) => s.classList.remove('active'));
      document.getElementById('appShell').hidden = false;
      window.scrollTo(0, 0);
    });

    // Invoque la page directement (route #/ratios non câblée dans app.js).
    await page.evaluate(() => window.__fmRatiosPage.renderRatiosPage());
    await page.waitForSelector('[data-testid="ratios-page"]', { timeout: 15000 });
    await page.waitForSelector('[data-testid="ratio-DSO"]', { state: 'attached', timeout: 15000 });
    // Ouvre les 5 sections repliables pour les contrôles et les captures.
    await page.evaluate(() => {
      document.querySelectorAll('details.rg-cat').forEach((d) => { d.open = true; });
    });
    await page.waitForTimeout(300);

    const norm = (s) => (s || '').replace(/[  ]/g, ' ');
    const valN = async (code) => norm(await page.textContent('[data-testid="ratio-' + code + '-n"]'));

    /* ---- R1 : 5 catégories, 20 cartes ---- */
    const catCount = await page.$$eval('[data-testid="ratios-cat"]', (els) => els.length);
    check('R1a 5 catégories affichées', catCount === 5, 'cats=' + catCount);
    const cardCount = await page.$$eval('[data-testid="ratios-page"] [data-code]', (els) => els.length);
    check('R1b 20 cartes ratio affichées', cardCount === 20, 'cartes=' + cardCount);
    const catTitles = norm(await page.$$eval('[data-testid="ratios-cat"] > summary',
      (els) => els.map((e) => e.textContent).join(' | ')));
    check('R1c titres des 5 catégories',
      /Structure financière/.test(catTitles) && /Liquidité/.test(catTitles)
      && /Rentabilité/.test(catTitles) && /Activité/.test(catTitles)
      && /autofinancement/i.test(catTitles),
      catTitles.slice(0, 120));

    /* ---- R2 : badges « à valider » sur DSO / BFR / DPO ---- */
    for (const code of ['DSO', 'BFR', 'DPO']) {
      const el = await page.$('[data-testid="badge-av-' + code + '"]');
      const txt = el ? norm(await el.textContent()) : '';
      check('R2 badge « ⚠ à valider » sur ' + code, el !== null && /à valider/.test(txt), txt);
    }
    const dsoForm = norm(await page.textContent('[data-testid="ratio-DSO"] .rg-form'));
    check('R2b formule DSO en légende (base 306 j)', /306/.test(dsoForm || ''),
      (dsoForm || '').trim().replace(/\s+/g, ' ').slice(0, 120));

    /* ---- R3 : valeurs N vérifiées à l'écran ---- */
    const auto = await valN('AUTONOMIE');
    check('R3a AUTONOMIE = 72,1 % (N)', /72,1\s?%/.test(auto), auto);
    const autoCard = norm(await page.textContent('[data-testid="ratio-AUTONOMIE"]'));
    check('R3b AUTONOMIE N-1 = 94,3 %', /94,3\s?%/.test(autoCard), autoCard.slice(0, 80));
    const liq = await valN('LIQUIDITE');
    check('R3c LIQUIDITE = 2,54', /2,54/.test(liq), liq);
    const marge = await valN('MARGE-NETTE');
    check('R3d MARGE-NETTE = 70,0 %', /70,0\s?%/.test(marge), marge);
    const dso = await valN('DSO');
    check('R3e DSO = 408,0 j', /408,0\s?j/.test(dso), dso);
    const bfr = await valN('BFR');
    check('R3f BFR = 210 000,00 F', /210 000,00\s?F/.test(bfr), bfr);

    /* ---- R4 : jauges vs norme ---- */
    const gaugeCount = await page.$$eval('[data-testid="ratios-page"] .rg-gauge', (els) => els.length);
    check('R4a jauges vs norme affichées', gaugeCount >= 10, 'jauges=' + gaugeCount);
    const verdicts = norm(await page.$$eval('[data-testid="ratios-page"] .rg-gauge',
      (els) => els.map((e) => e.textContent).join(' ')));
    check('R4b verdicts ✓ cible / ⚠ hors cible présents',
      /✓ cible/.test(verdicts) && /hors cible/.test(verdicts),
      verdicts.slice(0, 100));

    /* ---- R5 : boutons Excel + PDF ---- */
    const xlLabel = await page.textContent('[data-testid="ratios-excel"]');
    check('R5a bouton « ⬇️ Excel »', /Excel/.test(xlLabel || ''), (xlLabel || '').trim());
    const dlPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    await page.click('[data-testid="ratios-excel"]');
    const dl = await dlPromise;
    check('R5b clic -> téléchargement .xls', !!dl && /\.xls$/.test(dl.suggestedFilename() || ''),
      dl ? dl.suggestedFilename() : 'aucun download');
    check('R5c nom de fichier ratios_gestion_2025.xls',
      !!dl && dl.suggestedFilename() === 'ratios_gestion_2025.xls',
      dl ? dl.suggestedFilename() : 'aucun download');
    const pdfBtn = await page.$('[data-testid="ratios-pdf"]');
    check('R5d bouton « 🖨️ PDF » présent', pdfBtn !== null);

    await noOverflow(page, 'R6 ratios de gestion');
    await page.screenshot({ path: path.join(SHOTS, 'ratios-390-viewport.png') });
    await page.screenshot({ path: path.join(SHOTS, 'ratios-390.png'), fullPage: true });

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
