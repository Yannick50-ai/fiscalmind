/**
 * Soldes N / N-1 — infrastructure transverse Phase 0 (moteur comptable
 * FiscalMind Africa).
 *
 * Prérequis pour les phases Bilan / Compte de résultat / TFT : ces états
 * affichent des colonnes N et N-1 (cf. analyse-dsf-ohada.md §0 et §4) :
 *   - Bilan    : soldes cumulés au 31/12 (classes 1-5) de N et de N-1 ;
 *   - Résultat : mouvements de l'exercice (classes 6/7/8) de N et de N-1 ;
 *   - TFT      : variations = soldes N − soldes N-1 par poste.
 *
 * `previousYearBalances(entries, { year })` calcule les quatre vues en un
 * seul appel, à partir des écritures au format canonique
 * { id, date, journal, piece, libelle, lignes: [{ compte, debit, credit }] }.
 *
 * HYPOTHÈSE STRUCTURANTE : exercices = année civile (1/1 → 31/12).
 * C'est l'hypothèse du SaaS (aucun exercice à cheval n'est géré ici) ;
 * voir le README du moteur et NOTES.md.
 *
 * Pure ES module, zéro dépendance, aucun DOM, aucun localStorage/sessionStorage.
 */

import { toLines } from './journal.js';
import { periodBalances, cumulativeBalances } from './trial-balance.js';

/**
 * Normalise l'entrée : accepte les écritures canoniques (avec `lignes`)
 * ou directement des lignes plates { date, compte, debit, credit }
 * (utile pour les tests et les appels internes).
 */
function normalizeLines(entries) {
  const list = Array.isArray(entries) ? entries : [];
  if (list.length === 0) return [];
  const first = list[0] || {};
  if (Array.isArray(first.lignes)) return toLines(list);
  return list;
}

function yearRange(year) {
  const y = Number(year);
  if (!Number.isInteger(y)) throw new Error('previousYearBalances : year doit être une année entière (ex. 2025).');
  return y;
}

/**
 * Retourne { year, cumulN, cumulN1, mouvN, mouvN1 } :
 *  - cumulN  : soldes cumulés au 31/12/N, classes 1-5 (format trial-balance) ;
 *  - cumulN1 : soldes cumulés au 31/12/(N-1), classes 1-5 ;
 *  - mouvN   : mouvements de l'exercice N (1/1/N → 31/12/N), toutes classes ;
 *  - mouvN1  : mouvements de l'exercice N-1, toutes classes.
 * Soldes au format { compte: { md, mc, solde } }, solde = md − mc.
 * Ne modifie jamais les écritures passées en argument.
 */
export function previousYearBalances(entries, { year } = {}) {
  const y = yearRange(year);
  const lines = normalizeLines(entries);

  const n1 = String(y - 1);
  const n = String(y);

  return {
    year: y,
    cumulN: cumulativeBalances(lines, { upTo: n + '-12-31' }),
    cumulN1: cumulativeBalances(lines, { upTo: n1 + '-12-31' }),
    mouvN: periodBalances(lines, { from: n + '-01-01', to: n + '-12-31' }),
    mouvN1: periodBalances(lines, { from: n1 + '-01-01', to: n1 + '-12-31' }),
  };
}

/**
 * Variation N − N-1 d'un solde : helper pour le TFT
 * (Δ par poste = soldes N − soldes N-1, cf. analyse-dsf-ohada.md §4).
 * `cumulN` / `cumulN1` au format { compte: { md, mc, solde } }.
 * Retourne { md, mc, solde } pour le compte demandé.
 */
export function accountVariation(cumulN, cumulN1, compte) {
  const c = String(compte || '');
  const a = (cumulN || {})[c] || { md: 0, mc: 0, solde: 0 };
  const b = (cumulN1 || {})[c] || { md: 0, mc: 0, solde: 0 };
  return { md: a.md - b.md, mc: a.mc - b.mc, solde: a.solde - b.solde };
}
