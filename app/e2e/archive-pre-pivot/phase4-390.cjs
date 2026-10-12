#!/usr/bin/env node
/**
 * Test e2e 390px : phase 4 (lettrage + calendrier fiscal).
 * - Sert app/dist/ en statique, pilote chrome-headless-shell via playwright-core.
 * - 390x844, isMobile, tactile.
 * - (a) Lettrage : #/connexion -> démo -> seed 3 écritures (facture client 411,
 *   règlement 411, achat fournisseur 401) -> #/lettrage -> coche les 2 lignes
 *   411 -> Lettrer -> badge A + "Tout est lettré" -> délettre -> retour initial.
 * - (b) Calendrier : #/calendrier -> cherche un mois avec échéances (BF) ->
 *   clic sur la 1re échéance -> fiche stratégique affichée.
 * - Captures : lettrage-390.png, calendrier-390.png. Pas de débordement.
 *
 * Usage : node e2e/phase4-390.cjs   (depuis migration/app, après `npm run build`)
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
  let failed = 0;
  try {
    browser = await chromium.launch({ executablePath: SHELL, args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGEERROR: ' + e.message));

    // 1. Connexion démo + seed
    await page.goto(base + '#/connexion', { waitUntil: 'load', timeout: 30000 });
    await page.waitForSelector('[data-testid="auth-page"]', { timeout: 10000 });
    await page.click('[data-testid="demo-btn"]');
    await page.waitForSelector('[data-testid="journal-page"]', { timeout: 10000 });
    check('démo -> journal', true);

    const Y = new Date().getFullYear();
    await page.evaluate((Y) => {
      const entries = [
        { id: 'e1', date: Y + '-01-10', journal: 'VT', piece: 'VT-001', libelle: 'Facture client DUPONT',
          lignes: [{ compte: '411', debit: 1180000, credit: 0 }, { compte: '701', debit: 0, credit: 1000000 }, { compte: '443', debit: 0, credit: 180000 }] },
        { id: 'e2', date: Y + '-02-10', journal: 'BQ', piece: 'BQ-001', libelle: 'Règlement client DUPONT',
          lignes: [{ compte: '521', debit: 1180000, credit: 0 }, { compte: '411', debit: 0, credit: 1180000 }] },
        { id: 'e3', date: Y + '-01-15', journal: 'AC', piece: 'AC-001', libelle: 'Achat fournisseur',
          lignes: [{ compte: '601', debit: 500000, credit: 0 }, { compte: '401', debit: 0, credit: 500000 }] },
      ];
      localStorage.setItem('fm2_journal_demo', JSON.stringify(entries));
      location.hash = '#/lettrage';
    }, Y);
    await page.waitForSelector('[data-testid="lettrage-page"]', { timeout: 10000 });
    check('page Lettrage affichée', true);

    // 2. Groupes 401 et 411 présents
    check('groupe 411 présent', await page.locator('[data-testid="tiers-card-411"]').count() === 1);
    check('groupe 401 présent', await page.locator('[data-testid="tiers-card-401"]').count() === 1);
    await noOverflow(page, 'lettrage');

    // 3. Lettrage des 2 lignes 411
    const boxes = page.locator('.lt-sel[data-c="411"]');
    check('2 lignes 411 non lettrées', await boxes.count() === 2);
    await boxes.nth(0).check();
    await boxes.nth(1).check();
    await page.click('[data-testid="letter-btn-411"]');
    await page.waitForSelector('[data-testid="letter-badge-411-A"]', { timeout: 5000 });
    check('badge lettre A affiché', true);
    check('compte 411 tout lettré', await page.locator('[data-testid="all-lettered-411"]').count() === 1);
    const soldeTxt = await page.textContent('[data-testid="tiers-card-411"]');
    check('solde non lettré = 0', /Solde non lettré\s*:\s*0,00/.test(soldeTxt.replace(/\s+/g, ' ')));
    await page.screenshot({ path: path.join(SHOTS, 'lettrage-390.png') });

    // 4. Délettrage
    await page.click('[data-testid="unletter-411-A"]');
    await page.waitForSelector('.lt-sel[data-c="411"]', { timeout: 5000 });
    check('délettrage : lignes redevenues non lettrées', await page.locator('.lt-sel[data-c="411"]').count() === 2);
    check('badge A disparu', await page.locator('[data-testid="letter-badge-411-A"]').count() === 0);

    // 5. Clic tiers -> balance + grand livre
    await page.click('[data-testid="tier-link-411"]');
    await page.waitForSelector('[data-testid="tier-detail"]', { timeout: 5000 });
    const detail = await page.textContent('[data-testid="tier-detail"]');
    check('détail tiers : totaux affichés', /Total débit/.test(detail) && /Total crédit/.test(detail));
    await noOverflow(page, 'lettrage / détail tiers');

    // 6. Calendrier : cherche un mois avec échéances (BF)
    await page.evaluate(() => { location.hash = '#/calendrier'; });
    await page.waitForSelector('[data-testid="calendrier-page"]', { timeout: 10000 });
    check('page Calendrier affichée', true);
    let found = false;
    for (let i = 0; i < 12; i++) {
      if (await page.locator('[data-testid^="cal-item-"]').count() > 0) { found = true; break; }
      await page.click('[data-testid="cal-next"]');
      await page.waitForTimeout(250);
    }
    check('mois avec échéances trouvé (BF)', found);
    const nOpts = await page.locator('[data-testid="cal-country"] option').count();
    check('17 pays au sélecteur', nOpts === 17, nOpts + ' options');
    await noOverflow(page, 'calendrier');

    // 7. Clic échéance -> fiche stratégique
    await page.locator('[data-testid^="cal-item-"]').first().click();
    await page.waitForSelector('[data-testid="fiche-modal"]', { timeout: 5000 });
    const fiche = await page.textContent('[data-testid="fiche-modal"]');
    check('fiche affichée (contenu ou indisponible)',
      /Périodicité/.test(fiche) || /non disponible/.test(fiche), fiche.slice(0, 60).replace(/\s+/g, ' '));
    await page.screenshot({ path: path.join(SHOTS, 'calendrier-390.png') });
    await page.click('[data-testid="fiche-close"]');
    check('fiche fermée', await page.locator('[data-testid="fiche-modal"]').count() === 0);

    // 8. Changement de pays
    await page.selectOption('[data-testid="cal-country"]', 'CI');
    await page.waitForTimeout(400);
    const sub = await page.textContent('[data-testid="calendrier-page"] .page-sub');
    check('pays CI sélectionné', /Côte d'Ivoire|CI/.test(sub), sub.slice(0, 50));
  } catch (e) {
    check('EXCEPTION: ' + e.message, false);
  } finally {
    if (browser) await browser.close();
    srv.close();
  }
  failed = results.filter((r) => !r.ok).length;
  console.log('---');
  console.log(results.length + ' contrôles, ' + failed + ' échec(s)');
  process.exit(failed ? 1 : 0);
})();
