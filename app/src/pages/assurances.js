// FiscalMind Africa — page Assurances (#/assurances).
//
// Polices d'assurance : alerte d'expiration < 60 jours, paiement de la
// prime annuelle (écriture 625 -> 521, journal BQ), sinistres avec suivi.
// Persistance 100 % cloud (table fm_assurances via le store).

import { esc, $, fmt, fmtDate, toast } from '../ui.js';
import { loadAssurances, saveAssurance, deleteAssurance, saveEntry, CloudError } from '../store.js';
import { validateEntry } from '../../../src/engine/journal.js';
import {
  statutAssurance, policesUrgentes, sortByExpiration, isPrimePayee,
  primeEntry, sanitizePolice, sanitizeSinistre,
} from '../../../src/engine/assurances.js';

const S = { polices: [], sinFormFor: null };
const TONE = {
  danger: 'background:#fee2e2;color:#991b1b;',
  warn: 'background:#fef3c7;color:#92400e;',
  ok: 'background:#dcfce7;color:#166534;',
};

function shell() { return document.getElementById('appMain'); }

function errorHtml(msg) {
  return '<div class="error-state" data-testid="assur-error">'
    + '<div class="error-icon">⚠️</div><p>' + esc(msg) + '</p>'
    + '<button class="btn btn-primary" data-testid="assur-retry" id="assurRetry">Réessayer</button></div>';
}

function errMsg(e) {
  return e instanceof CloudError ? e.message : 'Erreur inattendue.';
}

function render() {
  const annee = new Date().getFullYear();
  const urgentes = policesUrgentes(S.polices);
  let h = '<div data-testid="assur-page">'
    + '<div class="page-head"><h2 class="page-title">🛡️ Assurances</h2>'
    + '<p class="page-sub">Polices, primes et sinistres</p></div>'
    + '<button class="btn btn-primary" id="polNew" data-testid="pol-new" style="width:100%;justify-content:center;margin-bottom:12px;">＋ Nouvelle police</button>'
    + '<div id="polFormWrap"></div>';

  if (urgentes.length) {
    h += '<div data-testid="assur-alert" style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:10px 12px;margin-bottom:14px;font-size:13px;">'
      + '⚠️ <strong>' + urgentes.length + ' police(s) à renouveler :</strong><br>'
      + urgentes.map((a) => '• ' + esc(a.assureur) + ' (' + esc(a.numero) + ') — ' + esc(statutAssurance(a).txt)).join('<br>')
      + '</div>';
  }

  if (!S.polices.length) {
    h += '<div class="empty-state"><div style="font-size:36px;">🛡️</div><div>Aucune police d’assurance enregistrée.</div></div>';
  } else {
    h += sortByExpiration(S.polices).map((a) => {
      const st = statutAssurance(a);
      const payee = isPrimePayee(a, annee);
      const sins = a.sinistres || [];
      return '<div class="card" style="margin-bottom:12px;" data-testid="pol-card-' + esc(a.id) + '"><div class="card-body">'
        + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;">'
        + '<div><strong>' + esc(a.assureur) + '</strong> '
        + '<span class="event-badge" style="' + TONE[st.tone] + 'font-size:11px;">' + esc(st.txt) + '</span><br>'
        + '<small class="muted">' + esc(a.type) + ' · Police n° ' + esc(a.numero) + (a.bien ? ' · ' + esc(a.bien) : '')
        + '<br>Prime : ' + fmt(a.prime) + ' F/an · ' + fmtDate(a.dateSouscription) + ' → ' + fmtDate(a.dateExpiration) + '</small></div>'
        + '<div style="display:flex;gap:6px;flex-wrap:wrap;">'
        + (payee
          ? '<span style="color:#166534;font-size:12px;align-self:center;">✓ Prime ' + annee + ' payée</span>'
          : '<button class="btn btn-primary btn-sm" data-pay="' + esc(a.id) + '" data-testid="pol-pay-' + esc(a.id) + '">Payer la prime</button>')
        + '<button class="btn btn-secondary btn-sm" data-sinform="' + esc(a.id) + '">＋ Sinistre</button>'
        + '<button class="btn btn-secondary btn-sm" data-edit="' + esc(a.id) + '">Modifier</button>'
        + '<button class="btn btn-secondary btn-sm" data-del="' + esc(a.id) + '">Supprimer</button>'
        + '</div></div>'
        + (sins.length
          ? '<div style="margin-top:10px;border-top:1px dashed rgba(0,0,0,0.1);padding-top:8px;">'
            + '<strong style="font-size:13px;">Sinistres (' + sins.length + ')</strong>'
            + sins.map((s) => '<div class="muted-sm" style="margin-top:4px;">• ' + fmtDate(s.date) + ' — ' + esc(s.description)
              + ' <span class="badge-plan" style="font-size:10px;">' + esc(s.statut) + '</span>'
              + (s.reclame ? ' · réclamé : ' + fmt(s.reclame) + ' F' : '')
              + (s.indemnise ? ' · indemnisé : ' + fmt(s.indemnise) + ' F' : '') + '</div>').join('')
            + '</div>'
          : '')
        + '<div id="sinForm-' + esc(a.id) + '" style="display:none;margin-top:8px;"></div>'
        + '</div></div>';
    }).join('');
  }
  h += '<div id="polModalRoot"></div></div>';
  shell().innerHTML = h;
  bind();
}

function bind() {
  $('#polNew').addEventListener('click', () => openForm(null));
  shell().querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => openForm(b.dataset.edit)));
  shell().querySelectorAll('[data-pay]').forEach((b) =>
    b.addEventListener('click', () => payerPrime(b.dataset.pay)));
  shell().querySelectorAll('[data-sinform]').forEach((b) =>
    b.addEventListener('click', () => openSinistreForm(b.dataset.sinform)));
  shell().querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (b.dataset.armed) {
        try {
          await deleteAssurance(b.dataset.del);
          S.polices = S.polices.filter((x) => x.id !== b.dataset.del);
          toast('Police supprimée.', 'success');
        } catch (e) { toast('Suppression impossible : ' + errMsg(e), 'error'); }
        render();
      } else {
        b.dataset.armed = '1'; b.textContent = 'Confirmer ?';
        setTimeout(() => { if (document.body.contains(b)) { delete b.dataset.armed; b.textContent = 'Supprimer'; } }, 2500);
      }
    }));
}

function openForm(id) {
  const a = id ? S.polices.find((x) => x.id === id) : null;
  const w = $('#polFormWrap');
  w.innerHTML = '<div style="background:var(--bg-light);border-radius:12px;padding:14px;margin-bottom:14px;" data-testid="pol-form">'
    + '<h4 style="margin:0 0 10px;">' + (id ? 'Modifier' : 'Nouvelle') + ' police</h4>'
    + '<div class="form-grid-2">'
    + '<label style="font-size:12px;">Assureur*<input id="po-assureur" class="form-input" value="' + esc(a ? a.assureur : '') + '"></label>'
    + '<label style="font-size:12px;">N° de police*<input id="po-numero" class="form-input" value="' + esc(a ? a.numero : '') + '"></label>'
    + '<label style="font-size:12px;">Type<input id="po-type" class="form-input" value="' + esc(a ? a.type : 'Multirisque') + '"></label>'
    + '<label style="font-size:12px;">Bien assuré<input id="po-bien" class="form-input" value="' + esc(a ? a.bien : '') + '"></label>'
    + '<label style="font-size:12px;">Prime annuelle (XOF)*<input id="po-prime" type="number" min="1" class="form-input" value="' + (a ? a.prime : '') + '"></label>'
    + '<label style="font-size:12px;">Souscription*<input id="po-debut" type="date" class="form-input" value="' + esc(a ? a.dateSouscription : '') + '"></label>'
    + '<label style="font-size:12px;">Expiration*<input id="po-fin" type="date" class="form-input" value="' + esc(a ? a.dateExpiration : '') + '"></label>'
    + '</div>'
    + '<div class="modal-actions">'
    + '<button class="btn btn-secondary" id="poCancel">Annuler</button>'
    + '<button class="btn btn-primary" id="poSave">Enregistrer</button>'
    + '</div></div>';
  $('#poCancel').addEventListener('click', () => { w.innerHTML = ''; });
  $('#poSave').addEventListener('click', async () => {
    const v = (x) => document.getElementById(x).value.trim();
    const res = sanitizePolice({
      id: id || undefined,
      assureur: v('po-assureur'), numero: v('po-numero'), type: v('po-type'), bien: v('po-bien'),
      prime: v('po-prime'), dateSouscription: v('po-debut'), dateExpiration: v('po-fin'),
      primes: a ? a.primes : [], sinistres: a ? a.sinistres : [],
    });
    if (!res.ok) { toast(res.errors[0], 'error'); return; }
    try {
      await saveAssurance(res.police);
      if (id) Object.assign(S.polices.find((x) => x.id === id), res.police);
      else S.polices.push(res.police);
      toast('Police enregistrée.', 'success');
    } catch (e) { toast('Sauvegarde impossible : ' + errMsg(e), 'error'); }
    render();
  });
}

async function payerPrime(id) {
  const a = S.polices.find((x) => x.id === id);
  if (!a) return;
  const annee = new Date().getFullYear();
  const entry = primeEntry(a, annee);
  if (!entry) { toast('Prime ' + annee + ' déjà payée.', 'error'); return; }
  const v = validateEntry(entry);
  if (!v.ok) { toast('Écriture invalide : ' + v.errors[0], 'error'); return; }
  try {
    await saveEntry(entry);
    a.primes = (a.primes || []).concat([annee]);
    await saveAssurance(a);
    toast('Prime ' + annee + ' passée au journal (' + fmt(entry.lignes[0].debit) + ' F).', 'success');
  } catch (e) { toast('Écriture impossible : ' + errMsg(e), 'error'); }
  render();
}

function openSinistreForm(assId) {
  const w = document.getElementById('sinForm-' + assId);
  if (!w) return;
  w.style.display = 'block';
  w.innerHTML = '<div style="background:var(--bg-light);border-radius:10px;padding:12px;" data-testid="sin-form">'
    + '<strong style="font-size:13px;">Nouveau sinistre</strong>'
    + '<div class="form-grid-2" style="margin-top:8px;">'
    + '<label style="font-size:12px;">Date*<input id="sn-date" type="date" class="form-input"></label>'
    + '<label style="font-size:12px;">Statut<select id="sn-statut" class="form-input"><option>En cours</option><option>Indemnisé</option><option>Rejeté</option></select></label>'
    + '<label style="font-size:12px;">Description*<input id="sn-desc" class="form-input"></label>'
    + '<label style="font-size:12px;">Montant réclamé (XOF)<input id="sn-reclame" type="number" min="0" class="form-input" value="0"></label>'
    + '<label style="font-size:12px;">Montant indemnisé (XOF)<input id="sn-indemnise" type="number" min="0" class="form-input" value="0"></label>'
    + '</div><div class="modal-actions">'
    + '<button class="btn btn-secondary btn-sm" id="snCancel">Annuler</button>'
    + '<button class="btn btn-primary btn-sm" id="snSave">Enregistrer</button>'
    + '</div></div>';
  $('#snCancel').addEventListener('click', () => { w.style.display = 'none'; w.innerHTML = ''; });
  $('#snSave').addEventListener('click', async () => {
    const v = (x) => document.getElementById(x).value.trim();
    const res = sanitizeSinistre({
      description: v('sn-desc'), date: v('sn-date'), statut: v('sn-statut'),
      reclame: v('sn-reclame'), indemnise: v('sn-indemnise'),
    });
    if (!res.ok) { toast(res.errors[0], 'error'); return; }
    const a = S.polices.find((x) => x.id === assId);
    if (!a) return;
    a.sinistres = (a.sinistres || []).concat([res.sinistre]);
    try {
      await saveAssurance(a);
      toast('Sinistre enregistré.', 'success');
    } catch (e) { toast('Sauvegarde impossible : ' + errMsg(e), 'error'); }
    render();
  });
}

async function load() {
  shell().innerHTML = '<div class="loading-state">Chargement des assurances…</div>';
  try {
    S.polices = await loadAssurances();
    render();
  } catch (e) {
    shell().innerHTML = errorHtml(errMsg(e));
    const r = $('#assurRetry');
    if (r) r.addEventListener('click', load);
  }
}

export function renderAssurancesPage() {
  load();
}
