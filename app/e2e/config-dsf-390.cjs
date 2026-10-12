#!/usr/bin/env node
/**
 * Smoke test e2e 390px : page Configuration — section « Identification DSF ».
 * Harnais direct de renderConfigPage (store + licence mockés).
 * Usage : node e2e/config-dsf-390.cjs (depuis migration/app)
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
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const HARNESS_HTML = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Config — harnais e2e</title>
<link rel="stylesheet" href="/app-src/styles/afrique-premium.css">
<link rel="stylesheet" href="/app-src/styles/app.css">
<script type="importmap">
{ "imports": {
  "/app-src/store.js": "/e2e/mock-store-config.js",
  "/app-src/licence.js": "/e2e/mock-licence-config.js"
} }
</script></head><body>
<div id="appMain"></div>
<div class="toast-container" id="toastContainer"></div>
<script type="module">
import { renderConfigPage } from '/app-src/pages/config.js';
renderConfigPage();
window.__configReady = true;
</script></body></html>`;

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = decodeURIComponent(req.url.split('?')[0]);
      let file = null;
      if (p === '/e2e-config.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(HARNESS_HTML); return; }
      if (p.startsWith('/app-src/')) file = path.join(APP, 'src', p.slice('/app-src/'.length));
      else if (p.startsWith('/src/')) file = path.join(ENG, p.slice('/src/'.length));
      else if (p.startsWith('/e2e/')) file = path.join(APP, 'e2e', p.slice('/e2e/'.length));
      if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
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

function mockInitScript() {
  /* eslint-disable */
  window.__fmMockSettings = {
    company: 'Smoke SARL',
    company_regime: 'BIC',
    company_r1: { sigle: 'SS', rccm: 'BF-OUA-2025-B-11111' },
    company_dirigeants: [{ nom: 'Yannick O.', qualite: 'Gérant', contact: '70' }],
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
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true });
    await ctx.addInitScript(mockInitScript);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('PAGEERROR: ' + e.message));
    await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com/, (r) => r.abort());
    await page.goto(base + 'e2e-config.html', { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => window.__configReady === true, null, { timeout: 15000 });
    await page.waitForSelector('[data-testid="config-page"]', { timeout: 15000 });

    check('D0 page config chargée', true);
    const sigle = await page.$eval('[data-testid="dsf-sigle"]', (el) => el.value);
    check('D1 section DSF : sigle pré-rempli depuis fm_settings', sigle === 'SS', JSON.stringify(sigle));
    const regimeOpts = await page.$$eval('#cfg-regime option', (o) => o.map((e) => e.value));
    check('D2 régime fiscal = sélecteur BIC/BNC/BA', ['BIC', 'BNC', 'BA'].every((v) => regimeOpts.includes(v)), regimeOpts.join(','));
    const regimeVal = await page.$eval('#cfg-regime', (el) => el.value);
    check('D3 régime pré-sélectionné BIC', regimeVal === 'BIC', regimeVal);
    const dirCount = await page.$$eval('[data-person-kind="dir"]', (els) => els.length);
    check('D4 dirigeant mock affiché', dirCount === 1, 'lignes=' + dirCount);
    // Ajout d'un associé puis sauvegarde.
    await page.click('[data-testid="dsf-ass-add"]');
    await page.waitForTimeout(300);
    const assCount = await page.$$eval('[data-person-kind="ass"]', (els) => els.length);
    check('D5 « Ajouter » associé -> 1 ligne', assCount === 1, 'lignes=' + assCount);
    await page.fill('[data-testid="dsf-sigle"]', 'SS2');
    const rows = await page.$$('[data-person-kind="ass"]');
    await rows[0].evaluate((r) => {
      r.querySelector('[data-ass-nom]').value = 'Awa D.';
      r.querySelector('[data-ass-qualite]').value = 'Associée';
      r.querySelector('[data-ass-part]').value = '60 %';
    });
    await page.click('[data-testid="dsf-save"]');
    await page.waitForTimeout(800);
    const saved = await page.evaluate(() => ({
      sigle: (window.__fmMockSettings.company_r1 || {}).sigle,
      ass: (window.__fmMockSettings.company_associes || [])[0],
      dir: (window.__fmMockSettings.company_dirigeants || [])[0],
    }));
    check('D6 sauvegarde -> fm_settings (r1 + associés + dirigeants préservés)',
      saved.sigle === 'SS2' && saved.ass && saved.ass.nom === 'Awa D.' && saved.dir && saved.dir.nom === 'Yannick O.',
      JSON.stringify(saved));
    // Le nom d'entreprise (source en-tête) est intact.
    const compName = await page.evaluate(() => window.__fmMockSettings.company);
    check('D7 nom d’entreprise intact', compName === 'Smoke SARL', compName);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    check('D8 pas de débordement horizontal', sw <= W, 'scrollWidth=' + sw);
    await page.screenshot({ path: path.join(SHOTS, 'config-dsf-390.png') });
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
