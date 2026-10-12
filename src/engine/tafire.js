/**
 * TAFIRE — Tableau financier des ressources et emplois (moteur FiscalMind Africa).
 *
 * Ports fidèles de fiscalmind-app.html :
 *  - balancesBefore  ← fmSoldesAvant      (~ligne 3800) : soldes AVANT le début
 *                      de période (toutes classes, dates < from) ;
 *  - periodMovements ← fmMouvementsPeriode (~ligne 3812) : mouvements
 *                      débit/crédit de la période par compte ;
 *  - bfe             ← fmBFE              (~ligne 3820) : besoin de financement
 *                      d'exploitation — la TVA récupérable sur
 *                      immobilisations (4451) est EXCLUE des créances
 *                      d'exploitation (élément du haut de bilan) ;
 *  - tafireData      ← fmTAFIREData       (~ligne 3830).
 *
 * Le TAFIRE se contrôle lui-même : dTresoCalc (ΔFR − ΔBFE) doit égaler
 * dTresoReel (variation réelle de la trésorerie 51-58).
 */

import { periodBalances } from './trial-balance.js';
import { compteResultatData, sumRubrique } from './financial-statements.js';

const NUM_RE = /^\d+$/;

/** Soldes des écritures strictement antérieures à `from` (toutes classes). */
export function balancesBefore(lines, from) {
  const map = {};
  (lines || []).forEach(e => {
    if (String(e.date || '') >= from) return;
    const c = String(e.compte || '');
    if (!NUM_RE.test(c)) return;
    if (!map[c]) map[c] = { md: 0, mc: 0 };
    map[c].md += e.debit || 0;
    map[c].mc += e.credit || 0;
  });
  Object.keys(map).forEach(c => { map[c].solde = map[c].md - map[c].mc; });
  return map;
}

/** Mouvements de la période par compte : { compte: { md, mc } }. */
export function periodMovements(lines, { from, to } = {}) {
  const map = {};
  (lines || []).forEach(e => {
    const d = String(e.date || '');
    if (from && d < from) return;
    if (to && d > to) return;
    const c = String(e.compte || '');
    if (!NUM_RE.test(c)) return;
    if (!map[c]) map[c] = { md: 0, mc: 0 };
    map[c].md += e.debit || 0;
    map[c].mc += e.credit || 0;
  });
  return map;
}

/**
 * Besoin de financement d'exploitation — port exact de fmBFE :
 * stocks + créances d'exploitation (sens D, HORS 4451) − dettes
 * d'exploitation (sens C). La 4452 (TVA sur achats courants) reste dans le
 * BFE : elle naît du cycle d'exploitation, comme la 443 en dettes.
 */
export function bfe(soldes) {
  const S = soldes || {};
  const stocks = Math.max(0, sumRubrique(S, ['31', '32', '33', '39'], ['39']));
  const sans4451 = Object.fromEntries(Object.entries(S).filter(([c]) => c !== '4451'));
  const cre = Math.max(0, sumRubrique(sans4451, ['41', '42', '43', '44', '45', '46', '47', '48'], null, 'D'));
  const det = Math.max(0, -sumRubrique(S, ['40', '41', '42', '43', '44', '45', '46', '47', '48'], null, 'C'));
  return stocks + cre - det;
}

/**
 * Données du TAFIRE — port fidèle de fmTAFIREData.
 *
 * @param {Array} lines  lignes { date, compte, debit, credit }
 * @param {Object} periode { from, to }
 * @returns { cafg, ebe, prodFin, chFin, prodHAO, chHAO, participation, is,
 *   dBFE, ete, acqImmo, rembDettes, dTvaImmo, emplois, cessions, augCapital,
 *   subventions, nouvEmprunts, ressources, dFR, dTresoCalc, dTresoReel }
 */
export function tafireData(lines, { from, to } = {}) {
  const S = periodBalances(lines, { from, to });
  const cr = compteResultatData(S);
  const P = pfx => -sumRubrique(S, pfx);
  const C = pfx => sumRubrique(S, pfx);
  const prodFin = P(['77']), chFin = C(['67']);
  const prodHAO = P(['84', '86', '88']), chHAO = C(['81', '83', '85']);
  const participation = C(['87']), is = C(['89']);
  const cafg = Math.round(cr.ebe + prodFin - chFin + prodHAO - chHAO - participation - is);

  const S0 = balancesBefore(lines, from || '0000-00-00');
  const dBFE = Math.round(bfe(S) - bfe(S0));
  const ete = cafg - dBFE;

  const mv = periodMovements(lines, { from, to });
  const D = pfx => Object.keys(mv).reduce((a, c) => a + (pfx.some(x => c.indexOf(x) === 0) ? mv[c].md : 0), 0);
  const K = pfx => Object.keys(mv).reduce((a, c) => a + (pfx.some(x => c.indexOf(x) === 0) ? mv[c].mc : 0), 0);

  const acqImmo = Math.round(D(['21', '22', '23', '24', '25', '26', '27']));
  const rembDettes = Math.round(D(['16', '17', '18']));
  // Correctif : la TVA récupérable sur immobilisations (4451) est un emploi
  // stable (haut de bilan), pas du BFE.
  const tvaImmoFin = Math.max(0, (S['4451'] || { solde: 0 }).solde);
  const tvaImmoDeb = Math.max(0, (S0['4451'] || { solde: 0 }).solde);
  const dTvaImmo = Math.round(tvaImmoFin - tvaImmoDeb);
  const cessions = Math.round(K(['21', '22', '23', '24', '25', '26', '27']));
  const augCapital = Math.round(K(['10', '11']));
  const subventions = Math.round(K(['14']));
  const nouvEmprunts = Math.round(K(['16', '17', '18']));

  const emplois = acqImmo + rembDettes + dTvaImmo;
  const ressources = cafg + cessions + augCapital + subventions + nouvEmprunts;
  const dFR = ressources - emplois;
  const dTresoCalc = dFR - dBFE;

  const tFin = sumRubrique(S, ['51', '52', '53', '54', '56', '57', '58']);
  const tDeb = sumRubrique(S0, ['51', '52', '53', '54', '56', '57', '58']);
  const dTresoReel = Math.round(tFin - tDeb);

  return {
    cafg, ebe: Math.round(cr.ebe), prodFin: Math.round(prodFin), chFin: Math.round(chFin),
    prodHAO: Math.round(prodHAO), chHAO: Math.round(chHAO),
    participation: Math.round(participation), is: Math.round(is),
    dBFE, ete, acqImmo, rembDettes, dTvaImmo, emplois, cessions,
    augCapital, subventions, nouvEmprunts, ressources, dFR, dTresoCalc, dTresoReel
  };
}
