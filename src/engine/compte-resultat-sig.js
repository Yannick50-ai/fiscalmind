/**
 * Compte de résultat aux SIG officiels OHADA — moteur pur, zéro dépendance.
 *
 * Implémente fidèlement la logique du classeur DSF de Yannick
 * (voir migration/analyse-dsf-ohada.md §3 et ANNEXE C) :
 *  - lignes TA→XI avec refs et libellés officiels ;
 *  - produits : sfc − sfd par compte (net des deux sens) ;
 *  - charges  : −sfd (soldes débiteurs uniquement, comme le classeur) ;
 *  - variations de stocks (6031, 6032, 6033) et production stockée (73) :
 *    −(sfd − sfc) par compte ;
 *  - SIG : XA (marge commerciale), XB (chiffre d'affaires), XC (valeur
 *    ajoutée), XD (EBE), XE (résultat d'exploitation), XF (résultat
 *    financier), XG (activités ordinaires), XH (HAO), XI (résultat net) ;
 *  - colonnes N et N-1 calculées sur les MOUVEMENTS de l'exercice
 *    (previous-year.js : mouvN / mouvN1), comme le classeur.
 *
 * `compteResultatSIG(entries, { year })` :
 *  - entries : écritures canoniques { id, date, journal, piece, libelle,
 *    lignes: [{ compte, debit, credit }] } (ou lignes plates) ;
 *  - year    : exercice (année civile, cf. previous-year.js).
 *
 * Retourne :
 *  { year, lignes: [{ ref, label, signe, n, n1, isSig }],
 *    resNet, resNetN1 }
 * `signe` : '+' (produit), '−' (charge), '+/−' (variation), '' (SIG).
 * `isSig` : true pour XA, XB, XC, XD, XE, XF, XG, XH, XI.
 * Le résultat net XI est injectable au bilan modèle 2 (ligne CJ) —
 * cf. bilan-modele2.js (interface lue, fichier non modifié).
 *
 * Pure ES module, aucun DOM, aucun localStorage/sessionStorage.
 */

import { previousYearBalances } from './previous-year.js';

/* ------------------------------------------------------------------ */
/* Sommes par sens (équivalent exact du sfd / sfc du classeur)          */
/* ------------------------------------------------------------------ */

/** Somme des soldes débiteurs (positifs) des comptes dont le n° commence
 *  par l'un des `prefixes`. */
function sfd(soldes, prefixes) {
  let t = 0;
  for (const c of Object.keys(soldes || {})) {
    if (!prefixes.some((p) => c.startsWith(p))) continue;
    const s = soldes[c].solde;
    if (s > 0) t += s;
  }
  return t;
}

/** Somme des soldes créditeurs (en valeur positive) — même filtrage. */
function sfc(soldes, prefixes) {
  let t = 0;
  for (const c of Object.keys(soldes || {})) {
    if (!prefixes.some((p) => c.startsWith(p))) continue;
    const s = soldes[c].solde;
    if (s < 0) t -= s;
  }
  return t;
}

/** Produit : sfc − sfd (net des deux sens). */
const prod = (mouv, prefixes) => sfc(mouv, prefixes) - sfd(mouv, prefixes);
/** Charge : −sfd (comme le classeur : colonne des soldes débiteurs). */
const charge = (mouv, prefixes) => -sfd(mouv, prefixes);
/** Variation de stocks : −(sfd − sfc). */
const variation = (mouv, prefixes) => -(sfd(mouv, prefixes) - sfc(mouv, prefixes));

/* ------------------------------------------------------------------ */
/* Table des lignes (refs officielles — ANNEXE C de l'analyse)          */
/* kind: 'P' produit, 'C' charge, 'V' variation, 'S' SIG (sum de refs)  */
/* ------------------------------------------------------------------ */

const DEFS = [
  { ref: 'TA', note: '21', sousNote: 'A', label: 'Ventes de marchandises', signe: '+', kind: 'P', p: ['701'] },
  { ref: 'RA', note: '22', label: 'Achats de marchandises', signe: '−', kind: 'C', p: ['601'] },
  { ref: 'RB', note: '6', label: 'Variation de stocks de marchandises', signe: '+/−', kind: 'V', p: ['6031'] },
  { ref: 'XA', formule: 'Somme TA à RB', label: 'MARGE COMMERCIALE', kind: 'S', sum: ['TA', 'RA', 'RB'] },
  { ref: 'TB', note: '21', sousNote: 'B', label: 'Ventes de produits fabriqués', signe: '+', kind: 'P', p: ['702', '703', '704'] },
  { ref: 'TC', note: '21', sousNote: 'C', label: 'Travaux, services vendus', signe: '+', kind: 'P', p: ['705', '706'] },
  { ref: 'TD', note: '21', sousNote: 'D', label: 'Produits accessoires', signe: '+', kind: 'P', p: ['707'] },
  { ref: 'XB', formule: 'A + B + C + D', label: "CHIFFRE D'AFFAIRES", kind: 'S', sum: ['TA', 'TB', 'TC', 'TD'] },
  { ref: 'TE', note: '6', label: 'Production stockée (ou déstockage)', signe: '+/−', kind: 'V', p: ['73'] },
  { ref: 'TF', note: '21', label: 'Production immobilisée', signe: '+', kind: 'P', p: ['72'] },
  { ref: 'TG', note: '21', label: "Subventions d'exploitation", signe: '+', kind: 'P', p: ['71'] },
  { ref: 'TH', note: '21', label: 'Autres produits', signe: '+', kind: 'P', p: ['75'] },
  { ref: 'TI', note: '12', label: "Transferts de charges d'exploitation", signe: '+', kind: 'P', p: ['781'] },
  { ref: 'RC', note: '22', label: 'Achats de matières premières et fournitures', signe: '−', kind: 'C', p: ['602'] },
  { ref: 'RD', note: '6', label: 'Variation de stocks de matières premières', signe: '+/−', kind: 'V', p: ['6032'] },
  { ref: 'RE', note: '22', label: 'Autres achats', signe: '−', kind: 'C', p: ['604', '605', '608'] },
  { ref: 'RF', note: '6', label: "Variation de stocks d'autres approvisionnements", signe: '+/−', kind: 'V', p: ['6033'] },
  { ref: 'RG', note: '23', label: 'Transports', signe: '−', kind: 'C', p: ['61'] },
  { ref: 'RH', note: '24', label: 'Services extérieurs', signe: '−', kind: 'C', p: ['62', '63'] },
  { ref: 'RI', note: '25', label: 'Impôts et taxes', signe: '−', kind: 'C', p: ['64'] },
  { ref: 'RJ', note: '26', label: 'Autres charges', signe: '−', kind: 'C', p: ['65'] },
  { ref: 'XC', formule: '(XB + RA + RB) + (somme TE à RJ)', label: 'VALEUR AJOUTÉE', kind: 'S',
    sum: ['XB', 'RA', 'RB', 'TE', 'TF', 'TG', 'TH', 'TI', 'RC', 'RD', 'RE', 'RF', 'RG', 'RH', 'RI', 'RJ'] },
  { ref: 'RK', note: '27', label: 'Charges de personnel', signe: '−', kind: 'C', p: ['66'] },
  { ref: 'XD', formule: 'XC + RK', label: "EXCÉDENT BRUT D'EXPLOITATION", kind: 'S', sum: ['XC', 'RK'] },
  { ref: 'TJ', note: '28', label: "Reprises de provisions d'exploitation", signe: '+', kind: 'P', p: ['791', '798', '799'] },
  { ref: 'RL', note: '3C&28', label: 'Dotations aux amortissements et aux provisions', signe: '−', kind: 'C', p: ['681', '691'] },
  { ref: 'XE', formule: 'XD + TJ + RL', label: "RÉSULTAT D'EXPLOITATION", kind: 'S', sum: ['XD', 'TJ', 'RL'] },
  { ref: 'TK', note: '29', label: 'Revenus financiers et assimilés', signe: '+', kind: 'P', p: ['77'] },
  { ref: 'TL', note: '28', label: 'Reprises de provisions financières', signe: '+', kind: 'P', p: ['797'] },
  { ref: 'TM', note: '12', label: 'Transferts de charges financières', signe: '+', kind: 'P', p: ['787'] },
  { ref: 'RM', note: '29', label: 'Frais financiers et charges assimilées', signe: '−', kind: 'C', p: ['67'] },
  { ref: 'RN', note: '3C&28', label: 'Dotations aux provisions financières', signe: '−', kind: 'C', p: ['697'] },
  { ref: 'XF', formule: 'Somme TK à RN', label: 'RÉSULTAT FINANCIER', kind: 'S', sum: ['TK', 'TL', 'TM', 'RM', 'RN'] },
  { ref: 'XG', formule: 'XE + XF', label: 'RÉSULTAT DES ACTIVITÉS ORDINAIRES', kind: 'S', sum: ['XE', 'XF'] },
  { ref: 'TN', note: '3D', label: "Produits des cessions d'immobilisations", signe: '+', kind: 'P', p: ['82'] },
  { ref: 'TO', note: '30', label: 'Autres produits HAO', signe: '+', kind: 'P', p: ['84', '86', '88'] },
  { ref: 'RO', note: '3D', label: "Valeurs comptables des cessions d'immobilisations", signe: '−', kind: 'C', p: ['81'] },
  { ref: 'RP', note: '30', label: 'Autres charges HAO', signe: '−', kind: 'C', p: ['83', '85'] },
  { ref: 'XH', formule: 'Somme TN à RP', label: 'RÉSULTAT HAO', kind: 'S', sum: ['TN', 'TO', 'RO', 'RP'] },
  { ref: 'RQ', note: '30', label: 'Participation des travailleurs', signe: '−', kind: 'C', p: ['87'] },
  { ref: 'RS', label: 'Impôts sur le résultat', signe: '−', kind: 'C', p: ['89'] },
  { ref: 'XI', formule: 'XG + XH - RQ - RS', label: 'RÉSULTAT NET', kind: 'S', sum: ['XG', 'XH', 'RQ', 'RS'] },
];

/* ------------------------------------------------------------------ */
/* Construction                                                        */
/* ------------------------------------------------------------------ */

function round(n) { return Math.round(Number(n) || 0); }

/** Valeur brute d'une ligne sur des mouvements { compte: { md, mc, solde } }. */
function lineValue(mouv, def, vals) {
  if (def.kind === 'S') return def.sum.reduce((t, r) => t + (vals[r] || 0), 0);
  if (def.kind === 'P') return prod(mouv, def.p);
  if (def.kind === 'C') return charge(mouv, def.p);
  return variation(mouv, def.p); // 'V'
}

/**
 * Compte de résultat aux SIG officiels OHADA (refs TA→XI), colonnes N/N-1.
 * Ne modifie jamais les écritures passées en argument.
 */
export function compteResultatSIG(entries, { year } = {}) {
  if (!Number.isInteger(Number(year))) {
    throw new Error('compteResultatSIG : year doit être une année entière (ex. 2025).');
  }
  const y = Number(year);
  const { mouvN, mouvN1 } = previousYearBalances(entries, { year: y });

  // Valeurs brutes par ref (les SIG se calculent dans l'ordre du tableau).
  const vals = {}, vals1 = {};
  for (const def of DEFS) {
    vals[def.ref] = lineValue(mouvN, def, vals);
    vals1[def.ref] = lineValue(mouvN1, def, vals1);
  }

  const lignes = DEFS.map((def) => ({
    ref: def.ref,
    label: def.label,
    signe: def.kind === 'S' ? '' : def.signe,
    note: def.note || '',
    sousNote: def.sousNote || '',
    formule: def.formule || '',
    n: round(vals[def.ref]),
    n1: round(vals1[def.ref]),
    isSig: def.kind === 'S',
  }));

  return {
    year: y,
    lignes,
    resNet: round(vals.XI),
    resNetN1: round(vals1.XI),
  };
}
