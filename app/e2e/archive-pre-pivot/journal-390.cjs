#!/usr/bin/env node
/**
 * Test e2e 390px : coquille applicative + page Journal (phase 2 migration).
 * - Sert app/dist/ en statique, pilote chrome-headless-shell via playwright-core.
 * - Émulation mobile : 390x844, isMobile, tactile.
 * - Scénario : #/connexion -> démo -> #/journal -> création d'une écriture
 *   équilibrée (apparaît dans la liste) -> tentative déséquilibrée (refusée
 *   avec message) -> suppression (double confirmation).
 * - Captures : migration/app/screenshots/ (liste + modale).
 * - Vérifie : pas de débordement horizontal à chaque étape.
 *
 * Usage : node e2e/journal-390.js   (depuis migration/app, après `npm run build`)
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

    // 1. Page connexion
    await page.goto(base + '#/connexion', { waitUntil: 'load', timeout: 30000 });
    await page.waitForSelector('[data-testid="auth-page"]', { timeout: 10000 });
    check('page connexion affichée', true);
    await noOverflow(page, 'connexion');

    // 2. Mode démo -> journal
    await page.click('[data-testid="demo-btn"]');
    await page.waitForSelector('[data-testid="journal-page"]', { timeout: 10000 });
    check('démo -> page journal', page.url().includes('#/journal'));
    await noOverflow(page, 'journal (vide)');
    await page.screenshot({ path: path.join(SHOTS, 'journal-liste-390.png') });

    // 3. Modale de saisie
    await page.click('[data-testid="new-entry-btn"]');
    await page.waitForSelector('[data-testid="entry-modal"]', { timeout: 5000 });
    check('modale de saisie ouverte', true);
    await noOverflow(page, 'modale');
    await page.screenshot({ path: path.join(SHOTS, 'journal-modale-390.png') });

    // 4. Écriture équilibrée : 601 (100 000 D) / 401 (100 000 C)
    await page.selectOption('[data-testid="entry-journal"]', 'AC');
    await page.fill('[data-testid="entry-piece"]', 'AC-001');
    await page.fill('[data-testid="entry-lib"]', 'Achat test e2e');
    await page.fill('[data-testid="line-compte-0"]', '601');
    await page.fill('[data-testid="line-debit-0"]', '100000');
    await page.fill('[data-testid="line-compte-1"]', '401');
    await page.fill('[data-testid="line-credit-1"]', '100000');
    const badge = await page.textContent('[data-testid="entry-balance-badge"]');
    check('contrôle équilibre en direct', /Équilibré/.test(badge || ''), (badge || '').trim().slice(0, 60));
    await page.click('[data-testid="entry-save"]');
    await page.waitForSelector('[data-testid="entry-card"]', { timeout: 5000 });
    const count1 = await page.textContent('[data-testid="journal-count"]');
    const cardText = await page.textContent('[data-testid="entry-card"]');
    check('écriture équilibrée enregistrée', /1 écriture/.test(count1 || '') && /Achat test e2e/.test(cardText || ''), (count1 || '').trim());
    await noOverflow(page, 'journal (1 écriture)');

    // 5. Écriture déséquilibrée -> refusée avec message
    await page.click('[data-testid="new-entry-btn"]');
    await page.waitForSelector('[data-testid="entry-modal"]', { timeout: 5000 });
    await page.fill('[data-testid="entry-lib"]', 'Écriture KO');
    await page.fill('[data-testid="line-compte-0"]', '601');
    await page.fill('[data-testid="line-debit-0"]', '100000');
    await page.fill('[data-testid="line-compte-1"]', '401');
    await page.fill('[data-testid="line-credit-1"]', '90000');
    await page.click('[data-testid="entry-save"]');
    await page.waitForSelector('[data-testid="entry-errors"]:not([hidden])', { timeout: 5000 });
    const errText = await page.textContent('[data-testid="entry-errors"]');
    const modalStillOpen = await page.$('[data-testid="entry-modal"]');
    const count2 = await page.textContent('[data-testid="journal-count"]');
    check('écriture déséquilibrée refusée avec message',
      /déséquilibrée/.test(errText || '') && !!modalStillOpen && /1 écriture/.test(count2 || ''),
      (errText || '').trim().slice(0, 80));
    await page.screenshot({ path: path.join(SHOTS, 'journal-erreur-390.png') });
    await page.click('#entryCancel');

    // 6. Suppression (double confirmation)
    await page.click('[data-testid="delete-entry-btn"]');
    await page.waitForTimeout(300);
    const confirmLabel = await page.textContent('[data-testid="delete-entry-btn"]');
    await page.click('[data-testid="delete-entry-btn"]');
    await page.waitForTimeout(500);
    const count3 = await page.textContent('[data-testid="journal-count"]');
    check('suppression avec confirmation', /Sûr/.test(confirmLabel || '') && /0 écriture/.test(count3 || ''), (count3 || '').trim());

    // 7. Garde de route : sans session, /journal redirige vers /connexion
    // (reload : un simple goto avec le même hash ne recharge pas la page)
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'load', timeout: 30000 });
    await page.waitForSelector('[data-testid="auth-page"]', { timeout: 10000 });
    check('garde de route /journal sans session', page.url().includes('#/connexion'));

    console.log('\n---');
    const fails = results.filter((r) => !r.ok);
    console.log(fails.length === 0 ? 'E2E JOURNAL : TOUT EST VERT (' + results.length + ' contrôles)' : 'E2E JOURNAL : ' + fails.length + ' ÉCHEC(S)');
    process.exitCode = fails.length === 0 ? 0 : 1;
  } finally {
    if (browser) await browser.close();
    srv.close();
  }
})().catch((e) => { console.error('ERREUR FATALE: ' + e.message); process.exit(2); });
