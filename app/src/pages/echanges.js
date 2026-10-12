// FiscalMind Africa — page Échanges DGI (#/echanges, protégée).
//
// Phase 7 : Export XML pour la télédéclaration DGI (inspiré du XmlMap
// `EDI_Mappage` du classeur NO-Pro.V2, modules IKA Conseil — seuls les
// champs non vides sont exportés, montants en FCFA entiers, dates
// jj/mm/aaaa) + import CSV des écritures (dates ddMMyy comme le classeur).
// 100 % cloud : lectures via le store (fm_entries, fm_settings), écritures
// d'import via saveEntry. Aucun localStorage.

import { esc, $, toast } from '../ui.js';
import {
  loadEntries, saveEntry, defaultPeriode,
  loadCompany, loadCompanyIfu, loadCompanyRegime, loadCountry, CloudError,
} from '../store.js';
import { bilanModele2 } from '../../../src/engine/bilan-modele2.js';
import { compteResultatSIG } from '../../../src/engine/compte-resultat-sig.js';
import { tftData } from '../../../src/engine/tft.js';
import { notesAnnexes } from '../../../src/engine/notes.js';
import { buildDgiXml } from '../../../src/engine/xml-export.js';
import { parseJournalCsv } from '../../../src/engine/csv-import.js';

const S = {
  entries: [], periode: null, company: '', ifu: '', regime: '', country: 'BF',
  year: null, csvText: '', csvResult: null, imported: null, busy: false,
};

function shell() { return document.getElementById('appMain'); }

function errMsg(e) {
  return e instanceof CloudError ? e.message : 'Erreur inattendue.';
}

function entryYears() {
  const ys = new Set();
  for (const e of S.entries || []) {
    if (e && e.date && /^\d{4}/.test(e.date)) ys.add(e.date.slice(0, 4));
  }
  const cur = String(new Date().getFullYear());
  ys.add(cur);
  if (S.periode && S.periode.debut) ys.add(S.periode.debut.slice(0, 4));
  return Array.from(ys).sort().reverse();
}

/** Télécharge un fichier texte (XML) côté client. */
function downloadText(filename, text, mime) {
  const blob = new Blob([text], { type: mime || 'application/xml;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

/* ------------------------------------------------------------------ */
/* Export DGI                                                           */
/* ------------------------------------------------------------------ */

function computeExport() {
  const year = Number(S.year);
  const cr = compteResultatSIG(S.entries, { year });
  const bilan = bilanModele2(S.entries, { year, resNet: cr.resNet });
  const tft = tftData(S.entries, { year });
  const notes = notesAnnexes(S.entries, { year, manuelles: {} });
  return buildDgiXml({
    company: { name: S.company, ncc: S.ifu, ifu: S.ifu, regime: S.regime, country: S.country },
    year,
    bilan, cr, tft,
    notes: notes.notes,
  });
}

function exportPreviewHtml() {
  let preview;
  try { preview = computeExport(); }
  catch (err) { return '<p class="muted-sm">⚠️ ' + esc(errMsg(err)) + '</p>'; }
  const st = preview.stats;
  return '<div class="muted-sm" data-testid="ech-export-stats">'
    + '📄 <strong>' + esc(preview.filename) + '</strong><br>'
    + 'Lignes exportées : bilan <strong>' + st.lignesBilan + '</strong> · '
    + 'compte de résultat <strong>' + st.lignesCR + '</strong> · '
    + 'TFT <strong>' + st.lignesTFT + '</strong> · '
    + 'notes <strong>' + st.notes + '</strong><br>'
    + 'Champs vides omis : <strong>' + st.champsOmits + '</strong> (règle IKA Conseil : seuls les champs non vides sont exportés).'
    + '</div>'
    + '<div class="notice-box" style="margin-top:8px;" data-testid="ech-export-id">'
    + '🏢 <strong>' + esc(S.company) + '</strong><br>'
    + 'NCC/IFU : <strong>' + esc(S.ifu || '— non renseigné —') + '</strong>'
    + '<br><span class="muted-sm">⚠️ Vérifiez votre NCC dans <strong>Configuration → Mon entreprise</strong> avant d’envoyer le fichier à la DGI.</span>'
    + '</div>';
}

function refreshExport() {
  const box = $('#echExportPreview');
  if (box) box.innerHTML = exportPreviewHtml();
}

/* ------------------------------------------------------------------ */
/* Import CSV                                                           */
/* ------------------------------------------------------------------ */

const PREVIEW_LINES = 8;

function csvPreviewHtml() {
  if (!S.csvText.trim()) {
    return '<p class="muted-sm">Collez vos lignes CSV ci-dessus ou choisissez un fichier pour voir l’aperçu.</p>';
  }
  const res = S.csvResult;
  if (!res) return '';
  const errLines = new Set(res.erreurs.map((e) => e.ligne));
  // Reconstruit l’aperçu ligne par ligne depuis le texte brut.
  const rawLines = S.csvText.split(/\r\n|\r|\n/);
  const rows = [];
  let shown = 0;
  for (let i = 0; i < rawLines.length && shown < PREVIEW_LINES; i++) {
    if (rawLines[i].trim() === '') continue;
    shown += 1;
    const no = i + 1;
    const err = res.erreurs.find((e) => e.ligne === no);
    rows.push('<tr' + (err ? ' style="background:#fdecea;"' : '') + '>'
      + '<td class="num">' + no + '</td>'
      + '<td>' + esc(rawLines[i].slice(0, 90)) + (rawLines[i].length > 90 ? '…' : '') + '</td>'
      + '<td>' + (err ? '❌' : '✓') + '</td></tr>');
  }
  let h = '<div class="table-wrap"><table class="etats-table" data-testid="ech-csv-table">'
    + '<thead><tr><th class="num">Ligne</th><th>Contenu</th><th>État</th></tr></thead><tbody>'
    + rows.join('') + '</tbody></table></div>'
    + '<p class="muted-sm">Écritures valides : <strong>' + res.ecritures.length + '</strong> · '
    + 'lignes en erreur : <strong>' + res.erreurs.length + '</strong>'
    + (rawLines.filter((l) => l.trim() !== '').length > PREVIEW_LINES ? ' · aperçu des ' + PREVIEW_LINES + ' premières lignes' : '')
    + '.</p>';
  if (res.erreurs.length > 0) {
    h += '<div data-testid="ech-csv-errors">'
      + res.erreurs.slice(0, 10).map((e) =>
        '<div style="color:#c0392b;font-size:13px;margin:4px 0;">❌ Ligne ' + e.ligne + ' : ' + esc(e.message) + '</div>').join('')
      + (res.erreurs.length > 10 ? '<div class="muted-sm">… et ' + (res.erreurs.length - 10) + ' autres erreurs.</div>' : '')
      + '</div>';
  }
  return h;
}

function refreshCsv() {
  const text = $('#echCsvText') ? $('#echCsvText').value : S.csvText;
  S.csvText = text;
  S.imported = null;
  S.csvResult = text.trim() ? parseJournalCsv(text) : null;
  const box = $('#echCsvPreview');
  if (box) box.innerHTML = csvPreviewHtml();
  const rep = $('#echImportReport');
  if (rep) rep.innerHTML = '';
  updateImportBtn();
}

function updateImportBtn() {
  const btn = $('#echImportBtn');
  if (!btn) return;
  const n = S.csvResult ? S.csvResult.ecritures.length : 0;
  btn.disabled = S.busy || n === 0;
  btn.innerHTML = '📥 Importer les lignes valides' + (n > 0 ? ' (' + n + ' écriture' + (n > 1 ? 's' : '') + ')' : '');
}

async function doImport() {
  const res = S.csvResult;
  if (!res || res.ecritures.length === 0 || S.busy) return;
  S.busy = true;
  updateImportBtn();
  const prefix = 'csv-' + Date.now().toString(36);
  let ok = 0;
  const failed = [];
  for (let i = 0; i < res.ecritures.length; i++) {
    const e = Object.assign({}, res.ecritures[i], { id: prefix + '-' + (i + 1) });
    try { await saveEntry(e); ok += 1; }
    catch (err) { failed.push({ piece: e.piece, message: errMsg(err) }); }
  }
  S.busy = false;
  S.entries = await loadEntries().catch(() => S.entries);
  S.imported = { ok, failed, erreurs: res.erreurs.length };
  const box = $('#echImportReport');
  if (box) {
    box.innerHTML = '<div data-testid="ech-import-report">'
      + '<div class="notice-ok">✅ <strong>' + ok + '</strong> écriture' + (ok > 1 ? 's' : '') + ' importée' + (ok > 1 ? 's' : '') + '.</div>'
      + (S.imported.erreurs > 0
        ? '<div class="muted-sm">⚠️ ' + S.imported.erreurs + ' ligne' + (S.imported.erreurs > 1 ? 's' : '') + ' en erreur ignorée' + (S.imported.erreurs > 1 ? 's' : '') + ' (voir aperçu).</div>'
        : '')
      + failed.map((f) => '<div style="color:#c0392b;font-size:13px;margin:4px 0;">❌ Pièce ' + esc(f.piece) + ' : ' + esc(f.message) + '</div>').join('')
      + '</div>';
  }
  toast(ok + ' écriture' + (ok > 1 ? 's' : '') + ' importée' + (ok > 1 ? 's' : '') + '.', 'success');
  refreshExport();
  updateImportBtn();
}

/* ------------------------------------------------------------------ */
/* Rendu principal                                                      */
/* ------------------------------------------------------------------ */

const CSV_DOC = '<details style="margin-bottom:4px;"><summary style="cursor:pointer;font-weight:600;">📖 Format CSV attendu</summary>'
  + '<div style="font-size:13px;margin-top:8px;"><p>Une ligne par <strong>mouvement</strong>, séparateur <strong>;</strong> (ou <strong>,</strong> — détecté automatiquement). '
  + 'Les lignes d’une même écriture sont regroupées par <strong>pièce + date</strong> (ou par <strong>ecriture_id</strong> si la colonne est présente). '
  + 'Une ligne d’en-tête nommée est reconnue (ex. <code>compte;date;journal;piece;libelle;debit;credit</code>), sinon les colonnes sont positionnelles.</p>'
  + '<ul>'
  + '<li><strong>compte</strong> : 1 à 6 chiffres (ex. 521, 401001)</li>'
  + '<li><strong>date</strong> : <code>ddMMyy</code> (ex. <code>010126</code> → 01/01/2026), <code>jj/mm/aaaa</code> ou <code>aaaa-mm-jj</code></li>'
  + '<li><strong>journal</strong> : code (BQ, VT, OD…) — OD par défaut</li>'
  + '<li><strong>debit / credit</strong> : nombres (« 1 234,56 » accepté)</li>'
  + '</ul>'
  + '<p>Chaque écriture doit être <strong>équilibrée</strong> (débit = crédit). Les lignes en erreur sont signalées et ignorées, le reste est importé.</p>'
  + '<pre style="font-family:monospace;font-size:11px;background:var(--bg-light);padding:8px;border-radius:8px;overflow-x:auto;white-space:pre-wrap;word-break:break-all;">compte;date;journal;piece;libelle;debit;credit\n'
  + '521;010126;BQ;P1;Capital;2000000;\n'
  + '101;010126;BQ;P1;Capital;;2000000\n'
  + '411;150326;VT;V12;Vente client;1180000;\n'
  + '701;150326;VT;V12;Vente client;;1000000\n'
  + '443;150326;VT;V12;Vente client;;180000</pre>'
  + '</div></details>';

export async function renderEchangesPage() {
  shell().innerHTML = '<div data-testid="echanges-page"><div class="loading-state">Chargement…</div></div>';
  try {
    const [entries, periode, company, ifu, regime, country] = await Promise.all([
      loadEntries(), defaultPeriode(), loadCompany(), loadCompanyIfu(), loadCompanyRegime(), loadCountry(),
    ]);
    S.entries = entries;
    S.periode = periode;
    S.company = company;
    S.ifu = ifu;
    S.regime = regime;
    S.country = country;
    S.csvText = '';
    S.csvResult = null;
    S.imported = null;
  } catch (err) {
    shell().innerHTML = '<div class="error-state" data-testid="echanges-error">'
      + '<div class="error-icon">⚠️</div><p>' + esc(errMsg(err)) + '</p>'
      + '<button class="btn btn-primary" id="echRetry">Réessayer</button></div>';
    document.getElementById('echRetry').addEventListener('click', () => renderEchangesPage());
    return;
  }
  S.year = (S.periode && S.periode.debut ? S.periode.debut.slice(0, 4) : String(new Date().getFullYear()));

  shell().innerHTML =
    '<div data-testid="echanges-page">'
    + '<div class="page-head"><h2 class="page-title">🔁 Échanges DGI</h2>'
    + '<p class="page-sub">Export XML pour la télédéclaration · Import CSV des écritures</p></div>'

    // ---- Section 1 : Export DGI ----
    + '<div class="card" style="margin-bottom:12px;"><div class="card-header">'
    + '<h3 class="card-title">📤 Export DGI (XML)</h3></div><div class="card-body">'
    + '<label style="font-size:12px;">Exercice'
    + '<select id="echExportYear" class="form-input" data-testid="ech-export-year" style="max-width:160px;">'
    + entryYears().map((y) => '<option value="' + y + '"' + (y === S.year ? ' selected' : '') + '>' + y + '</option>').join('')
    + '</select></label>'
    + '<div id="echExportPreview" data-testid="ech-export-preview" style="margin-top:10px;"></div>'
    + '<button class="btn btn-primary" id="echDlXml" data-testid="ech-dl-xml" style="width:100%;justify-content:center;margin-top:10px;">⬇️ XML</button>'
    + '<p class="muted-sm" style="margin-bottom:0;">Fichier <code>NO-{exercice}-{ncc}-{aaaammjj}.xml</code> — seuls les champs non vides sont exportés, montants en FCFA entiers.</p>'
    + '</div></div>'

    // ---- Section 2 : Import CSV ----
    + '<div class="card"><div class="card-header">'
    + '<h3 class="card-title">📥 Import CSV des écritures</h3></div><div class="card-body">'
    + CSV_DOC
    + '<label style="font-size:12px;margin-top:8px;display:block;">Coller le CSV'
    + '<textarea id="echCsvText" class="form-input" data-testid="ech-csv-text" rows="5" style="font-family:monospace;font-size:12px;" placeholder="compte;date;journal;piece;libelle;debit;credit"></textarea></label>'
    + '<label class="btn btn-secondary btn-sm" style="margin-top:8px;cursor:pointer;">📁 Choisir un fichier (.csv, .txt)'
    + '<input type="file" id="echCsvFile" data-testid="ech-csv-file" accept=".csv,.txt,text/csv,text/plain" hidden></label>'
    + '<div id="echCsvPreview" data-testid="ech-csv-preview" style="margin-top:10px;"></div>'
    + '<button class="btn btn-primary" id="echImportBtn" data-testid="ech-import" style="width:100%;justify-content:center;margin-top:10px;">📥 Importer les lignes valides</button>'
    + '<div id="echImportReport" style="margin-top:8px;"></div>'
    + '</div></div>'
    + '</div>';

  refreshExport();
  refreshCsv();

  $('#echExportYear').addEventListener('change', (e) => { S.year = e.target.value; refreshExport(); });

  $('#echDlXml').addEventListener('click', () => {
    try {
      const res = computeExport();
      downloadText(res.filename, res.xml);
      toast('Fichier ' + res.filename + ' téléchargé.', 'success');
    } catch (err) { toast(errMsg(err), 'error'); }
  });

  $('#echCsvText').addEventListener('input', refreshCsv);

  $('#echCsvFile').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      $('#echCsvText').value = String(rd.result || '');
      refreshCsv();
      toast('Fichier chargé : ' + f.name, 'info');
    };
    rd.onerror = () => toast('Lecture du fichier impossible.', 'error');
    rd.readAsText(f, 'utf-8');
    e.target.value = '';
  });

  $('#echImportBtn').addEventListener('click', doImport);
}
