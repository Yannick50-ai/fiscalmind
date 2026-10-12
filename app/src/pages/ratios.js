// FiscalMind Africa — page Ratios de gestion (#/ratios, protégée).
//
// Port de la feuille « RATIOS DE GESTION » du classeur NO-Pro.V2
// (moteur src/engine/ratios.js — 20 ratios, 5 catégories, N et N-1).
// - 5 catégories en sections repliables (<details>) ;
// - cartes ratio : valeur N, valeur N-1, jauge vs norme, interprétation,
//   badge « ⚠ à valider » + formule en légende pour DSO / DPO / BFR ;
// - exports Excel (.xls via app/src/exports.js — OBLIGATOIRE) et PDF
//   (impression, en-tête « Mon entreprise », période) ;
// - 100 % cloud (aucun localStorage/sessionStorage), mobile-first 390 px.
// - NE PAS câbler ici : l'enregistrement de la route se fait dans
//   app/src/app.js par le coordinateur (voir snippet en rapport de phase).

import { esc, fmt, toast, $, $all } from '../ui.js';
import {
  loadEntries, savePeriode, defaultPeriode, loadCompany,
} from '../store.js';
import { toLines } from '../../../src/engine/journal.js';
import { ratiosGestion } from '../../../src/engine/ratios.js';
import { buildExcelDoc, downloadExcel, renderSharedPrintHeader, fmtX } from '../exports.js';

const S = { entries: [], periode: null, company: '', data: null };

function shell() { return document.getElementById('appMain'); }
function year() { return S.periode.debut.slice(0, 4); }
function periodeLabel() { return 'Exercice ' + year(); }

/* ------------------------------------------------------------------ */
/* Formatage des valeurs par unité                                      */
/* ------------------------------------------------------------------ */

const fr1 = (v) => v.toFixed(1).replace('.', ',');
const fr2 = (v) => v.toFixed(2).replace('.', ',');

function fmtRatio(r, v) {
  if (v == null || !isFinite(v)) return '—';
  switch (r.unite) {
    case 'pct': return fr1(v * 100) + ' %';
    case 'j': return fr1(v) + ' j';
    case 'ans': return fr1(v) + ' ans';
    case 'fcfa': { const f = fmt(Math.round(v)); return (f === '' ? '0,00' : f) + ' F'; }
    default: return fr2(v);
  }
}

/* ------------------------------------------------------------------ */
/* Jauge vs norme                                                       */
/* ------------------------------------------------------------------ */

function gaugeHtml(r) {
  if (r.n == null || !r.seuil) return '';
  const s = r.seuil;
  const bounds = [s.min, s.max].filter((v) => v != null && isFinite(v));
  if (!bounds.length) return '';
  const v = r.n;
  const scale = Math.max(Math.abs(v), ...bounds.map((b) => Math.abs(b))) * 1.25 || 1;
  const pos = (x) => Math.min(100, Math.max(0, (x / scale) * 100)).toFixed(1);
  const ticks = bounds.map((b) =>
    '<span class="rg-tick" style="left:' + pos(b) + '%" title="Cible : ' + esc(String(b)) + '"></span>').join('');
  const ok = (s.min == null || v >= s.min) && (s.max == null || v <= s.max);
  const verdict = ok
    ? '<span class="badge-ok">✓ cible</span>'
    : '<span class="badge-ko">⚠ hors cible</span>';
  return '<div class="rg-gauge"><div class="rg-bar">' + ticks
    + '<span class="rg-dot' + (ok ? ' ok' : ' ko') + '" style="left:' + pos(v) + '%"></span></div>'
    + verdict + '</div>';
}

/* ------------------------------------------------------------------ */
/* Rendu                                                                */
/* ------------------------------------------------------------------ */

const PAGE_CSS = `
.rg-sub{font-size:12.5px;color:#555;margin:6px 0 2px;line-height:1.5}
.rg-cat{border:1px solid var(--border,#e5e0d5);border-radius:12px;margin:10px 0;background:#fff;overflow:hidden}
.rg-cat>summary{padding:12px 14px;font-weight:700;font-size:15px;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:8px;background:linear-gradient(135deg,#fff8e7,#fdf3d8)}
.rg-cat>summary::-webkit-details-marker{display:none}
.rg-cat>summary .rg-count{font-size:11px;font-weight:600;color:#8a6a1f;background:#fff;border:1px solid #e5d9b8;border-radius:12px;padding:2px 8px;white-space:nowrap}
.rg-cards{padding:8px;display:grid;gap:8px}
.rg-card{border:1px solid var(--border,#e5e0d5);border-radius:10px;padding:10px 12px;background:#fffdf7}
.rg-card-head{display:flex;align-items:flex-start;gap:8px;margin-bottom:6px}
.rg-code{font-size:10px;font-weight:800;color:#fff;background:#1f3a5f;border-radius:6px;padding:3px 7px;white-space:nowrap;margin-top:1px}
.rg-label{font-weight:700;font-size:13.5px;flex:1}
.rg-av{display:inline-block;font-size:10.5px;font-weight:800;color:#92400e;background:#fef3c7;border:1px solid #f59e0b;border-radius:12px;padding:2px 8px;white-space:nowrap}
.rg-vals{display:flex;gap:16px;margin:4px 0 6px}
.rg-val{font-size:12px;color:#666}
.rg-val strong{display:block;font-size:16px;color:#1a1a1a}
.rg-val.n1 strong{font-size:13px;color:#555;font-weight:600}
.rg-gauge{display:flex;align-items:center;gap:8px;margin:6px 0}
.rg-bar{position:relative;flex:1;height:8px;background:#f1ead6;border-radius:4px}
.rg-tick{position:absolute;top:-3px;width:2px;height:14px;background:#8a6a1f;border-radius:1px}
.rg-dot{position:absolute;top:50%;width:12px;height:12px;border-radius:50%;transform:translate(-50%,-50%);border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.25)}
.rg-dot.ok{background:#16a34a}.rg-dot.ko{background:#dc2626}
.rg-norme{font-size:11.5px;color:#8a6a1f;margin:4px 0}
.rg-interp{font-size:12.5px;color:#444;margin:4px 0;line-height:1.45}
.rg-form{margin-top:6px;font-size:11.5px;color:#555}
.rg-form>summary{cursor:pointer;color:#1f3a5f;font-weight:600;font-size:11.5px}
.rg-form .rg-note{margin-top:4px;padding:6px 8px;background:#fffbeb;border-left:3px solid #f59e0b;border-radius:0 6px 6px 0}
.rg-form code{font-size:11px}
@media print{.rg-cat{break-inside:avoid}.rg-card{break-inside:avoid}}
`;

function cardHtml(r) {
  const av = r.aValider
    ? ' <span class="rg-av" data-testid="badge-av-' + esc(r.code) + '" title="' + esc(r.noteValider || 'Formule à valider') + '">⚠ à valider</span>'
    : '';
  const form = '<details class="rg-form"><summary>Formule et source</summary>'
    + '<div><code>' + esc(r.formule || '—') + '</code></div>'
    + (r.aValider && r.noteValider ? '<div class="rg-note">⚠ ' + esc(r.noteValider) + '</div>' : '')
    + '</details>';
  return '<article class="rg-card" data-testid="ratio-' + esc(r.code) + '" data-code="' + esc(r.code) + '">'
    + '<div class="rg-card-head"><span class="rg-code">' + esc(r.code) + '</span>'
    + '<span class="rg-label">' + esc(r.label) + '</span>' + av + '</div>'
    + '<div class="rg-vals">'
    + '<div class="rg-val">N<strong data-testid="ratio-' + esc(r.code) + '-n">' + esc(fmtRatio(r, r.n)) + '</strong></div>'
    + '<div class="rg-val n1">N-1<strong>' + esc(fmtRatio(r, r.n1)) + '</strong></div>'
    + '</div>'
    + gaugeHtml(r)
    + '<p class="rg-norme">Norme : <strong>' + esc(r.norme) + '</strong></p>'
    + '<p class="rg-interp">' + esc(r.interpretation) + '</p>'
    + form
    + '</article>';
}

function renderContent() {
  const c = $('#ratiosContent');
  c.innerHTML = S.data.categories.map((cat, i) =>
    '<details class="rg-cat" data-testid="ratios-cat"' + (i === 0 ? ' open' : '') + '>'
    + '<summary><span>' + esc(cat.titre) + '</span>'
    + '<span class="rg-count">' + cat.ratios.length + ' ratio' + (cat.ratios.length > 1 ? 's' : '') + '</span></summary>'
    + '<div class="rg-cards">' + cat.ratios.map(cardHtml).join('') + '</div>'
    + '</details>').join('');
}

function compute() {
  S.data = ratiosGestion(toLines(S.entries), { year: Number(year()) });
}

/* ------------------------------------------------------------------ */
/* Exports Excel / PDF                                                  */
/* ------------------------------------------------------------------ */

function valCell(r, v) {
  if (v == null || !isFinite(v)) return '<td>—</td>';
  if (r.unite === 'fcfa') return '<td class="num">' + fmtX(v) + '</td>';
  if (r.unite === 'pct') return '<td class="num">' + fr1(v * 100).replace(',', '.') + ' %</td>';
  return '<td class="num">' + String(Math.round(v * 100) / 100).replace('.', ',') + '</td>';
}

function exportExcel() {
  const y = year();
  let body = '';
  for (const cat of S.data.categories) {
    body += '<table><thead><tr><th colspan="6">' + esc(cat.titre) + '</th></tr>'
      + '<tr><th>Code</th><th>Ratio</th><th>N (' + y + ')</th><th>N-1 (' + (Number(y) - 1)
      + ')</th><th>Norme</th><th>Interprétation</th></tr></thead><tbody>';
    for (const r of cat.ratios) {
      body += '<tr><td>' + esc(r.code) + '</td><td>' + esc(r.label)
        + (r.aValider ? ' ⚠ À VALIDER' : '') + '</td>'
        + valCell(r, r.n) + valCell(r, r.n1)
        + '<td>' + esc(r.norme) + '</td><td>' + esc(r.interpretation)
        + (r.aValider && r.noteValider ? ' — ' + esc(r.noteValider) : '')
        + '<br><i>Formule : ' + esc(r.formule || '—') + '</i></td></tr>';
    }
    body += '</tbody></table>';
  }
  const doc = buildExcelDoc({
    company: S.company,
    title: 'Ratios de gestion',
    periode: periodeLabel(),
    bodyHtml: body,
  });
  downloadExcel('ratios_gestion_' + y + '.xls', doc);
  toast('Export Excel téléchargé.', 'success');
}

function renderPrintHeader() {
  renderSharedPrintHeader(S.company, 'Ratios de gestion', periodeLabel());
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export async function renderRatiosPage(query) {
  shell().innerHTML = '<div data-testid="ratios-page"><div class="loading-state">Chargement des ratios…</div></div>';
  try {
    const [entries, periode, company] = await Promise.all([
      loadEntries(), defaultPeriode(), loadCompany(),
    ]);
    S.entries = entries;
    S.periode = periode;
    S.company = company;
  } catch (err) {
    shell().innerHTML = '<div class="error-state" data-testid="ratios-error">'
      + '<div class="error-icon">⚠️</div><p>' + esc(err.message || 'Erreur de chargement.') + '</p>'
      + '<button class="btn btn-primary" id="ratiosRetry">Réessayer</button></div>';
    document.getElementById('ratiosRetry').addEventListener('click', () => renderRatiosPage(query));
    return;
  }
  compute();

  shell().innerHTML =
    '<style>' + PAGE_CSS + '</style>'
    + '<div data-testid="ratios-page">'
    + '<div class="etats-head no-print">'
    + '<h2 class="page-title">📊 Ratios de gestion</h2>'
    + '<div class="journal-toolbar">'
    + '<select id="ratiosExercice" class="form-input" data-testid="ratios-exercice" aria-label="Exercice"></select>'
    + '<button class="btn btn-secondary btn-sm" id="ratiosExcel" data-testid="ratios-excel">⬇️ Excel</button>'
    + '<button class="btn btn-secondary btn-sm" id="ratiosPdf" data-testid="ratios-pdf">🖨️ PDF</button>'
    + '</div>'
    + '<p class="rg-sub">20 ratios en 5 catégories — valeurs N et N-1, normes du classeur NO-Pro.V2. '
    + 'Les ratios marqués <span class="rg-av">⚠ à valider</span> reposent sur une formule du classeur à confirmer.</p>'
    + '</div>'
    + '<div class="print-header" id="printHeader"></div>'
    + '<div id="ratiosContent"></div>'
    + '</div>';

  renderExercices();
  $('#ratiosExercice').addEventListener('change', async (e) => {
    const y = e.target.value;
    S.periode = { debut: y + '-01-01', fin: y + '-12-31' };
    try { await savePeriode(S.periode); }
    catch (err) { toast(err.message || 'Erreur de sauvegarde.', 'error'); }
    compute();
    renderContent();
  });
  $('#ratiosExcel').addEventListener('click', exportExcel);
  $('#ratiosPdf').addEventListener('click', () => { renderPrintHeader(); window.print(); });

  renderPrintHeader();
  renderContent();
}

function renderExercices() {
  const years = new Set([String(new Date().getFullYear())]);
  S.entries.forEach((e) => { if (e.date) years.add(String(e.date).slice(0, 4)); });
  const cur = year();
  $('#ratiosExercice').innerHTML = Array.from(years).sort().reverse()
    .map((y) => '<option value="' + y + '"' + (y === cur ? ' selected' : '') + '>Exercice ' + y + '</option>').join('');
}
