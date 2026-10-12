/**
 * Grand livre (moteur comptable FiscalMind Africa).
 *
 * Port fidèle de fmGrandLivre (~ligne 4468) : lignes d'un compte sur la
 * période, triées par date croissante, avec solde progressif
 * (solde += débit − crédit).
 *
 * Retourne :
 *  { compte, intitule, rows: [{ id, date, journal, piece, libelle,
 *                               debit, credit, solde }],
 *    tot: { debit, credit }, solde }
 */

import { accountLabel } from './labels.js';

/**
 * @param {Array} lines  lignes { id, date, journal, piece, compte, libelle, debit, credit }
 * @param {string} compte numéro de compte (comparaison stricte, comme le source)
 * @param {Object} periode { from, to } dates 'AAAA-MM-JJ' incluses
 */
export function generalLedger(lines, compte, { from, to } = {}) {
  const c = String(compte || '');
  const entries = (lines || [])
    .filter(e => {
      if (String(e.compte || '') !== c) return false;
      const d = String(e.date || '');
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    })
    .sort((a, b) => (a.date < b.date ? -1 : (a.date > b.date ? 1 : 0)));

  let solde = 0;
  const rows = entries.map(e => {
    solde += (e.debit || 0) - (e.credit || 0);
    return {
      id: e.id,
      date: e.date,
      journal: e.journal,
      piece: e.piece,
      libelle: e.libelle,
      debit: e.debit || 0,
      credit: e.credit || 0,
      solde
    };
  });
  const tot = { debit: 0, credit: 0 };
  entries.forEach(e => { tot.debit += e.debit || 0; tot.credit += e.credit || 0; });
  return { compte: c, intitule: accountLabel(c), rows, tot, solde };
}
