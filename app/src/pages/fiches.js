// FiscalMind Africa — page Fiches R1–R4 + Recevabilité DSF (#/fiches, protégée).
//
// Fiches DSF OHADA générées par le moteur src/engine/fiches.js :
//  - R1 : identification complète de l'entité (Configuration → « Mon entreprise »
//         + « Identification DSF (fiches R1–R3) ») ;
//  - R2 : dirigeants (saisie manuelle) ; R3 : associés / actionnaires ;
//  - R4 : récapitulatif des notes annexes (chiffrée / non chiffrée /
//         non applicable) — statut par défaut depuis NOTES_TITRES (notes.js),
//         surcharge modifiable par note, persistée en fm_settings
//         ('fiches_notes_statuts') ;
//  - Recevabilité : contrôles de complétude avant dépôt (bilan équilibré,
//         XI == CJ, R1 complète, notes chiffrées).
// Exports : Excel .xls par fiche + PDF par fiche (impression, en-tête pro
// partagé « Mon entreprise », jamais WagaExpress).

import { esc, $, $all, toast } from '../ui.js';
import {
  loadEntries, defaultPeriode, loadCompany, loadCompanyIfu, loadCompanyRegime,
  loadCompanyR1, loadDirigeants, loadAssocies, getSetting, setSetting,
} from '../store.js';
import { buildFiches, NOTES_STATUTS } from '../../../src/engine/fiches.js';
import { bilanModele2 } from '../../../src/engine/bilan-modele2.js';
import { compteResultatSIG } from '../../../src/engine/compte-resultat-sig.js';
import { buildExcelDoc, downloadExcel, renderSharedPrintHeader } from '../exports.js';

const S = {
  periode: null, company: '', fiches: null, tab: 'r1',
  bilan: null, cr: null, notesStatus: {},
};

const TABS = [
  ['r1', 'R1 — Identification'],
  ['r2', 'R2 — Dirigeants'],
  ['r3', 'R3 — Associés'],
  ['r4', 'R4 — Notes annexes'],
  ['recevabilite', '✓ Recevabilité'],
];

const EXCEL_TITLES = {
  r1: 'Fiche R1 — Identification de l’entreprise',
  r2: 'Fiche R2 — Dirigeants',
  r3: 'Fiche R3 — Associés et actionnaires',
  r4: 'Fiche R4 — Récapitulatif des notes annexes',
  recevabilite: 'Recevabilité DSF — Contrôles de complétude',
};

const STATUT_BADGE = {
  chiffree: ['#16a34a', 'Chiffrée'],
  non_chiffree: ['#d97706', 'Non chiffrée'],
  non_applicable: ['#6b7280', 'Non applicable'],
};

function shell() { return document.getElementById('appMain'); }

function periodeLabel() {
  return S.periode ? 'Exercice ' + S.periode.debut.slice(0, 4) : '';
}

function statutBadge(code) {
  const [col, label] = STATUT_BADGE[code] || STATUT_BADGE.non_chiffree;
  return '<span style="font-size:11px;font-weight:700;color:' + col + ';border:1px solid ' + col
    + ';border-radius:20px;padding:2px 8px;white-space:nowrap;">' + esc(label) + '</span>';
}

function statutSelect(numero, code) {
  const opts = NOTES_STATUTS.map((s) => {
    const [, label] = STATUT_BADGE[s];
    return '<option value="' + s + '"' + (s === code ? ' selected' : '') + '>' + label + '</option>';
  }).join('');
  return '<select class="form-input" data-r4-statut="' + esc(numero) + '" data-testid="fiches-r4-statut-' + esc(numero) + '" style="font-size:12px;padding:4px 6px;">' + opts + '</select>';
}

/* ---------------- tables par onglet ---------------- */

function tableR1() {
  const rows = S.fiches.r1.map((r) => {
    const missing = r.obligatoire && !r.valeur;
    return '<tr' + (missing ? ' style="background:#fef2f2;"' : '') + '>'
      + '<td style="font-weight:600;width:42%;">' + esc(r.champ) + (r.obligatoire ? ' <span style="color:#dc2626;">*</span>' : '') + '</td>'
      + '<td>' + (r.valeur ? esc(r.valeur) : '<span class="muted-sm">— non renseigné</span>') + '</td></tr>';
  }).join('');
  return '<div class="table-wrap"><table class="etats-table" data-testid="fiches-table"><tbody>' + rows + '</tbody></table></div>'
    + '<p class="muted-sm">Modifiez ces valeurs dans Configuration → Mon entreprise / Identification DSF.</p>';
}

function tableR2() {
  if (!S.fiches.r2.length) {
    return '<p class="muted-sm" data-testid="fiches-table">Aucun dirigeant renseigné — ajoutez-les dans Configuration → Identification DSF.</p>';
  }
  const rows = S.fiches.r2.map((d) => '<tr><td style="font-weight:600;">' + esc(d.nom || '—') + '</td>'
    + '<td>' + esc(d.qualite || '—') + '</td><td>' + esc(d.contact || '—') + '</td></tr>').join('');
  return '<div class="table-wrap"><table class="etats-table" data-testid="fiches-table"><thead><tr><th>Nom et prénoms</th><th>Qualité</th><th>Contact</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function tableR3() {
  if (!S.fiches.r3.length) {
    return '<p class="muted-sm" data-testid="fiches-table">Aucun associé renseigné — ajoutez-les dans Configuration → Identification DSF.</p>';
  }
  const rows = S.fiches.r3.map((a) => '<tr><td style="font-weight:600;">' + esc(a.nom || '—') + '</td>'
    + '<td>' + esc(a.qualite || '—') + '</td><td style="text-align:right;">' + esc(a.part || '—') + '</td></tr>').join('');
  return '<div class="table-wrap"><table class="etats-table" data-testid="fiches-table"><thead><tr><th>Nom et prénoms</th><th>Qualité</th><th style="text-align:right;">Part</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function tableR4() {
  const rows = S.fiches.r4.map((n) => '<tr><td style="white-space:nowrap;font-weight:600;width:78px;" data-testid="fiches-r4-note">' + esc(n.note) + '</td>'
    + '<td>' + esc(n.titre) + '</td><td style="white-space:nowrap;">' + statutBadge(n.statutCode) + '</td>'
    + '<td>' + statutSelect(n.numero, n.statutCode) + '</td></tr>').join('');
  return '<p class="muted-sm">Statut par défaut : note calculée → « Chiffrée », note manuelle → « Non chiffrée ». Ajustez si besoin (enregistré automatiquement).</p>'
    + '<div class="table-wrap"><table class="etats-table" data-testid="fiches-table"><thead><tr><th>Note</th><th>Intitulé</th><th>Statut</th><th>Ajuster</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function tableRecevabilite() {
  const rows = S.fiches.recevabilite.map((c) => {
    const icon = c.ok === true ? '✅' : (c.ok === false ? '❌' : '⚪');
    const col = c.ok === true ? '#16a34a' : (c.ok === false ? '#dc2626' : '#6b7280');
    return '<tr><td style="font-size:18px;width:40px;text-align:center;">' + icon + '</td>'
      + '<td><strong style="color:' + col + ';">' + esc(c.controle) + '</strong><div class="muted-sm">' + esc(c.detail) + '</div></td></tr>';
  }).join('');
  const ok = S.fiches.recevabilite.filter((c) => c.ok === true).length;
  const ko = S.fiches.recevabilite.filter((c) => c.ok === false).length;
  const na = S.fiches.recevabilite.filter((c) => c.ok === null).length;
  return '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;" data-testid="fiches-recap">'
    + '<span style="font-size:12px;font-weight:700;color:#16a34a;">✅ ' + ok + ' conforme(s)</span>'
    + '<span style="font-size:12px;font-weight:700;color:#dc2626;">❌ ' + ko + ' non conforme(s)</span>'
    + (na ? '<span style="font-size:12px;font-weight:700;color:#6b7280;">⚪ ' + na + ' non calculable(s)</span>' : '')
    + '</div>'
    + '<div class="table-wrap"><table class="etats-table" data-testid="fiches-table"><tbody>' + rows + '</tbody></table></div>';
}

function tabContent() {
  switch (S.tab) {
    case 'r2': return tableR2();
    case 'r3': return tableR3();
    case 'r4': return tableR4();
    case 'recevabilite': return tableRecevabilite();
    default: return tableR1();
  }
}

/* ---------------- exports ---------------- */

function excelCell(v, num) {
  if (num) return '<td class="num">' + esc(String(v)) + '</td>';
  return '<td>' + esc(String(v)) + '</td>';
}

function ficheTableHtml() {
  const f = S.fiches;
  if (S.tab === 'r1') {
    return '<table><thead><tr><th>Champ</th><th>Valeur</th></tr></thead><tbody>'
      + f.r1.map((r) => '<tr><td>' + esc(r.champ) + '</td><td>' + esc(r.valeur || '— non renseigné') + '</td></tr>').join('')
      + '</tbody></table>';
  }
  if (S.tab === 'r2') {
    return '<table><thead><tr><th>Nom et prénoms</th><th>Qualité</th><th>Contact</th></tr></thead><tbody>'
      + f.r2.map((d) => '<tr>' + excelCell(d.nom || '—') + excelCell(d.qualite || '—') + excelCell(d.contact || '—') + '</tr>').join('')
      + '</tbody></table>';
  }
  if (S.tab === 'r3') {
    return '<table><thead><tr><th>Nom et prénoms</th><th>Qualité</th><th>Part</th></tr></thead><tbody>'
      + f.r3.map((a) => '<tr>' + excelCell(a.nom || '—') + excelCell(a.qualite || '—') + excelCell(a.part || '—') + '</tr>').join('')
      + '</tbody></table>';
  }
  if (S.tab === 'r4') {
    return '<table><thead><tr><th>Note</th><th>Intitulé</th><th>Statut</th></tr></thead><tbody>'
      + f.r4.map((n) => '<tr><td>' + esc(n.note) + '</td><td>' + esc(n.titre) + '</td><td>' + esc(n.statut) + '</td></tr>').join('')
      + '</tbody></table>';
  }
  return '<table><thead><tr><th>Contrôle</th><th>Statut</th><th>Détail</th></tr></thead><tbody>'
    + f.recevabilite.map((c) => '<tr><td>' + esc(c.controle) + '</td><td>'
      + esc(c.ok === true ? 'Conforme' : (c.ok === false ? 'Non conforme' : 'Non calculable')) + '</td>'
      + '<td>' + esc(c.detail) + '</td></tr>').join('')
    + '</tbody></table>';
}

function exportExcel() {
  const year = S.periode ? S.periode.debut.slice(0, 4) : 'xxxx';
  const doc = buildExcelDoc({
    company: S.company,
    title: EXCEL_TITLES[S.tab],
    periode: periodeLabel() + ' — DSF OHADA',
    bodyHtml: ficheTableHtml(),
  });
  downloadExcel('fiche_' + S.tab + '_' + year + '.xls', doc);
  toast('Fichier ' + S.tab.toUpperCase() + ' exporté en Excel.', 'success');
}

function printPdf() {
  renderSharedPrintHeader(S.company, EXCEL_TITLES[S.tab], periodeLabel() + ' — DSF OHADA');
  window.print();
}

/* ---------------- rendu ---------------- */

function render() {
  const tabsHtml = TABS.map(([k, label]) => '<button class="tab-btn' + (S.tab === k ? ' active' : '') + '" data-fiche-tab="' + k + '" data-testid="fiches-tab-' + k + '">' + label + '</button>').join('');
  shell().innerHTML = '<div data-testid="fiches-page">'
    + '<div class="print-header" id="printHeader"></div>'
    + '<div class="fiches-head no-print">'
    + '<div class="page-head"><h2 class="page-title">📋 Fiches DSF</h2>'
    + '<p class="page-sub">Fiches R1–R4 et recevabilité — ' + esc(periodeLabel()) + '</p></div>'
    + '<div class="etats-tabs" style="margin-bottom:10px;">' + tabsHtml + '</div>'
    + '<div style="display:flex;gap:8px;margin-bottom:12px;">'
    + '<button class="btn btn-secondary btn-sm" id="fichesExcel" data-testid="fiches-excel">⬇️ Excel</button>'
    + '<button class="btn btn-secondary btn-sm" id="fichesPrint" data-testid="fiches-print">🖨️ PDF</button>'
    + '</div></div>'
    + '<div id="fichesContent">' + tabContent() + '</div>'
    + '</div>';

  $all('[data-fiche-tab]').forEach((b) => b.addEventListener('click', () => {
    S.tab = b.dataset.ficheTab;
    render();
  }));
  $('#fichesExcel').addEventListener('click', exportExcel);
  $('#fichesPrint').addEventListener('click', printPdf);

  // Ajustement du statut d'une note en R4 (persisté en fm_settings).
  $all('[data-r4-statut]').forEach((sel) => sel.addEventListener('change', async () => {
    const numero = sel.dataset.r4Statut;
    const code = sel.value;
    S.notesStatus = Object.assign({}, S.notesStatus, { [numero]: code });
    try {
      await setSetting('fiches_notes_statuts', S.notesStatus);
      S.fiches = buildFiches({
        company: S.companyObj, dirigeants: S.dirigeants, associes: S.associes,
        notesStatus: S.notesStatus, bilan: S.bilan, cr: S.cr,
      });
      render();
      toast('Statut de la note ' + numero + ' enregistré.', 'success');
    } catch (e) {
      toast('Enregistrement impossible : ' + (e && e.message ? e.message : 'erreur'), 'error');
    }
  }));
}

export async function renderFichesPage(query) {
  shell().innerHTML = '<div data-testid="fiches-page"><div class="loading-state">Chargement des fiches DSF…</div></div>';
  try {
    const [entries, periode, company, ifu, regime, r1, dirigeants, associes, notesStatus] = await Promise.all([
      loadEntries(), defaultPeriode(), loadCompany(), loadCompanyIfu(), loadCompanyRegime(),
      loadCompanyR1(), loadDirigeants(), loadAssocies(),
      getSetting('fiches_notes_statuts', {}).catch(() => ({})),
    ]);
    S.periode = periode;
    S.company = company;
    S.notesStatus = notesStatus && typeof notesStatus === 'object' ? notesStatus : {};
    S.companyObj = Object.assign({ nom: company, nif: ifu, regime }, r1);
    S.dirigeants = dirigeants;
    S.associes = associes;
    const year = Number(String(periode.debut).slice(0, 4));
    try {
      S.bilan = bilanModele2(entries, { year });
    } catch (e) { S.bilan = null; }
    try {
      S.cr = compteResultatSIG(entries, { year });
    } catch (e) { S.cr = null; }
    S.fiches = buildFiches({
      company: S.companyObj, dirigeants, associes,
      notesStatus: S.notesStatus, bilan: S.bilan, cr: S.cr,
    });
    render();
  } catch (err) {
    shell().innerHTML = '<div class="error-state" data-testid="fiches-error">'
      + '<div class="error-icon">⚠️</div><p>' + esc(err && err.message ? err.message : 'Erreur de chargement.') + '</p>'
      + '<button class="btn btn-primary" id="fichesRetry">Réessayer</button></div>';
    const retry = $('#fichesRetry');
    if (retry) retry.addEventListener('click', () => renderFichesPage(query));
  }
}
