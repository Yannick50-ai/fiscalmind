// FiscalMind Africa — page Journal comptable (#/journal, protégée).
//
// - Liste des écritures (cartes mobile-first), tri par date, recherche,
//   filtre par code journal, sélecteur d'exercice (persisté).
// - Multi-journaux : codes par défaut + journaux personnalisés (ajout/suppression).
// - Modale de saisie : pièce multi-lignes validée par le moteur
//   (validateEntry/addEntry/updateEntry de src/engine/journal.js),
//   autocomplétion sur les 1420 comptes du plan SYSCOHADA révisé,
//   indication du sens normal, contrôle d'équilibre en direct.
// - Persistance 100 % cloud (store.js → Supabase). Les erreurs réseau/serveur
//   affichent un message explicite en français avec bouton Réessayer.

import { esc, fmt, fmtDate, toast, todayISO, $, $all } from '../ui.js';
import {
  loadEntries, saveEntry, deleteEntryById, savePeriode, defaultPeriode,
  journalCodes, journalLabel, loadJournaux, saveJournal, deleteJournal,
} from '../store.js';
import {
  validateEntry, addEntry, updateEntry, deleteEntry, newEntryId,
} from '../../../src/engine/journal.js';
import { getAccount, sensNormal, ACCOUNTS } from '../../../src/engine/chart-of-accounts.js';
import { isAdmin, getQuotaInfo } from '../licence.js';
import { isDemoMode, getDemoEntries, demoBannerHtml, wireDemoExit } from '../demo-mode.js';

async function getUserPlan() {
  const q = getQuotaInfo();
  return (q && q.plan) || 'gratuit';
}

const S = {
  entries: [], journaux: [], periode: null,
  filter: '', q: '', sort: 'asc',
  draft: null, // { id?, date, journal, piece, libelle, lignes: [{compte,debit,credit}] }
};

function shell() { return document.getElementById('appMain'); }

/** Panneau d'erreur explicite (FR) avec bouton Réessayer. */
function errorHtml(message) {
  return '<div class="error-state" data-testid="journal-error">'
    + '<div class="error-icon">⚠️</div>'
    + '<p>' + esc(message || 'Une erreur est survenue.') + '</p>'
    + '<button class="btn btn-primary" data-testid="journal-retry" id="journalRetry">Réessayer</button></div>';
}

/* ------------------------------------------------------------------ */
/* Rendu principal                                                     */
/* ------------------------------------------------------------------ */

export async function renderJournalPage() {
  const demo = isDemoMode();
  shell().innerHTML =
    '<div data-testid="journal-page">'
    + (demo ? demoBannerHtml() : '')
    + '<div class="journal-head">'
    + '<h2 class="page-title">📒 Journal comptable <span class="conn-badge conn-on" data-testid="conn-badge" id="connBadge" title="Données sur le serveur">● Connecté</span></h2>'
    + '<div class="journal-toolbar">'
    + '<select id="exerciceSelect" class="form-input" data-testid="exercice-select" aria-label="Exercice"></select>'
    + (demo ? '' : '<button class="btn btn-secondary btn-sm" id="journauxBtn" data-testid="journaux-btn">📚 Journaux</button>')
    + (demo ? '' : '<button class="btn btn-primary btn-sm" id="newEntryBtn" data-testid="new-entry-btn">＋ Écriture</button>')
    + '</div>'
    + '<div class="journal-filters">'
    + '<input class="form-input" id="journalSearch" data-testid="journal-search" type="search" placeholder="🔍 Rechercher (libellé, compte, pièce)">'
    + '<select class="form-input" id="journalFilter" data-testid="journal-filter" aria-label="Filtrer par journal"></select>'
    + '<select class="form-input" id="journalSort" data-testid="journal-sort" aria-label="Tri">'
    + '<option value="asc">Date ↑</option><option value="desc">Date ↓</option></select>'
    + '</div>'
    + '<div id="journalBalance" data-testid="journal-balance"></div>'
    + '</div>'
    + '<div id="journalList"><div class="loading-state">Chargement du journal…</div></div>'
    + '<div id="journalEmpty" class="empty-state" data-testid="journal-empty"></div>'
    + '</div>'
    + '<div id="modalRoot"></div>';

  if (demo) wireDemoExit();
  if (!demo) {
    $('#newEntryBtn').addEventListener('click', () => openEntryModal(null));
    $('#journauxBtn').addEventListener('click', openJournauxModal);
  }
  $('#journalSearch').addEventListener('input', (e) => { S.q = e.target.value; renderList(); });
  $('#journalFilter').addEventListener('change', (e) => { S.filter = e.target.value; renderList(); });
  $('#journalSort').addEventListener('change', (e) => { S.sort = e.target.value; renderList(); });
  $('#exerciceSelect').addEventListener('change', async (e) => {
    const y = e.target.value;
    S.periode = { debut: y + '-01-01', fin: y + '-12-31' };
    try { await savePeriode(S.periode); }
    catch (err) { toast(err.message || 'Erreur de sauvegarde.', 'error'); }
    renderList();
  });

  await reload();
}

async function reload() {
  try {
    // Mode démo : données d'exemple, pas d'appel serveur.
    if (isDemoMode()) {
      S.entries = await getDemoEntries();
      S.journaux = [{ code: 'AN', label: 'À-nouveaux' }];
      S.periode = { debut: '2025-01-01', fin: '2025-12-31' };
      setConn(true);
      renderToolbar();
      renderList();
      return;
    }
    const [entries, journaux, periode] = await Promise.all([
      loadEntries(), loadJournaux(), defaultPeriode(),
    ]);
    S.entries = entries;
    S.journaux = journaux;
    S.periode = periode;
    setConn(true);
    renderToolbar();
    renderList();
  } catch (err) {
    setConn(false);
    const host = shell().querySelector('[data-testid="journal-page"]');
    if (host) {
      host.innerHTML = errorHtml(err.message);
      const retry = document.getElementById('journalRetry');
      if (retry) retry.addEventListener('click', () => renderJournalPage());
    } else {
      toast(err.message || 'Erreur de chargement.', 'error');
    }
  }
}

/** Pastille de connexion : ● Connecté (vert) / ● Erreur (rouge). */
function setConn(ok) {
  const b = document.getElementById('connBadge');
  if (!b) return;
  b.className = 'conn-badge ' + (ok ? 'conn-on' : 'conn-ko');
  b.textContent = ok ? '● Connecté' : '● Erreur';
  b.title = ok ? 'Données sur le serveur' : 'Problème de connexion au serveur';
}

function renderToolbar() {
  // Exercices : années présentes dans les données + année en cours
  const years = new Set([String(new Date().getFullYear())]);
  S.entries.forEach((e) => { if (e.date) years.add(String(e.date).slice(0, 4)); });
  const cur = S.periode.debut.slice(0, 4);
  $('#exerciceSelect').innerHTML = Array.from(years).sort().reverse()
    .map((y) => '<option value="' + y + '"' + (y === cur ? ' selected' : '') + '>Exercice ' + y + '</option>').join('');

  const codes = journalCodes(S.journaux);
  $('#journalFilter').innerHTML = '<option value="">Tous les journaux</option>'
    + Object.keys(codes).sort().map((c) =>
      '<option value="' + esc(c) + '"' + (S.filter === c ? ' selected' : '') + '>' + esc(c) + ' — ' + esc(codes[c]) + '</option>').join('');
}

function periodeEntries() {
  return S.entries.filter((e) =>
    e.date >= S.periode.debut && e.date <= S.periode.fin);
}

function filteredEntries() {
  const q = S.q.trim().toLowerCase();
  return periodeEntries()
    .filter((e) => !S.filter || e.journal === S.filter)
    .filter((e) => {
      if (!q) return true;
      const hay = (e.libelle + ' ' + e.piece + ' ' + e.lignes.map((l) => l.compte + ' ' + accountName(l.compte)).join(' ')).toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => S.sort === 'asc'
      ? (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
      : (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
}

function accountName(compte) {
  const a = getAccount(compte);
  return a ? a.intitule : '';
}

function renderList() {
  const list = filteredEntries();
  let td = 0, tc = 0;
  const cards = list.map((e) => {
    let ed = 0, ec = 0;
    const lines = e.lignes.map((l) => {
      ed += l.debit || 0; ec += l.credit || 0;
      const name = accountName(l.compte);
      return '<div class="entry-line"><span class="entry-compte"><strong>' + esc(l.compte) + '</strong>'
        + (name ? ' <small>' + esc(name) + '</small>' : '') + '</span>'
        + '<span class="entry-montants"><span class="m-debit">' + fmt(l.debit) + '</span>'
        + '<span class="m-credit">' + fmt(l.credit) + '</span></span></div>';
    }).join('');
    td += ed; tc += ec;
    // Écritures de démo : protégées sur un compte non-admin (ni modification
    // ni suppression) ; l'admin peut les modifier et les supprimer.
    // En mode démo (visite sans compte) : tout est en lecture seule.
    const demoLocked = e.demo && !isAdmin();
    const actions = (demoLocked || isDemoMode())
      ? '<span class="event-badge" title="Lecture seule — mode démo">👁️ Démo</span>'
      : '<button class="btn btn-secondary btn-sm" data-edit="' + esc(e.id) + '" aria-label="Modifier">✏️</button> '
      + '<button class="btn btn-secondary btn-sm" data-del="' + esc(e.id) + '" data-testid="delete-entry-btn" aria-label="Supprimer">🗑️</button>';
    return '<article class="entry-card" data-testid="entry-card" data-entry-id="' + esc(e.id) + '">'
      + '<div class="entry-head"><span class="entry-date">' + esc(fmtDate(e.date)) + '</span>'
      + '<span class="event-badge">' + esc(e.journal) + '</span>'
      + (e.piece ? '<span class="entry-piece">' + esc(e.piece) + '</span>' : '')
      + (e.doc ? '<span class="entry-doc" title="Document source">📎 ' + esc(e.doc) + '</span>' : '')
      + '<span class="entry-total">' + fmt(ed) + '</span></div>'
      + '<div class="entry-lib">' + esc(e.libelle) + '</div>'
      + '<div class="entry-lines">' + lines + '</div>'
      + '<div class="entry-actions">' + actions + '</div></article>';
  }).join('');

  $('#journalList').innerHTML = cards;
  const empty = $('#journalEmpty');
  empty.style.display = list.length ? 'none' : 'block';
  if (!list.length) empty.innerHTML = '<i class="fas fa-book-open"></i><div>Aucune écriture sur cette période.<br>Cliquez sur « ＋ Écriture » pour commencer.</div>';

  const ok = td === tc;
  $('#journalBalance').innerHTML =
    '<div class="balance-bar" data-testid="journal-totals">'
    + '<span>Débit : <strong>' + fmt(td) + '</strong></span>'
    + '<span>Crédit : <strong>' + fmt(tc) + '</strong></span>'
    + (ok
      ? '<span class="badge-ok">✓ Équilibré</span>'
      : '<span class="badge-ko">⚠ Écart : ' + fmt(Math.abs(td - tc)) + '</span>')
    + '<span class="muted" data-testid="journal-count">' + list.length + ' écriture(s)</span></div>';

  $all('[data-edit]').forEach((b) => b.addEventListener('click', () => openEntryModal(b.dataset.edit)));
  $all('[data-del]').forEach((b) => b.addEventListener('click', () => confirmDelete(b)));
}

async function confirmDelete(btn) {
  const id = btn.dataset.del;
  if (btn.dataset.confirm === '1') {
    btn.disabled = true;
    try {
      await deleteEntryById(id);
      S.entries = deleteEntry(S.entries, id);
      renderToolbar(); renderList();
      toast('Écriture supprimée.', 'success');
    } catch (err) {
      btn.disabled = false;
      toast(err.message || 'Suppression impossible.', 'error');
    }
  } else {
    btn.dataset.confirm = '1';
    btn.textContent = 'Sûr ?';
    setTimeout(() => { if (btn.isConnected) { btn.dataset.confirm = ''; btn.textContent = '🗑️'; } }, 2500);
  }
}

/* ------------------------------------------------------------------ */
/* Modale de saisie d'écriture                                          */
/* ------------------------------------------------------------------ */

let datalistBuilt = false;
function ensureDatalist() {
  if (datalistBuilt || !document.getElementById('accountList')) return;
  datalistBuilt = true;
  const opts = Object.keys(ACCOUNTS).sort().map((n) =>
    '<option value="' + n + '">' + n + ' — ' + esc(ACCOUNTS[n].intitule) + '</option>').join('');
  document.getElementById('accountList').innerHTML = opts;
}

function openEntryModal(entryId) {
  const codes = journalCodes(S.journaux);
  const existing = entryId ? S.entries.find((e) => e.id === entryId) : null;
  S.draft = existing
    ? { id: existing.id, date: existing.date, journal: existing.journal, piece: existing.piece || '', libelle: existing.libelle, lignes: existing.lignes.map((l) => ({ ...l })) }
    : { id: null, date: todayISO(), journal: Object.keys(codes)[0] || 'OD', piece: '', libelle: '', lignes: [{ compte: '', debit: 0, credit: 0 }, { compte: '', debit: 0, credit: 0 }] };

  const d = S.draft;
  $('#modalRoot').innerHTML =
    '<div class="modal-overlay active" id="entryOverlay"><div class="modal" role="dialog" aria-modal="true" data-testid="entry-modal">'
    + '<h3 class="modal-title">' + (d.id ? "Modifier l'écriture" : 'Nouvelle écriture') + '</h3>'
    + '<div class="form-grid-2">'
    + '<div class="form-group"><label class="form-label" for="entryDate">Date</label>'
    + '<input class="form-input" id="entryDate" data-testid="entry-date" type="date" value="' + esc(d.date) + '" required></div>'
    + '<div class="form-group"><label class="form-label" for="entryJournal">Journal</label>'
    + '<select class="form-input" id="entryJournal" data-testid="entry-journal">'
    + Object.keys(codes).sort().map((c) => '<option value="' + esc(c) + '"' + (c === d.journal ? ' selected' : '') + '>' + esc(c) + ' — ' + esc(codes[c]) + '</option>').join('')
    + '</select></div></div>'
    + '<div class="form-group"><label class="form-label" for="entryPiece">N° de pièce (optionnel)</label>'
    + '<input class="form-input" id="entryPiece" data-testid="entry-piece" type="text" value="' + esc(d.piece) + '" placeholder="ex. AC2026-0001"></div>'
    + '<div class="form-group"><label class="form-label" for="entryLib">Libellé</label>'
    + '<input class="form-input" id="entryLib" data-testid="entry-lib" type="text" value="' + esc(d.libelle) + '" placeholder="ex. Achat marchandises" required></div>'
    + '<datalist id="accountList"></datalist>'
    + '<div class="lines-head"><span class="form-label">Lignes (partie double)</span>'
    + '<button class="btn btn-secondary btn-sm" id="addLineBtn" data-testid="add-line-btn" type="button">＋ Ligne</button></div>'
    + '<div id="entryLines"></div>'
    + '<div id="entryTotals" class="entry-totals" data-testid="entry-balance-badge"></div>'
    + '<div id="entryErrors" class="form-error" data-testid="entry-errors" hidden></div>'
    + '<div class="modal-actions">'
    + '<button class="btn btn-secondary" id="entryCancel" type="button">Annuler</button>'
    + '<button class="btn btn-primary" id="entrySave" data-testid="entry-save" type="button"><i class="fas fa-check"></i> Enregistrer</button>'
    + '</div></div></div>';

  ensureDatalist();
  renderDraftLines();

  $('#entryDate').addEventListener('change', (e) => { S.draft.date = e.target.value; });
  $('#entryJournal').addEventListener('change', (e) => { S.draft.journal = e.target.value; });
  $('#entryPiece').addEventListener('input', (e) => { S.draft.piece = e.target.value; });
  $('#entryLib').addEventListener('input', (e) => { S.draft.libelle = e.target.value; });
  $('#addLineBtn').addEventListener('click', () => {
    S.draft.lignes.push({ compte: '', debit: 0, credit: 0 });
    renderDraftLines();
  });
  $('#entryCancel').addEventListener('click', closeModal);
  $('#entryOverlay').addEventListener('click', (e) => { if (e.target.id === 'entryOverlay') closeModal(); });
  $('#entrySave').addEventListener('click', saveDraft);
  updateTotals();
}

function closeModal() { $('#modalRoot').innerHTML = ''; S.draft = null; }

function renderDraftLines() {
  const box = $('#entryLines');
  box.innerHTML = S.draft.lignes.map((l, i) =>
    '<div class="line-edit" data-line="' + i + '">'
    + '<div class="form-group" style="margin:0;flex:1;min-width:0;">'
    + '<label class="form-label">Compte ' + (i + 1) + '</label>'
    + '<input class="form-input line-compte" data-testid="line-compte-' + i + '" list="accountList" inputmode="numeric"'
    + ' value="' + esc(l.compte) + '" placeholder="ex. 601" autocomplete="off">'
    + '<div class="sens-hint" data-sens="' + i + '">' + sensHint(l.compte) + '</div></div>'
    + '<div class="line-montants">'
    + '<input class="form-input line-debit" data-testid="line-debit-' + i + '" type="number" min="0" inputmode="decimal"'
    + ' value="' + (l.debit || '') + '" placeholder="Débit" aria-label="Débit ligne ' + (i + 1) + '">'
    + '<input class="form-input line-credit" data-testid="line-credit-' + i + '" type="number" min="0" inputmode="decimal"'
    + ' value="' + (l.credit || '') + '" placeholder="Crédit" aria-label="Crédit ligne ' + (i + 1) + '"></div>'
    + (S.draft.lignes.length > 2
      ? '<button class="btn btn-secondary btn-sm line-del" data-line-del="' + i + '" type="button" aria-label="Supprimer la ligne">×</button>'
      : '')
    + '</div>').join('');

  $all('.line-compte', box).forEach((inp, i) => {
    inp.addEventListener('input', () => {
      S.draft.lignes[i].compte = inp.value.trim();
      box.querySelector('[data-sens="' + i + '"]').innerHTML = sensHint(inp.value.trim());
      updateTotals();
    });
  });
  $all('.line-debit', box).forEach((inp, i) => {
    inp.addEventListener('input', () => {
      const v = Math.max(0, Math.round(Number(inp.value) || 0));
      S.draft.lignes[i].debit = v;
      if (v > 0) { S.draft.lignes[i].credit = 0; box.querySelectorAll('.line-credit')[i].value = ''; }
      updateTotals();
    });
  });
  $all('.line-credit', box).forEach((inp, i) => {
    inp.addEventListener('input', () => {
      const v = Math.max(0, Math.round(Number(inp.value) || 0));
      S.draft.lignes[i].credit = v;
      if (v > 0) { S.draft.lignes[i].debit = 0; box.querySelectorAll('.line-debit')[i].value = ''; }
      updateTotals();
    });
  });
  $all('[data-line-del]', box).forEach((b) =>
    b.addEventListener('click', () => {
      S.draft.lignes.splice(Number(b.dataset.lineDel), 1);
      renderDraftLines(); updateTotals();
    }));
}

function sensHint(compte) {
  const c = String(compte || '').trim();
  if (!c) return '';
  const a = getAccount(c);
  if (!a) return /^\d{2,6}$/.test(c) ? '<span class="sens-unknown">Compte inconnu au plan révisé</span>' : '';
  const sens = sensNormal(c);
  const label = sens === 'D' ? 'Débit' : sens === 'C' ? 'Crédit' : 'mixte';
  return esc(a.intitule) + '<br><span class="sens-' + (sens || 'mixte').toLowerCase() + '">Sens normal : ' + label + '</span>';
}

function draftTotals() {
  let td = 0, tc = 0;
  S.draft.lignes.forEach((l) => { td += l.debit || 0; tc += l.credit || 0; });
  return { td, tc };
}

function updateTotals() {
  const { td, tc } = draftTotals();
  const ok = td > 0 && td === tc;
  $('#entryTotals').innerHTML =
    '<span>Débit : <strong>' + fmt(td) + '</strong></span>'
    + '<span>Crédit : <strong>' + fmt(tc) + '</strong></span>'
    + (ok ? '<span class="badge-ok">✓ Équilibré</span>'
      : '<span class="badge-ko">⚠ Écart : ' + fmt(Math.abs(td - tc)) + '</span>');
}

async function saveDraft() {
  const errBox = $('#entryErrors');
  errBox.hidden = true; errBox.innerHTML = '';
  const v = validateEntry(S.draft);
  if (!v.ok) {
    errBox.innerHTML = v.errors.map((e) => '<div>• ' + esc(e) + '</div>').join('');
    errBox.hidden = false;
    return; // refus explicite : la modale reste ouverte
  }
  let res;
  let saved;
  if (S.draft.id) {
    res = updateEntry(S.entries, S.draft.id, S.draft);
    saved = res.ok ? res.entries.find((e) => e.id === S.draft.id) : null;
  } else {
    // Limite : 30 écritures/mois pour le plan Gratuit
    const plan = (await getUserPlan()) || 'gratuit';
    if (plan === 'gratuit' || plan === 'demo') {
      const debutMois = new Date(); debutMois.setDate(1); debutMois.setHours(0,0,0,0);
      const nbCeMois = S.entries.filter((e) => new Date(e.date || e.created_at) >= debutMois).length;
      if (nbCeMois >= 30) {
        errBox.innerHTML = '<div>• Limite de 30 écritures/mois atteinte (plan Gratuit). <a href="#/config">Passez au plan Essentiel</a> pour des écritures illimitées.</div>';
        errBox.hidden = false;
        return;
      }
    }
    saved = { ...S.draft, id: newEntryId() };
    res = addEntry(S.entries, saved);
  }
  if (!res.ok || !saved) {
    errBox.innerHTML = (res.errors || ['Écriture invalide.']).map((e) => '<div>• ' + esc(e) + '</div>').join('');
    errBox.hidden = false;
    return;
  }
  const btn = $('#entrySave');
  btn.disabled = true;
  try {
    await saveEntry(saved);
  } catch (err) {
    btn.disabled = false;
    errBox.innerHTML = '<div>• ' + esc(err.message || 'Enregistrement impossible.') + '</div>';
    errBox.hidden = false;
    return; // la modale reste ouverte : aucune donnée perdue
  }
  S.entries = res.entries;
  const wasEdit = !!(S.draft && S.draft.id);
  closeModal();
  renderToolbar(); renderList();
  toast(wasEdit ? 'Écriture modifiée.' : 'Écriture enregistrée.', 'success');
}

/* ------------------------------------------------------------------ */
/* Gestion des journaux (multi-journaux)                               */
/* ------------------------------------------------------------------ */

function openJournauxModal() {
  const codes = journalCodes(S.journaux);
  const perso = S.journaux;
  const used = {};
  S.entries.forEach((e) => { used[e.journal] = (used[e.journal] || 0) + 1; });

  $('#modalRoot').innerHTML =
    '<div class="modal-overlay active" id="journauxOverlay"><div class="modal" role="dialog" aria-modal="true">'
    + '<h3 class="modal-title">📚 Journaux comptables</h3>'
    + '<p class="modal-desc">Plusieurs journaux auxiliaires possibles (ex. BQ1, BQ2 pour plusieurs banques, ES1, ES2 pour plusieurs caisses).</p>'
    + '<div class="journaux-list">'
    + Object.keys(codes).sort().map((c) => {
      const isPerso = perso.some((p) => String(p.code).toUpperCase() === c);
      const n = used[c] || 0;
      return '<div class="journal-row"><span class="event-badge">' + esc(c) + '</span>'
        + '<span style="flex:1;">' + esc(codes[c]) + (n ? ' <small class="muted">(' + n + ' écriture(s))</small>' : '') + '</span>'
        + (isPerso
          ? '<button class="btn btn-secondary btn-sm" data-jdel="' + esc(c) + '" ' + (n ? 'disabled title="Journal utilisé"' : '') + '>🗑️</button>'
          : '<small class="muted">défaut</small>') + '</div>';
    }).join('') + '</div>'
    + '<div class="form-grid-2" style="margin-top:12px;">'
    + '<div class="form-group"><label class="form-label" for="newJCode">Code (2-4 lettres/chiffres)</label>'
    + '<input class="form-input" id="newJCode" maxlength="4" placeholder="ex. BQ2" style="text-transform:uppercase;"></div>'
    + '<div class="form-group"><label class="form-label" for="newJLabel">Libellé</label>'
    + '<input class="form-input" id="newJLabel" placeholder="ex. Banque BSIC"></div></div>'
    + '<div class="modal-actions">'
    + '<button class="btn btn-secondary" id="journauxClose" type="button">Fermer</button>'
    + '<button class="btn btn-primary" id="journauxAdd" type="button">＋ Ajouter</button>'
    + '</div></div></div>';

  $('#journauxClose').addEventListener('click', () => { $('#modalRoot').innerHTML = ''; });
  $('#journauxOverlay').addEventListener('click', (e) => { if (e.target.id === 'journauxOverlay') $('#modalRoot').innerHTML = ''; });
  $('#journauxAdd').addEventListener('click', async () => {
    const code = ($('#newJCode').value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    const label = ($('#newJLabel').value || '').trim();
    if (!code || code.length < 2) { toast('Code invalide (2 à 4 lettres/chiffres).', 'error'); return; }
    if (!label) { toast('Le libellé est obligatoire.', 'error'); return; }
    if (codes[code]) { toast('Ce code existe déjà.', 'error'); return; }
    const btn = $('#journauxAdd');
    btn.disabled = true;
    try {
      await saveJournal(code, label);
    } catch (err) {
      btn.disabled = false;
      toast(err.message || 'Création impossible.', 'error');
      return;
    }
    S.journaux = [...S.journaux, { code, label }];
    toast('Journal ' + code + ' créé.', 'success');
    $('#modalRoot').innerHTML = '';
    renderToolbar(); renderList();
  });
  $all('[data-jdel]').forEach((b) => b.addEventListener('click', async () => {
    const code = b.dataset.jdel;
    b.disabled = true;
    try {
      await deleteJournal(code);
    } catch (err) {
      b.disabled = false;
      toast(err.message || 'Suppression impossible.', 'error');
      return;
    }
    S.journaux = S.journaux.filter((p) => String(p.code).toUpperCase() !== code);
    toast('Journal ' + code + ' supprimé.', 'success');
    $('#modalRoot').innerHTML = '';
    renderToolbar(); renderList();
  }));
}
