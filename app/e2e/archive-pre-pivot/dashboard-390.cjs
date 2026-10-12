#!/usr/bin/env node
/**
 * Test e2e 390px : tableau de bord (phase 6 migration).
 * - Sert app/dist/ en statique, pilote chrome-headless-shell via playwright-core.
 * - Émulation mobile : 390x844, isMobile, tactile.
 * - Scénario : #/connexion -> démo -> seed de 6 écritures sur 3 mois
 *   -> #/accueil (dashboard) : KPI, graphiques SVG, alertes.
 * - Vérifie : 6 cartes KPI avec bonnes valeurs (CA 3 M, résultat 800 k),
 *   graphique avec barres non nulles, 1 alerte échéance, clic KPI -> États,
 *   état vide élégant sans écritures, pas de débordement horizontal.
 * - Captures : migration/app/screenshots/ (dashboard-390.png, dashboard-390-charts.png).
 *
 * Usage : node e2e/dashboard-390.cjs   (depuis migration/app, après `npm run build`)
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

    // 2. Seed : 6 écritures sur 3 mois
    const Y = new Date().getFullYear();
    await page.evaluate((Y) => {
      const entries = [
        { id: 'e1', date: Y + '-01-05', journal: 'OD', piece: 'OD-001', libelle: 'Apport en capital',
          lignes: [{ compte: '101', debit: 0, credit: 5000000 }, { compte: '521', debit: 5000000, credit: 0 }] },
        { id: 'e2', date: Y + '-01-12', journal: 'AC', piece: 'AC-001', libelle: 'Achat marchandises',
          lignes: [{ compte: '601', debit: 1000000, credit: 0 }, { compte: '4452', debit: 180000, credit: 0 }, { compte: '401', debit: 0, credit: 1180000 }] },
        { id: 'e3', date: Y + '-02-10', journal: 'VT', piece: 'VT-001', libelle: 'Vente',
          lignes: [{ compte: '411', debit: 2360000, credit: 0 }, { compte: '701', debit: 0, credit: 2000000 }, { compte: '443', debit: 0, credit: 360000 }] },
        { id: 'e4', date: Y + '-02-28', journal: 'PA', piece: 'PA-001', libelle: 'Salaires',
          lignes: [{ compte: '6611', debit: 900000, credit: 0 }, { compte: '422', debit: 0, credit: 900000 }] },
        { id: 'e5', date: Y + '-03-15', journal: 'VT', piece: 'VT-002', libelle: 'Vente mars',
          lignes: [{ compte: '411', debit: 1180000, credit: 0 }, { compte: '701', debit: 0, credit: 1000000 }, { compte: '443', debit: 0, credit: 180000 }] },
        { id: 'e6', date: Y + '-03-20', journal: 'OD', piece: 'OD-002', libelle: 'Loyer',
          lignes: [{ compte: '622', debit: 300000, credit: 0 }, { compte: '401', debit: 0, credit: 300000 }] },
      ];
      localStorage.setItem('fm2_journal_demo', JSON.stringify(entries));
      location.hash = '#/accueil';
    }, Y);
    await page.waitForSelector('[data-testid="dashboard-page"]', { timeout: 10000 });
    check('dashboard affiché (#/accueil)', true);

    // 3. KPI : 6 cartes, bonnes valeurs
    const cards = await page.$$('[data-testid="kpi-grid"] .kpi-card');
    check('6 cartes KPI', cards.length === 6, cards.length + ' cartes');
    const ca = norm(await page.textContent('[data-testid="kpi-ca"]'));
    check('KPI CA = 3 M', /3\s?M/.test(ca), ca.slice(0, 40));
    const rn = norm(await page.textContent('[data-testid="kpi-resnet"]'));
    check('KPI résultat net = 800 k', /800\s?k/.test(rn), rn.slice(0, 40));
    const treso = norm(await page.textContent('[data-testid="kpi-treso"]'));
    check('KPI trésorerie = 5 M', /5\s?M/.test(treso), treso.slice(0, 40));
    await noOverflow(page, 'dashboard / KPI');
    await page.screenshot({ path: path.join(SHOTS, 'dashboard-390.png') });

    // 4. Graphiques : barres non nulles + donut + courbe
    const nonZeroBars = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#chart-ca-charges .chart-bar, [data-testid="chart-ca-charges"] .chart-bar'))
        .filter((r) => Number(r.getAttribute('height')) > 0).length);
    check('graphique : barres non nulles (>= 3)', nonZeroBars >= 3, nonZeroBars + ' barres');
    check('donut charges présent', await page.$('[data-testid="chart-charges-donut"]') !== null);
    check('courbe trésorerie présente', await page.$('[data-testid="chart-treso"]') !== null);
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(300);
    await noOverflow(page, 'dashboard / graphiques');
    await page.screenshot({ path: path.join(SHOTS, 'dashboard-390-charts.png') });

    // 5. Alertes : au moins 1 échéance fiscale
    const deadlines = await page.$$('[data-testid="alert-deadline"]');
    check('>= 1 alerte échéance fiscale', deadlines.length >= 1, deadlines.length + ' alerte(s)');
    check('badge balance présent', await page.$('[data-testid="alert-balance"]') !== null);

    // 6. Clic KPI -> États (onglet CR)
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click('[data-testid="kpi-ca"]');
    await page.waitForSelector('[data-testid="etats-page"]', { timeout: 10000 });
    const tabActive = await page.$eval('[data-testid="tab-cr"]', (el) => el.classList.contains('active'));
    check('clic KPI CA -> États / onglet Résultat', tabActive);

    // 7. État vide : sans écritures
    await page.evaluate(() => {
      localStorage.setItem('fm2_journal_demo', JSON.stringify([]));
      location.hash = '#/accueil';
    });
    await page.waitForSelector('[data-testid="dashboard-empty"]', { timeout: 10000 });
    check('état vide élégant sans écritures', true);
    await noOverflow(page, 'dashboard / vide');

    const failed = results.filter((r) => !r.ok);
    console.log('\n=== ' + (results.length - failed.length) + '/' + results.length + ' contrôles verts ===');
    if (failed.length) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    srv.close();
  }
})();
