// FiscalMind Africa — page Pilotage (#/pilotage, protégée).
//
// CE (compte d'exploitation) + PT (plan de trésorerie) mensuels, réels et
// prévisionnels — port du classeur NO-Pro.V2 (moteurs src/engine/ce-pt.js).
// 4 sous-vues : CE réel | CE prévision | PT réel | PT prévisionnel.
// - Tableaux 12 mois + total (scroll horizontal sur mobile, .table-wrap).
// - Prévision : objectif par poste (montant FCFA ou %), moteur
//   prévision = réel × (1 + variation/total) — saisonnalité conservée.
//   Objectifs persistés en fm_settings ('pilotage_objectifs'), 100 % cloud.
// - Graphiques en barres SVG mensuels, zéro dépendance.
// - Exports par vue : Excel (.xls via app/src/exports.js) et PDF (impression).
//   Pas de CSV pour ces états (règle produit).

import { esc, fmt, toast, $, $all } from '../ui.js';
import {
  loadEntries, savePeriode, defaultPeriode,
  loadCompany, getSetting, setSetting,
} from '../store.js';
import { toLines } from '../../../src/engine/journal.js';
import {
  compteExploitation, planTresorerie, prevoir, sigCE, ceRefs, ptRefs,
} from '../../../src/engine/ce-pt.js';
import { buildExcelDoc, downloadExcel, renderSharedPrintHeader } from '../exports.js';

const S = {
  entries: [], periode: null, company: '',
  tab: 'ce-reel',
  ce: null, pt: null,
  objectifs: { ce: {}, pt: {} }, // { REF: { type: 'montant'|'pct', value: number } }
};

const TABS = [
  ['ce-reel', '📊 CE réel'],
  ['ce-prev', '🔮 CE prévision'],
  ['pt-reel', '💧 PT réel'],
  ['pt-prev', '🔮 PT prévisionnel'],
];

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const OBJ_KEY = 'pilotage_objectifs';

function shell() { return document.getElementById('appMain'); }
function year() { return S.periode.debut.slice(0, 4); }
function periodeLabel() { return 'Exercice ' + year(); }

/** fmt() rend '' pour 0 — mois vides allégés ; totaux toujours chiffrés. */
function fmtM(v) { return v === 0 ? '' : fmt(v); }
function fmtT(v) { const n = Math.round(Number(v) || 0); return n === 0 ? '0,00' : fmt(n); }
const sum12 = a => a.reduce((x, y) => x + y, 0);
const z12 = () => new Array(12).fill(0);

/* ------------------------------------------------------------------ */
/* Calculs                                                             */
/* ------------------------------------------------------------------ */

function compute() {
  const lines = toLines(S.entries);
  S.ce = compteExploitation(lines, { year: year() });
  S.pt = planTresorerie(lines, { year: year() });
}

function objectifOf(kind, ref) {
  const o = (S.objectifs[kind] || {})[ref];
  if (!o || o.value === '' || o.value == null) return {};
  const v = Number(o.value);
  if (!isFinite(v) || v === 0) return {};
  return o.type === 'pct' ? { variationPct: v } : { variation: Math.round(v) };
}

/** CE prévisionnel : chaque poste est projeté, puis les SIG sont recalculés. */
function previsionCE() {
  const postes = S.ce.postes.map(p => {
    const mois = prevoir(p.mois, objectifOf('ce', p.ref));
    return { ref: p.ref, label: p.label, signe: p.signe, mois, total: sum12(mois) };
  });
  return { postes, sig: sigCE(postes) };
}

/** PT prévisionnel : chaque REF est projetée (AF comprise, comme le classeur). */
function previsionPT() {
  const refs = S.pt.refs.map(r => {
    const mois = prevoir(r.mois, objectifOf('pt', r.ref));
    return { ref: r.ref, label: r.label, signe: r.signe, mois, total: sum12(mois) };
  });
  const enc = z12(), dec = z12();
  refs.forEach(r => {
    const k = r.ref.charAt(0);
    for (let m = 0; m < 12; m++) {
      if (k === 'E') enc[m] += r.mois[m];
      else if (k === 'D') dec[m] += r.mois[m];
    }
  });
  const af = refs.find(r => r.ref === 'AF').mois;
  const net = z12(), solde = z12();
  let c = 0;
  for (let m = 0; m < 12; m++) { net[m] = enc[m] - dec[m] + af[m]; c += net[m]; solde[m] = c; }
  return { refs, totaux: { encaissements: enc, decaissements: dec, net }, solde };
}

/* ------------------------------------------------------------------ */
/* Rendu principal                                                     */
/* ------------------------------------------------------------------ */

export async function renderPilotagePage(query) {
  shell().innerHTML = '<div data-testid="pilotage-page"><div class="loading-state">Chargement du pilotage…</div></div>';
  try {
    const [entries, periode, company, objectifs] = await Promise.all([
      loadEntries(), defaultPeriode(), loadCompany(),
      getSetting(OBJ_KEY, { ce: {}, pt: {} }),
    ]);
    S.entries = entries;
    S.periode = periode;
    S.company = company;
    S.objectifs = (objectifs && typeof objectifs === 'object')
      ? { ce: objectifs.ce || {}, pt: objectifs.pt || {} }
      : { ce: {}, pt: {} };
  } catch (err) {
    shell().innerHTML = '<div class="error-state" data-testid="pilotage-error">'
      + '<div class="error-icon">⚠️</div><p>' + esc(err.message || 'Erreur de chargement.') + '</p>'
      + '<button class="btn btn-primary" id="pilotageRetry">Réessayer</button></div>';
    document.getElementById('pilotageRetry').addEventListener('click', () => renderPilotagePage(query));
    return;
  }
  if (query && query.tab && TABS.some(([k]) => k === query.tab)) S.tab = query.tab;
  compute();

  shell().innerHTML =
    '<div data-testid="pilotage-page">'
    + '<div class="etats-head no-print">'
    + '<h2 class="page-title">🧭 Pilotage — CE &amp; Trésorerie</h2>'
    + '<div class="journal-toolbar">'
    + '<select id="pilotageExercice" class="form-input" data-testid="pilotage-exercice" aria-label="Exercice"></select>'
    + '<button class="btn btn-secondary btn-sm" id="pilotageExcel" data-testid="pilotage-excel">⬇️ Excel</button>'
    + '<button class="btn btn-secondary btn-sm" id="pilotagePdf" data-testid="pilotage-pdf">🖨️ PDF</button>'
    + '</div>'
    + '<div class="etats-tabs" role="tablist">'
    + TABS.map(([k, label]) =>
      '<button class="etats-tab' + (S.tab === k ? ' active' : '') + '" role="tab" data-tab="' + k + '" data-testid="pilotage-tab-' + k + '">'
      + label + '</button>').join('')
    + '</div></div>'
    + '<div class="print-header" id="printHeader"></div>'
    + '<div id="pilotageContent"></div>'
    + '</div>';

  renderExercices();
  $('#pilotageExercice').addEventListener('change', async (e) => {
    const y = e.target.value;
    S.periode = { debut: y + '-01-01', fin: y + '-12-31' };
    try { await savePeriode(S.periode); }
    catch (err) { toast(err.message || 'Erreur de sauvegarde.', 'error'); }
    compute();
    renderContent();
  });
  $('#pilotageExcel').addEventListener('click', exportExcel);
  $('#pilotagePdf').addEventListener('click', () => { renderPrintHeader(); window.print(); });
  $all('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    S.tab = b.dataset.tab;
    $all('[data-tab]').forEach((x) => x.classList.toggle('active', x === b));
    renderContent();
  }));

  renderContent();
}

function renderExercices() {
  const years = new Set([String(new Date().getFullYear())]);
  S.entries.forEach((e) => { if (e.date) years.add(String(e.date).slice(0, 4)); });
  const cur = year();
  $('#pilotageExercice').innerHTML = Array.from(years).sort().reverse()
    .map((y) => '<option value="' + y + '"' + (y === cur ? ' selected' : '') + '>Exercice ' + y + '</option>').join('');
}

function viewTitle() {
  return { 'ce-reel': 'Compte d’exploitation — réel', 'ce-prev': 'Compte d’exploitation — prévisionnel',
    'pt-reel': 'Plan de trésorerie — réel', 'pt-prev': 'Plan de trésorerie — prévisionnel' }[S.tab];
}

function renderPrintHeader() {
  renderSharedPrintHeader(S.company, viewTitle(), periodeLabel());
}

function renderContent() {
  renderPrintHeader();
  const c = $('#pilotageContent');
  if (S.tab === 'ce-reel') c.innerHTML = renderCeReel();
  else if (S.tab === 'ce-prev') { c.innerHTML = renderCePrev(); bindObjectifs('ce'); bindReset('ce'); }
  else if (S.tab === 'pt-reel') c.innerHTML = renderPtReel();
  else { c.innerHTML = renderPtPrev(); bindObjectifs('pt'); bindReset('pt'); }
}

/* ------------------------------------------------------------------ */
/* Tableaux                                                            */
/* ------------------------------------------------------------------ */

function thead() {
  return '<tr><th>Réf</th><th>Libellé</th>'
    + MOIS.map(m => '<th class="num">' + m + '</th>').join('')
    + '<th class="num">Total</th></tr>';
}

function rowHtml(r, cls, testid) {
  return '<tr' + (cls ? ' class="' + cls + '"' : '') + '>'
    + '<td class="ref">' + esc(r.ref) + '</td>'
    + '<td>' + esc(r.label) + '</td>'
    + r.mois.map(v => '<td class="num">' + fmtM(v) + '</td>').join('')
    + '<td class="num"' + (testid ? ' data-testid="' + testid + '"' : '') + '><strong>' + fmtT(r.total) + '</strong></td>'
    + '</tr>';
}

function tableWrap(inner) {
  return '<div class="table-wrap">' + inner + '</div>';
}

function renderCeReel() {
  const { postes, sig } = S.ce;
  const xi = sig.find(x => x.ref === 'XI');
  return '<div class="stmt-head">'
    + '<h3 class="stmt-title">Compte d’exploitation — réel (' + esc(periodeLabel()) + ')</h3>'
    + '<span class="badge-ok">Résultat net : ' + fmtT(xi.total) + ' F</span></div>'
    + svgSingle(xi.mois, 'Résultat net mensuel (XI)', 'pilotage-chart-ce-reel')
    + tableWrap('<table class="etats-table"><thead>' + thead() + '</thead><tbody>'
      + postes.map(p => rowHtml(p)).join('')
      + sig.map(x => rowHtml(x, 'row-total')).join('')
      + '</tbody></table>');
}

function renderCePrev() {
  const { postes, sig } = previsionCE();
  const xi = sig.find(x => x.ref === 'XI');
  return objectifsPanel('ce')
    + '<div id="pilotageResult">'
    + '<div class="stmt-head">'
    + '<h3 class="stmt-title">Compte d’exploitation — prévisionnel (' + esc(periodeLabel()) + ')</h3>'
    + '<span class="badge-ok">Résultat net prévu : ' + fmtT(xi.total) + ' F</span></div>'
    + '<div class="print-only">' + esc(objectifsSummary('ce')) + '</div>'
    + svgSingle(xi.mois, 'Résultat net prévisionnel mensuel (XI)', 'pilotage-chart-ce-prev')
    + tableWrap('<table class="etats-table"><thead>' + thead() + '</thead><tbody>'
      + postes.map(p => rowHtml(p, '', 'prevtotal-ce-' + p.ref)).join('')
      + sig.map(x => rowHtml(x, 'row-total', 'prevtotal-ce-' + x.ref)).join('')
      + '</tbody></table>')
    + '</div>';
}

function renderPtReel() {
  return renderPt(S.pt, false);
}

function renderPtPrev() {
  return renderPt(previsionPT(), true);
}

function renderPt(pt, isPrev) {
  const t = pt.totaux;
  const totRow = (label, arr, testid) =>
    rowHtml({ ref: '', label, mois: arr, total: sum12(arr) }, 'row-total', testid);
  const body =
    pt.refs.map(r => rowHtml(r, r.ref === 'AF' ? 'row-sub' : '', isPrev ? 'prevtotal-pt-' + r.ref : '')).join('')
    + totRow('Total encaissements (E1 à E4)', t.encaissements, isPrev ? 'prevtotal-pt-ENC' : '')
    + totRow('Total décaissements (D1 à D6)', t.decaissements, isPrev ? 'prevtotal-pt-DEC' : '')
    + totRow('Trésorerie nette mensuelle', t.net, isPrev ? 'prevtotal-pt-NET' : '')
    + totRow('Solde de trésorerie cumulé', pt.solde, isPrev ? 'prevtotal-pt-SOLDE' : '');
  const chart = svgDouble(t.encaissements, t.decaissements,
    isPrev ? 'Encaissements / décaissements prévisionnels' : 'Encaissements / décaissements mensuels',
    isPrev ? 'pilotage-chart-pt-prev' : 'pilotage-chart-pt-reel');
  const head = '<div class="stmt-head">'
    + '<h3 class="stmt-title">Plan de trésorerie — ' + (isPrev ? 'prévisionnel' : 'réel')
    + ' (' + esc(periodeLabel()) + ')</h3>'
    + '<span class="badge-ok">Solde fin d’exercice : ' + fmtT(pt.solde[11]) + ' F</span></div>';
  const inner = head
    + (isPrev ? '<div class="print-only">' + esc(objectifsSummary('pt')) + '</div>' : '')
    + chart
    + tableWrap('<table class="etats-table"><thead>' + thead() + '</thead><tbody>' + body + '</tbody></table>');
  return isPrev ? objectifsPanel('pt') + '<div id="pilotageResult">' + inner + '</div>' : inner;
}

/* ------------------------------------------------------------------ */
/* Panneau d'objectifs (prévision)                                     */
/* ------------------------------------------------------------------ */

function objectifsPanel(kind) {
  const defs = kind === 'ce' ? ceRefs() : ptRefs();
  const obj = S.objectifs[kind] || {};
  return '<details class="obj-panel no-print" open>'
    + '<summary>🎯 Objectifs de prévision par poste <small>(variation souhaitée : montant ou %)</small></summary>'
    + '<div class="obj-grid">'
    + defs.map(d => {
      const o = obj[d.ref] || {};
      return '<div class="obj-row">'
        + '<span class="obj-ref" title="' + esc(d.label) + '">' + esc(d.ref) + '</span>'
        + '<input class="form-input obj-val" type="number" step="any" data-kind="' + kind + '" data-ref="' + d.ref + '"'
        + ' data-testid="obj-' + kind + '-' + d.ref + '" value="' + esc(o.value ?? '') + '" placeholder="0"'
        + ' aria-label="Objectif ' + esc(d.ref) + ' — ' + esc(d.label) + '">'
        + '<select class="form-input obj-type" data-kind="' + kind + '" data-ref="' + d.ref + '"'
        + ' data-testid="objtype-' + kind + '-' + d.ref + '" aria-label="Type d’objectif ' + esc(d.ref) + '">'
        + '<option value="montant"' + (o.type !== 'pct' ? ' selected' : '') + '>FCFA</option>'
        + '<option value="pct"' + (o.type === 'pct' ? ' selected' : '') + '>%</option>'
        + '</select></div>';
    }).join('')
    + '</div>'
    + '<button class="btn btn-secondary btn-sm" id="objReset" data-testid="obj-reset">↺ Réinitialiser les objectifs</button>'
    + '</details>';
}

function objectifsSummary(kind) {
  const obj = S.objectifs[kind] || {};
  const parts = Object.keys(obj)
    .filter(r => obj[r] && obj[r].value !== '' && obj[r].value != null && Number(obj[r].value) !== 0)
    .map(r => r + ' ' + (obj[r].type === 'pct' ? obj[r].value + ' %' : fmt(obj[r].value) + ' FCFA'));
  return parts.length ? 'Objectifs saisis : ' + parts.join(' · ') : 'Aucun objectif saisi (reprise du réel).';
}

let saveTimer = null;
function bindObjectifs(kind) {
  const content = $('#pilotageContent');
  if (!content || content.dataset['objBound_' + kind]) return; // un seul bind par vue
  content.dataset['objBound_' + kind] = '1';
  const refresh = () => {
    const res = $('#pilotageResult');
    if (!res) return;
    res.innerHTML = kind === 'ce'
      ? resultInnerCePrev()
      : resultInnerPtPrev();
  };
  let inputTimer = null;
  content.addEventListener('input', (e) => {
    const el = e.target.closest('.obj-val');
    if (!el || el.dataset.kind !== kind) return;
    S.objectifs[kind][el.dataset.ref] = {
      type: (content.querySelector('.obj-type[data-ref="' + el.dataset.ref + '"]') || {}).value || 'montant',
      value: el.value,
    };
    clearTimeout(inputTimer);
    inputTimer = setTimeout(refresh, 300); // recalcul instantané, sans perdre le focus
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveObjectifs, 1200);
  });
  content.addEventListener('change', (e) => {
    const el = e.target.closest('.obj-val, .obj-type');
    if (!el || el.dataset.kind !== kind) return;
    const ref = el.dataset.ref;
    const valEl = content.querySelector('.obj-val[data-ref="' + ref + '"]');
    const typeEl = content.querySelector('.obj-type[data-ref="' + ref + '"]');
    S.objectifs[kind][ref] = { type: (typeEl || {}).value || 'montant', value: (valEl || {}).value };
    refresh();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveObjectifs, 400);
  });
}

/** Bouton « Réinitialiser » — re-bindé à chaque rendu (élément recréé). */
function bindReset(kind) {
  const reset = $('#objReset');
  if (!reset) return;
  reset.addEventListener('click', async () => {
    S.objectifs[kind] = {};
    try { await saveObjectifs(); toast('Objectifs réinitialisés.', 'success'); }
    catch (err) { toast(err.message || 'Sauvegarde impossible.', 'error'); }
    renderContent();
  });
}

/** Contenu (tableau + graphique) des vues prévisionnelles, re-rendu seul. */
function resultInnerCePrev() {
  const { postes, sig } = previsionCE();
  const xi = sig.find(x => x.ref === 'XI');
  return '<div class="stmt-head">'
    + '<h3 class="stmt-title">Compte d’exploitation — prévisionnel (' + esc(periodeLabel()) + ')</h3>'
    + '<span class="badge-ok">Résultat net prévu : ' + fmtT(xi.total) + ' F</span></div>'
    + '<div class="print-only">' + esc(objectifsSummary('ce')) + '</div>'
    + svgSingle(xi.mois, 'Résultat net prévisionnel mensuel (XI)', 'pilotage-chart-ce-prev')
    + tableWrap('<table class="etats-table"><thead>' + thead() + '</thead><tbody>'
      + postes.map(p => rowHtml(p, '', 'prevtotal-ce-' + p.ref)).join('')
      + sig.map(x => rowHtml(x, 'row-total', 'prevtotal-ce-' + x.ref)).join('')
      + '</tbody></table>');
}

function resultInnerPtPrev() {
  const pt = previsionPT();
  const t = pt.totaux;
  const totRow = (label, arr, testid) =>
    rowHtml({ ref: '', label, mois: arr, total: sum12(arr) }, 'row-total', testid);
  return '<div class="stmt-head">'
    + '<h3 class="stmt-title">Plan de trésorerie — prévisionnel (' + esc(periodeLabel()) + ')</h3>'
    + '<span class="badge-ok">Solde fin d’exercice prévu : ' + fmtT(pt.solde[11]) + ' F</span></div>'
    + '<div class="print-only">' + esc(objectifsSummary('pt')) + '</div>'
    + svgDouble(t.encaissements, t.decaissements, 'Encaissements / décaissements prévisionnels', 'pilotage-chart-pt-prev')
    + tableWrap('<table class="etats-table"><thead>' + thead() + '</thead><tbody>'
      + pt.refs.map(r => rowHtml(r, r.ref === 'AF' ? 'row-sub' : '', 'prevtotal-pt-' + r.ref)).join('')
      + totRow('Total encaissements (E1 à E4)', t.encaissements, 'prevtotal-pt-ENC')
      + totRow('Total décaissements (D1 à D6)', t.decaissements, 'prevtotal-pt-DEC')
      + totRow('Trésorerie nette mensuelle', t.net, 'prevtotal-pt-NET')
      + totRow('Solde de trésorerie cumulé', pt.solde, 'prevtotal-pt-SOLDE')
      + '</tbody></table>');
}

async function saveObjectifs() {
  await setSetting(OBJ_KEY, S.objectifs);
}

/* ------------------------------------------------------------------ */
/* Graphiques SVG (zéro dépendance)                                    */
/* ------------------------------------------------------------------ */

function svgFrame(barsSvg, labelsSvg, legendHtml, testid, ariaLabel) {
  const W = 560, H = 200;
  return '<div class="chart-card"><div class="chart-title">' + esc(ariaLabel) + '</div>'
    + '<div class="chart-scroll"><svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img"'
    + ' aria-label="' + esc(ariaLabel) + '" data-testid="' + testid + '">'
    + barsSvg + labelsSvg + '</svg></div>'
    + (legendHtml ? '<div class="chart-legend">' + legendHtml + '</div>' : '')
    + '</div>';
}

function barGeom(valuesList) {
  const W = 560, H = 200, padL = 10, padB = 26, padT = 12;
  const all = valuesList.flatMap(v => v);
  const max = Math.max(0, ...all), min = Math.min(0, ...all);
  const range = (max - min) || 1;
  const y = v => padT + (max - v) / range * (H - padT - padB);
  const gw = (W - padL * 2) / 12;
  let labels = '';
  for (let m = 0; m < 12; m++) {
    labels += '<text x="' + (padL + m * gw + gw / 2).toFixed(1) + '" y="' + (H - 8)
      + '" text-anchor="middle" font-size="10" fill="#666">' + MOIS[m].slice(0, 3) + '</text>';
  }
  return { y, y0: y(0), gw, padL, labels };
}

function svgSingle(values, title, testid) {
  const g = barGeom([values]);
  const bw = Math.min(30, g.gw - 10);
  let bars = '';
  for (let m = 0; m < 12; m++) {
    const v = values[m];
    const x = g.padL + m * g.gw + (g.gw - bw) / 2;
    const yv = g.y(v);
    bars += '<rect x="' + x.toFixed(1) + '" y="' + Math.min(yv, g.y0).toFixed(1)
      + '" width="' + bw.toFixed(1) + '" height="' + Math.abs(yv - g.y0).toFixed(1)
      + '" rx="2" fill="' + (v < 0 ? '#dc2626' : '#16a34a') + '">'
      + '<title>' + MOIS[m] + ' : ' + fmtT(v) + ' F</title></rect>';
  }
  const base = '<line x1="10" y1="' + g.y0 + '" x2="550" y2="' + g.y0 + '" stroke="#999" stroke-width="1"/>';
  return svgFrame(base + bars, g.labels, '', testid, title);
}

function svgDouble(a, b, title, testid) {
  const g = barGeom([a, b]);
  const bw = Math.min(16, (g.gw - 10) / 2);
  let bars = '';
  for (let m = 0; m < 12; m++) {
    [['#16a34a', a[m], 0], ['#f97316', b[m], 1]].forEach(([col, v, k]) => {
      const x = g.padL + m * g.gw + (g.gw - bw * 2) / 2 + k * bw;
      const yv = g.y(v);
      bars += '<rect x="' + x.toFixed(1) + '" y="' + Math.min(yv, g.y0).toFixed(1)
        + '" width="' + bw.toFixed(1) + '" height="' + Math.abs(yv - g.y0).toFixed(1)
        + '" rx="2" fill="' + col + '"><title>' + MOIS[m] + ' : ' + fmtT(v) + ' F</title></rect>';
    });
  }
  const base = '<line x1="10" y1="' + g.y0 + '" x2="550" y2="' + g.y0 + '" stroke="#999" stroke-width="1"/>';
  const legend = '<span class="chart-leg"><i style="background:#16a34a"></i>Encaissements</span>'
    + '<span class="chart-leg"><i style="background:#f97316"></i>Décaissements</span>';
  return svgFrame(base + bars, g.labels, legend, testid, title);
}

/* ------------------------------------------------------------------ */
/* Exports Excel / PDF (par vue)                                       */
/* ------------------------------------------------------------------ */

function excelTable(headers, rows) {
  return '<table><thead><tr>'
    + headers.map(h => '<th>' + esc(h) + '</th>').join('')
    + '</tr></thead><tbody>' + rows.join('') + '</tbody></table>';
}

function excelRow(cells, cls) {
  return '<tr' + (cls ? ' class="' + cls + '"' : '') + '>'
    + cells.map((c, i) => i === 0 || i === 1
      ? '<td>' + esc(String(c)) + '</td>'
      : '<td class="num">' + esc(String(c)) + '</td>').join('')
    + '</tr>';
}

const excelNum = v => String(Math.round(Number(v) || 0));

function objectifsExcelTable(kind) {
  const obj = S.objectifs[kind] || {};
  const defs = kind === 'ce' ? ceRefs() : ptRefs();
  const rows = defs
    .filter(d => obj[d.ref] && obj[d.ref].value !== '' && obj[d.ref].value != null && Number(obj[d.ref].value) !== 0)
    .map(d => excelRow([d.ref, d.label,
      obj[d.ref].type === 'pct' ? obj[d.ref].value + ' %' : fmtT(obj[d.ref].value) + ' FCFA']));
  if (!rows.length) return '<p><em>Aucun objectif saisi — reprise du réel.</em></p>';
  return excelTable(['Réf', 'Poste', 'Variation souhaitée'], rows);
}

function ceExcelBody(postes, sig, isPrev) {
  const head = ['Réf', 'Libellé', ...MOIS, 'Total annuel'];
  const rows = postes.map(p =>
    excelRow([p.ref, p.label, ...p.mois.map(excelNum), excelNum(p.total)]));
  const sigRows = sig.map(x =>
    excelRow([x.ref, x.label, ...x.mois.map(excelNum), excelNum(x.total)], 'sig'));
  return (isPrev ? '<p><strong>Objectifs saisis</strong></p>' + objectifsExcelTable('ce') : '')
    + excelTable(head, rows.concat(sigRows));
}

function ptExcelBody(pt, isPrev) {
  const head = ['Réf', 'Libellé', ...MOIS, 'Total annuel'];
  const rows = pt.refs.map(r =>
    excelRow([r.ref, r.label, ...r.mois.map(excelNum), excelNum(r.total)]));
  const t = pt.totaux;
  const tot = (label, arr) =>
    excelRow(['', label, ...arr.map(excelNum), excelNum(sum12(arr))], 'total');
  rows.push(
    tot('Total encaissements (E1 à E4)', t.encaissements),
    tot('Total décaissements (D1 à D6)', t.decaissements),
    tot('Trésorerie nette mensuelle', t.net),
    tot('Solde de trésorerie cumulé', pt.solde));
  return (isPrev ? '<p><strong>Objectifs saisis</strong></p>' + objectifsExcelTable('pt') : '')
    + excelTable(head, rows);
}

function exportExcel() {
  const y = year();
  const conf = {
    'ce-reel': ['ce_reel_', false, () => ceExcelBody(S.ce.postes, S.ce.sig, false)],
    'ce-prev': ['ce_previsionnel_', true, () => { const p = previsionCE(); return ceExcelBody(p.postes, p.sig, true); }],
    'pt-reel': ['pt_reel_', false, () => ptExcelBody(S.pt, false)],
    'pt-prev': ['pt_previsionnel_', true, () => ptExcelBody(previsionPT(), true)],
  }[S.tab];
  try {
    const doc = buildExcelDoc({
      company: S.company, title: viewTitle(), periode: periodeLabel(), bodyHtml: conf[2](),
    });
    downloadExcel(conf[0] + y + '.xls', doc);
    toast('Export Excel généré.', 'success');
  } catch (err) {
    toast(err.message || 'Export impossible.', 'error');
  }
}
