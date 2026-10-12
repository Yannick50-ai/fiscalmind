/**
 * FiscalMind Africa — Audit Readiness : checklists de contrôle fiscal (pur).
 *
 * Port des constantes de fiscalmind-app.html (AUDIT_GROUPS, AUDIT_DEFAULTS,
 * AUDIT_PRIO). 100 % pur : la persistance vit dans fmCloud (table fm_audit).
 * Élément : { id, group, title, priority: 'high'|'medium'|'low', note, done }.
 */

export const AUDIT_GROUPS = {
  legal: '📁 Documents légaux',
  fin: '📊 États financiers',
  fisc: '🏛️ Obligations fiscales',
  ctrl: '🔒 Contrôles internes',
};

export const AUDIT_PRIO = { high: 'Critique', medium: 'Important', low: 'Optionnel' };

/** Modèle de départ (tous non cochés — pas de données d'exemple imposées). */
export const AUDIT_DEFAULTS = [
  { group: 'legal', title: 'RCCM à jour', priority: 'high', note: '' },
  { group: 'legal', title: "Attestation d'identification fiscale (IFU)", priority: 'high', note: '' },
  { group: 'legal', title: 'Contrat de bail ou titre foncier', priority: 'medium', note: '' },
  { group: 'legal', title: 'Statuts et PV d’assemblées générales', priority: 'medium', note: '' },
  { group: 'fin', title: 'Bilan N et N-1', priority: 'high', note: '' },
  { group: 'fin', title: 'Compte de résultat N et N-1', priority: 'high', note: '' },
  { group: 'fin', title: 'TAFIRE (Tableau des flux)', priority: 'high', note: '' },
  { group: 'fin', title: 'Notes annexes complètes', priority: 'medium', note: '' },
  { group: 'fisc', title: 'Déclarations TVA mensuelles', priority: 'high', note: '' },
  { group: 'fisc', title: 'Acomptes provisionnels IS', priority: 'high', note: '' },
  { group: 'fisc', title: 'Taxe minimum forfaitaire (TMF)', priority: 'high', note: '' },
  { group: 'fisc', title: 'Déclarations IUTS et patronales', priority: 'medium', note: '' },
  { group: 'fisc', title: 'DSF (Déclaration statistique et fiscale)', priority: 'high', note: '' },
  { group: 'ctrl', title: 'Procédures de validation des factures', priority: 'medium', note: '' },
  { group: 'ctrl', title: 'Séparation des fonctions (achat/paiement)', priority: 'high', note: '' },
  { group: 'ctrl', title: 'Inventaire physique vs comptable', priority: 'high', note: '' },
  { group: 'ctrl', title: 'Rapprochements bancaires', priority: 'medium', note: '' },
];

/** Fabrique les éléments initiaux (ids stables, tous non cochés). */
export function defaultAuditItems() {
  return AUDIT_DEFAULTS.map((d, i) => ({
    id: 'a' + (i + 1),
    group: d.group,
    title: d.title,
    priority: d.priority,
    note: d.note,
    done: false,
  }));
}

function validPriority(p) {
  return p === 'high' || p === 'medium' || p === 'low' ? p : 'medium';
}

/** Nettoie un élément saisi par l'utilisateur (immuable). */
export function sanitizeAuditItem(raw) {
  const r = raw || {};
  return {
    id: String(r.id || 'a' + Date.now().toString(36)),
    group: AUDIT_GROUPS[r.group] ? r.group : 'ctrl',
    title: String(r.title || '').trim().slice(0, 120),
    priority: validPriority(r.priority),
    note: String(r.note || '').trim().slice(0, 200),
    done: !!r.done,
  };
}

/** Bascule un élément (immuable). */
export function toggleAuditItem(items, id) {
  return (items || []).map((it) => (it.id === id ? { ...it, done: !it.done } : it));
}

/** Ajoute un élément (immuable). */
export function addAuditItem(items, raw) {
  return (items || []).concat([sanitizeAuditItem(raw)]);
}

/** Met à jour un élément (immuable). */
export function updateAuditItem(items, id, patch) {
  return (items || []).map((it) =>
    it.id === id ? sanitizeAuditItem({ ...it, ...patch, id }) : it
  );
}

/** Supprime un élément (immuable). */
export function deleteAuditItem(items, id) {
  return (items || []).filter((it) => it.id !== id);
}

/** Éléments d'un groupe. */
export function itemsOfGroup(items, group) {
  return (items || []).filter((it) => it.group === group);
}

/**
 * Avancement : { done, total, percent } — global ou par groupe.
 */
export function auditProgress(items, group) {
  const list = group ? itemsOfGroup(items, group) : items || [];
  const total = list.length;
  const done = list.filter((it) => it.done).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}
