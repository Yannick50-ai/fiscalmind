#!/usr/bin/env node
/**
 * Test e2e 390px : Fiches R1–R4 + Recevabilité DSF — Phase 8.
 *
 * La route #/fiches n'est PAS câblée dans app.js (le coordinateur câblera) :
 * la page est invoquée DIRECTEMENT via son export `renderFichesPage`
 * (option prévue par la mission). Le harnais sert les sources en ESM pur :
 *   /app-src/** -> migration/app/src/**   (page, ui, exports, styles)
 *   /src/**     -> migration/src/**       (moteurs ES purs)
 *   /e2e/**     -> migration/app/e2e/**   (mock du store)
 * Une import map remappe '../store.js' -> mock 100 % mémoire
 * (window.__fmMockEntries / window.__fmMockSettings) : aucun Supabase,
 * aucune session — le store est le seul module mocké.
 *
 * Données mock : SARL « E2E Fiches SARL » (identification incomplète :
 * téléphone manquant) ; écritures équilibrées 2025 (immo 244 + vente 701).
 * Attendus :
 *  - R1 affiche la dénomination / sigle / RCCM / exercice depuis la config mock ;
 *  - Recevabilité : au moins un contrôle ✅ (bilan équilibré) et un ❌
 *    (Fiche R1 incomplète — téléphone manquant) ;
 *  - ajustement d'un statut en R4 -> persistance fm_settings mock ;
 *  - bouton Excel -> téléchargement fiche_r1_2025.xls ;
 *  - 5 onglets présents ; 0 débordement à 390 px.
 * Captures : migration/app/screenshots/.
 *
 * Usage : node e2e/fiches-390.cjs   (depuis migration/app)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('/home/hatch/workspace/fiscalmind-migration/e2e/node_modules/playwright-core');

const APP = '/home/hatch/workspace/goals/fiscalmind-africa-saas-launch/migration/app';
const ENG = '/home/hatch/workspace/goals/fiscalmind-africa-saas-launch/migration/src';
const SHOTS = path.join(APP, 'screenshots');
const SHELL = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const W = 390, H = 844;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2',
};

const HARNESS_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fiches DSF — harnais e2e</title>
<link rel="stylesheet" href="/app-src/styles/afrique-premium.css">
<link rel="stylesheet" href="/app-src/styles/app.css">
<script type="importmap">
{ "imports": { "/app-src/store.js": "/e2e/mock-store-fiches.js" } }
</script>
</head>
<body>
<div id="appMain"></div>
<div class="toast-container" id="toastContainer"></div>
<script type="module">
import { renderFichesPage } from '/app-src/pages/fiches.js';
renderFichesPage({})
  .then(() => { window.__fichesReady = true; })
  .catch((e) => { window.__fichesError = String((e && e.message) || e); });
</script>
</body>
</html>`;

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = decodeURIComponent(req.url.split('?')[0]);
      let file = null;
      if (p === '/e2e-fiches.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(HARNESS_HTML);
        return;
      }
      if (p.startsWith('/app-src/')) file = path.join(APP, 'src', p.slice('/app-src/'.length));
      else if (p.startsWith('/src/')) file = path.join(ENG, p.slice('/src/'.length));
      else if (p.startsWith('/e2e/')) file = path.join(APP, 'e2e', p.slice('/e2e/'.length));
      if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('nf'); return;
      }
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); res.end('nf'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
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
  const Lg = (compte, debit, credit) => ({ compte, debit, credit });
  const mk = (id, date, lignes) => ({ id, date, journal: 'OD', piece: id, libelle: id, lignes });
  window.__fmMockEntries = [
    mk('e1', '2025-01-01', [Lg('244', 500000, 0), Lg('521', 0, 500000)]),
    mk('e2', '2025-04-01', [Lg('411', 200000, 0), Lg('701', 0, 200000)]),
  ];
  window.__fmMockSettings = {
    company: 'E2E Fiches SARL',
    company_ifu: '00998877B',
    company_regime: 'BIC',
    // Identification volontairement incomplète : téléphone manquant.
    company_r1: {
      sigle: 'EF SARL', adresse: 'Ouagadougou, BF', rccm: 'BF-OUA-2025-B-98765',
      exerciceDebut: '2025-01-01', exerciceFin: '2025-12-31',
      email: 'contact@ef.bf', expertNom: 'Cabinet Test', expertContact: '25 00 00 00',
    },
    company_dirigeants: [{ nom: 'Yannick O.', qualite: 'Gérant', contact: '70 00 00 00' }],
    company_associes: [{ nom: 'Awa D.', qualite: 'Associée', part: '60 %' }],
  };
  /* eslint-enable */
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
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

    await page.goto(base + 'e2e-fiches.html', { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.__fichesReady === true, null, { timeout: 15000 });
    const loadErr = await page.evaluate(() => window.__fichesError || null);
    check('C0 page chargée sans erreur', loadErr === null, loadErr || 'ok');
    await page.waitForSelector('[data-testid="fiches-table"]', { timeout: 15000 });

    /* ---- C1 : onglets + R1 depuis la config mock ---- */
    const tabs = await page.$$eval('[data-testid^="fiches-tab-"]', (els) => els.map((e) => e.dataset.testid));
    check('C1a 5 onglets R1/R2/R3/R4/Recevabilité', tabs.length === 5, tabs.join(','));
    const r1Text = (await page.textContent('[data-testid="fiches-table"]')).replace(/[  ]/g, ' ');
    check('C1b R1 : dénomination E2E Fiches SARL', r1Text.includes('E2E Fiches SARL'), 'R1 rendue');
    check('C1c R1 : sigle EF SARL + RCCM + exercice', r1Text.includes('EF SARL') && r1Text.includes('BF-OUA-2025-B-98765') && r1Text.includes('01/01/2025'), 'R1 rendue');
    check('C1d R1 : téléphone marqué « non renseigné »', r1Text.includes('Téléphone') && r1Text.includes('non renseigné'), 'ligne Téléphone présente');
    await page.screenshot({ path: path.join(SHOTS, 'fiches-r1-390.png') });

    /* ---- C2 : Recevabilité — au moins un ✅ et un ❌ ---- */
    await page.click('[data-testid="fiches-tab-recevabilite"]');
    await page.waitForTimeout(300);
    const recText = (await page.textContent('[data-testid="fiches-table"]')).replace(/[  ]/g, ' ');
    check('C2a recevabilité : Bilan équilibré ✅', recText.includes('Bilan équilibré') && recText.includes('✅'), recText.slice(0, 120));
    check('C2b recevabilité : Fiche R1 incomplète ❌ (téléphone)', recText.includes('❌') && recText.includes('Téléphone'), recText.slice(0, 160));
    check('C2c recevabilité : XI == CJ ✅', recText.includes('Cohérence résultat') && recText.includes('✅'), 'cohérence');
    const recap = await page.textContent('[data-testid="fiches-recap"]');
    check('C2d récapitulatif ✅/❌ affiché', /✅ \d+ conforme/.test(recap) && /❌ \d+ non conforme/.test(recap), recap.trim());
    await page.screenshot({ path: path.join(SHOTS, 'fiches-recevabilite-390.png') });

    /* ---- C3 : R2 / R3 — dirigeants et associés ---- */
    await page.click('[data-testid="fiches-tab-r2"]');
    await page.waitForTimeout(300);
    const r2Text = await page.textContent('[data-testid="fiches-table"]');
    check('C3a R2 : dirigeant mock affiché', r2Text.includes('Yannick O.') && r2Text.includes('Gérant'), 'R2 rendue');
    await page.click('[data-testid="fiches-tab-r3"]');
    await page.waitForTimeout(300);
    const r3Text = await page.textContent('[data-testid="fiches-table"]');
    check('C3b R3 : associé mock affiché', r3Text.includes('Awa D.') && r3Text.includes('60 %'), 'R3 rendue');

    /* ---- C4 : R4 — statuts + surcharge persistée ---- */
    await page.click('[data-testid="fiches-tab-r4"]');
    await page.waitForTimeout(300);
    const r4Count = await page.$$eval('[data-testid="fiches-r4-note"]', (els) => els.length);
    check('C4a R4 : autant de lignes que de notes', r4Count >= 36, 'lignes=' + r4Count);
    const r4Text = await page.textContent('[data-testid="fiches-table"]');
    check('C4b R4 : note 3A chiffrée par défaut', /Note 3A/.test(r4Text) && /Chiffrée/.test(r4Text), 'R4 rendue');
    await page.selectOption('[data-testid="fiches-r4-statut-3A"]', 'non_applicable');
    await page.waitForTimeout(500);
    const saved = await page.evaluate(() => (window.__fmMockSettings['fiches_notes_statuts'] || {})['3A']);
    check('C4c surcharge statut 3A -> fm_settings mock', saved === 'non_applicable', JSON.stringify(saved));
    await page.screenshot({ path: path.join(SHOTS, 'fiches-r4-390.png') });

    /* ---- C5 : export Excel R1 -> fiche_r1_2025.xls ---- */
    await page.click('[data-testid="fiches-tab-r1"]');
    await page.waitForTimeout(300);
    const dlPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    await page.click('[data-testid="fiches-excel"]');
    const dl = await dlPromise;
    check('C5a clic Excel -> téléchargement .xls', !!dl && /\.xls$/.test(dl.suggestedFilename() || ''),
      dl ? dl.suggestedFilename() : 'aucun download');
    check('C5b nom de fichier fiche_r1_2025.xls',
      !!dl && dl.suggestedFilename() === 'fiche_r1_2025.xls',
      dl ? dl.suggestedFilename() : 'aucun download');

    /* ---- C6 : recevabilité en .xls aussi ---- */
    await page.click('[data-testid="fiches-tab-recevabilite"]');
    await page.waitForTimeout(300);
    const dl2Promise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    await page.click('[data-testid="fiches-excel"]');
    const dl2 = await dl2Promise;
    check('C6 recevabilité Excel -> fiche_recevabilite_2025.xls',
      !!dl2 && dl2.suggestedFilename() === 'fiche_recevabilite_2025.xls',
      dl2 ? dl2.suggestedFilename() : 'aucun download');

    await noOverflow(page, 'C7 fiches DSF');
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
