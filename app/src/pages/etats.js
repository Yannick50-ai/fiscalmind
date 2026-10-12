// FiscalMind Africa — page États financiers (#/etats, protégée).
//
// Onglets : Balance | Grand livre | Bilan | Compte de résultat | TAFIRE | TFT.
// Données calculées par le moteur (src/engine) depuis les écritures du store,
// sur la période/exercice sélectionné (même sélecteur que le Journal, persisté).
// - Bilan : bilanModele2(entries, { year, resNet }) — modèle 2 (système allégé
//   OHADA) : refs officielles AE→BZ / CA→DZ, colonnes Brut | Amort-Dépréc |
//   Net N | Net N-1, ventilation des mixtes par sens (40/41), 478→BU, 479→DV.
//   Le résultat net (ligne CJ) est injecté depuis le compte de résultat.
// - TFT : tftData(entries, { year }) — tableau des flux de trésorerie,
//   méthode directe (refs ZA→ZH, colonnes N / N-1) + détail TBFT repliable.
//   La ligne FQ « Remboursements » porte un marqueur « ⚠ à valider »
//   (signe incohérent dans le classeur source — voir src/engine/tft.js).
//   Le TAFIRE est conservé (deux onglets) — décision produit du 8 oct. 2026.
// - Exports : Imprimer/PDF via window.print() (en-tête pro partagé) ;
//   Excel .xls pour le bilan modèle 2, le compte de résultat aux SIG et le
//   TFT (module app/src/exports.js) ; CSV conservé pour Balance / Grand livre /
//   TAFIRE.
// - En-tête des exports : nom d'entreprise (table fm_settings, modifiable ici,
//   défaut « Mon entreprise ») — jamais « WagaExpress ».

import { esc, fmt, fmtDate, toast, $, $all } from '../ui.js';
import {
  loadEntries, savePeriode, defaultPeriode,
  loadCompany, saveCompany,
} from '../store.js';
import { isDemoMode, getDemoEntries, demoBannerHtml, wireDemoExit } from '../demo-mode.js';
import { toLines } from '../../../src/engine/journal.js';
import { trialBalance } from '../../../src/engine/trial-balance.js';
import { generalLedger } from '../../../src/engine/general-ledger.js';
import { compteResultatSIG } from '../../../src/engine/compte-resultat-sig.js';
import { bilanModele2 } from '../../../src/engine/bilan-modele2.js';
import { tafireData } from '../../../src/engine/tafire.js';
import { tftData } from '../../../src/engine/tft.js';
import { buildExcelDoc, downloadExcel, buildMultiSheetExcel, downloadMultiSheetExcel, safeSheetName, renderSharedPrintHeader, fmtX } from '../exports.js';
import { ACCOUNTS } from '../../../src/engine/chart-of-accounts.js';

const S = {
  entries: [], periode: null, company: '',
  tab: 'balance', glCompte: '',
  data: null, // { bal, cr, bilan, tafire, tft, gl }
};

const TABS = [
  ['balance', '⚖️ Balance'],
  ['gl', '📖 Grand livre'],
  ['bilan', '🏦 Bilan'],
  ['cr', '📈 Résultat'],
  ['tafire', '💧 TAFIRE'],
  ['tft', '💧 TFT'],
];

function shell() { return document.getElementById('appMain'); }

/** fmt() rend '' pour 0 — ici on veut un vrai « 0,00 » dans les états. */
function fmtN(n) {
  const v = Math.round(Number(n) || 0);
  return v === 0 ? '0,00' : fmt(v);
}

function periodeLabel() {
  return 'Exercice ' + S.periode.debut.slice(0, 4);
}

/* ------------------------------------------------------------------ */
/* Calculs                                                             */
/* ------------------------------------------------------------------ */

function compute() {
  const lines = toLines(S.entries);
  const { debut, fin } = S.periode;
  const bal = trialBalance(lines, { from: debut, to: fin });
  // Compte de résultat aux SIG officiels (colonnes N / N-1) ; le résultat
  // net XI alimente le bilan modèle 2 (ligne CJ).
  const cr = compteResultatSIG(S.entries, { year: Number(debut.slice(0, 4)) });
  const bilanM2 = bilanModele2(S.entries, { year: Number(debut.slice(0, 4)), resNet: cr.resNet });
  const tafire = tafireData(lines, { from: debut, to: fin });
  // TFT — tableau des flux de trésorerie, méthode directe (refs ZA→ZH,
  // colonnes N / N-1) + détail TBFT. Le TAFIRE est conservé (deux onglets).
  const tft = tftData(S.entries, { year: Number(debut.slice(0, 4)) });
  S.data = { lines, bal, cr, bilanM2, tafire, tft };
  if (!S.glCompte) {
    S.glCompte = bal.rows.length ? bal.rows[0].compte : '';
  }
}

/* ------------------------------------------------------------------ */
/* Rendu principal                                                     */
/* ------------------------------------------------------------------ */

export async function renderEtatsPage(query) {
  shell().innerHTML = '<div data-testid="etats-page"><div class="loading-state">Chargement des états…</div></div>';
  try {
    if (isDemoMode()) {
      S.entries = await getDemoEntries();
      S.periode = { debut: '2025-01-01', fin: '2025-12-31' };
      S.company = { nom: 'Entreprise Démo (exemple)' };
    } else {
      const [entries, periode, company] = await Promise.all([
        loadEntries(), defaultPeriode(), loadCompany(),
      ]);
      S.entries = entries;
      S.periode = periode;
      S.company = company;
    }
  } catch (err) {
    shell().innerHTML = '<div class="error-state" data-testid="etats-error">'
      + '<div class="error-icon">⚠️</div><p>' + esc(err.message || 'Erreur de chargement.') + '</p>'
      + '<button class="btn btn-primary" id="etatsRetry">Réessayer</button></div>';
    document.getElementById('etatsRetry').addEventListener('click', () => renderEtatsPage(query));
    return;
  }
  if (query && query.tab && TABS.some(([k]) => k === query.tab)) S.tab = query.tab;
  compute();

  shell().innerHTML =
    '<div data-testid="etats-page">'
    + (isDemoMode() ? demoBannerHtml() : '')
    + '<div class="etats-head no-print">'
    + '<h2 class="page-title">📊 États financiers</h2>'
    + '<div class="journal-toolbar">'
    + '<select id="etatsExercice" class="form-input" data-testid="etats-exercice" aria-label="Exercice"></select>'
    + '<button class="btn btn-secondary btn-sm" id="etatsPrint" data-testid="etats-print">🖨️ Imprimer / PDF</button>'
    + '<button class="btn btn-secondary btn-sm" id="etatsDownload" data-testid="etats-download">⬇️ CSV</button>'
    + '</div>'
    + '<div class="form-group" style="margin-bottom:10px;">'
    + '<label class="form-label" for="companyInput">Entreprise (en-tête des exports)</label>'
    + '<input class="form-input" id="companyInput" data-testid="company-input" type="text" maxlength="80" value="' + esc(S.company) + '">'
    + '</div>'
    + '<div class="etats-tabs" role="tablist">'
    + TABS.map(([k, label]) =>
      '<button class="etats-tab' + (S.tab === k ? ' active' : '') + '" role="tab" data-tab="' + k + '" data-testid="tab-' + k + '">'
      + label + '</button>').join('')
    + '</div></div>'
    + '<div class="print-header" id="printHeader"></div>'
    + '<div id="etatsContent"></div>'
    + '<datalist id="glAccountList"></datalist>'
    + '</div>';

  renderExercices();
  buildGlDatalist();

  $('#etatsExercice').addEventListener('change', async (e) => {
    const y = e.target.value;
    S.periode = { debut: y + '-01-01', fin: y + '-12-31' };
    try { await savePeriode(S.periode); }
    catch (err) { toast(err.message || 'Erreur de sauvegarde.', 'error'); }
    S.glCompte = '';
    compute();
    renderContent();
  });
  $('#companyInput').addEventListener('change', async (e) => {
    S.company = (e.target.value || '').trim() || 'Mon entreprise';
    e.target.value = S.company;
    try {
      await saveCompany(S.company);
      toast('Nom d\'entreprise enregistré.', 'success');
    } catch (err) {
      toast(err.message || 'Enregistrement impossible.', 'error');
    }
    renderPrintHeader();
  });
  $('#etatsPrint').addEventListener('click', () => { renderPrintHeader(); window.print(); });
  $('#etatsDownload').addEventListener('click', exportDownload);
  if (isDemoMode()) wireDemoExit();
  $all('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    S.tab = b.dataset.tab;
    $all('[data-tab]').forEach((x) => x.classList.toggle('active', x === b));
    renderContent();
  }));

  renderPrintHeader();
  renderContent();
}

function renderExercices() {
  const years = new Set([String(new Date().getFullYear())]);
  S.entries.forEach((e) => { if (e.date) years.add(String(e.date).slice(0, 4)); });
  const cur = S.periode.debut.slice(0, 4);
  $('#etatsExercice').innerHTML = Array.from(years).sort().reverse()
    .map((y) => '<option value="' + y + '"' + (y === cur ? ' selected' : '') + '>Exercice ' + y + '</option>').join('');
}

function buildGlDatalist() {
  const dl = $('#glAccountList');
  if (!dl || dl.dataset.built) return;
  dl.dataset.built = '1';
  dl.innerHTML = Object.keys(ACCOUNTS).sort().map((n) =>
    '<option value="' + n + '">' + n + ' — ' + esc(ACCOUNTS[n].intitule) + '</option>').join('');
}

function renderPrintHeader() {
  const el = $('#printHeader');
  if (!el) return;
  if (S.tab === 'bilan') {
    // PDF du bilan modèle 2 : en-tête pro partagé (jamais « WagaExpress »).
    renderSharedPrintHeader(S.company, 'Bilan — modèle 2 (système allégé OHADA)', periodeLabel());
    return;
  }
  if (S.tab === 'cr') {
    // PDF du compte de résultat aux SIG : en-tête pro partagé.
    renderSharedPrintHeader(S.company, 'Compte de résultat — SIG (OHADA)', periodeLabel());
    return;
  }
  if (S.tab === 'tft') {
    // PDF du TFT : en-tête pro partagé (jamais « WagaExpress »).
    renderSharedPrintHeader(S.company, 'Tableau des flux de trésorerie — TFT (OHADA)', periodeLabel());
    return;
  }
  const tabLabel = (TABS.find(([k]) => k === S.tab) || [])[1] || '';
  el.innerHTML = '<div class="print-company">' + esc(S.company) + '</div>'
    + '<div class="print-title">' + esc(tabLabel.replace(/^[^\s]+\s/, '')) + ' — ' + esc(periodeLabel()) + '</div>'
    + '<div class="print-date">Édité le ' + esc(fmtDate(new Date().toISOString().slice(0, 10))) + ' — montants en FCFA</div>';
}

/** Libellé du bouton de téléchargement : Excel pour le bilan modèle 2, le
 *  compte de résultat aux SIG et le TFT, CSV pour Balance / Grand livre /
 *  TAFIRE (règle produit du 8 oct. 2026 : les états de la liasse sortent en
 *  Excel + PDF, le CSV brut reste réservé à Balance/Grand livre). */
function updateDownloadBtn() {
  const b = $('#etatsDownload');
  if (b) b.textContent = (S.tab === 'bilan' || S.tab === 'cr' || S.tab === 'tft') ? '⬇️ Excel' : '⬇️ CSV';
}

function exportDownload() {
  if (S.tab === 'bilan') exportExcelBilan();
  else if (S.tab === 'cr') exportExcelCR();
  else if (S.tab === 'tft') exportExcelTFT();
  else exportCsv();
}

function renderContent() {
  renderPrintHeader();
  updateDownloadBtn();
  const c = $('#etatsContent');
  if (S.tab === 'balance') c.innerHTML = renderBalance();
  else if (S.tab === 'gl') { c.innerHTML = renderGL(); bindGL(); }
  else if (S.tab === 'bilan') c.innerHTML = renderBilan();
  else if (S.tab === 'cr') c.innerHTML = renderCR();
  else if (S.tab === 'tafire') c.innerHTML = renderTafire();
  else if (S.tab === 'tft') c.innerHTML = renderTft();
}

function tableWrap(inner) {
  return '<div class="table-wrap">' + inner + '</div>';
}

/* ------------------------------------------------------------------ */
/* Balance                                                             */
/* ------------------------------------------------------------------ */

function renderBalance() {
  const { bal } = S.data;
  const ok = bal.tot.md === bal.tot.mc;
  // Présentation aux normes : comptes regroupés par classe, sous-total
  // "** CLASSE X" intercalé après chaque section (comme l'appli d'origine),
  // puis ligne TOTAUX.
  const clsMap = {};
  (bal.classes || []).forEach((c) => { clsMap[c.classe] = c; });
  const subRow = (c) => '<tr class="row-sub"><td class="num">' + esc(c.classe) + '</td>'
    + '<td><strong>** ' + esc(c.label || ('CLASSE ' + c.classe)) + '</strong></td>'
    + '<td class="num"><strong>' + fmtN(c.md) + '</strong></td>'
    + '<td class="num"><strong>' + fmtN(c.mc) + '</strong></td>'
    + '<td class="num"><strong>' + fmtN(c.sd) + '</strong></td>'
    + '<td class="num"><strong>' + fmtN(c.sc) + '</strong></td></tr>';
  let body = '', lastCl = '';
  (bal.rows || []).forEach((r) => {
    const cl = String(r.compte).charAt(0);
    if (cl !== lastCl) {
      if (lastCl && clsMap[lastCl]) body += subRow(clsMap[lastCl]);
      lastCl = cl;
    }
    body += '<tr><td class="num">' + esc(r.compte) + '</td>'
      + '<td>' + esc(r.intitule) + '</td>'
      + '<td class="num">' + fmtN(r.md) + '</td>'
      + '<td class="num">' + fmtN(r.mc) + '</td>'
      + '<td class="num">' + fmtN(r.sd) + '</td>'
      + '<td class="num">' + fmtN(r.sc) + '</td></tr>';
  });
  if (lastCl && clsMap[lastCl]) body += subRow(clsMap[lastCl]);
  return '<div class="stmt-head" data-testid="balance-badge">'
    + '<h3 class="stmt-title">Balance des comptes</h3>'
    + (ok ? '<span class="badge-ok">✓ Équilibrée</span>'
      : '<span class="badge-ko">⚠ Écart : ' + fmtN(Math.abs(bal.tot.md - bal.tot.mc)) + '</span>')
    + '</div>'
    + (bal.rows.length ? tableWrap(
      '<table class="etats-table"><thead><tr><th>Compte</th><th>Intitulé</th>'
      + '<th class="num">Débit</th><th class="num">Crédit</th>'
      + '<th class="num">Solde D</th><th class="num">Solde C</th></tr></thead>'
      + '<tbody>' + body
      + '<tr class="row-total"><td class="num" colspan="2"><strong>TOTAUX</strong></td>'
      + '<td class="num"><strong>' + fmtN(bal.tot.md) + '</strong></td>'
      + '<td class="num"><strong>' + fmtN(bal.tot.mc) + '</strong></td>'
      + '<td class="num"><strong>' + fmtN(bal.tot.sd) + '</strong></td>'
      + '<td class="num"><strong>' + fmtN(bal.tot.sc) + '</strong></td></tr>'
      + '</tbody></table>')
      : '<div class="empty-state"><i class="fas fa-scale-balanced"></i><div>Aucun mouvement sur cette période.</div></div>');
}

/* ------------------------------------------------------------------ */
/* Grand livre                                                         */
/* ------------------------------------------------------------------ */

function renderGL() {
  const gl = generalLedger(S.data.lines, S.glCompte, { from: S.periode.debut, to: S.periode.fin });
  const rows = gl.rows.map((r) =>
    '<tr><td>' + esc(fmtDate(r.date)) + '</td>'
    + '<td>' + esc(r.journal || '') + '</td>'
    + '<td>' + esc(r.piece || '') + '</td>'
    + '<td>' + esc(r.libelle || '') + '</td>'
    + '<td class="num">' + fmtN(r.debit) + '</td>'
    + '<td class="num">' + fmtN(r.credit) + '</td>'
    + '<td class="num"><strong>' + fmtN(r.solde) + '</strong></td></tr>').join('');
  const sens = gl.solde > 0 ? 'débiteur' : gl.solde < 0 ? 'créditeur' : 'nul';
  return '<div class="stmt-head">'
    + '<h3 class="stmt-title">Grand livre</h3></div>'
    + '<div class="form-group no-print" style="margin-bottom:10px;">'
    + '<label class="form-label" for="glCompteInput">Compte</label>'
    + '<input class="form-input" id="glCompteInput" data-testid="gl-compte" list="glAccountList" inputmode="numeric" '
    + 'value="' + esc(S.glCompte) + '" placeholder="ex. 521" autocomplete="off"></div>'
    + (S.glCompte
      ? '<p><strong>' + esc(S.glCompte) + '</strong> — ' + esc(gl.intitule || '') + ' '
        + '<span class="muted">(' + gl.rows.length + ' ligne(s), solde ' + sens + ')</span></p>'
        + (gl.rows.length ? tableWrap(
          '<table class="etats-table"><thead><tr><th>Date</th><th>Jnl</th><th>Pièce</th><th>Libellé</th>'
          + '<th class="num">Débit</th><th class="num">Crédit</th><th class="num">Solde</th></tr></thead>'
          + '<tbody>' + rows
          + '<tr class="row-total"><td colspan="4"><strong>TOTAUX</strong></td>'
          + '<td class="num"><strong>' + fmtN(gl.tot.debit) + '</strong></td>'
          + '<td class="num"><strong>' + fmtN(gl.tot.credit) + '</strong></td>'
          + '<td class="num"><strong>' + fmtN(gl.solde) + '</strong></td></tr>'
          + '</tbody></table>')
          : '<div class="empty-state"><div>Aucun mouvement sur ce compte pour la période.</div></div>')
      : '<div class="empty-state"><div>Choisissez un compte pour afficher son grand livre.</div></div>');
}

function bindGL() {
  const inp = $('#glCompteInput');
  if (!inp) return;
  inp.addEventListener('change', () => {
    S.glCompte = inp.value.trim();
    renderContent();
  });
}

/* ------------------------------------------------------------------ */
/* Bilan — modèle 2 (système allégé OHADA)                             */
/* ------------------------------------------------------------------ */

function renderBilan() {
  const m2 = S.data.bilanM2;
  const ok = m2.controles.actifEqPassif;
  const money = (v) => '<td class="num">' + fmtN(v) + '</td>';
  const noteCell = (r) => '<td class="ref">' + esc(r.note || '') + '</td>';
  const rowA = (r) => {
    const cls = r.ref === 'BZ' ? 'row-total' : r.total ? 'row-sub' : '';
    const lab = r.total ? '<strong>' + esc(r.label) + '</strong>' : esc(r.label);
    return '<tr class="' + cls + '" data-ref="' + esc(r.ref) + '">'
      + '<td class="ref">' + esc(r.ref) + '</td>'
      + '<td' + (r.total ? '' : ' class="ind"') + '>' + lab + '</td>'
      + noteCell(r)
      + money(r.brut) + money(r.amort) + money(r.netN) + money(r.netN1) + '</tr>';
  };
  const rowP = (r) => {
    const cls = r.ref === 'DZ' ? 'row-total' : r.total ? 'row-sub' : '';
    const lab = r.total ? '<strong>' + esc(r.label) + '</strong>' : esc(r.label);
    return '<tr class="' + cls + '" data-ref="' + esc(r.ref) + '">'
      + '<td class="ref">' + esc(r.ref) + '</td>'
      + '<td' + (r.total ? '' : ' class="ind"') + '>' + lab + '</td>'
      + noteCell(r)
      + money(r.netN) + money(r.netN1) + '</tr>';
  };
  const y = S.periode.debut.slice(0, 4);
  const y1 = String(Number(y) - 1);
  return '<div class="stmt-head" data-testid="bilan-badge">'
    + '<h3 class="stmt-title">Bilan — modèle 2 <span class="muted">(système allégé OHADA)</span></h3>'
    + (ok ? '<span class="badge-ok">✓ Actif = Passif</span>'
      : '<span class="badge-ko">⚠ Écart Actif/Passif : ' + fmtN(Math.abs(m2.controles.ecart)) + '</span>')
    + '</div>'
    + '<h4 class="stmt-subtitle">ACTIF</h4>'
    + tableWrap('<table class="etats-table" data-testid="bilan-table-actif"><thead><tr>'
      + '<th>Réf</th><th>Rubrique</th><th>Note</th>'
      + '<th class="num">Brut ' + y + '</th><th class="num">Amort.-Dépréc.</th>'
      + '<th class="num">Net ' + y + '</th><th class="num">Net ' + y1 + '</th></tr></thead>'
      + '<tbody>' + m2.actif.map(rowA).join('') + '</tbody></table>')
    + '<h4 class="stmt-subtitle">PASSIF</h4>'
    + tableWrap('<table class="etats-table" data-testid="bilan-table-passif"><thead><tr>'
      + '<th>Réf</th><th>Rubrique</th><th>Note</th>'
      + '<th class="num">Net ' + y + '</th><th class="num">Net ' + y1 + '</th></tr></thead>'
      + '<tbody>' + m2.passif.map(rowP).join('') + '</tbody></table>')
    + '<p class="muted" data-testid="bilan-resnet">Résultat net de l\'exercice (CJ) : <strong>' + fmtN(m2.resNet) + '</strong>'
    + ' — montants en FCFA</p>';
}

/* ------------------------------------------------------------------ */
/* Compte de résultat — SIG officiels OHADA (refs TA→XI, N / N-1)       */
/* ------------------------------------------------------------------ */

function renderCR() {
  const cr = S.data.cr;
  const y = S.periode.debut.slice(0, 4);
  const y1 = String(Number(y) - 1);
  const rows = cr.lignes.map((l) => {
    const cls = l.ref === 'XI' ? 'row-resnet' : l.isSig ? 'row-sig' : '';
    const lab = l.isSig ? '<strong>' + esc(l.label) + '</strong>' : esc(l.label);
    const formule = l.formule ? ' <span class="muted">(' + esc(l.formule) + ')</span>' : '';
    const noteTxt = (l.sousNote ? l.sousNote + ' ' : '') + (l.signe ? l.signe + ' ' : '') + (l.note || '');
    const val = (v) => (l.isSig ? '<strong>' : '') + fmtN(v) + (l.isSig ? '</strong>' : '');
    return '<tr class="' + cls + '" data-ref="' + esc(l.ref) + '">'
      + '<td class="ref">' + esc(l.ref) + '</td>'
      + '<td' + (l.isSig ? '' : ' class="ind"') + '>' + lab + formule + '</td>'
      + '<td class="ref">' + esc(noteTxt.trim()) + '</td>'
      + '<td class="num">' + val(l.n) + '</td>'
      + '<td class="num">' + val(l.n1) + '</td></tr>';
  }).join('');
  return '<div class="stmt-head"><h3 class="stmt-title">Compte de résultat '
    + '<span class="muted">(soldes intermédiaires de gestion — OHADA)</span></h3>'
    + '<span class="badge-ok" data-testid="cr-resnet">Résultat net : ' + fmtN(cr.resNet) + '</span></div>'
    + tableWrap('<table class="etats-table" data-testid="cr-table"><thead><tr>'
      + '<th>Réf</th><th>Libellé</th><th>Note</th><th class="num">Net ' + y + '</th><th class="num">Net ' + y1 + '</th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table>')
    + '<p class="muted">Cascade officielle TA→XI — montants en FCFA.</p>';
}

/* ------------------------------------------------------------------ */
/* TAFIRE                                                              */
/* ------------------------------------------------------------------ */

function renderTafire() {
  const t = S.data.tafire;
  const sec = (titre, rows) =>
    '<h4 class="stmt-subtitle">' + esc(titre) + '</h4>'
    + tableWrap('<table class="etats-table"><tbody>'
      + rows.map(([l, v, lvl]) =>
        '<tr class="' + (lvl ? 'row-sub' : '') + '"><td>' + (lvl ? '<strong>' + esc(l) + '</strong>' : esc(l)) + '</td>'
        + '<td class="num">' + (lvl ? '<strong>' : '') + fmtN(v) + (lvl ? '</strong>' : '') + '</td></tr>').join('')
      + '</tbody></table>');
  const ok = t.dTresoCalc === t.dTresoReel;
  return '<div class="stmt-head" data-testid="tafire-controle"><h3 class="stmt-title">TAFIRE</h3>'
    + (ok ? '<span class="badge-ok">✓ Trésorerie contrôlée</span>'
      : '<span class="badge-ko">⚠ Écart trésorerie : ' + fmtN(Math.abs(t.dTresoCalc - t.dTresoReel)) + '</span>')
    + '</div>'
    + '<p class="muted">Tableau financier des ressources et emplois — montants en FCFA.</p>'
    + sec('Capacité d\'autofinancement globale (CAFG)', [
      ['Excédent brut d\'exploitation', t.ebe, 0],
      ['+ Produits financiers', t.prodFin, 0],
      ['− Charges financières', -t.chFin, 0],
      ['+ Produits HAO', t.prodHAO, 0],
      ['− Charges HAO', -t.chHAO, 0],
      ['− Participation des travailleurs', -t.participation, 0],
      ['− Impôt sur le résultat', -t.is, 0],
      ['CAFG', t.cafg, 1],
    ])
    + sec('Excédent de trésorerie d\'exploitation (ETE)', [
      ['CAFG', t.cafg, 0],
      ['− Variation du besoin de financement d\'exploitation', -t.dBFE, 0],
      ['ETE', t.ete, 1],
    ])
    + sec('Emplois stables', [
      ['Acquisitions d\'immobilisations', t.acqImmo, 0],
      ['Remboursement des dettes financières', t.rembDettes, 0],
      ['Variation TVA sur immobilisations (4451)', t.dTvaImmo, 0],
      ['TOTAL EMPLOIS', t.emplois, 1],
    ])
    + sec('Ressources stables', [
      ['CAFG', t.cafg, 0],
      ['Cessions d\'immobilisations', t.cessions, 0],
      ['Augmentation de capital', t.augCapital, 0],
      ['Subventions d\'investissement', t.subventions, 0],
      ['Nouveaux emprunts', t.nouvEmprunts, 0],
      ['TOTAL RESSOURCES', t.ressources, 1],
    ])
    + sec('Contrôle', [
      ['Variation du fonds de roulement (ressources − emplois)', t.dFR, 0],
      ['Variation de trésorerie calculée', t.dTresoCalc, 0],
      ['Variation de trésorerie réelle (51 à 58)', t.dTresoReel, 1],
    ]);
}

/* ------------------------------------------------------------------ */
/* TFT — tableau des flux de trésorerie, méthode directe (refs ZA→ZH)     */
/* ------------------------------------------------------------------ */

function renderTft() {
  const t = S.data.tft;
  const c = t.controles;
  const secTitle = {
    A: 'A — ACTIVITÉS OPÉRATIONNELLES',
    B: 'B — ACTIVITÉS D\u2019INVESTISSEMENT',
    C: 'C — ACTIVITÉS DE FINANCEMENT',
  };
  let rows = '', lastSec = '§';
  for (const l of t.lignes) {
    if (l.section && l.section !== lastSec) {
      rows += '<tr class="row-section"><td colspan="4">' + esc(secTitle[l.section]) + '</td></tr>';
      lastSec = l.section;
    }
    const strong = l.kind === 'total' || l.kind === 'grand';
    const cls = l.kind === 'grand' ? 'row-resnet' : (strong || l.kind === 'za') ? 'row-sub' : '';
    const lab = (strong ? '<strong>' : '') + esc(l.ref + ' — ' + l.label) + (strong ? '</strong>' : '')
      + (l.fqAValider ? ' <span class="badge-warn" data-testid="tft-fq-badge">⚠ à valider</span>' : '');
    const cell = (v) => '<td class="num">' + (strong ? '<strong>' : '') + fmtN(v) + (strong ? '</strong>' : '') + '</td>';
    rows += '<tr class="' + cls + '" data-ref="' + esc(l.ref) + '">'
      + '<td class="ref">' + esc(l.ref) + '</td>'
      + '<td' + (l.kind === 'flux' ? ' class="ind"' : '') + '>' + lab + '</td>'
      + '<td class="ref">' + esc(l.note || '') + '</td>'
      + cell(l.n) + cell(l.n1) + '</tr>';
  }
  const badges = (c.zhEqTresoNette
    ? '<span class="badge-ok">✓ ZH = trésorerie nette</span>'
    : '<span class="badge-ko">⚠ Écart ZH : ' + fmtN(Math.abs(c.ecartZH)) + '</span>')
    + ' ' + (c.zgEqSomme
      ? '<span class="badge-ok">✓ ZG = ZB + ZC + ZF</span>'
      : '<span class="badge-ko">⚠ Écart ZG : ' + fmtN(Math.abs(c.ecartZG)) + '</span>');
  // Détail TBFT repliable (calculs de variations par section).
  const secLabels = {
    za: 'Trésorerie nette au 1er janvier',
    A: 'A — Flux opérationnel (détail)',
    B: 'B — Flux d\u2019investissement (détail)',
    C: 'C — Flux de financement (détail)',
  };
  let det = '';
  for (const sec of ['za', 'A', 'B', 'C']) {
    const drows = t.tbft[sec].map((d) =>
      '<tr class="' + (d.total ? 'row-sub' : '') + '"><td>'
      + (d.total ? '<strong>' + esc(d.label) + '</strong>' : esc(d.label)) + '</td>'
      + '<td class="num">' + (d.n == null ? '—' : fmtN(d.n)) + '</td>'
      + '<td class="num">' + (d.n1 == null ? '—' : fmtN(d.n1)) + '</td></tr>').join('');
    det += '<h4 class="stmt-subtitle">' + esc(secLabels[sec]) + '</h4>'
      + tableWrap('<table class="etats-table"><thead><tr><th>Composante</th>'
        + '<th class="num">N</th><th class="num">N-1</th></tr></thead>'
        + '<tbody>' + drows + '</tbody></table>');
  }
  return '<div class="stmt-head"><h3 class="stmt-title">💧 TFT '
    + '<span class="muted">(flux de trésorerie — méthode directe, OHADA)</span></h3>'
    + '<div>' + badges + '</div></div>'
    + tableWrap('<table class="etats-table" data-testid="tft-table"><thead><tr>'
      + '<th>Réf</th><th>Libellé</th><th>Note</th><th class="num">N</th><th class="num">N-1</th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table>')
    + '<p class="muted" data-testid="tft-fq-note">FQ — Remboursements : le classeur source applique un signe '
    + 'incohérent entre N et N-1. Hypothèse affichée : <strong>' + fmtN(t.fq.retenuN) + '</strong> ; '
    + 'hypothèse alternative : <strong>' + fmtN(t.fq.alternatifN) + '</strong>. À valider.</p>'
    + '<details class="tft-detail" data-testid="tft-tbft"><summary>📋 Détail TBFT — calculs de variations</summary>'
    + det + '</details>'
    + '<p class="muted">Montants en FCFA.</p>';
}

/* ------------------------------------------------------------------ */
/* Export Excel du bilan modèle 2 (livrable — remplace le CSV)         */
/* ------------------------------------------------------------------ */

function exportExcelBilan() {
  const m2 = S.data.bilanM2;
  const y = S.periode.debut.slice(0, 4);
  const y1 = String(Number(y) - 1);
  const num = (r, v, total) => ({ v, num: true, style: total ? 'total' : undefined });
  const rowA = (r) => {
    const t = r.total ? 'total' : undefined;
    return [
      { v: r.ref, style: t }, { v: r.label, style: t }, { v: r.note || '', style: t },
      num(r, r.brut, r.total), num(r, r.amort, r.total),
      num(r, r.netN, r.total), num(r, r.netN1, r.total),
    ];
  };
  const rowP = (r) => {
    const t = r.total ? 'total' : undefined;
    return [
      { v: r.ref, style: t }, { v: r.label, style: t }, { v: r.note || '', style: t },
      num(r, r.netN, r.total), num(r, r.netN1, r.total),
    ];
  };
  const doc = buildMultiSheetExcel({
    sheets: [
      {
        name: 'Bilan Actif',
        title: 'Bilan Actif — modèle 2 — ' + S.company + ' — Exercice ' + y,
        headers: ['Réf', 'Rubrique', 'Note', 'Brut ' + y, 'Amort.-Dépréc.', 'Net ' + y, 'Net ' + y1],
        rows: m2.actif.map(rowA),
      },
      {
        name: 'Bilan Passif',
        title: 'Bilan Passif — modèle 2 — ' + S.company + ' — Exercice ' + y,
        headers: ['Réf', 'Rubrique', 'Note', 'Net ' + y, 'Net ' + y1],
        rows: m2.passif.map(rowP),
      },
    ],
  });
  downloadMultiSheetExcel('bilan_modele2_' + y + '.xls', doc);
  toast('Bilan exporté en Excel (2 feuilles).', 'success');
}

/* ------------------------------------------------------------------ */
/* Export Excel du compte de résultat aux SIG (livrable — remplace le   */
/* CSV)                                                                */
/* ------------------------------------------------------------------ */

function exportExcelCR() {
  const cr = S.data.cr;
  const y = S.periode.debut.slice(0, 4);
  const y1 = String(Number(y) - 1);
  const row = (l) => {
    const t = l.isSig ? 'total' : undefined;
    const noteTxt = ((l.sousNote ? l.sousNote + ' ' : '') + (l.signe ? l.signe + ' ' : '') + (l.note || '')).trim();
    const label = l.label + (l.formule ? ' (' + l.formule + ')' : '');
    return [
      { v: l.ref, style: t }, { v: label, style: t }, { v: noteTxt, style: t },
      { v: l.n, num: true, style: t }, { v: l.n1, num: true, style: t },
    ];
  };
  const doc = buildMultiSheetExcel({
    sheets: [{
      name: 'Compte de résultat',
      title: 'Compte de résultat — SIG — ' + S.company + ' — Exercice ' + y,
      headers: ['Réf', 'Libellé', 'Note', 'Net ' + y, 'Net ' + y1],
      rows: cr.lignes.map(row),
    }],
  });
  downloadMultiSheetExcel('compte_resultat_sig_' + y + '.xls', doc);
  toast('Compte de résultat exporté en Excel.', 'success');
}

/* ------------------------------------------------------------------ */
/* Export Excel du TFT (livrable — remplace le CSV)                    */
/* ------------------------------------------------------------------ */

function exportExcelTFT() {
  const t = S.data.tft;
  const y = S.periode.debut.slice(0, 4);
  const y1 = String(Number(y) - 1);
  const strong = (l) => l.kind === 'total' || l.kind === 'grand';
  const row = (l) => {
    const tstyle = l.kind === 'grand' ? 'total' : (strong(l) || l.kind === 'za') ? 'total' : undefined;
    const label = l.label + (l.fqAValider ? ' — ⚠ À VALIDER' : '');
    return [
      { v: l.ref, style: tstyle }, { v: label, style: tstyle }, { v: l.note || '', style: tstyle },
      { v: l.n, num: true, style: tstyle }, { v: l.n1, num: true, style: tstyle },
    ];
  };
  const sheets = [{
    name: 'TFT',
    title: 'Tableau des flux de trésorerie — ' + S.company + ' — Exercice ' + y,
    headers: ['Réf', 'Libellé', 'Note', 'Net ' + y, 'Net ' + y1],
    rows: t.lignes.map(row),
  }];
  const detLabels = {
    za: 'Trésorerie nette au 1er janvier',
    A: 'A — Flux opérationnel (détail)',
    B: 'B — Flux d’investissement (détail)',
    C: 'C — Flux de financement (détail)',
  };
  for (const sec of ['za', 'A', 'B', 'C']) {
    sheets.push({
      name: 'TBFT ' + sec.toUpperCase(),
      title: 'Détail TBFT — ' + detLabels[sec] + ' — Exercice ' + y,
      headers: ['Composante', 'N', 'N-1'],
      rows: t.tbft[sec].map((d) => {
        const ts = d.total ? 'total' : undefined;
        return [
          { v: d.label, style: ts },
          d.n == null ? { v: '—', style: ts } : { v: d.n, num: true, style: ts },
          d.n1 == null ? { v: '—', style: ts } : { v: d.n1, num: true, style: ts },
        ];
      }),
    });
  }
  const doc = buildMultiSheetExcel({ sheets });
  downloadMultiSheetExcel('tft_' + y + '.xls', doc);
  toast('TFT exporté en Excel (' + sheets.length + ' feuilles).', 'success');
}

/* ------------------------------------------------------------------ */
/* Export CSV (Balance / Grand livre / TAFIRE)                           */
/* ------------------------------------------------------------------ */

function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function downloadCSV(filename, rows) {
  const text = '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  toast('Fichier CSV téléchargé.', 'success');
}

function csvHead(titre) {
  return [
    [S.company],
    [titre + ' — ' + periodeLabel()],
    ['Montants en FCFA'],
    [],
  ];
}

function exportCsv() {
  const y = S.periode.debut.slice(0, 4);
  if (S.tab === 'balance') {
    const { bal } = S.data;
    const clsMap = {};
    (bal.classes || []).forEach((c) => { clsMap[c.classe] = c; });
    const csvRows = [['Compte', 'Intitulé', 'Débit', 'Crédit', 'Solde débiteur', 'Solde créditeur']];
    let lastCl = '';
    (bal.rows || []).forEach((r) => {
      const cl = String(r.compte).charAt(0);
      if (cl !== lastCl) {
        if (lastCl && clsMap[lastCl]) {
          const c = clsMap[lastCl];
          csvRows.push([c.classe, '** ' + (c.label || ('CLASSE ' + c.classe)), c.md, c.mc, c.sd, c.sc]);
        }
        lastCl = cl;
      }
      csvRows.push([r.compte, r.intitule, r.md, r.mc, r.sd, r.sc]);
    });
    if (lastCl && clsMap[lastCl]) {
      const c = clsMap[lastCl];
      csvRows.push([c.classe, '** ' + (c.label || ('CLASSE ' + c.classe)), c.md, c.mc, c.sd, c.sc]);
    }
    csvRows.push(['', 'TOTAUX', bal.tot.md, bal.tot.mc, bal.tot.sd, bal.tot.sc]);
    downloadCSV('balance_' + y + '.csv', csvHead('Balance des comptes').concat(csvRows));
  } else if (S.tab === 'gl') {
    const gl = generalLedger(S.data.lines, S.glCompte, { from: S.periode.debut, to: S.periode.fin });
    downloadCSV('grand_livre_' + S.glCompte + '_' + y + '.csv', csvHead('Grand livre — ' + S.glCompte).concat(
      [['Date', 'Journal', 'Pièce', 'Libellé', 'Débit', 'Crédit', 'Solde']],
      gl.rows.map((r) => [r.date, r.journal, r.piece, r.libelle, r.debit, r.credit, r.solde])));
  } else if (S.tab === 'tafire') {
    const t = S.data.tafire;
    downloadCSV('tafire_' + y + '.csv', csvHead('TAFIRE').concat([
      ['EBE', t.ebe],
      ['CAFG', t.cafg],
      ['Variation du BFE', t.dBFE],
      ['ETE', t.ete],
      ['Acquisitions d\'immobilisations', t.acqImmo],
      ['Remboursement dettes financières', t.rembDettes],
      ['Variation TVA sur immobilisations', t.dTvaImmo],
      ['TOTAL EMPLOIS', t.emplois],
      ['Cessions d\'immobilisations', t.cessions],
      ['Augmentation de capital', t.augCapital],
      ['Subventions', t.subventions],
      ['Nouveaux emprunts', t.nouvEmprunts],
      ['TOTAL RESSOURCES', t.ressources],
      ['Variation du fonds de roulement', t.dFR],
      ['Variation de trésorerie calculée', t.dTresoCalc],
      ['Variation de trésorerie réelle', t.dTresoReel],
    ]));
  }
}
