// FiscalMind Africa — page Audit Readiness (#/audit).
//
// Checklists de contrôle fiscal (Brigade, DGE) : 4 groupes, éléments
// cochables, ajout/modification/suppression, avancement global et par
// groupe. Persistance 100 % cloud (table fm_audit via le store) —
// amorçage avec le modèle de départ si aucun élément enregistré.

import { esc, $, toast } from '../ui.js';
import { loadAudit, saveAudit, CloudError } from '../store.js';
import {
  AUDIT_GROUPS, AUDIT_PRIO, defaultAuditItems, sanitizeAuditItem,
  toggleAuditItem, addAuditItem, updateAuditItem, deleteAuditItem,
  itemsOfGroup, auditProgress,
} from '../../../src/engine/audit.js';

const S = { items: [], loading: true, error: null };

function shell() { return document.getElementById('appMain'); }

function errorHtml(msg) {
  return '<div class="error-state" data-testid="audit-error">'
    + '<div class="error-icon">⚠️</div><p>' + esc(msg) + '</p>'
    + '<button class="btn btn-primary" data-testid="audit-retry" id="auditRetry">Réessayer</button></div>';
}

function progressBar(p) {
  return '<div style="background:var(--bg-light);border-radius:8px;height:8px;margin-top:6px;">'
    + '<div style="background:var(--primary);height:8px;border-radius:8px;width:' + p.percent + '%;"></div></div>'
    + '<small class="muted">' + p.done + ' / ' + p.total + ' (' + p.percent + ' %)</small>';
}

function render() {
  const global = auditProgress(S.items);
  let h = '<div data-testid="audit-page">'
    + '<div class="page-head"><h2 class="page-title">📋 Audit Readiness</h2>'
    + '<p class="page-sub">Préparez vos contrôles fiscaux (Brigade, DGE)</p></div>'

    + '<div class="card" style="margin-bottom:14px;"><div class="card-body">'
    + '<strong>Avancement global</strong>' + progressBar(global)
    + '</div></div>';

  Object.keys(AUDIT_GROUPS).forEach((g) => {
    const list = itemsOfGroup(S.items, g);
    const p = auditProgress(S.items, g);
    h += '<div class="card" style="margin-bottom:12px;"><div class="card-body">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">'
      + '<strong>' + esc(AUDIT_GROUPS[g]) + '</strong>'
      + '<span class="muted-sm">' + p.done + '/' + p.total + '</span></div>'
      + progressBar(p)
      + '<div style="margin-top:10px;" data-testid="audit-group-' + g + '">'
      + list.map((it) =>
        '<div class="checkline" data-testid="audit-item-' + esc(it.id) + '" style="align-items:flex-start;">'
        + '<input type="checkbox" data-toggle="' + esc(it.id) + '"' + (it.done ? ' checked' : '')
        + ' style="margin-top:3px;flex-shrink:0;width:18px;height:18px;" aria-label="Cocher">'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="' + (it.done ? 'text-decoration:line-through;color:var(--text-muted);' : 'font-weight:600;') + '">'
        + esc(it.title) + '</div>'
        + '<div class="muted-sm"><span class="badge-plan" style="font-size:10px;">'
        + esc(AUDIT_PRIO[it.priority] || '') + '</span>'
        + (it.note ? ' · ' + esc(it.note) : '') + '</div></div>'
        + '<button class="btn btn-secondary btn-sm" data-edit="' + esc(it.id) + '" title="Modifier" aria-label="Modifier">✎</button>'
        + '<button class="btn btn-secondary btn-sm" data-del="' + esc(it.id) + '" title="Supprimer" aria-label="Supprimer">🗑</button>'
        + '</div>'
      ).join('')
      + '</div>'
      + '<button class="btn btn-secondary btn-sm" data-add="' + g + '" style="width:100%;justify-content:center;margin-top:6px;" data-testid="audit-add-' + g + '">＋ Ajouter un élément</button>'
      + '</div></div>';
  });

  h += '</div>';
  shell().innerHTML = h;
  bind();
}

function bind() {
  shell().querySelectorAll('[data-toggle]').forEach((cb) => {
    cb.addEventListener('change', async () => {
      S.items = toggleAuditItem(S.items, cb.dataset.toggle);
      try { await saveAudit(S.items); } catch (e) { toast('Sauvegarde impossible : ' + errMsg(e), 'error'); }
      render();
    });
  });
  shell().querySelectorAll('[data-add]').forEach((b) => {
    b.addEventListener('click', () => openForm(null, b.dataset.add));
  });
  shell().querySelectorAll('[data-edit]').forEach((b) => {
    b.addEventListener('click', () => openForm(b.dataset.edit, null));
  });
  shell().querySelectorAll('[data-del]').forEach((b) => {
    b.addEventListener('click', async () => {
      if (b.dataset.armed) {
        S.items = deleteAuditItem(S.items, b.dataset.del);
        try { await saveAudit(S.items); toast('Élément supprimé.', 'success'); }
        catch (e) { toast('Suppression impossible : ' + errMsg(e), 'error'); }
        render();
      } else {
        b.dataset.armed = '1';
        b.textContent = 'Confirmer ?';
        setTimeout(() => { if (document.body.contains(b)) { delete b.dataset.armed; b.textContent = '🗑'; } }, 2500);
      }
    });
  });
}

function openForm(id, group) {
  const it = id ? S.items.find((x) => x.id === id) : null;
  const g = it ? it.group : group;
  let root = $('#auditModalRoot');
  if (!root) { root = document.createElement('div'); root.id = 'auditModalRoot'; shell().appendChild(root); }
  root.innerHTML =
    '<div class="modal-overlay active" id="auditOverlay"><div class="modal" role="dialog" aria-modal="true" data-testid="audit-modal">'
    + '<h3 class="modal-title">' + (it ? 'Modifier l’élément' : 'Nouvel élément') + '</h3>'
    + '<p class="modal-desc">' + esc(AUDIT_GROUPS[g]) + '</p>'
    + '<label style="font-size:12px;">Titre*<input id="am-title" class="form-input" value="' + esc(it ? it.title : '') + '" maxlength="120"></label>'
    + '<label style="font-size:12px;">Note (optionnel)<input id="am-note" class="form-input" value="' + esc(it ? it.note : '') + '" maxlength="200"></label>'
    + '<label style="font-size:12px;">Priorité<select id="am-prio" class="form-input">'
    + ['high', 'medium', 'low'].map((p) =>
      '<option value="' + p + '"' + ((it ? it.priority : 'medium') === p ? ' selected' : '') + '>'
      + esc(AUDIT_PRIO[p]) + '</option>').join('')
    + '</select></label>'
    + '<div class="modal-actions">'
    + '<button class="btn btn-secondary" id="amCancel">Annuler</button>'
    + '<button class="btn btn-primary" id="amSave">Enregistrer</button>'
    + '</div></div></div>';
  const close = () => { root.innerHTML = ''; };
  $('#amCancel').addEventListener('click', close);
  $('#auditOverlay').addEventListener('click', (ev) => { if (ev.target.id === 'auditOverlay') close(); });
  $('#amSave').addEventListener('click', async () => {
    const title = $('#am-title').value.trim();
    if (!title) { toast('Titre requis.', 'error'); return; }
    const note = $('#am-note').value.trim();
    const priority = $('#am-prio').value;
    try {
      if (it) S.items = updateAuditItem(S.items, id, { title, note, priority });
      else S.items = addAuditItem(S.items, { group: g, title, note, priority });
      await saveAudit(S.items);
      toast('Enregistré.', 'success');
    } catch (e) { toast('Sauvegarde impossible : ' + errMsg(e), 'error'); }
    close();
    render();
  });
}

function errMsg(e) {
  return e instanceof CloudError ? e.message : 'Erreur inattendue.';
}

async function load() {
  S.loading = true; S.error = null;
  shell().innerHTML = '<div class="loading-state">Chargement de l’audit…</div>';
  try {
    const items = await loadAudit();
    S.items = items.length ? items : defaultAuditItems();
    if (!items.length) { try { await saveAudit(S.items); } catch (e) { /* amorçage non bloquant */ } }
    S.loading = false;
    render();
  } catch (e) {
    S.loading = false;
    S.error = errMsg(e);
    shell().innerHTML = errorHtml(S.error);
    const r = $('#auditRetry');
    if (r) r.addEventListener('click', load);
  }
}

export function renderAuditPage() {
  load();
}
