#!/usr/bin/env node
/**
 * Test e2e 390px : Notes annexes OHADA (1–36) — Phase 4.
 *
 * La route #/notes n'est PAS câblée dans app.js (un autre agent travaille
 * dessus en parallèle) : la page est donc invoquée DIRECTEMENT via son
 * export `renderNotesPage` (option prévue par la mission). Le harnais sert
 * les sources en ESM pur (aucun build) :
 *   /app-src/** -> migration/app/src/**   (page, ui, exports, styles)
 *   /src/**     -> migration/src/**       (moteurs ES purs)
 *   /e2e/**     -> migration/app/e2e/**   (mock du store)
 * Une import map remappe '../store.js' -> mock 100 % mémoire
 * (window.__fmMockEntries / window.__fmMockSettings) : aucun Supabase,
 * aucune session — le store est le seul module mocké.
 *
 * Données : acquisition 244 en 2024 (500 000, S.I. 2025), acquisition
 * 300 000 + cession 100 000 en 2025 ; ventes 701 : 100 000 (2024),
 * 200 000 (2025) ; note 1 manuelle pré-renseignée.
 * Attendus :
 *  - note 3A, poste 24 : Ouverture 500 000 / Acquisitions 300 000 /
 *    Cessions 100 000 / Clôture 700 000 ;
 *  - note 21, poste 701 : N 200 000 / N-1 100 000 / +100,0 % ;
 *  - note 1 : textarea pré-rempli, sauvegarde -> fm_settings mock ;
 *  - bouton Excel -> téléchargement note_3A_2025.xls ;
 *  - 44 options dans le sélecteur ; 0 débordement à 390 px.
 * Captures : migration/app/screenshots/.
 *
 * Usage : node e2e/notes-390.cjs   (depuis migration/app)
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
<title>Notes annexes — harnais e2e</title>
<link rel="stylesheet" href="/app-src/styles/afrique-premium.css">
<link rel="stylesheet" href="/app-src/styles/app.css">
<script type="importmap">
{ "imports": { "/app-src/store.js": "/e2e/mock-store-notes.js" } }
</script>
</head>
<body>
<div id="appMain"></div>
<div class="toast-container" id="toastContainer"></div>
<script type="module">
import { renderNotesPage } from '/app-src/pages/notes.js';
renderNotesPage({})
  .then(() => { window.__notesReady = true; })
  .catch((e) => { window.__notesError = String((e && e.message) || e); });
</script>
</body>
</html>`;

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = decodeURIComponent(req.url.split('?')[0]);
      let file = null;
      if (p === '/e2e-notes.html') {
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

// fmt() utilise l'espace insécable étroit (U+202F) : on normalise.
const norm = (s) => (s || '').replace(/[  ]/g, ' ');

async function rowText(page, compteTag) {
  const rows = await page.$$eval(
    '[data-testid="notes-table"] tbody tr',
    (trs) => trs.map((tr) => tr.textContent),
  );
  const hit = rows.find((t) => t.indexOf(compteTag) !== -1);
  return norm(hit || '').replace(/\s+/g, ' ').trim();
}

function mockInitScript() {
  /* eslint-disable */
  const Lg = (compte, debit, credit) => ({ compte, debit, credit });
  const mk = (id, date, lignes) => ({ id, date, journal: 'OD', piece: id, libelle: id, lignes });
  window.__fmMockEntries = [
    mk('e1', '2024-06-01', [Lg('244', 500000, 0), Lg('521', 0, 500000)]),
    mk('e2', '2024-04-01', [Lg('411', 100000, 0), Lg('701', 0, 100000)]),
    mk('e3', '2025-03-01', [Lg('244', 300000, 0), Lg('521', 0, 300000)]),
    mk('e4', '2025-09-01', [Lg('521', 100000, 0), Lg('244', 0, 100000)]),
    mk('e5', '2025-04-01', [Lg('411', 200000, 0), Lg('701', 0, 200000)]),
  ];
  window.__fmMockSettings = {
    company: 'E2E Test SARL',
    notes_man_1: { texte: 'Méthode du coût historique.' },
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

    await page.goto(base + 'e2e-notes.html', { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.__notesReady === true, null, { timeout: 15000 });
    const loadErr = await page.evaluate(() => window.__notesError || null);
    check('C0 page chargée sans erreur', loadErr === null, loadErr || 'ok');
    await page.waitForSelector('[data-testid="notes-table"]', { timeout: 15000 });

    /* ---- C1 : note 3A par défaut — acquisition puis cession partielle ---- */
    const selVal = await page.$eval('[data-testid="notes-select"]', (el) => el.value);
    check('C1a note 3A sélectionnée par défaut', selVal === '3A', 'value=' + selVal);
    const optCount = await page.$$eval('[data-testid="notes-select"] option', (o) => o.length);
    check('C1b sélecteur : 44 notes (1–36 avec sous-notes)', optCount === 44, 'options=' + optCount);
    // Lignes par racine à 2 chiffres : le poste 244 apparaît sous « (24) ».
    const r244 = await rowText(page, '(24)');
    check('C1c 3A/244 : Ouverture 500 000,00', /500 000,00/.test(r244), r244.slice(0, 110));
    check('C1d 3A/244 : Acquisitions 300 000,00 / Cessions 100 000,00',
      /300 000,00/.test(r244) && /100 000,00/.test(r244), r244.slice(0, 110));
    check('C1e 3A/244 : Clôture 700 000,00', /700 000,00/.test(r244), r244.slice(0, 110));
    const headMouv = norm(await page.textContent('[data-testid="notes-table"] thead'));
    check('C1f colonnes Ouverture/Acquisitions/Cessions/Clôture',
      /Ouverture/.test(headMouv) && /Acquisitions/.test(headMouv) && /Cessions/.test(headMouv) && /Clôture/.test(headMouv),
      headMouv.replace(/\s+/g, ' '));

    /* ---- C2 : note 21 — variation % correcte ---- */
    await page.selectOption('[data-testid="notes-select"]', '21');
    await page.waitForTimeout(300);
    const r701 = await rowText(page, '(701)');
    check('C2a 21/701 : N 200 000,00 / N-1 100 000,00',
      /200 000,00/.test(r701) && /100 000,00/.test(r701), r701.slice(0, 110));
    check('C2b 21/701 : variation +100,0 %', /\+100,0 %/.test(r701), r701.slice(0, 110));
    await page.screenshot({ path: path.join(SHOTS, 'notes-21-390.png') });

    /* ---- C3 : note manuelle — saisie persistée en fm_settings mock ---- */
    await page.selectOption('[data-testid="notes-select"]', '1');
    await page.waitForTimeout(300);
    const taVal = await page.$eval('[data-testid="notes-field-texte"]', (el) => el.value);
    check('C3a note 1 : textarea pré-rempli depuis fm_settings', taVal === 'Méthode du coût historique.', JSON.stringify(taVal));
    await page.fill('[data-testid="notes-field-texte"]', 'Principes : coût historique, prudence.');
    await page.click('[data-testid="notes-save"]');
    await page.waitForTimeout(500);
    const saved = await page.evaluate(() => (window.__fmMockSettings['notes_man_1'] || {}).texte);
    check('C3b sauvegarde -> fm_settings mock à jour', saved === 'Principes : coût historique, prudence.', JSON.stringify(saved));
    await page.screenshot({ path: path.join(SHOTS, 'notes-manuelle-390.png') });

    /* ---- C4 : export Excel .xls de la note ---- */
    await page.selectOption('[data-testid="notes-select"]', '3A');
    await page.waitForTimeout(300);
    const dlPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    await page.click('[data-testid="notes-excel"]');
    const dl = await dlPromise;
    check('C4a clic Excel -> téléchargement .xls', !!dl && /\.xls$/.test(dl.suggestedFilename() || ''),
      dl ? dl.suggestedFilename() : 'aucun download');
    check('C4b nom de fichier note_3A_2025.xls',
      !!dl && dl.suggestedFilename() === 'note_3A_2025.xls',
      dl ? dl.suggestedFilename() : 'aucun download');
    await page.screenshot({ path: path.join(SHOTS, 'notes-3a-390.png') });

    /* ---- C5 : boutons PDF + tout exporter présents ---- */
    const printVisible = await page.isVisible('[data-testid="notes-print"]');
    const allVisible = await page.isVisible('[data-testid="notes-excel-all"]');
    check('C5a boutons PDF et « Tout exporter » visibles', printVisible && allVisible);

    await noOverflow(page, 'C6 notes annexes');
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
