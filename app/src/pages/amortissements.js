// FiscalMind Africa — page Amortissements (#/amortissements).
//
// Immobilisations, plans d'amortissement linéaires (prorata temporis la
// 1re année), génération des écritures de dotation 681 -> compte
// d'amortissement au 31/12 vers le journal (fm_entries). VNC suivie.
// Persistance 100 % cloud (table fm_immos via le store).

import { esc, $, fmt, fmtDate, toast } from '../ui.js';
import { loadImmos, saveImmo, deleteImmo, saveEntry, CloudError } from '../store.js';
import { validateEntry } from '../../../src/engine/journal.js';
import {
  planAmortissement, annuite, isDotationBooked, bookedSummary,
  dotationEntry, sanitizeImmo,
} from '../../../src/engine/amortissements.js';

const S = { immos: [], detailId: null };

function shell() { return document.getElementById('appMain'); }

function errorHtml(msg) {
  return '<div class="error-state" data-testid="amort-error">'
    + '<div class="error-icon">⚠️</div><p>' + esc(msg) + '</p>'
    + '<button class="btn btn-primary" data-testid="amort-retry" id="amortRetry">Réessayer</button></div>';
}

function errMsg(e) {
  return e instanceof CloudError ? e.message : 'Erreur inattendue.';
}

function render() {
  let h = '<div data-testid="amort-page">'
    + '<div class="page-head"><h2 class="page-title">📉 Amortissements</h2>'
    + '<p class="page-sub">Linéaire, prorata temporis la 1ʳᵉ année</p></div>'
    + '<button class="btn btn-primary" id="immoNew" data-testid="immo-new" style="width:100%;justify-content:center;margin-bottom:12px;">＋ Nouvelle immobilisation</button>'
    + '<div id="immoFormWrap"></div>'
    + '<div id="immoList">';

  if (!S.immos.length) {
    h += '<div class="empty-state"><div style="font-size:36px;">📉</div>'
      + '<div>Aucune immobilisation enregistrée.<br>Ajoutez vos biens amortissables pour générer leur plan.</div></div>';
  } else {
    h += S.immos.map((im) => {
      const s = bookedSummary(im);
      return '<div class="card" style="margin-bottom:12px;" data-testid="immo-card-' + esc(im.id) + '"><div class="card-body">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">'
        + '<div><strong>' + esc(im.designation) + '</strong><br>'
        + '<small class="muted">' + esc(im.compte) + ' · ' + fmt(im.valeur) + ' F · ' + im.duree + ' ans · mise en service le ' + fmtDate(im.dateMiseEnService) + '</small></div>'
        + '<div style="display:flex;gap:6px;flex-wrap:wrap;">'
        + '<button class="btn btn-secondary btn-sm" data-plan="' + esc(im.id) + '">Plan</button>'
        + '<button class="btn btn-secondary btn-sm" data-edit="' + esc(im.id) + '">Modifier</button>'
        + '<button class="btn btn-secondary btn-sm" data-del="' + esc(im.id) + '">Supprimer</button>'
        + '</div></div>'
        + '<div style="background:var(--bg-light);border-radius:8px;height:8px;margin-top:10px;">'
        + '<div style="background:var(--primary);height:8px;border-radius:8px;width:' + s.percent + '%;"></div></div>'
        + '<small class="muted">Comptabilisé : ' + fmt(s.cumulBooked) + ' F (' + s.percent + ' %) · VNC : ' + fmt(s.vnc) + ' F</small>'
        + '</div></div>';
    }).join('');
  }
  h += '</div><div id="immoDetail"></div><div id="immoModalRoot"></div></div>';
  shell().innerHTML = h;
  bind();
  if (S.detailId) showDetail(S.detailId);
}

function bind() {
  $('#immoNew').addEventListener('click', () => openForm(null));
  shell().querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => openForm(b.dataset.edit)));
  shell().querySelectorAll('[data-plan]').forEach((b) =>
    b.addEventListener('click', () => { S.detailId = b.dataset.plan; showDetail(S.detailId); }));
  shell().querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (b.dataset.armed) {
        try {
          await deleteImmo(b.dataset.del);
          S.immos = S.immos.filter((x) => x.id !== b.dataset.del);
          if (S.detailId === b.dataset.del) S.detailId = null;
          toast('Immobilisation supprimée (les écritures passées sont conservées).', 'success');
        } catch (e) { toast('Suppression impossible : ' + errMsg(e), 'error'); }
        render();
      } else {
        b.dataset.armed = '1'; b.textContent = 'Confirmer ?';
        setTimeout(() => { if (document.body.contains(b)) { delete b.dataset.armed; b.textContent = 'Supprimer'; } }, 2500);
      }
    }));
}

function openForm(id) {
  const im = id ? S.immos.find((x) => x.id === id) : null;
  const w = $('#immoFormWrap');
  w.innerHTML = '<div style="background:var(--bg-light);border-radius:12px;padding:14px;margin-bottom:14px;" data-testid="immo-form">'
    + '<h4 style="margin:0 0 10px;">' + (id ? 'Modifier' : 'Nouvelle') + ' immobilisation</h4>'
    + '<div class="form-grid-2">'
    + '<label style="font-size:12px;">Désignation*<input id="im-designation" class="form-input" value="' + esc(im ? im.designation : '') + '"></label>'
    + '<label style="font-size:12px;">Compte immobilisation*<input id="im-compte" class="form-input" inputmode="numeric" value="' + esc(im ? im.compte : '241') + '"></label>'
    + '<label style="font-size:12px;">Compte d’amortissement*<input id="im-compteAmort" class="form-input" inputmode="numeric" value="' + esc(im ? im.compteAmort : '281') + '"></label>'
    + '<label style="font-size:12px;">Valeur d’acquisition (XOF)*<input id="im-valeur" type="number" min="1" class="form-input" value="' + (im ? im.valeur : '') + '"></label>'
    + '<label style="font-size:12px;">Durée (années)*<input id="im-duree" type="number" min="1" max="50" class="form-input" value="' + (im ? im.duree : '') + '"></label>'
    + '<label style="font-size:12px;">Mise en service*<input id="im-date" type="date" class="form-input" value="' + esc(im ? im.dateMiseEnService : '') + '"></label>'
    + '</div>'
    + '<div class="modal-actions">'
    + '<button class="btn btn-secondary" id="imCancel">Annuler</button>'
    + '<button class="btn btn-primary" id="imSave">Enregistrer</button>'
    + '</div></div>';
  $('#imCancel').addEventListener('click', () => { w.innerHTML = ''; });
  $('#imSave').addEventListener('click', async () => {
    const v = (x) => document.getElementById(x).value.trim();
    const res = sanitizeImmo({
      id: id || undefined,
      designation: v('im-designation'), compte: v('im-compte'), compteAmort: v('im-compteAmort'),
      valeur: v('im-valeur'), duree: v('im-duree'), dateMiseEnService: v('im-date'),
      booked: im ? im.booked : [],
    });
    if (!res.ok) { toast(res.errors[0], 'error'); return; }
    try {
      await saveImmo(res.immo);
      if (id) Object.assign(S.immos.find((x) => x.id === id), res.immo);
      else S.immos.push(res.immo);
      toast('Immobilisation enregistrée.', 'success');
    } catch (e) { toast('Sauvegarde impossible : ' + errMsg(e), 'error'); }
    render();
  });
}

function showDetail(id) {
  const im = S.immos.find((x) => x.id === id);
  const box = $('#immoDetail');
  if (!im || !box) return;
  const plan = planAmortissement(im);
  box.innerHTML = '<div class="card" data-testid="immo-plan"><div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">'
    + '<h3 class="card-title">Plan — ' + esc(im.designation) + '</h3>'
    + '<button class="btn btn-secondary btn-sm" id="immoDetailClose">Fermer</button></div>'
    + '<div class="card-body"><div class="table-wrap"><table class="etats-table"><thead><tr>'
    + '<th>Exercice</th><th class="num">Dotation</th><th class="num">Cumul</th><th class="num">VNC</th><th></th>'
    + '</tr></thead><tbody>'
    + plan.map((p) => '<tr><td>' + p.annee + '</td><td class="num">' + fmt(p.dotation) + '</td>'
      + '<td class="num">' + fmt(p.cumul) + '</td><td class="num">' + fmt(p.vnc) + '</td>'
      + '<td style="text-align:right;white-space:nowrap;">' + (isDotationBooked(im, p.annee)
        ? '<span style="color:#166534;font-size:12px;">✓ comptabilisée</span>'
        : '<button class="btn btn-primary btn-sm" data-gen="' + p.annee + '" data-testid="gen-dotation-' + p.annee + '">Générer l’écriture</button>')
      + '</td></tr>').join('')
    + '</tbody></table></div>'
    + '<p class="muted-sm" style="margin:8px 0 0;">Linéaire : ' + fmt(Math.round(annuite(im))) + ' F/an, prorata temporis la 1ʳᵉ année. Écriture : 681 → ' + esc(im.compteAmort) + ' (journal OD).</p>'
    + '</div></div>';
  $('#immoDetailClose').addEventListener('click', () => { S.detailId = null; box.innerHTML = ''; });
  box.querySelectorAll('[data-gen]').forEach((b) =>
    b.addEventListener('click', () => genererDotation(im.id, Number(b.dataset.gen))));
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function genererDotation(immoId, annee) {
  const im = S.immos.find((x) => x.id === immoId);
  if (!im) return;
  const entry = dotationEntry(im, annee);
  if (!entry) { toast('Dotation ' + annee + ' déjà comptabilisée ou sans montant.', 'error'); return; }
  const v = validateEntry(entry);
  if (!v.ok) { toast('Écriture invalide : ' + v.errors[0], 'error'); return; }
  try {
    await saveEntry(entry);
    im.booked = (im.booked || []).concat([annee]);
    await saveImmo(im);
    toast('Dotation ' + annee + ' passée au journal (' + fmt(entry.lignes[0].debit) + ' F).', 'success');
  } catch (e) { toast('Écriture impossible : ' + errMsg(e), 'error'); }
  render();
}

async function load() {
  shell().innerHTML = '<div class="loading-state">Chargement des immobilisations…</div>';
  try {
    S.immos = await loadImmos();
    S.detailId = null;
    render();
  } catch (e) {
    shell().innerHTML = errorHtml(errMsg(e));
    const r = $('#amortRetry');
    if (r) r.addEventListener('click', load);
  }
}

export function renderAmortissementsPage() {
  load();
}
