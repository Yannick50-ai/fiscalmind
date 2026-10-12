#!/usr/bin/env node
/**
 * Test e2e 390px : Bilan modèle 2 (système allégé OHADA) — Phase 1.
 *
 * Même harnais que sync-390.cjs : bundle de test (clés Supabase factices,
 * dist-e2e), serveur statique, chrome-headless-shell via playwright-core,
 * émulation mobile 390x844, Supabase MOCKÉ EN PAGE (mini-base mémoire
 * window.__fmMockDB), session injectée via window.__fmSetSession.
 *
 * Données : un montage comptable équilibré (débits = crédits = 3 300 000)
 * pré-chargé dans le mock fm_entries, conçu pour exercer les ventilations
 * du classeur (40 déb/créd, 41 déb/créd, 419→DI, 478→BU, 479→DV,
 * 28/29 en Amort, 52/53 créditeur→DR).
 *
 * Scénarios :
 * B1. #/etats?tab=bilan -> badge « ✓ Actif = Passif ».
 * B2. Refs officielles visibles : AE, BZ (actif), CA, DZ (passif).
 * B3. Table actif : 6 colonnes (Réf, Rubrique, Brut, Amort.-Dépréc., Net N, Net N-1).
 * B4. Ventilation vérifiée à l'écran : ligne AE = 500 000 / 100 000 / 400 000 ;
 *     ligne BU = 10 000 (478 isolé) ; ligne DV = 15 000 (479 isolé).
 * B5. Bouton de téléchargement = « ⬇️ Excel » sur l'onglet bilan ; le clic
 *     déclenche un téléchargement .xls (module app/src/exports.js).
 * B6. Zéro clé fm2_* en localStorage (SaaS 100 % cloud).
 * B7. Cohérence Balance/Grand livre : sous-totaux « ** CLASSE » intercalés
 *     (balance), colonne « Pièce » (grand livre).
 * Captures : migration/app/screenshots/.
 *
 * Usage : node e2e/bilan-modele2-390.cjs   (depuis migration/app)
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
 *   PRÉ-CHARGÉ avec le montage comptable de test (fm_entries) + réglages
 *   (fm_settings : période 2025, entreprise « E2E Test SARL ») ;
 * - session mémoire via window.__fmSetSession (hook de test de auth.js).
 */
function mockInitScript() {
  /* eslint-disable */
  const UID = 'e2e-uid';
  const Lg = (compte, debit, credit) => ({ compte, debit, credit });
  const entry = {
    id: 'e2e-m2', date: '2025-06-15', journal: 'OD', piece: 'M2-001',
    libelle: 'Montage ventilation modèle 2',
    lignes: [
      Lg('521', 1000000, 0), Lg('101', 0, 1000000),
      Lg('211', 500000, 0), Lg('521', 0, 500000),
      Lg('681', 100000, 0), Lg('2811', 0, 100000),
      Lg('2451', 800000, 0), Lg('521', 0, 800000),
      Lg('681', 200000, 0), Lg('2845', 0, 200000),
      Lg('2444', 300000, 0), Lg('521', 0, 300000),
      Lg('681', 50000, 0), Lg('2844', 0, 50000),
      Lg('401', 25000, 0), Lg('521', 0, 25000),
      Lg('601', 60000, 0), Lg('404', 0, 60000),
      Lg('411', 100000, 0), Lg('701', 0, 100000),
      Lg('701', 30000, 0), Lg('419', 0, 30000),
      Lg('471', 20000, 0), Lg('521', 0, 20000),
      Lg('478', 10000, 0), Lg('471', 0, 10000),
      Lg('621', 50000, 0), Lg('467', 0, 50000),
      Lg('657', 15000, 0), Lg('479', 0, 15000),
      Lg('601', 40000, 0), Lg('521', 0, 40000),
    ],
  };
  const DB = {
    fm_entries: [{ user_id: UID, entry_id: 'e2e-m2', entry }],
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

    await page.goto(base + '#/etats?tab=bilan', { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.__fmSessionSet === true, null, { timeout: 10000 });
    await renderRoute(page, '#/etats?tab=bilan');
    await page.waitForSelector('[data-testid="etats-page"]', { timeout: 15000 });
    await page.waitForSelector('[data-testid="bilan-table-actif"]', { timeout: 15000 });

    /* ---- B1 : badge d'équilibre ---- */
    const badge = await page.textContent('[data-testid="bilan-badge"]');
    check('B1 badge « ✓ Actif = Passif »', /Actif = Passif/.test(badge || ''), (badge || '').trim().slice(0, 60));

    /* ---- B2 : refs officielles ---- */
    for (const ref of ['AE', 'BZ', 'CA', 'DZ', 'AD', 'CP']) {
      const el = await page.$('[data-ref="' + ref + '"]');
      check('B2 réf ' + ref + ' visible', el !== null);
    }

    /* ---- B3 : 6 colonnes sur la table actif ---- */
    const thCount = await page.$$eval('[data-testid="bilan-table-actif"] thead th', (ths) => ths.length);
    check('B3 table actif : 6 colonnes (Réf, Rubrique, Brut, Amort, Net N, Net N-1)', thCount === 6, 'th=' + thCount);
    const thPCount = await page.$$eval('[data-testid="bilan-table-passif"] thead th', (ths) => ths.length);
    check('B3b table passif : 4 colonnes', thPCount === 4, 'th=' + thPCount);

    /* ---- B4 : ventilations affichées ---- */
    // fmt() utilise l'espace insécable étroit (U+202F) comme séparateur de
    // milliers en fr-FR : on normalise avant les contrôles.
    const norm = (s) => (s || '').replace(/[  ]/g, ' ');
    const rowText = async (ref) => norm(await page.textContent('[data-ref="' + ref + '"]'));
    const ae = await rowText('AE');
    check('B4a AE = 500 000 / 100 000 / 400 000',
      /500 000,00/.test(ae || '') && /100 000,00/.test(ae || '') && /400 000,00/.test(ae || ''),
      (ae || '').trim().replace(/\s+/g, ' ').slice(0, 120));
    const bu = await rowText('BU');
    check('B4b BU = 10 000 (478 isolé)', /10 000,00/.test(bu || ''), (bu || '').trim().replace(/\s+/g, ' ').slice(0, 80));
    const dv = await rowText('DV');
    check('B4c DV = 15 000 (479 isolé)', /15 000,00/.test(dv || ''), (dv || '').trim().replace(/\s+/g, ' ').slice(0, 80));
    const bz = await rowText('BZ');
    check('B4d BZ Net N = 1 395 000', /1 395 000,00/.test(bz || ''), (bz || '').trim().replace(/\s+/g, ' ').slice(0, 100));
    const resnet = norm(await page.textContent('[data-testid="bilan-resnet"]'));
    check('B4e résultat net affiché = −445 000', /-?445 000,00/.test(resnet || ''), (resnet || '').trim().slice(0, 80));

    /* ---- B5 : bouton Excel + téléchargement .xls ---- */
    const dlLabel = await page.textContent('[data-testid="etats-download"]');
    check('B5a bouton « ⬇️ Excel » sur l’onglet bilan', /Excel/.test(dlLabel || ''), (dlLabel || '').trim());
    const dlPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    await page.click('[data-testid="etats-download"]');
    const dl = await dlPromise;
    check('B5b clic -> téléchargement .xls', !!dl && /\.xls$/.test(dl.suggestedFilename() || ''),
      dl ? dl.suggestedFilename() : 'aucun download');

    /* ---- B6 : zéro localStorage ---- */
    const lsKeys = await page.evaluate(() => Object.keys(window.localStorage || {}).filter((k) => k.indexOf('fm2_') === 0));
    check('B6 zéro clé fm2_* en localStorage', lsKeys.length === 0, JSON.stringify(lsKeys));

    await noOverflow(page, 'B7 bilan modèle 2');
    await page.screenshot({ path: path.join(SHOTS, 'bilan-modele2-390.png') });

    /* ---- B7/B8 : cohérence Balance / Grand livre ---- */
    await renderRoute(page, '#/etats?tab=balance');
    await page.waitForSelector('[data-testid="balance-badge"]', { timeout: 10000 });
    const balText = await page.textContent('[data-testid="etats-page"]');
    check('B7a balance : sous-totaux « ** … » intercalés par classe', /\*\* /.test(balText || ''));
    check('B7b balance : ligne TOTAUX', /TOTAUX/.test(balText || ''));
    const dlLabel2 = await page.textContent('[data-testid="etats-download"]');
    check('B7c bouton « ⬇️ CSV » sur l’onglet balance', /CSV/.test(dlLabel2 || ''), (dlLabel2 || '').trim());
    await noOverflow(page, 'B7d balance');
    await page.screenshot({ path: path.join(SHOTS, 'bilan-modele2-balance-390.png') });

    await renderRoute(page, '#/etats?tab=gl');
    await page.waitForTimeout(600);
    await page.fill('[data-testid="gl-compte"]', '411');
    await page.dispatchEvent('[data-testid="gl-compte"]', 'change');
    await page.waitForTimeout(600);
    const glText = await page.textContent('[data-testid="etats-page"]');
    check('B8a grand livre : colonne « Pièce »', /Pièce/.test(glText || ''));
    check('B8b grand livre : compte 411 affiché', /411/.test(glText || ''));
    await noOverflow(page, 'B8c grand livre');
    await page.screenshot({ path: path.join(SHOTS, 'bilan-modele2-gl-390.png') });

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
