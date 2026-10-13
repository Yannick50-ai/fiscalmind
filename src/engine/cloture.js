// FiscalMind Africa — Clôture d'exercice (13/10/2026, inspiré Dolibarr).
// Génère les écritures de clôture SYSCOHADA :
//  1. Soldes des comptes de charges (6) → 131
//  2. Soldes des comptes de produits (7) → 131
//  3. Le compte 131 porte le résultat net (créditeur = bénéfice, débiteur = perte)

import { toLines } from './journal.js';

/**
 * Calcule les écritures de clôture pour un exercice.
 * @param {Array} entries - écritures de l'exercice
 * @param {string} year - année de l'exercice (ex. "2026")
 * @returns {Array} écritures de clôture (format canonique)
 */
export function closingEntries(entries, year) {
  const list = (entries || []).filter((e) => String(e.date || '').slice(0, 4) === String(year));
  const lines = toLines(list);

  // Soldes par compte (classes 6 et 7 uniquement)
  const soldes = {};
  lines.forEach((l) => {
    const c = String(l.compte || '');
    const classe = c.charAt(0);
    if (classe !== '6' && classe !== '7') return;
    if (!soldes[c]) soldes[c] = { compte: c, debit: 0, credit: 0 };
    soldes[c].debit += l.debit || 0;
    soldes[c].credit += l.credit || 0;
  });

  const dateCloture = year + '-12-31';
  const ecritures = [];
  let totalProduits = 0;
  let totalCharges = 0;

  // 1. Clôture des produits (7) : Débit 7xxx / Crédit 131
  Object.values(soldes).forEach((s) => {
    if (s.compte.charAt(0) !== '7') return;
    const solde = s.credit - s.debit; // normalement créditeur
    if (solde === 0) return;
    totalProduits += solde;
    ecritures.push({
      id: 'clot-' + year + '-p-' + s.compte,
      date: dateCloture,
      journal: 'OD',
      piece: 'CLOT' + year,
      libelle: 'Clôture ' + year + ' — ' + s.compte,
      lignes: [
        { compte: s.compte, debit: solde > 0 ? solde : 0, credit: solde < 0 ? -solde : 0 },
        { compte: '131', debit: solde < 0 ? -solde : 0, credit: solde > 0 ? solde : 0 },
      ],
    });
  });

  // 2. Clôture des charges (6) : Crédit 6xxx / Débit 131
  Object.values(soldes).forEach((s) => {
    if (s.compte.charAt(0) !== '6') return;
    const solde = s.debit - s.credit; // normalement débiteur
    if (solde === 0) return;
    totalCharges += solde;
    ecritures.push({
      id: 'clot-' + year + '-c-' + s.compte,
      date: dateCloture,
      journal: 'OD',
      piece: 'CLOT' + year,
      libelle: 'Clôture ' + year + ' — ' + s.compte,
      lignes: [
        { compte: s.compte, debit: solde < 0 ? -solde : 0, credit: solde > 0 ? solde : 0 },
        { compte: '131', debit: solde > 0 ? solde : 0, credit: solde < 0 ? -solde : 0 },
      ],
    });
  });

  const resultat = totalProduits - totalCharges;

  return { ecritures, totalProduits, totalCharges, resultat };
}

/**
 * Écriture d'affectation du résultat (à passer en N+1).
 * Bénéfice : Débit 131 / Crédit 121 (ou 110)
 * Perte : Débit 129 / Crédit 131
 */
export function affectationResultat(resultat, year) {
  const y = String(Number(year) + 1);
  if (resultat === 0) return null;
  const isBenefice = resultat > 0;
  const montant = Math.abs(resultat);
  return {
    id: 'aff-' + y + '-resultat',
    date: y + '-01-01',
    journal: 'AN',
    piece: 'AFF' + y,
    libelle: 'Affectation du résultat ' + year + (isBenefice ? ' (bénéfice)' : ' (perte)'),
    lignes: isBenefice
      ? [
          { compte: '131', debit: montant, credit: 0 },
          { compte: '121', debit: 0, credit: montant },
        ]
      : [
          { compte: '129', debit: montant, credit: 0 },
          { compte: '131', debit: 0, credit: montant },
        ],
  };
}
