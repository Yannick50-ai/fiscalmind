// FiscalMind Africa — page Notes annexes OHADA (#/notes, protégée).
//
// 46 notes (1, 2, 3A–3E, 4–8, 8A, 9–14, 15A/B, 16A/B/B bis/C, 17–27B, 28–36) calculées par
// le moteur src/engine/notes.js depuis les écritures du store :
//  - tableaux de mouvements (3A, 3C, 28) : Ouverture / Acquisitions-Dotations
//    / Cessions-Sorties-Reprises / Clôture ;
//  - soldes N / N-1 + variation % (4, 6–14, 15A, 16A, 17–27A, 29, 30, 32–34) ;
//  - saisie manuelle (1, 2, 3B, 3D, 3E, 5, 15B, 16B, 16C, 27B, 31, 35, 36)
//    persistée en fm_settings (clés notes_man_<n>), 100 % cloud.
// Exports : Excel .xls par note + « tout exporter » (module app/src/exports.js),
// PDF via window.print() (en-tête pro partagé). En-tête : Mon entreprise
// (jamais « WagaExpress »), exercice, montants en FCFA.

import { esc, fmt, toast, $, $all } from '../ui.js';
import {
  loadEntries, savePeriode, defaultPeriode,
  loadCompany, saveCompany, getSetting, setSetting,
} from '../store.js';
import { notesAnnexes, NOTES_TITRES, manualSettingKey, fmtVarPct } from '../../../src/engine/notes.js';
import { buildVerbatimNote, verbatimDisponible } from '../../../src/engine/notes-verbatim-render.js';
import { getNoteVerbatim } from '../../../src/engine/notes-verbatim.js';
import { buildExcelDoc, downloadExcel, downloadMultiSheetExcel, buildMultiSheetExcel, safeSheetName, renderSharedPrintHeader, fmtX } from '../exports.js';

const S = {
  entries: [], periode: null, company: '',
  notes: [], numero: '3A', manuelles: {},
};

function shell() { return document.getElementById('appMain'); }

/** fmt() rend '' pour 0 — ici on veut un vrai « 0,00 » dans les tableaux. */
function fmtN(n) {
  const v = Math.round(Number(n) || 0);
  return v === 0 ? '0,00' : fmt(v);
}

function periodeLabel() {
  return 'Exercice ' + S.periode.debut.slice(0, 4);
}

function currentNote() {
  return S.notes.find((n) => n.numero === S.numero) || S.notes[0];
}

function noteTitle(note) {
  return 'Note ' + note.numero + ' — ' + note.titre;
}

/* ------------------------------------------------------------------ */
/* Chargement                                                           */
/* ------------------------------------------------------------------ */

export async function renderNotesPage(query) {
  shell().innerHTML = '<div data-testid="notes-page"><div class="loading-state">Chargement des notes annexes…</div></div>';
  try {
    const [entries, periode, company] = await Promise.all([
      loadEntries(), defaultPeriode(), loadCompany(),
    ]);
    S.entries = entries;
    S.periode = periode;
    S.company = company;
    // Notes manuelles : une clé fm_settings par note (100 % cloud).
    const manualNums = NOTES_TITRES.filter((t) => t.statut === 'manuelle').map((t) => t.numero);
    const vals = await Promise.all(manualNums.map((n) => getSetting(manualSettingKey(n), {}).catch(() => ({}))));
    S.manuelles = {};
    manualNums.forEach((n, i) => { S.manuelles[n] = vals[i] && typeof vals[i] === 'object' ? vals[i] : {}; });
  } catch (err) {
    shell().innerHTML = '<div class="error-state" data-testid="notes-error">'
      + '<div class="error-icon">⚠️</div><p>' + esc(err.message || 'Erreur de chargement.') + '</p>'
      + '<button class="btn btn-primary" id="notesRetry">Réessayer</button></div>';
    document.getElementById('notesRetry').addEventListener('click', () => renderNotesPage(query));
    return;
  }
  if (query && query.note && NOTES_TITRES.some((t) => t.numero === query.note)) S.numero = query.note;
  compute();

  shell().innerHTML =
    '<div data-testid="notes-page">'
    + '<div class="notes-head no-print">'
    + '<h2 class="page-title">📑 Notes annexes</h2>'
    + '<div class="journal-toolbar">'
    + '<select id="notesExercice" class="form-input" data-testid="notes-exercice" aria-label="Exercice"></select>'
    + '<button class="btn btn-secondary btn-sm" id="notesPrint" data-testid="notes-print">🖨️ PDF</button>'
    + '<button class="btn btn-secondary btn-sm" id="notesExcel" data-testid="notes-excel">⬇️ Excel</button>'
    + '<button class="btn btn-secondary btn-sm" id="notesExcelAll" data-testid="notes-excel-all">⬇️ Tout exporter</button>'
    + '</div>'
    + '<div class="form-group" style="margin-bottom:10px;">'
    + '<label class="form-label" for="notesCompanyInput">Entreprise (en-tête des exports)</label>'
    + '<input class="form-input" id="notesCompanyInput" data-testid="notes-company-input" type="text" maxlength="80" value="' + esc(S.company) + '">'
    + '</div>'
    + '<div class="form-group" style="margin-bottom:10px;">'
    + '<label class="form-label" for="notesSelect">Note annexe</label>'
    + '<select id="notesSelect" class="form-input" data-testid="notes-select" aria-label="Note annexe">'
    + NOTES_TITRES.map((t) =>
      '<option value="' + esc(t.numero) + '"' + (t.numero === S.numero ? ' selected' : '') + '>'
      + 'Note ' + esc(t.numero) + ' — ' + esc(t.titre)
      + (t.statut === 'manuelle' ? ' ✍️' : '') + '</option>').join('')
    + '</select>'
    + '</div></div>'
    + '<div class="print-header" id="printHeader"></div>'
    + '<div id="notesContent"></div>'
    + '</div>';

  renderExercices();

  $('#notesExercice').addEventListener('change', async (e) => {
    const y = e.target.value;
    S.periode = { debut: y + '-01-01', fin: y + '-12-31' };
    try { await savePeriode(S.periode); }
    catch (err) { toast(err.message || 'Erreur de sauvegarde.', 'error'); }
    compute();
    renderContent();
  });
  $('#notesCompanyInput').addEventListener('change', async (e) => {
    S.company = (e.target.value || '').trim() || 'Mon entreprise';
    e.target.value = S.company;
    try {
      await saveCompany(S.company);
      toast('Nom d’entreprise enregistré.', 'success');
    } catch (err) {
      toast(err.message || 'Enregistrement impossible.', 'error');
    }
    renderPrintHeader();
  });
  $('#notesSelect').addEventListener('change', (e) => {
    S.numero = e.target.value;
    renderContent();
  });
  $('#notesPrint').addEventListener('click', () => { renderPrintHeader(); window.print(); });
  $('#notesExcel').addEventListener('click', exportNoteExcel);
  $('#notesExcelAll').addEventListener('click', exportAllExcel);

  renderPrintHeader();
  renderContent();
}

function renderExercices() {
  const years = new Set([String(new Date().getFullYear())]);
  S.entries.forEach((e) => { if (e.date) years.add(String(e.date).slice(0, 4)); });
  const cur = S.periode.debut.slice(0, 4);
  $('#notesExercice').innerHTML = Array.from(years).sort().reverse()
    .map((y) => '<option value="' + y + '"' + (y === cur ? ' selected' : '') + '>Exercice ' + y + '</option>').join('');
}

function compute() {
  const year = Number(S.periode.debut.slice(0, 4));
  // Utilise le moteur verbatim (structures officielles exactes)
  const nums = verbatimDisponible();
  S.notes = nums.map((num) => {
    try {
      const v = buildVerbatimNote(num, S.entries, year);
      if (!v) return null;
      // Enrichit avec le statut (manuelle/calculée) depuis l'ancien moteur
      const titre = NOTES_TITRES.find((t) => t.numero === num);
      v.statut = titre ? titre.statut : (v.pattern === 'texte' ? 'manuelle' : 'calculee');
      v.type = v.pattern === 'texte' ? 'manuelle' : v.pattern;
      // Pour les notes texte, attache le formulaire manuel
      if (v.pattern === 'texte' && v.champs) {
        v.formulaire = v.champs.map((c) => ({
          key: c.key, label: c.label, type: 'textarea',
          value: (S.manuelles[num] && S.manuelles[num][c.key]) || '',
        }));
      }
      return v;
    } catch (e) {
      return null;
    }
  }).filter(Boolean);
  if (!S.notes.some((n) => n.numero === S.numero)) S.numero = S.notes[0].numero;
}

function renderPrintHeader() {
  const note = currentNote();
  renderSharedPrintHeader(S.company, note ? noteTitle(note) : 'Notes annexes', periodeLabel() + ' — montants en FCFA');
}

/* ------------------------------------------------------------------ */
/* Rendu du contenu                                                     */
/* ------------------------------------------------------------------ */

function statutBadge(note) {
  return note.statut === 'manuelle'
    ? '<span class="badge-plan">✍️ Saisie manuelle</span>'
    : '<span class="badge-ok">🧮 Calculée automatiquement</span>';
}

function renderContent() {
  const c = $('#notesContent');
  const note = currentNote();
  if (!note) { c.innerHTML = '<p class="empty-state">Aucune note.</p>'; return; }
  renderPrintHeader();
  let html = '<div class="notes-note-head">'
    + '<h3 class="notes-note-title">' + esc(noteTitle(note)) + '</h3>'
    + statutBadge(note) + '</div>';
  if (note.pattern === 'texte') {
    // Note textuelle : formulaire manuel + tableaux éventuels
    if (note.formulaire) html += renderForm(note);
    note.tables.forEach((t) => { html += renderVerbatimTable(t, note); });
  } else {
    note.tables.forEach((t) => { html += renderVerbatimTable(t, note); });
  }
  if (note.pied) html += '<p class="notes-pied"><em>' + esc(note.pied).replace(/\n/g, '<br>') + '</em></p>';
  if (note.note) html += '<p class="notes-note muted"><small>' + esc(note.note) + '</small></p>';
  c.innerHTML = html;
  if (note.pattern === 'texte' && note.formulaire) bindForm(note);
}

/**
 * Rend un tableau verbatim officiel (structure exacte de l'imprimé DGI).
 */
function renderVerbatimTable(t, note) {
  const isMouv = t.pattern === 'mouvement';
  let html = '';
  if (t.titre) html += '<h4 class="notes-table-title">' + esc(t.titre) + '</h4>';
  if (t.isSecondary && t.lignes.length === 0) {
    html += '<p class="muted">Tableau à compléter manuellement.</p>';
    return html;
  }
  html += '<div class="table-wrap"><table class="etats-table" data-testid="notes-table"><thead><tr>';
  // Colonnes : première = libellés, puis les colonnes de données
  html += '<th>' + esc(t.colonnes[0] === 'Exercice N' ? 'Libellés' : t.colonnes[0]) + '</th>';
  const dataCols = t.colonnes.slice(1);
  // Si la première colonne est un libellé de données (cas 'comparatif' sans 'Libellés'),
  // on l'affiche comme en-tête de libellés
  dataCols.forEach((col) => {
    html += '<th class="num">' + esc(col) + '</th>';
  });
  html += '</tr>';
  // Ligne supplémentaire pour colonnesSup (ex. ancienneté des créances)
  if (t.colonnesSup) {
    html += '<tr><th></th>' + t.colonnesSup.map((c) => '<th class="num"><small>' + esc(c) + '</small></th>').join('') + '</tr>';
  }
  html += '</thead><tbody>';

  t.lignes.forEach((l, idx) => {
    if (l.isHeader) {
      html += '<tr class="row-header" data-testid="notes-row-' + idx + '"><td colspan="' + (dataCols.length + 1) + '"><strong>' + esc(l.label) + '</strong></td></tr>';
      return;
    }
    const cls = (l.isTotal || l.isSubtotal) ? ' class="row-total"' : '';
    html += '<tr' + cls + ' data-testid="notes-row-' + idx + '"><td>' + esc(l.label) + '</td>';
    if (isMouv) {
      html += '<td class="num">' + fmtN(l.ouverture) + '</td>'
        + '<td class="num">' + fmtN(l.plus) + '</td>'
        + '<td class="num">' + fmtN(l.moins) + '</td>'
        + '<td class="num"><strong>' + fmtN(l.cloture) + '</strong></td>';
    } else {
      // Comparatif : N, N-1, Var% (+ colonnes supplémentaires si définies)
      const nCols = dataCols.length;
      html += '<td class="num">' + fmtN(l.n) + '</td>'
        + '<td class="num">' + fmtN(l.n1) + '</td>';
      if (nCols >= 3) {
        const v = l.varPct;
        const vCls = v === null ? '' : (v > 0 ? ' style="color:#1e7d32;"' : v < 0 ? ' style="color:#b3261e;"' : '');
        html += '<td class="num"' + vCls + '>' + esc(fmtVarPct(v)) + '</td>';
      }
      // Colonnes supplémentaires (ex. ancienneté) : vides pour l'instant
      for (let i = 3; i < nCols; i++) html += '<td class="num">—</td>';
    }
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  if (t.note) html += '<p class="muted"><small>' + esc(t.note) + '</small></p>';
  return html;
}

function renderForm(note) {
  let html = '<form id="notesForm" data-testid="notes-form" data-numero="' + esc(note.numero) + '">';
  note.formulaire.forEach((f) => {
    const id = 'notes-man-' + note.numero + '-' + f.key;
    html += '<div class="form-group"><label class="form-label" for="' + id + '">' + esc(f.label) + '</label>';
    if (f.type === 'textarea') {
      html += '<textarea class="form-input" id="' + id + '" data-key="' + esc(f.key) + '" rows="6" data-testid="notes-field-' + esc(f.key) + '">'
        + esc(f.value) + '</textarea>';
    } else {
      html += '<input class="form-input" id="' + id + '" data-key="' + esc(f.key) + '" type="number" inputmode="decimal"'
        + ' value="' + esc(f.value) + '" data-testid="notes-field-' + esc(f.key) + '">';
    }
    html += '</div>';
  });
  html += '<button type="submit" class="btn btn-primary" data-testid="notes-save">💾 Enregistrer</button>'
    + ' <span class="muted notes-hint">Enregistré dans le cloud (fm_settings).</span>'
    + '</form>';
  return html;
}

function bindForm(note) {
  const form = $('#notesForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const values = {};
    $all('[data-key]', form).forEach((el) => { values[el.dataset.key] = el.value; });
    try {
      await setSetting(manualSettingKey(note.numero), values);
      S.manuelles[note.numero] = values;
      compute();
      toast('Note ' + note.numero + ' enregistrée.', 'success');
    } catch (err) {
      toast(err.message || 'Enregistrement impossible.', 'error');
    }
  });
}

/* ------------------------------------------------------------------ */
/* Exports                                                              */
/* ------------------------------------------------------------------ */

function excelTable(headers, rows) {
  let h = '<table><thead><tr>' + headers.map((x) => '<th>' + esc(x) + '</th>').join('') + '</tr></thead><tbody>';
  rows.forEach((r) => {
    h += '<tr' + (r.isTotal ? ' class="total"' : '') + '>'
      + r.cells.map((c) => '<td' + (c.num ? ' class="num"' : '') + '>' + (c.num ? fmtX(c.v) : esc(c.v)) + '</td>').join('')
      + '</tr>';
  });
  return h + '</tbody></table>';
}

function noteBodyHtml(note) {
  let h = '<p><strong>' + esc(noteTitle(note)) + '</strong></p>';
  if (note.pattern === 'texte' && note.formulaire) {
    const vals = S.manuelles[note.numero] || {};
    note.formulaire.forEach((f) => {
      const v = vals[f.key] !== undefined && vals[f.key] !== null ? String(vals[f.key]) : '';
      h += '<p><strong>' + esc(f.label) + ' :</strong><br>' + esc(v || '—').replace(/\n/g, '<br>') + '</p>';
    });
  }
  (note.tables || []).forEach((t) => {
    if (t.titre) h += '<p><strong>' + esc(t.titre) + '</strong></p>';
    const isMouv = t.pattern === 'mouvement';
    const headers = ['Libellés'].concat(t.colonnes.slice(1));
    const rows = t.lignes.map((l) => {
      if (l.isHeader) return { isTotal: false, cells: [{ v: l.label }] };
      const cells = [{ v: l.label }];
      if (isMouv) {
        cells.push({ v: l.ouverture, num: true }, { v: l.plus, num: true }, { v: l.moins, num: true }, { v: l.cloture, num: true });
      } else {
        cells.push({ v: l.n, num: true }, { v: l.n1, num: true });
        if (t.colonnes.length >= 4) cells.push({ v: fmtVarPct(l.varPct) });
      }
      return { isTotal: !!(l.isTotal || l.isSubtotal), cells };
    });
    h += excelTable(headers, rows);
  });
  if (note.pied) h += '<p><em>' + esc(note.pied).replace(/\n/g, '<br>') + '</em></p>';
  return h;
}

function exportNoteExcel() {
  const note = currentNote();
  if (!note) return;
  const doc = buildExcelDoc({
    company: S.company,
    title: noteTitle(note),
    periode: periodeLabel(),
    bodyHtml: noteBodyHtml(note),
  });
  downloadExcel('note_' + note.numero.replace(/[^0-9A-Za-z]/g, '') + '_' + S.periode.debut.slice(0, 4) + '.xls', doc);
  toast('Note ' + note.numero + ' exportée en Excel.', 'success');
}

function exportAllExcel() {
  const year = S.periode.debut.slice(0, 4);
  const sheets = [{
    name: 'Sommaire',
    title: 'Notes annexes — ' + periodeLabel() + ' — ' + S.company,
    headers: ['Note', 'Intitulé', 'Statut'],
    rows: S.notes.map((n) => [
      'Note ' + n.numero, n.titre,
      n.statut === 'manuelle' ? 'Saisie manuelle' : 'Calculée',
    ]),
  }];
  S.notes.forEach((n) => {
    const title = 'Note ' + n.numero + ' — ' + n.titre + ' — ' + periodeLabel();
    const rows = [];
    if (n.pattern === 'texte' && n.formulaire) {
      const vals = S.manuelles[n.numero] || {};
      n.formulaire.forEach((f) => {
        const v = vals[f.key] !== undefined && vals[f.key] !== null ? String(vals[f.key]) : '';
        rows.push([{ v: f.label }, { v: v || '—' }]);
      });
    }
    (n.tables || []).forEach((t) => {
      if (t.titre) rows.push([{ v: t.titre }]);
      const isMouv = t.pattern === 'mouvement';
      const headers = ['Libellés'].concat(t.colonnes.slice(1));
      if (rows.length === 0 || (n.pattern !== 'texte')) {
        // Ligne d'en-tête (seulement si pas déjà ajoutée)
      }
      t.lignes.forEach((l) => {
        const style = (l.isTotal || l.isSubtotal) ? 'total' : undefined;
        const num = (v) => ({ v, num: true, style });
        if (l.isHeader) {
          rows.push([{ v: l.label, style }]);
          return;
        }
        const cells = [{ v: l.label, style }];
        if (isMouv) {
          cells.push(num(l.ouverture), num(l.plus), num(l.moins), num(l.cloture));
        } else {
          cells.push(num(l.n), num(l.n1));
          if (t.colonnes.length >= 4) cells.push({ v: fmtVarPct(l.varPct), style });
        }
        rows.push(cells);
      });
      if (t.note) rows.push([{ v: t.note }]);
    });
    if (n.pied) rows.push([{ v: n.pied }]);
    const headers = ['Libellés', 'Exercice N', 'Exercice N-1', 'Variation'];
    sheets.push({ name: 'Note ' + n.numero, title, headers, rows });
  });
  const doc = buildMultiSheetExcel({ sheets });
  downloadMultiSheetExcel('notes_annexes_' + year + '.xls', doc);
  toast('Les ' + S.notes.length + ' notes annexes ont été exportées (' + sheets.length + ' feuilles Excel).', 'success');
}
