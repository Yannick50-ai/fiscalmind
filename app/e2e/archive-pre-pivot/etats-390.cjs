#!/usr/bin/env node
/**
 * Test e2e 390px : page États financiers (phase 4 migration).
 * - Sert app/dist/ en statique, pilote chrome-headless-shell via playwright-core.
 * - Émulation mobile : 390x844, isMobile, tactile.
 * - Scénario : #/connexion -> démo -> seed de 3 écritures (capital, achat, vente)
 *   -> #/etats -> onglets Balance / Grand livre / Bilan / Compte de résultat / TAFIRE.
 * - Vérifie : balance équilibrée, bilan Actif = Passif avec résultat net non nul
 *   cohérent avec le compte de résultat, TAFIRE autocontrôlé, export CSV
 *   (événement download), pas de débordement horizontal sur chaque onglet.
 * - Captures : migration/app/screenshots/ (bilan + compte de résultat).
 *
 * Usage : node e2e/etats-390.cjs   (depuis migration/app, après `npm run build`)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('/home/hatch/workspace/fiscalmind-migration/e2e/node_modules/playwright-core');

const DIST = '/home/hatch/workspace/goals/fiscalmind-africa-saas-launch/migration/app/dist';
const SHOTS = '/home/hatch/workspace/goals/fiscalmind-africa-saas-launch/migration/app/screenshots';
const SHELL = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const W = 390, H = 844;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

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

/** Normalise les espaces (y c. insécables FR) pour comparer les montants. */
function norm(s) { return String(s || '').replace(/[\s ⁠ ]/g, ' '); }

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const { srv, port } = await serve();
  const base = `http://127.0.0.1:${port}/`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: SHELL, args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGEERROR: ' + e.message));

    // 1. Connexion démo
    await page.goto(base + '#/connexion', { waitUntil: 'load', timeout: 30000 });
    await page.waitForSelector('[data-testid="auth-page"]', { timeout: 10000 });
    await page.click('[data-testid="demo-btn"]');
    await page.waitForSelector('[data-testid="journal-page"]', { timeout: 10000 });
    check('démo -> journal', true);

    // 2. Seed : 3 écritures (capital 5M, achat 1 180 000, vente 2 360 000)
    const Y = new Date().getFullYear();
    await page.evaluate((Y) => {
      const entries = [
        { id: 'e1', date: Y + '-01-05', journal: 'OD', piece: 'OD-001', libelle: 'Apport en capital',
          lignes: [{ compte: '101', debit: 0, credit: 5000000 }, { compte: '521', debit: 5000000, credit: 0 }] },
        { id: 'e2', date: Y + '-02-10', journal: 'AC', piece: 'AC-001', libelle: 'Achat marchandises',
          lignes: [{ compte: '601', debit: 1000000, credit: 0 }, { compte: '4452', debit: 180000, credit: 0 }, { compte: '401', debit: 0, credit: 1180000 }] },
        { id: 'e3', date: Y + '-03-15', journal: 'VT', piece: 'VT-001', libelle: 'Vente marchandises',
          lignes: [{ compte: '411', debit: 2360000, credit: 0 }, { compte: '701', debit: 0, credit: 2000000 }, { compte: '443', debit: 0, credit: 360000 }] },
      ];
      localStorage.setItem('fm2_journal_demo', JSON.stringify(entries));
      location.hash = '#/etats';
    }, Y);
    await page.waitForSelector('[data-testid="etats-page"]', { timeout: 10000 });
    check('page États affichée', true);
    const tabs = await page.$$('[data-testid^="tab-"]');
    check('5 onglets présents', tabs.length === 5, tabs.length + ' onglets');
    await noOverflow(page, 'états / balance');

    // 3. Balance : badge Équilibré
    const balBadge = norm(await page.textContent('[data-testid="balance-badge"]'));
    check('balance équilibrée', /Équilibrée/.test(balBadge), balBadge.slice(0, 60));

    // 4. Bilan : Actif = Passif + résultat net non nul
    await page.click('[data-testid="tab-bilan"]');
    await page.waitForSelector('[data-testid="bilan-badge"]', { timeout: 5000 });
    const bilanBadge = norm(await page.textContent('[data-testid="bilan-badge"]'));
    check('bilan : badge Actif = Passif', /Actif = Passif/.test(bilanBadge), bilanBadge.slice(0, 60));
    const bilanRes = norm(await page.textContent('[data-testid="bilan-resnet"]'));
    check('bilan : résultat net = 1 000 000 (non nul)', /1 000 000/.test(bilanRes), bilanRes.slice(0, 80));
    await noOverflow(page, 'états / bilan');
    await page.screenshot({ path: path.join(SHOTS, 'etats-bilan-390.png') });

    // 5. Compte de résultat : cohérence avec le bilan
    await page.click('[data-testid="tab-cr"]');
    await page.waitForSelector('[data-testid="cr-resnet"]', { timeout: 5000 });
    const crRes = norm(await page.textContent('[data-testid="cr-resnet"]'));
    check('CR : résultat net = 1 000 000', /1 000 000/.test(crRes), crRes.slice(0, 60));
    check('cohérence bilan/CR (même résultat net)',
      /1 000 000/.test(bilanRes) && /1 000 000/.test(crRes));
    await noOverflow(page, 'états / CR');
    await page.screenshot({ path: path.join(SHOTS, 'etats-cr-390.png') });

    // 6. TAFIRE : autocontrôle trésorerie
    await page.click('[data-testid="tab-tafire"]');
    await page.waitForSelector('[data-testid="tafire-controle"]', { timeout: 5000 });
    const taf = norm(await page.textContent('[data-testid="tafire-controle"]'));
    check('TAFIRE : trésorerie contrôlée', /contrôlée/.test(taf), taf.slice(0, 60));
    await noOverflow(page, 'états / TAFIRE');

    // 7. Grand livre : compte 521
    await page.click('[data-testid="tab-gl"]');
    await page.fill('[data-testid="gl-compte"]', '521');
    await page.dispatchEvent('[data-testid="gl-compte"]', 'change');
    await page.waitForTimeout(400);
    const glText = norm(await page.textContent('[data-testid="etats-page"]'));
    check('grand livre 521 affiché', /5 000 000/.test(glText));
    await noOverflow(page, 'états / grand livre');

    // 8. Export CSV : événement download
    await page.click('[data-testid="tab-balance"]');
    const dlPromise = page.waitForEvent('download', { timeout: 8000 });
    await page.click('[data-testid="etats-csv"]');
    const dl = await dlPromise;
    const fname = dl.suggestedFilename();
    check('export CSV déclenché', /\.csv$/.test(fname), fname);

    // 9. Garde de route : sans session, /etats redirige vers /connexion
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load', timeout: 30000 });
    await page.goto(base + '#/etats');
    await page.waitForSelector('[data-testid="auth-page"]', { timeout: 10000 });
    check('garde de route /etats sans session', page.url().includes('#/connexion'));

    console.log('\n---');
    const fails = results.filter((r) => !r.ok);
    console.log(fails.length === 0 ? 'E2E ÉTATS : TOUT EST VERT (' + results.length + ' contrôles)' : 'E2E ÉTATS : ' + fails.length + ' ÉCHEC(S)');
    process.exitCode = fails.length === 0 ? 0 : 1;
  } finally {
    if (browser) await browser.close();
    srv.close();
  }
})().catch((e) => { console.error('E2E FATAL: ' + (e && e.message)); process.exitCode = 1; });
