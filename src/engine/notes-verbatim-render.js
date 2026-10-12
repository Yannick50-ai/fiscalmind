/**
 * FiscalMind Africa — Moteur de rendu VERBATIM des notes annexes.
 *
 * Prend les structures officielles de notes-verbatim.js et les remplit
 * avec les données calculées depuis la balance (via previousYearBalances).
 *
 * Chaque ligne verbatim avec `comptes: [...]` est calculée directement
 * depuis la balance par préfixe de compte. Les lignes sans `comptes`
 * (headers, sous-totaux) sont agrégées ou laissées à zéro.
 */

import { previousYearBalances } from './previous-year.js';
import { sumPrefixes, variationPct } from './notes.js';
import { getNoteVerbatim, NOTES_VERBATIM } from './notes-verbatim.js';

const nz = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Calcule les valeurs N / N-1 pour une liste de préfixes de comptes.
 * @param {Object} bal balance de previousYearBalances
 * @param {Array<string>} prefixes
 * @param {'cumul'|'mouv'} source
 * @param {'abs'|'md'|'mc'} champ
 */
function calcSoldes(bal, prefixes, source = 'cumul', champ = 'abs') {
  if (!prefixes || !prefixes.length) return { n: 0, n1: 0, varPct: null };
  const pick = (v) => (champ === 'md' ? v.md : champ === 'mc' ? v.mc : Math.abs(v.solde));
  const n = pick(sumPrefixes(source === 'cumul' ? bal.cumulN : bal.mouvN, prefixes));
  const n1 = pick(sumPrefixes(source === 'cumul' ? bal.cumulN1 : bal.mouvN1, prefixes));
  return { n: nz(n), n1: nz(n1), varPct: variationPct(n, n1) };
}

/**
 * Calcule les mouvements Ouverture / + / − / Clôture pour des préfixes.
 */
function calcMouvements(bal, prefixes) {
  if (!prefixes || !prefixes.length) return { ouverture: 0, plus: 0, moins: 0, cloture: 0 };
  const ouv = sumPrefixes(bal.cumulN1, prefixes);
  const mouv = sumPrefixes(bal.mouvN, prefixes);
  const ouverture = nz(ouv.solde);
  const plus = nz(mouv.md);
  const moins = nz(mouv.mc);
  return { ouverture, plus, moins, cloture: ouverture + plus - moins };
}

/**
 * Détermine la source (cumul/mouv) et le champ selon le numéro de note.
 * Notes 1-20 : bilan (cumul, abs). Notes 21-33 : résultat (mouv).
 */
function inferSourceChamp(numero) {
  const num = String(numero);
  // Notes de résultat (charges/produits) : mouvements
  if (/^(21|22|23|24|25|26|27A|29|30|32|33)$/.test(num)) {
    return { source: 'mouv', champ: num === '21' || num === '29' || num === '30' || num === '32' ? 'mc' : 'md' };
  }
  return { source: 'cumul', champ: 'abs' };
}

/**
 * Remplit les lignes d'une section/table avec les données calculées.
 * @param {Array} lignesDef définitions verbatim
 * @param {Object} bal balance
 * @param {string} pattern 'comparatif' | 'mouvement'
 * @param {Object} srcChamp { source, champ }
 * @returns {Array} lignes remplies
 */
function fillLignes(lignesDef, bal, pattern, srcChamp) {
  const filled = [];
  let subtotalAcc = null;

  for (const def of lignesDef) {
    if (def.header) {
      // Réinitialise l'accumulateur de sous-total à chaque header
      subtotalAcc = { n: 0, n1: 0, ouverture: 0, plus: 0, moins: 0, cloture: 0 };
      filled.push({ ...def, isHeader: true });
      continue;
    }
    if (def.subtotal) {
      const vals = subtotalAcc || { n: 0, n1: 0, ouverture: 0, plus: 0, moins: 0, cloture: 0 };
      if (pattern === 'mouvement') {
        filled.push({ ...def, isSubtotal: true, ...vals, cloture: vals.ouverture + vals.plus - vals.moins });
      } else {
        filled.push({ ...def, isSubtotal: true, n: vals.n, n1: vals.n1, varPct: variationPct(vals.n, vals.n1) });
      }
      subtotalAcc = { n: 0, n1: 0, ouverture: 0, plus: 0, moins: 0, cloture: 0 };
      continue;
    }
    if (def.total) {
      // Total = somme de toutes les lignes de données (non-header)
      const dataLines = filled.filter((l) => !l.isHeader && !l.isSubtotal && !l.isTotal);
      const sum = (k) => dataLines.reduce((a, l) => a + (nz(l[k])), 0);
      if (pattern === 'mouvement') {
        const ouverture = sum('ouverture'), plus = sum('plus'), moins = sum('moins');
        filled.push({ ...def, isTotal: true, ouverture, plus, moins, cloture: ouverture + plus - moins });
      } else {
        const n = sum('n'), n1 = sum('n1');
        filled.push({ ...def, isTotal: true, n, n1, varPct: variationPct(n, n1) });
      }
      continue;
    }
    // Ligne de données normale
    let vals;
    if (pattern === 'mouvement') {
      vals = calcMouvements(bal, def.comptes);
    } else {
      vals = calcSoldes(bal, def.comptes, srcChamp.source, srcChamp.champ);
      // Ajuste le champ pour les produits (mc) vs charges (md) dans les sections mixtes
      if (def.comptes && def.comptes.some((c) => /^[678]/.test(c)) && srcChamp.source === 'mouv') {
        // Laisse le champ inféré
      }
    }
    filled.push({ ...def, ...vals });
    // Accumule pour sous-total
    if (subtotalAcc) {
      for (const k of ['n', 'n1', 'ouverture', 'plus', 'moins', 'cloture']) {
        if (vals[k] !== undefined) subtotalAcc[k] += nz(vals[k]);
      }
    }
  }
  return filled;
}

/**
 * Construit le modèle de rendu verbatim pour une note.
 * @param {string} numero
 * @param {Array} entries écritures
 * @param {number} year année
 * @returns {Object|null} { numero, titre, pattern, tables: [...], pied, note, champs }
 *   tables: [{ titre?, colonnes: [...], lignes: [...] }]
 */
export function buildVerbatimNote(numero, entries, year) {
  const def = getNoteVerbatim(numero);
  if (!def) return null;

  const bal = previousYearBalances(entries, { year });
  const srcChamp = inferSourceChamp(numero);
  const result = {
    numero: def.numero,
    titre: def.titre,
    pattern: def.pattern,
    pied: def.pied || '',
    note: def.note || '',
    tables: [],
    champs: def.champs || null,
  };

  if (def.pattern === 'texte') {
    // Pas de table, juste les champs manuels
    if (def.tableau) {
      result.tables.push({
        colonnes: def.tableau.colonnes,
        lignes: def.tableau.lignes.map((l) => ({ ...l, cells: ['', '', '', ''] })),
      });
    }
    return result;
  }

  if (def.sections) {
    // Plusieurs tables (ex. N5, N12, N16B, N29, N30)
    for (const sec of def.sections) {
      const pattern = def.pattern === 'mouvement' ? 'mouvement' : 'comparatif';
      const lignes = fillLignes(sec.lignes, bal, pattern, srcChamp);
      result.tables.push({
        titre: sec.titre,
        colonnes: sec.colonnes || def.colonnes || ['Exercice N', 'Exercice N-1', 'Variation en %'],
        lignes,
        pattern,
      });
    }
    return result;
  }

  // Table unique
  const pattern = def.pattern === 'mouvement' ? 'mouvement' : 'comparatif';
  const lignes = fillLignes(def.lignes || [], bal, pattern, srcChamp);
  result.tables.push({
    colonnes: def.colonnes || ['Exercice N', 'Exercice N-1', 'Variation en %'],
    colonnesSup: def.colonnesSup || null,
    lignes,
    pattern,
  });

  // Tableau secondaire (ex. N4 liste des filiales)
  if (def.tableau2) {
    result.tables.push({
      titre: def.tableau2.titre,
      colonnes: def.tableau2.colonnes,
      lignes: [],
      note: def.tableau2.note || '',
      isSecondary: true,
    });
  }

  return result;
}

/**
 * Liste des numéros avec rendu verbatim disponible.
 */
export function verbatimDisponible() {
  return Object.keys(NOTES_VERBATIM);
}
