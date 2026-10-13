/**
 * Plan comptable SYSCOHADA — module de gestion (12/10/2026).
 * Permet de consulter, ajouter, modifier, supprimer des comptes,
 * et de gérer les sous-comptes tiers (clients/fournisseurs).
 * Les personnalisations sont stockées dans fm_settings (clé `plan_comptable_custom`).
 */

import { ACCOUNTS, CLASSES, getAccount, registerSubAccount } from '../../../src/engine/chart-of-accounts.js';
import { getSetting, setSetting, loadTiers } from '../store.js';
import { esc, toast, confirmDialog } from '../ui.js';

function shell() { return document.getElementById('appMain'); }

const CUSTOM_KEY = 'plan_comptable_custom';

const S = {
  custom: { added: {}, modified: {}, hidden: [] }, // {added: {num: {intitule, sens}}, modified: {num: {intitule}}, hidden: [num]}
  tiers: [], // sous-comptes clients/fournisseurs (13/10/2026)
  search: '',
  classe: '',
  type: '', // '', 'clients', 'fournisseurs', 'tiers', 'tresorerie', etc.
  showAddForm: false,
  editingNum: null,
};

/* ------------------------------------------------------------------ */
/* Chargement / sauvegarde                                            */
/* ------------------------------------------------------------------ */

async function loadCustom() {
  try {
    const c = await getSetting(CUSTOM_KEY);
    if (c && typeof c === 'object') {
      S.custom = {
        added: c.added || {},
        modified: c.modified || {},
        hidden: c.hidden || [],
      };
    }
  } catch (e) { /* pas de personnalisation */ }
}

async function saveCustom() {
  await setSetting(CUSTOM_KEY, S.custom);
}

/** Retourne le plan fusionné : base + ajouts - masqués + intitulés modifiés + sous-comptes tiers. */
function getMergedPlan() {
  const plan = {};
  for (const [num, acc] of Object.entries(ACCOUNTS)) {
    if (S.custom.hidden.includes(num)) continue;
    const mod = S.custom.modified[num];
    plan[num] = mod ? { ...acc, intitule: mod.intitule } : acc;
  }
  for (const [num, acc] of Object.entries(S.custom.added)) {
    plan[num] = acc;
  }
  // Sous-comptes des tiers (clients/fournisseurs créés depuis le Classeur) — 13/10/2026
  for (const t of (S.tiers || [])) {
    if (t.compte && t.nom && !plan[t.compte]) {
      plan[t.compte] = {
        intitule: (t.type === 'C' ? 'Clients — ' : 'Fournisseurs — ') + t.nom,
        sens: t.type === 'C' ? 'D' : 'C',
        tiers: true,
      };
    }
  }
  return plan;
}

/* ------------------------------------------------------------------ */
/* Rendu                                                              */
/* ------------------------------------------------------------------ */

function typeOfAccount(num) {
  if (num.startsWith('411')) return 'clients';
  if (num.startsWith('401')) return 'fournisseurs';
  if (num.startsWith('41') || num.startsWith('40') || num.startsWith('42') || num.startsWith('43') || num.startsWith('44') || num.startsWith('45') || num.startsWith('46') || num.startsWith('47')) return 'tiers';
  if (num.startsWith('52') || num.startsWith('57')) return 'tresorerie';
  return 'autres';
}

function typeLabel(t) {
  return { clients: '👤 Clients', fournisseurs: '🏭 Fournisseurs', tiers: '🤝 Tiers', tresorerie: '💰 Trésorerie', autres: '📦 Autres' }[t] || t;
}

function filteredAccounts() {
  const plan = getMergedPlan();
  const q = S.search.trim().toLowerCase();
  return Object.entries(plan)
    .filter(([num, acc]) => {
      if (S.classe && !num.startsWith(S.classe)) return false;
      if (S.type && typeOfAccount(num) !== S.type) return false;
      if (q && !num.includes(q) && !(acc.intitule || '').toLowerCase().includes(q)) return false;
      return true;
    })
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
}

function render() {
  const accounts = filteredAccounts();
  const plan = getMergedPlan();
  const total = Object.keys(plan).length;

  let h = '<div data-testid="plan-comptable-page">'
    + '<div class="page-head"><h2 class="page-title">📖 Plan comptable</h2>'
    + '<p class="page-sub">SYSCOHADA révisé — ' + total + ' comptes · personnalisable</p></div>'

    // Barre de recherche + filtres
    + '<div class="card" style="margin-bottom:12px;"><div class="card-body">'
    + '<input class="form-input" id="pcSearch" placeholder="🔍 Rechercher un n° ou un intitulé…" value="' + esc(S.search) + '" style="margin-bottom:8px;">'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
    + '<select class="form-input" id="pcClasse" style="flex:1;min-width:120px;">'
    + '<option value="">Toutes les classes</option>'
    + Object.entries(CLASSES).map(([c, label]) => '<option value="' + c + '"' + (S.classe === c ? ' selected' : '') + '>' + c + ' — ' + esc(label.split(' ').slice(0, 3).join(' ')) + '</option>').join('')
    + '</select>'
    + '<select class="form-input" id="pcType" style="flex:1;min-width:120px;">'
    + '<option value="">Tous les types</option>'
    + '<option value="clients"' + (S.type === 'clients' ? ' selected' : '') + '>👤 Clients</option>'
    + '<option value="fournisseurs"' + (S.type === 'fournisseurs' ? ' selected' : '') + '>🏭 Fournisseurs</option>'
    + '<option value="tiers"' + (S.type === 'tiers' ? ' selected' : '') + '>🤝 Tiers</option>'
    + '<option value="tresorerie"' + (S.type === 'tresorerie' ? ' selected' : '') + '>💰 Trésorerie</option>'
    + '</select>'
    + '</div>'
    + '<button class="btn btn-primary" id="pcAddBtn" style="width:100%;margin-top:8px;justify-content:center;">+ Ajouter un compte</button>'
    + '</div></div>';

  // Formulaire d'ajout
  if (S.showAddForm) {
    h += '<div class="card" style="margin-bottom:12px;"><div class="card-body">'
      + '<h3 class="card-title">➕ Nouveau compte</h3>'
      + '<div class="form-grid-2">'
      + '<label style="font-size:11px;">N° de compte<input class="form-input" id="pcNewNum" inputmode="numeric" placeholder="ex. 411007"></label>'
      + '<label style="font-size:11px;">Sens<select class="form-input" id="pcNewSens"><option value="D">Débit</option><option value="C">Crédit</option><option value="">Mixte</option></select></label>'
      + '</div>'
      + '<label style="font-size:11px;">Intitulé<input class="form-input" id="pcNewLabel" placeholder="ex. Client — Nom de l\'entreprise"></label>'
      + '<div style="display:flex;gap:8px;margin-top:8px;">'
      + '<button class="btn btn-secondary" id="pcCancelAdd" style="flex:1;justify-content:center;">Annuler</button>'
      + '<button class="btn btn-primary" id="pcSaveAdd" style="flex:2;justify-content:center;">Enregistrer</button>'
      + '</div></div></div>';
  }

  // Liste des comptes
  h += '<div class="card"><div class="card-body">'
    + '<h3 class="card-title" style="margin-bottom:8px;">' + accounts.length + ' compte(s)</h3>';

  if (!accounts.length) {
    h += '<p class="muted-sm">Aucun compte trouvé.</p>';
  } else {
    // Grouper par classe pour l'affichage
    let lastClasse = '';
    accounts.slice(0, 200).forEach(([num, acc]) => {
      const classe = num.charAt(0);
      if (classe !== lastClasse) {
        lastClasse = classe;
        h += '<div style="font-weight:700;font-size:12px;color:var(--primary);margin:10px 0 4px;">Classe ' + classe + ' — ' + esc((CLASSES[classe] || '').split('—')[0]) + '</div>';
      }
      const isCustom = S.custom.added[num];
      const isModified = S.custom.modified[num];
      h += '<div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);">'
        + '<strong style="font-size:13px;flex:none;min-width:64px;">' + esc(num) + '</strong>'
        + '<span style="flex:1;min-width:0;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(acc.intitule || '')
        + (isCustom ? ' <span class="badge-ok" style="font-size:10px;">perso</span>' : '')
        + (isModified ? ' <span class="badge-ok" style="font-size:10px;">modifié</span>' : '')
        + '</span>'
        + '<span class="muted-sm" style="flex:none;">' + (acc.sens || '—') + '</span>'
        + '<button class="btn btn-secondary" data-pc-edit="' + esc(num) + '" style="flex:none;padding:4px 8px;font-size:12px;">✏️</button>'
        + '<button class="btn btn-secondary" data-pc-del="' + esc(num) + '" style="flex:none;padding:4px 8px;font-size:12px;color:#dc2626;">🗑️</button>'
        + '</div>';
    });
    if (accounts.length > 200) {
      h += '<p class="muted-sm" style="margin-top:8px;">… et ' + (accounts.length - 200) + ' autres (affinez la recherche)</p>';
    }
  }

  h += '</div></div></div>';
  shell().innerHTML = h;
  bind();
}

function bind() {
  const search = document.getElementById('pcSearch');
  if (search) search.addEventListener('input', (e) => { S.search = e.target.value; render(); });
  const classe = document.getElementById('pcClasse');
  if (classe) classe.addEventListener('change', (e) => { S.classe = e.target.value; render(); });
  const type = document.getElementById('pcType');
  if (type) type.addEventListener('change', (e) => { S.type = e.target.value; render(); });

  const addBtn = document.getElementById('pcAddBtn');
  if (addBtn) addBtn.addEventListener('click', () => { S.showAddForm = true; S.editingNum = null; render(); });
  const cancelAdd = document.getElementById('pcCancelAdd');
  if (cancelAdd) cancelAdd.addEventListener('click', () => { S.showAddForm = false; render(); });
  const saveAdd = document.getElementById('pcSaveAdd');
  if (saveAdd) saveAdd.addEventListener('click', saveNewAccount);

  shell().querySelectorAll('[data-pc-edit]').forEach((b) =>
    b.addEventListener('click', () => editAccount(b.dataset.pcEdit)));
  shell().querySelectorAll('[data-pc-del]').forEach((b) =>
    b.addEventListener('click', () => deleteAccount(b.dataset.pcDel)));
}

/* ------------------------------------------------------------------ */
/* Actions                                                            */
/* ------------------------------------------------------------------ */

async function saveNewAccount() {
  const num = (document.getElementById('pcNewNum').value || '').trim();
  const intitule = (document.getElementById('pcNewLabel').value || '').trim();
  const sens = document.getElementById('pcNewSens').value;
  if (!num || !intitule) { toast('N° et intitulé obligatoires.', 'error'); return; }
  if (!/^\d+$/.test(num)) { toast('Le n° de compte ne doit contenir que des chiffres.', 'error'); return; }
  const plan = getMergedPlan();
  if (plan[num]) { toast('Ce compte existe déjà.', 'error'); return; }
  S.custom.added[num] = { intitule, sens };
  // Si c'était masqué, le démasquer
  S.custom.hidden = S.custom.hidden.filter((n) => n !== num);
  await saveCustom();
  S.showAddForm = false; S.search = num;
  toast('Compte ' + num + ' ajouté.', 'success');
  render();
}

async function editAccount(num) {
  const plan = getMergedPlan();
  const acc = plan[num];
  if (!acc) return;
  const nouveau = window.prompt('Nouvel intitulé pour le compte ' + num + ' :', acc.intitule);
  if (nouveau === null) return; // annulé
  const intitule = nouveau.trim();
  if (!intitule) { toast('Intitulé vide — non modifié.', 'error'); return; }
  if (S.custom.added[num]) {
    S.custom.added[num].intitule = intitule;
  } else {
    S.custom.modified[num] = { intitule };
  }
  await saveCustom();
  toast('Compte ' + num + ' modifié.', 'success');
  render();
}

async function deleteAccount(num) {
  const isCustom = !!S.custom.added[num];
  const title = isCustom ? 'Supprimer le compte ' + num + ' ?' : 'Masquer le compte ' + num + ' ?';
  const msg = isCustom
    ? 'Suppression définitive.'
    : 'Le compte sera masqué du plan.\n(Il reste dans la référence SYSCOHADA)';
  if (!await confirmDialog(title, msg, { okLabel: isCustom ? 'Supprimer' : 'Masquer', danger: true })) return;
  if (isCustom) {
    delete S.custom.added[num];
  } else {
    if (!S.custom.hidden.includes(num)) S.custom.hidden.push(num);
    delete S.custom.modified[num];
  }
  await saveCustom();
  toast(isCustom ? 'Compte supprimé.' : 'Compte masqué.', 'success');
  render();
}

/* ------------------------------------------------------------------ */
/* API publique                                                       */
/* ------------------------------------------------------------------ */

async function load() {
  shell().innerHTML = '<div class="loading-state">Chargement du plan comptable…</div>';
  await loadCustom();
  // Charger les tiers pour afficher leurs sous-comptes (13/10/2026)
  try {
    S.tiers = await loadTiers();
    for (const t of (S.tiers || [])) {
      if (t.compte && t.nom) {
        registerSubAccount(t.compte, (t.type === 'C' ? 'Clients — ' : 'Fournisseurs — ') + t.nom);
      }
    }
  } catch (e) { S.tiers = []; }
  render();
}

export function renderPlanComptablePage() {
  load();
}

/** Retourne l'intitulé personnalisé d'un compte (ou celui du plan standard). */
export function getAccountLabel(num) {
  if (S.custom.added[num]) return S.custom.added[num].intitule;
  if (S.custom.modified[num]) return S.custom.modified[num].intitule;
  // Sous-comptes tiers
  const t = (S.tiers || []).find((x) => x.compte === String(num));
  if (t) return (t.type === 'C' ? 'Clients — ' : 'Fournisseurs — ') + t.nom;
  try {
    const acc = getAccount(String(num));
    if (acc && acc.intitule) return acc.intitule;
  } catch (e) { /* repli */ }
  const acc = ACCOUNTS[num];
  return acc ? acc.intitule : '';
}

/** Vérifie qu'un compte existe (standard, personnalisé ou sous-compte enregistré). */
export function accountExists(num) {
  return !!(ACCOUNTS[num] || S.custom.added[num]);
}
