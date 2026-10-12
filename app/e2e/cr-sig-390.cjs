#!/usr/bin/env node
/**
 * Test e2e 390px : Compte de résultat aux SIG officiels OHADA — Phase 2.
 *
 * Même harnais que bilan-modele2-390.cjs : bundle de test (clés Supabase
 * factices, dist-e2e), serveur statique, chrome-headless-shell via
 * playwright-core, émulation mobile 390x844, Supabase MOCKÉ EN PAGE
 * (mini-base mémoire window.__fmMockDB), session injectée via
 * window.__fmSetSession.
 *
 * Données : un montage comptable équilibré pré-chargé dans le mock
 * fm_entries, conçu pour exercer la cascade des SIG (TA→XI), les
 * variations de stocks (6031) et les colonnes N / N-1.
 * Attendus : TA=1 000 000 / 500 000 ; XA=500 000 / 200 000 ;
 * XB=1 400 000 / 500 000 ; XI=642 000 / 200 000.
 *
 * Scénarios :
 * C1. #/etats?tab=cr -> badge « Résultat net : 642 000,00 ».
 * C2. Refs officielles visibles : TA, XA, XB, XC, XD, XE, XF, XG, XH, XI.
 * C3. Table CR : 4 colonnes (Réf, Rubrique, N, N-1), 42 lignes.
 * C4. Valeurs vérifiées à l'écran : TA, XA, XB, XI (N et N-1), RB.
 * C5. Bouton de téléchargement = « ⬇️ Excel » sur l'onglet résultat ;
 *     le clic déclenche un téléchargement .xls (module app/src/exports.js).
 * C6. Pas de débordement horizontal à 390 px.
 * Captures : migration/app/screenshots/.
 *
 * Usage : node e2e/cr-sig-390.cjs   (depuis migration/app)
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
 *   PRÉ-CHARGÉ avec le montage SIG de test (fm_entries) + réglages
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
    mk('e1', '2025-03-01', [Lg('411', 1000000, 0), Lg('701', 0, 1000000)]),
    mk('e2', '2025-03-02', [Lg('601', 600000, 0), Lg('401', 0, 600000)]),
    mk('e3', '2025-03-03', [Lg('311', 100000, 0), Lg('6031', 0, 100000)]),
    mk('e4', '2025-04-01', [Lg('411', 400000, 0), Lg('702', 0, 400000)]),
    mk('e5', '2025-05-01', [Lg('661', 200000, 0), Lg('421', 0, 200000)]),
    mk('e6', '2025-06-01', [Lg('681', 50000, 0), Lg('281', 0, 50000)]),
    mk('e7', '2025-07-01', [Lg('521', 20000, 0), Lg('771', 0, 20000)]),
    mk('e8', '2025-07-02', [Lg('671', 8000, 0), Lg('521', 0, 8000)]),
    mk('e9', '2025-08-01', [Lg('521', 30000, 0), Lg('821', 0, 30000)]),
    mk('e10', '2025-08-02', [Lg('812', 10000, 0), Lg('244', 0, 10000)]),
    mk('e11', '2025-09-01', [Lg('891', 40000, 0), Lg('441', 0, 40000)]),
    mk('n1', '2024-02-01', [Lg('411', 500000, 0), Lg('701', 0, 500000)]),
    mk('n2', '2024-02-02', [Lg('601', 300000, 0), Lg('401', 0, 300000)]),
  ];
  const DB = {
    fm_entries: entries.map((entry, i) => ({ user_id: UID, entry_id: 'e2e-cr-' + i, entry })),
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

    await page.goto(base + '#/etats?tab=cr', { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.__fmSessionSet === true, null, { timeout: 10000 });
    await renderRoute(page, '#/etats?tab=cr');
    await page.waitForSelector('[data-testid="etats-page"]', { timeout: 15000 });
    await page.waitForSelector('[data-testid="cr-table"]', { timeout: 15000 });

    // fmt() utilise l'espace insécable étroit (U+202F) comme séparateur de
    // milliers en fr-FR : on normalise avant les contrôles.
    const norm = (s) => (s || '').replace(/[  ]/g, ' ');
    const rowText = async (ref) => norm(await page.textContent('[data-ref="' + ref + '"]'));

    /* ---- C1 : badge résultat net ---- */
    const badge = norm(await page.textContent('[data-testid="cr-resnet"]'));
    check('C1 badge « Résultat net : 642 000,00 »', /642 000,00/.test(badge || ''), (badge || '').trim().slice(0, 60));

    /* ---- C2 : refs officielles des SIG ---- */
    for (const ref of ['TA', 'XA', 'XB', 'XC', 'XD', 'XE', 'XF', 'XG', 'XH', 'XI']) {
      const el = await page.$('[data-ref="' + ref + '"]');
      check('C2 réf ' + ref + ' visible', el !== null);
    }

    /* ---- C3 : 4 colonnes, 42 lignes ---- */
    const thCount = await page.$$eval('[data-testid="cr-table"] thead th', (ths) => ths.length);
    check('C3 table CR : 4 colonnes (Réf, Rubrique, N, N-1)', thCount === 4, 'th=' + thCount);
    const trCount = await page.$$eval('[data-testid="cr-table"] tbody tr', (trs) => trs.length);
    check('C3b table CR : 42 lignes TA→XI', trCount === 42, 'tr=' + trCount);
    const thText = norm(await page.textContent('[data-testid="cr-table"] thead'));
    check('C3c en-têtes N et N-1', /N-1/.test(thText || ''), (thText || '').trim().replace(/\s+/g, ' '));

    /* ---- C4 : valeurs N et N-1 vérifiées à l'écran ---- */
    const ta = await rowText('TA');
    check('C4a TA = 1 000 000 (N) / 500 000 (N-1)',
      /1 000 000,00/.test(ta || '') && /500 000,00/.test(ta || ''),
      (ta || '').trim().replace(/\s+/g, ' ').slice(0, 100));
    const xa = await rowText('XA');
    check('C4b XA = 500 000 (N) / 200 000 (N-1)',
      /500 000,00/.test(xa || '') && /200 000,00/.test(xa || ''),
      (xa || '').trim().replace(/\s+/g, ' ').slice(0, 100));
    const xb = await rowText('XB');
    check('C4c XB = 1 400 000 (N) / 500 000 (N-1)',
      /1 400 000,00/.test(xb || '') && /500 000,00/.test(xb || ''),
      (xb || '').trim().replace(/\s+/g, ' ').slice(0, 100));
    const rb = await rowText('RB');
    check('C4d RB = 100 000 (variation stocks 6031)', /100 000,00/.test(rb || ''),
      (rb || '').trim().replace(/\s+/g, ' ').slice(0, 100));
    const xi = await rowText('XI');
    check('C4e XI = 642 000 (N) / 200 000 (N-1)',
      /642 000,00/.test(xi || '') && /200 000,00/.test(xi || ''),
      (xi || '').trim().replace(/\s+/g, ' ').slice(0, 100));
    const sigCls = await page.$eval('[data-ref="XA"]', (el) => el.className);
    check('C4f SIG en surbrillance (classe row-sig)', /row-sig/.test(sigCls || ''), sigCls);

    /* ---- C5 : bouton Excel + téléchargement .xls ---- */
    const dlLabel = await page.textContent('[data-testid="etats-download"]');
    check('C5a bouton « ⬇️ Excel » sur l’onglet résultat', /Excel/.test(dlLabel || ''), (dlLabel || '').trim());
    const dlPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    await page.click('[data-testid="etats-download"]');
    const dl = await dlPromise;
    check('C5b clic -> téléchargement .xls', !!dl && /\.xls$/.test(dl.suggestedFilename() || ''),
      dl ? dl.suggestedFilename() : 'aucun download');
    check('C5c nom de fichier compte_resultat_sig_2025.xls',
      !!dl && dl.suggestedFilename() === 'compte_resultat_sig_2025.xls',
      dl ? dl.suggestedFilename() : 'aucun download');

    await noOverflow(page, 'C6 compte de résultat SIG');
    await page.screenshot({ path: path.join(SHOTS, 'cr-sig-390.png') });

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
