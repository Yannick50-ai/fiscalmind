/**
 * Libellés de comptes (moteur comptable FiscalMind Africa).
 *
 * Port fidèle de fmCompteLabel (fiscalmind-app.html, ~ligne 4901) :
 * libellé exact si le compte est au plan, sinon repli sur le compte parent
 * le plus proche (« FOURNISSEURS, DETTES EN COMPTE (s/cpte 401001) »),
 * sinon « Compte NNN ».
 *
 * Utilisé par la balance et le grand livre pour afficher l'intitulé des
 * comptes mouvementés, y compris ceux issus de journaux historiques.
 */

import { getAccount } from './chart-of-accounts.js';

export function accountLabel(numero) {
  const c = String(numero || '');
  const exact = getAccount(c);
  if (exact) return exact.intitule;
  for (let n = c.length - 1; n >= 2; n--) {
    const parent = getAccount(c.slice(0, n));
    if (parent) return parent.intitule + ' (s/cpte ' + c + ')';
  }
  return 'Compte ' + c;
}
