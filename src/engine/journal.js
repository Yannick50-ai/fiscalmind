/**
 * Journal — écritures en partie double (moteur comptable FiscalMind Africa).
 *
 * Modèle canonique (objet "pièce") :
 *   { id, date: 'AAAA-MM-JJ', journal: 'AC', piece: 'AC2025-0001',
 *     libelle: '...', lignes: [{ compte: '601', debit: 1000000, credit: 0 }, ...] }
 *
 * Règles de validation (contrôles de saveEntry, fiscalmind-app.html ~ligne 4964,
 * DURCIS pour la migration — voir NOTES.md) :
 *  - date et libellé obligatoires ;
 *  - compte : 2 à 6 chiffres ET présent au plan comptable SYSCOHADA révisé
 *    (isValidAccount) — le plan complet (1421 lignes) remplace l'ancien
 *    contrôle qui acceptait tout numéro de 2 à 6 chiffres ;
 *  - montants positifs, entiers (arrondis comme dans le source) ;
 *  - chaque ligne porte UN SEUL montant (débit XOR crédit) ;
 *  - CONTRÔLE PARTIE DOUBLE : total débits = total crédits.
 *
 * Différence assumée avec le source (voir NOTES.md) : le source stocke des
 * lignes isolées {d,j,p,c,lib,debit,credit} et ne contrôle l'équilibre que si
 * la pièce est renseignée. Ici l'écriture EST la pièce : l'équilibre est
 * toujours exigé. `flattenEntry` / `toLines` fournissent la vue "lignes"
 * utilisée par les modules de calcul (balance, grand livre, états).
 */

import { isValidAccount } from './chart-of-accounts.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Identifiant d'écriture — port fidèle de fmNewEntryId (~ligne 4895). */
export function newEntryId() {
  return 'e' + Date.now().toString(36) + Math.floor(Math.random() * 9999);
}

function isRealDate(iso) {
  if (!DATE_RE.test(iso)) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Valide une écriture (pièce). Retourne { ok, errors[] }.
 * Ne modifie jamais l'écriture passée en argument.
 */
export function validateEntry(entry) {
  const errors = [];
  const e = entry || {};

  if (!e.date || !isRealDate(String(e.date))) errors.push('La date est obligatoire (format AAAA-MM-JJ).');
  if (!String(e.libelle || '').trim()) errors.push('Le libellé est obligatoire.');
  if (!String(e.journal || '').trim()) errors.push('Le code journal est obligatoire.');

  const lignes = Array.isArray(e.lignes) ? e.lignes : [];
  if (lignes.length < 2) {
    errors.push('Une écriture comporte au moins deux lignes (partie double).');
  } else {
    let td = 0, tc = 0;
    lignes.forEach((l, i) => {
      const tag = 'Ligne ' + (i + 1);
      const c = String((l || {}).compte || '');
      if (!/^\d{2,6}$/.test(c)) {
        errors.push(tag + ' : compte invalide — 2 à 6 chiffres (ex. 401, 6611).');
      } else if (!isValidAccount(c)) {
        errors.push(tag + ' : compte ' + c + ' inconnu au plan comptable SYSCOHADA révisé.');
      }
      const debit = Math.round(Number((l || {}).debit) || 0);
      const credit = Math.round(Number((l || {}).credit) || 0);
      if (debit < 0 || credit < 0) errors.push(tag + ' : les montants doivent être positifs.');
      if (!((debit > 0 && credit === 0) || (credit > 0 && debit === 0))) {
        errors.push(tag + ' : renseignez soit le débit, soit le crédit (un seul montant).');
      }
      td += debit; tc += credit;
    });
    if (td === 0 && tc === 0) {
      errors.push('Écriture vide : tous les montants sont à zéro.');
    } else if (td !== tc) {
      errors.push(
        'Écriture déséquilibrée : débits ' + td.toLocaleString('fr-FR') +
        ' F ≠ crédits ' + tc.toLocaleString('fr-FR') + ' F (écart ' +
        Math.abs(td - tc).toLocaleString('fr-FR') + ' F).'
      );
    }
  }
  return { ok: errors.length === 0, errors };
}

function normalizedEntry(entry) {
  const lignes = (entry.lignes || []).map(l => ({
    compte: String(l.compte || ''),
    debit: Math.round(Number(l.debit) || 0),
    credit: Math.round(Number(l.credit) || 0),
    // La lettre de lettrage (moteur lettrage.js) est conservée si présente ;
    // absente sinon, pour ne pas alourdir le format canonique.
    ...(l.lettre ? { lettre: String(l.lettre) } : {})
  }));
  return {
    id: entry.id || newEntryId(),
    date: String(entry.date),
    journal: String(entry.journal || '').trim(),
    piece: String(entry.piece || '').trim(),
    libelle: String(entry.libelle || '').trim(),
    lignes,
    // Traçabilité au document source (Classeur Intelligent) : conservée si présente.
    ...(entry.doc ? { doc: String(entry.doc).slice(0, 120) } : {})
  };
}

/**
 * Ajoute une écriture (immuable : retourne un nouveau tableau).
 * Retourne { ok, errors, entries } — entries inchangé en cas d'échec.
 */
export function addEntry(entries, entry) {
  const v = validateEntry(entry);
  if (!v.ok) return { ok: false, errors: v.errors, entries };
  return { ok: true, errors: [], entries: [...(entries || []), normalizedEntry(entry)] };
}

/**
 * Modifie une écriture (immuable). `patch` peut contenir tout ou partie des
 * champs, y compris `lignes` (remplacées en bloc). L'écriture résultante est
 * revalidée en entier.
 */
export function updateEntry(entries, id, patch) {
  const list = entries || [];
  const idx = list.findIndex(x => x && x.id === id);
  if (idx < 0) return { ok: false, errors: ['Écriture introuvable.'], entries: list };
  const merged = { ...list[idx], ...(patch || {}), id };
  const v = validateEntry(merged);
  if (!v.ok) return { ok: false, errors: v.errors, entries: list };
  const next = list.slice();
  next[idx] = normalizedEntry(merged);
  return { ok: true, errors: [], entries: next };
}

/** Supprime une écriture (immuable). */
export function deleteEntry(entries, id) {
  return (entries || []).filter(x => x && x.id !== id);
}

/**
 * Aplatit une écriture en lignes { id, date, journal, piece, compte, libelle,
 * debit, credit } — correspond au format historique du source
 * ({d,j,p,c,lib,debit,credit}, ~ligne 4432), avec des noms de champs lisibles.
 */
export function flattenEntry(entry) {
  const e = normalizedEntry(entry);
  return e.lignes.map(l => ({
    id: e.id,
    date: e.date,
    journal: e.journal,
    piece: e.piece,
    compte: l.compte,
    libelle: e.libelle,
    debit: l.debit,
    credit: l.credit
  }));
}

/** Aplatit tout un journal d'écritures en lignes (vue utilisée par les calculs). */
export function toLines(entries) {
  return (entries || []).flatMap(flattenEntry);
}

/**
 * Convertit une ligne au format historique {d,j,p,c,lib,debit,credit}
 * vers le format canonique (regroupement par pièce ; les lignes sans pièce
 * deviennent chacune une écriture — voir NOTES.md).
 */
export function fromLegacyLines(legacyLines) {
  const groups = new Map();
  const singles = [];
  for (const l of legacyLines || []) {
    const key = (l.p && l.j) ? l.j + '|' + l.p : null;
    const line = {
      compte: String(l.c || ''),
      debit: Math.round(Number(l.debit) || 0),
      credit: Math.round(Number(l.credit) || 0)
    };
    if (key) {
      if (!groups.has(key)) {
        groups.set(key, {
          id: l.id, date: l.d, journal: l.j, piece: l.p,
          libelle: l.lib, lignes: []
        });
      }
      const g = groups.get(key);
      g.lignes.push(line);
      if (g.libelle !== l.lib && l.lib) g.libelle = g.libelle || l.lib;
    } else {
      singles.push({
        id: l.id, date: l.d, journal: l.j, piece: l.p || '',
        libelle: l.lib, lignes: [line]
      });
    }
  }
  return [...groups.values(), ...singles];
}
