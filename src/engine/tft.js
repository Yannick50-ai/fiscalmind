/**
 * TFT — Tableau des Flux de Trésorerie (méthode directe, modèle 2 OHADA)
 * + TBFT (tableau de bord de contrôle des flux de trésorerie).
 *
 * Implémente la logique du classeur DSF de Yannick
 * (voir migration/analyse-dsf-ohada.md §4 et ANNEXE D) :
 *  - TFT : refs ZA–ZH, colonnes N / N-1 ;
 *  - TBFT : détail des variations par section (opérationnel A,
 *    investissement B, financement C) avec les ajustements du classeur
 *    (exclusions 478/419/414/467/458/4494/4751 côté créances ;
 *    409/404/481/482/467/4752/472 côté dettes).
 *
 * `tftData(entries, { year })` :
 *  - entries : écritures canoniques { id, date, journal, piece, libelle,
 *    lignes: [{ compte, debit, credit }] } (ou lignes plates) ;
 *  - year    : exercice (année civile, cf. previous-year.js).
 *
 * Conventions (soldes au format { compte: { md, mc, solde } }, solde = md − mc) :
 *  - Δ N   = S.F.(N) − S.F.(N-1)   (cumulN − cumulN1) ;
 *  - Δ N-1 = S.F.(N-1) − S.I.(N-1) (cumulN1 − cumulN2) ;
 *  - les comptes de résultat (classes 6/7/8) sont lus sur les MOUVEMENTS
 *    de l'exercice (mouvN / mouvN1), comme le compte de résultat aux SIG.
 *
 * Retourne :
 *  { year,
 *    lignes: [{ ref, label, section, kind, n, n1, fqAValider? }],
 *    tbft:   { za: [...], A: [...], B: [...], C: [...] }
 *             (lignes de détail { label, n, n1, total? }),
 *    controles: { zhEqTresoNette, zh, tresoNetteN, ecartZH,
 *                 zgEqSomme, zg, sommeZBZC ZF->somme, ecartZG },
 *    fq: { remboursementsN, remboursementsN1,
 *          retenuN, retenuN1, alternatifN, alternatifN1 },
 *    fqAValider: true }
 *
 * ⚠️ AMBIGUÏTÉ FQ (remboursements) — reprise du classeur : la ligne FQ
 * « Remboursements » a un signe incohérent entre N et N-1 dans le classeur
 * source. Elle N'EST PAS figée : affichée avec `fqAValider: true`,
 * hypothèse retenue FQ = −remboursements (sortie de trésorerie),
 * hypothèse alternative exposée dans `fq`. À trancher avec Yannick.
 *
 * Interprétations documentées (écarts possibles vs le classeur) :
 *  - ZA : le « ± 472 » du classeur est intégré à la trésorerie nette
 *    (actif ET contrôle ZH), faute de quoi ZA + ZG ≠ ZH ;
 *  - FL (subventions reçues) : Δsfc(14) + reprises 799 (le « − Δ 799 »
 *    littéral du classeur double-compterait les reprises et casserait
 *    l'identité ZH = trésorerie nette) ;
 *  - FJ : cessions financières = 826 − Δ créances (4856, 4143). Le
 *    « + Δ 27 » du classeur est montré en détail TBFT mais NON additionné
 *    (les variations de 27 sont déjà captées dans FH via Δ nettes 26/27 ;
 *    les additionner compterait deux fois) — point à valider avec Yannick ;
 *  - FO = Δ16 signé (littéral classeur) : en présence de remboursements,
 *    FO et FQ se chevauchent — c'est précisément l'ambiguïté signalée.
 *
 * Pure ES module, aucun DOM, aucun localStorage/sessionStorage.
 */

import { toLines } from './journal.js';
import { cumulativeBalances } from './trial-balance.js';
import { previousYearBalances } from './previous-year.js';
import { compteResultatSIG } from './compte-resultat-sig.js';

/* ------------------------------------------------------------------ */
/* Sommes par sens sur une balance { compte: { md, mc, solde } }        */
/* ------------------------------------------------------------------ */

function eachAccount(bal, prefixes, minus, fn) {
  for (const c of Object.keys(bal || {})) {
    if (!prefixes.some((p) => c.startsWith(p))) continue;
    if (minus && minus.some((p) => c.startsWith(p))) continue;
    fn(c, bal[c]);
  }
}

/** Soldes débiteurs (positifs) — équivalent sfd du classeur. */
function sfd(bal, prefixes, minus) {
  let t = 0;
  eachAccount(bal, prefixes, minus, (c, e) => { if (e.solde > 0) t += e.solde; });
  return t;
}

/** Soldes créditeurs (en valeur positive) — équivalent sfc du classeur. */
function sfc(bal, prefixes, minus) {
  let t = 0;
  eachAccount(bal, prefixes, minus, (c, e) => { if (e.solde < 0) t -= e.solde; });
  return t;
}

/** Solde signé (sfd − sfc). */
function netSigned(bal, prefixes, minus) {
  return sfd(bal, prefixes, minus) - sfc(bal, prefixes, minus);
}

/** Δ signée S.F.(A) − S.F.(B) d'un groupe de comptes. */
function varSigned(balA, balB, prefixes, minus) {
  return netSigned(balA, prefixes, minus) - netSigned(balB, prefixes, minus);
}

/** Δ des montants débiteurs positifs (sfd). */
function varSfd(balA, balB, prefixes, minus) {
  return sfd(balA, prefixes, minus) - sfd(balB, prefixes, minus);
}

/** Δ des montants créditeurs positifs (sfc). */
function varSfc(balA, balB, prefixes, minus) {
  return sfc(balA, prefixes, minus) - sfc(balB, prefixes, minus);
}

/** Somme des mouvements débiteurs (mouvements de l'exercice). */
function mdSum(mouv, prefixes) {
  let t = 0;
  eachAccount(mouv, prefixes, null, (c, e) => { t += e.md || 0; });
  return t;
}

function round(n) { return Math.round(Number(n) || 0); }

/* ------------------------------------------------------------------ */
/* Listes de comptes (ANNEXE D de l'analyse)                           */
/* ------------------------------------------------------------------ */

const TRESO_ACTIF = ['50', '51', '52', '53', '54', '57', '581', '582'];
const TRESO_PASSIF_C = ['564', '565', '561', '566']; // sfc
const TRESO_PASSIF_D = ['52', '53'];                // sfc (découverts)

const AD_BRUT = ['211', '212', '213', '214', '215', '216', '217', '218'];
const AD_AMORT = ['281', '291'];
const AI_BRUT = ['22', '23', '24'];
const AI_AMORT = ['282', '292', '283', '293', '284', '294'];
const AQ_BRUT = ['26', '27'];
const AQ_AMORT = ['296', '297'];

const FOURN_INCORP = ['4811', '4821', '4041', '4046', '48161', '48171', '48181'];
const FOURN_CORP = ['4812', '4822', '4042', '4047', '48162', '48172', '48182'];
const LOCATION_ACQ = ['2286', '2316', '2326', '2416', '2426', '2446', '2456']; // biens en location-acquisition : pas de flux cash
const CRE_CESS_INCORP = ['4851', '4852', '4141', '4142'];
const CRE_CESS_FIN = ['4856', '4143'];

/* ------------------------------------------------------------------ */
/* Trésorerie nette                                                    */
/* ------------------------------------------------------------------ */

function tresoActif(bal) { return sfd(bal, TRESO_ACTIF); }

function tresoPassif(bal) {
  return sfc(bal, TRESO_PASSIF_C) + sfc(bal, TRESO_PASSIF_D);
}

/** Trésorerie nette = tréso-actif + 472 (signé) − tréso-passif. */
function tresoNette(bal) {
  return tresoActif(bal) + netSigned(bal, ['472']) - tresoPassif(bal);
}

/* ------------------------------------------------------------------ */
/* Rubriques ajustées du TBFT (flux opérationnel)                      */
/* ------------------------------------------------------------------ */

/** Actif circulant HAO ajusté : BA bilan hors 485 (créances sur cessions
 *  d'immobilisations → flux d'investissement). */
function baAjuste(bal) {
  return sfd(bal, ['486']) - sfc(bal, ['498']);
}

/** Stocks nets (BB). */
function stocksNets(bal) {
  return sfd(bal, ['31', '32', '33', '34', '35', '36', '37', '38']) - sfc(bal, ['39']);
}

/** Créances et emplois assimilés ajustés : BG bilan hors 478, 419, 414,
 *  467, 458, 4494, 4751 (flux d'investissement / financement). */
function creancesAjustees(bal) {
  const bh = sfd(bal, ['40']) - sfc(bal, ['490']);
  const bi = sfd(bal, ['41'], ['419', '414']) - sfc(bal, ['491']);
  const bj = sfd(bal, ['42', '43', '44', '46', '47'], ['478', '467', '458', '4494', '4751'])
    - sfc(bal, ['492', '493', '495', '496', '497']);
  return bh + bi + bj;
}

/** Passif circulant ajusté : DP bilan hors 409, 404, 481, 482, 467, 4752,
 *  472 (dettes d'investissement / financement). */
function dettesAjustees(bal) {
  const dh = sfc(bal, ['484', '488', '4998']); // 481, 482 exclus (HAO)
  const di = sfc(bal, ['41']);
  const dj = sfc(bal, ['40'], ['409', '404']);
  const dk = sfc(bal, ['42', '43', '44']);
  const dm = sfc(bal, ['185', '45', '46', '47'], ['479', '467', '4752', '472']);
  const dn = sfc(bal, ['499', '599'], ['4998']);
  return dh + di + dj + dk + dm + dn;
}

/* ------------------------------------------------------------------ */
/* Investissements : acquisitions / cessions                           */
/* ------------------------------------------------------------------ */

function netImmo(bal, brutPfx, amortPfx) {
  return sfd(bal, brutPfx) - sfc(bal, amortPfx);
}

/** Montants créditeurs positifs (dettes fournisseurs d'immobilisations). */
function fournPos(bal, prefixes) {
  return sfc(bal, prefixes) - sfd(bal, prefixes);
}

/** FF brut : acquisitions d'immobilisations incorporelles. */
function acqIncorp(balA, balB, mouv) {
  const dNet = netImmo(balA, AD_BRUT, AD_AMORT) - netImmo(balB, AD_BRUT, AD_AMORT);
  const dot = sfd(mouv, ['6812', '6913']);
  const vnc = sfd(mouv, ['811', '6541']);
  const d251 = varSigned(balA, balB, ['251']);
  const dFourn = fournPos(balA, FOURN_INCORP) - fournPos(balB, FOURN_INCORP);
  return { dNet, dot, vnc, d251, dFourn, total: dNet + dot + vnc + d251 - dFourn };
}

/** FG brut : acquisitions d'immobilisations corporelles. */
function acqCorp(balA, balB, mouv) {
  const dNet = netImmo(balA, AI_BRUT, AI_AMORT) - netImmo(balB, AI_BRUT, AI_AMORT);
  const dot = sfd(mouv, ['6813', '6914']);
  const vnc = sfd(mouv, ['812', '6542']);
  const subv = varSfc(balA, balB, ['1061', '1062']) + varSfc(balA, balB, ['154'])
    + varSfc(balA, balB, ['1984']); // réévaluations / provisions : pas de cash
  const loc = varSfd(balA, balB, LOCATION_ACQ); // location-acquisition : pas de cash
  const d2714 = varSfd(balA, balB, ['2714']);   // créances de location-financement
  const d252 = varSigned(balA, balB, ['252']);
  const dFourn = fournPos(balA, FOURN_CORP) - fournPos(balB, FOURN_CORP);
  return { dNet, dot, vnc, subv, loc, d2714, d252, dFourn, total: dNet + dot + vnc - subv - loc - d2714 + d252 - dFourn };
}

/** FH brut : acquisitions d'immobilisations financières. */
function acqFin(balA, balB) {
  const dNet = netImmo(balA, AQ_BRUT, AQ_AMORT) - netImmo(balB, AQ_BRUT, AQ_AMORT);
  const depr = varSfc(balA, balB, AQ_AMORT); // dépréciations : réintégrer
  const dFourn = fournPos(balA, ['4813']) - fournPos(balB, ['4813']);
  return { dNet, depr, dFourn, total: dNet + depr - dFourn };
}

/** FI : cessions d'immobilisations incorporelles et corporelles. */
function cesIncorpCorp(balA, balB, mouv) {
  const prod = sfc(mouv, ['821', '822', '7541', '7542']);
  const cre = (bal) => sfd(bal, CRE_CESS_INCORP) - sfc(bal, CRE_CESS_INCORP);
  const dCre = cre(balA) - cre(balB);
  return { prod, dCre, total: prod - dCre };
}

/** FJ : cessions d'immobilisations financières.
 *  Le « + Δ 27 » du classeur est exposé en détail TBFT mais non additionné
 *  (déjà capté dans FH) — voir l'en-tête du fichier. */
function cesFin(balA, balB, mouv) {
  const prod = sfc(mouv, ['826']);
  const cre = (bal) => sfd(bal, CRE_CESS_FIN) - sfc(bal, CRE_CESS_FIN);
  const dCre = cre(balA) - cre(balB);
  const d27 = varSigned(balA, balB, ['27']); // info TBFT uniquement
  return { prod, dCre, d27, total: prod - dCre };
}

/* ------------------------------------------------------------------ */
/* Financement                                                         */
/* ------------------------------------------------------------------ */

function financement(balA, balB, mouv) {
  const fk = varSfc(balA, balB, ['10']) - varSfc(balA, balB, ['106'])
    - varSfd(balA, balB, ['109']) - varSigned(balA, balB, ['467'])
    - varSigned(balA, balB, ['4581']);
  const fl = varSfc(balA, balB, ['14']) + sfc(mouv, ['799'])
    - varSigned(balA, balB, ['4582']) - varSigned(balA, balB, ['4494'])
    - varSigned(balA, balB, ['4497']);
  const fmBase = varSfd(balA, balB, ['10']) - varSfc(balA, balB, ['106'])
    - varSfd(balA, balB, ['109']) + varSigned(balA, balB, ['467'])
    + varSigned(balA, balB, ['4581']);
  const fm = -fmBase;
  const fn = -mdSum(mouv, ['465']);
  // Variations en montants créditeurs positifs : un remboursement (diminution
  // du solde créditeur) donne une variation négative = sortie de trésorerie.
  const fo = varSfc(balA, balB, ['16']);
  const fp = varSfc(balA, balB, ['18']) - varSfc(balA, balB, ['183'])
    - mdSum(mouv, ['17']);
  const remb = mdSum(mouv, ['16', '17', '18']);
  return { fk, fl, fm, fmBase, fn, fo, fp, remb };
}

/* ------------------------------------------------------------------ */
/* Calcul d'une colonne (N ou N-1)                                     */
/* ------------------------------------------------------------------ */

function crVals(cr, col) {
  const get = (ref) => {
    const l = cr.lignes.find((x) => x.ref === ref);
    return col === 'n' ? l.n : l.n1;
  };
  return { XD: get('XD'), XF: get('XF'), TO: get('TO'), RP: get('RP'), RQ: get('RQ'), RS: get('RS') };
}

/**
 * Calcule toutes les composantes d'une colonne.
 * balA/balB : balances S.F. (A = fin, B = début) ; mouv : mouvements de l'exercice.
 * Retourne { refs, d } où d porte les composantes nommées (détail TBFT).
 */
function computeColumn(balA, balB, mouv, cv) {
  const d = {};

  // --- CAFG : XD + 654(sfd) − 754(sfc) + XF + TO + RP + RQ + RS
  // (RP/RQ/RS sont ≤ 0 dans le CR : les additionner = les soustraire.)
  d.xd = cv.XD;
  d.p654 = sfd(mouv, ['654']);
  d.m754 = sfc(mouv, ['754']);
  d.xf = cv.XF; d.to = cv.TO; d.rp = cv.RP; d.rq = cv.RQ; d.rs = cv.RS;
  d.fa = d.xd + d.p654 - d.m754 + d.xf + d.to + d.rp + d.rq + d.rs;

  // --- Variations du besoin opérationnel
  d.fbBase = baAjuste(balA) - baAjuste(balB);
  d.fb = -d.fbBase;
  d.fcBase = stocksNets(balA) - stocksNets(balB);
  d.fc = -d.fcBase;
  d.fdBase = creancesAjustees(balA) - creancesAjustees(balB);
  d.fd = -d.fdBase;
  d.feBase = dettesAjustees(balA) - dettesAjustees(balB);
  d.fe = d.feBase;
  d.zb = d.fa + d.fb + d.fc + d.fd + d.fe;

  // --- Investissements
  const ff = acqIncorp(balA, balB, mouv);
  const fg = acqCorp(balA, balB, mouv);
  const fh = acqFin(balA, balB);
  const fi = cesIncorpCorp(balA, balB, mouv);
  const fj = cesFin(balA, balB, mouv);
  Object.assign(d, {
    ffDNet: ff.dNet, ffDot: ff.dot, ffVnc: ff.vnc, ff251: ff.d251, ffFourn: ff.dFourn,
    fgDNet: fg.dNet, fgDot: fg.dot, fgVnc: fg.vnc, fgSubv: fg.subv, fgLoc: fg.loc,
    fg2714: fg.d2714, fg252: fg.d252, fgFourn: fg.dFourn,
    fhDNet: fh.dNet, fhDepr: fh.depr, fhFourn: fh.dFourn,
    fiProd: fi.prod, fiCre: fi.dCre, fjProd: fj.prod, fjCre: fj.dCre, fjD27: fj.d27,
  });
  d.ff = -ff.total; d.fg = -fg.total; d.fh = -fh.total; d.fi = fi.total; d.fj = fj.total;
  d.zc = d.ff + d.fg + d.fh + d.fi + d.fj;

  // --- Financement
  const fin = financement(balA, balB, mouv);
  d.fk = fin.fk; d.fl = fin.fl; d.fm = fin.fm; d.fmBase = fin.fmBase; d.fn = fin.fn;
  d.fk10 = varSfc(balA, balB, ['10']); d.fk106 = varSfc(balA, balB, ['106']);
  d.fk109 = varSfd(balA, balB, ['109']);
  d.fkAjust = -varSigned(balA, balB, ['467']) - varSigned(balA, balB, ['4581']);
  d.fl14 = varSfc(balA, balB, ['14']); d.fl799 = sfc(mouv, ['799']);
  d.flAjust = -varSigned(balA, balB, ['4582']) - varSigned(balA, balB, ['4494'])
    - varSigned(balA, balB, ['4497']);
  d.zd = d.fk + d.fl + d.fm + d.fn;
  d.fo = fin.fo;
  d.fp18 = varSfc(balA, balB, ['18']); d.fp183 = varSfc(balA, balB, ['183']);
  d.fp17 = mdSum(mouv, ['17']); d.fp = fin.fp;
  d.remb = fin.remb;
  d.fq = -d.remb; // hypothèse retenue (⚠ à valider)
  d.ze = d.fo + d.fp + d.fq;
  d.zf = d.zd + d.ze;

  // --- Variation de trésorerie
  d.zg = d.zb + d.zc + d.zf;

  return d;
}

/* ------------------------------------------------------------------ */
/* Table des lignes du TFT                                             */
/* ------------------------------------------------------------------ */

// kind: 'za' | 'flux' | 'total' | 'grand' — section: null | 'A' | 'B' | 'C'
const TFT_DEFS = [
  { ref: 'ZA', label: 'Trésorerie nette au 1er janvier (Trésorerie actif N-1 − Trésorerie passif N-1)', note: 'A', section: null, kind: 'za' },
  { ref: 'FA', label: "Capacité d'autofinancement globale (CAFG)", section: 'A', kind: 'flux' },
  { ref: 'FB', label: '− Variation de l\'actif circulant HAO (1)', section: 'A', kind: 'flux' },
  { ref: 'FC', label: '− Variation des stocks', section: 'A', kind: 'flux' },
  { ref: 'FD', label: '− Variation des créances', section: 'A', kind: 'flux' },
  { ref: 'FE', label: '+ Variation du passif circulant (1)', section: 'A', kind: 'flux' },
  { ref: 'ZB', label: 'Flux de trésorerie provenant des activités opérationnelles (somme FA à FE)', note: 'B', section: 'A', kind: 'total' },
  { ref: 'FF', label: "− Acquisitions d'immobilisations incorporelles", section: 'B', kind: 'flux' },
  { ref: 'FG', label: "− Acquisitions d'immobilisations corporelles", section: 'B', kind: 'flux' },
  { ref: 'FH', label: "− Acquisitions d'immobilisations financières", section: 'B', kind: 'flux' },
  { ref: 'FI', label: '+ Encaissements liés aux cessions d’immobilisations incorporelles et corporelles', section: 'B', kind: 'flux' },
  { ref: 'FJ', label: "+ Cessions d'immobilisations financières", section: 'B', kind: 'flux' },
  { ref: 'ZC', label: 'Flux de trésorerie provenant des activités d’investissement (somme FF à FJ)', note: 'C', section: 'B', kind: 'total' },
  { ref: 'FK', label: '+ Augmentations de capital par apports nouveaux', section: 'C', kind: 'flux' },
  { ref: 'FL', label: "+ Subventions d'investissement reçues", section: 'C', kind: 'flux' },
  { ref: 'FM', label: '− Prélèvements sur le capital', section: 'C', kind: 'flux' },
  { ref: 'FN', label: '− Dividendes versés', section: 'C', kind: 'flux' },
  { ref: 'ZD', label: 'Flux de trésorerie provenant du financement par les capitaux propres (somme FK à FN)', note: 'D', section: 'C', kind: 'total' },
  { ref: 'FO', label: '+ Emprunts', section: 'C', kind: 'flux' },
  { ref: 'FP', label: '+ Autres dettes financières', section: 'C', kind: 'flux' },
  { ref: 'FQ', label: '− Remboursements des emprunts et autres dettes financières', section: 'C', kind: 'flux', fqAValider: true },
  { ref: 'ZE', label: 'Flux de trésorerie provenant du financement par les capitaux étrangers (somme FO à FQ)', note: 'E', section: 'C', kind: 'total' },
  { ref: 'ZF', label: 'Flux de trésorerie provenant des activités de financement (D+E)', note: 'F', section: 'C', kind: 'total' },
  { ref: 'ZG', label: 'VARIATION DE LA TRÉSORERIE NETTE DE LA PÉRIODE (B+C+F)', note: 'G', section: null, kind: 'grand' },
  { ref: 'ZH', label: 'Trésorerie nette au 31 décembre (G+A) — Contrôle : Trésorerie actif N − Trésorerie passif N', note: 'H', section: null, kind: 'grand' },
];

// [clé composante, libellé, 'total'?] — détail TBFT par section
const DETAIL_DEFS = {
  za: [
    ['zaActif', 'Trésorerie-actif au 1/1 (50, 51, 52, 53, 54, 57, 581, 582)'],
    ['za472', '± 472 — Créances et dettes sur titres de placement'],
    ['zaPassif', '− Trésorerie-passif au 1/1 (564, 565, 52, 53, 561, 566)'],
    ['za', 'ZA — Trésorerie nette au 1er janvier', 'total'],
  ],
  A: [
    ['xd', "XD — Excédent brut d'exploitation"],
    ['p654', '+ 654 — VNC des cessions courantes (soldes débiteurs)'],
    ['m754', '− 754 — Produits des cessions courantes (soldes créditeurs)'],
    ['xf', '+ XF — Résultat financier'],
    ['to', '+ TO — Autres produits HAO'],
    ['rp', 'RP — Autres charges HAO (valeur négative)'],
    ['rq', 'RQ — Participation des travailleurs (valeur négative)'],
    ['rs', 'RS — Impôts sur le résultat (valeur négative)'],
    ['fa', 'FA — CAFG', 'total'],
    ['fbBase', '− Δ actif circulant HAO ajusté (486 − 498)'],
    ['fb', 'FB', 'total'],
    ['fcBase', '− Δ stocks nets (31 à 38 − 39)'],
    ['fc', 'FC', 'total'],
    ['fdBase', '− Δ créances ajustées (hors 478, 419, 414, 467, 458, 4494, 4751)'],
    ['fd', 'FD', 'total'],
    ['feBase', '+ Δ passif circulant ajusté (hors 409, 404, 481, 482, 467, 4752, 472)'],
    ['fe', 'FE', 'total'],
    ['zb', 'ZB — Flux opérationnel', 'total'],
  ],
  B: [
    ['ffDNet', 'Δ nettes immobilisations incorporelles (AD)'],
    ['ffDot', '+ Dotations 6812, 6913'],
    ['ffVnc', '+ VNC 811, 6541'],
    ['ff251', '+ Δ 251 — Avances sur immos incorporelles'],
    ['ffFourn', '− Δ dettes fournisseurs d\'immos incorp. (4041, 4046, 4811, 4821, …)'],
    ['ff', 'FF — Acquisitions immos incorporelles', 'total'],
    ['fgDNet', 'Δ nettes immobilisations corporelles (AI)'],
    ['fgDot', '+ Dotations 6813, 6914'],
    ['fgVnc', '+ VNC 812, 6542'],
    ['fgSubv', '− Réévaluations / provisions (1061, 1062, 154, 1984)'],
    ['fgLoc', '− Biens en location-acquisition (2286, 2316, 2326, 2416, 2426, 2446, 2456)'],
    ['fg2714', '− 2714 — Créances de location-financement'],
    ['fg252', '+ Δ 252 — Avances sur immos corporelles'],
    ['fgFourn', '− Δ dettes fournisseurs d\'immos corp. (4042, 4047, 4812, 4822, …)'],
    ['fg', 'FG — Acquisitions immos corporelles', 'total'],
    ['fhDNet', 'Δ nettes immobilisations financières (26, 27)'],
    ['fhDepr', '+ Dépréciations 296, 297'],
    ['fhFourn', '− Δ 4813 — Dettes sur immos financières'],
    ['fh', 'FH — Acquisitions immos financières', 'total'],
    ['fiProd', '+ 821, 822, 7541, 7542 — Produits des cessions'],
    ['fiCre', '− Δ créances sur cessions (4851, 4852, 4141, 4142)'],
    ['fi', 'FI — Cessions immos incorp./corp.', 'total'],
    ['fjProd', '+ 826 — Produits des cessions financières'],
    ['fjCre', '− Δ créances sur cessions (4856, 4143)'],
    ['fjD27', 'Δ 27 — Autres immos financières (info : déjà capté dans FH, non additionné)'],
    ['fj', 'FJ — Cessions immos financières', 'total'],
    ['zc', "ZC — Flux d'investissement", 'total'],
  ],
  C: [
    ['fk10', '+ Δ 10 — Capital (soldes créditeurs)'],
    ['fk106', '− Δ 106 — Écarts de réévaluation'],
    ['fk109', '− Δ 109 — Capital non appelé (soldes débiteurs)'],
    ['fkAjust', '± 467, 4581 — ajustements'],
    ['fk', 'FK — Augmentation de capital', 'total'],
    ['fl14', '+ Δ 14 — Subventions d\'investissement'],
    ['fl799', '+ 799 — Reprises de subventions'],
    ['flAjust', '± 4582, 4494, 4497 — subventions à recevoir / avances'],
    ['fl', 'FL — Subventions reçues', 'total'],
    ['fmBase', 'Base prélèvements (Δ 10 déb. − Δ 106 − Δ 109 + Δ 467 + Δ 4581)'],
    ['fm', 'FM — Prélèvements sur le capital', 'total'],
    ['fn', 'FN — Dividendes versés (− mouvements débiteurs 465)', 'total'],
    ['zd', 'ZD — Flux capitaux propres', 'total'],
    ['fo', '+ Δ 16 — Emprunts (FO)'],
    ['fp18', '+ Δ 18 — Autres dettes financières'],
    ['fp183', '− Δ 183 — Intérêts courus sur dettes liées à des participations'],
    ['fp17', '− Mouvements débiteurs 17'],
    ['fp', 'FP', 'total'],
    ['remb', 'Remboursements bruts (mouvements débiteurs 16, 17, 18)'],
    ['fq', 'FQ — Remboursements (hypothèse retenue : −) ⚠ à valider', 'total'],
    ['ze', 'ZE — Flux capitaux étrangers', 'total'],
    ['zf', 'ZF — Flux de financement', 'total'],
  ],
};

// Clés dont la valeur brute est un montant positif à soustraire dans le
// total : le détail affiche la contribution signée (× −1). Les autres clés
// sont déjà des contributions signées (ex. rp/rq/rs négatifs du CR).
const DETAIL_SIGN = {
  m754: -1, fbBase: -1, fcBase: -1, fdBase: -1,
  ffFourn: -1, fgSubv: -1, fgLoc: -1, fg2714: -1, fgFourn: -1,
  fhFourn: -1, fiCre: -1, fjCre: -1,
  fk106: -1, fk109: -1, fp183: -1, fp17: -1,
  zaPassif: -1,
};

/* ------------------------------------------------------------------ */
/* Fonction principale                                                 */
/* ------------------------------------------------------------------ */

/**
 * TFT + TBFT (méthode directe), colonnes N / N-1.
 * Ne modifie jamais les écritures passées en argument.
 */
export function tftData(entries, { year } = {}) {
  if (!Number.isInteger(Number(year))) {
    throw new Error('tftData : year doit être une année entière (ex. 2025).');
  }
  const y = Number(year);
  const list = Array.isArray(entries) ? entries : [];
  const lines = (list.length && Array.isArray(list[0].lignes)) ? toLines(list) : list;

  const { cumulN, cumulN1, mouvN, mouvN1 } = previousYearBalances(lines, { year: y });
  const cumulN2 = cumulativeBalances(lines, { upTo: (y - 2) + '-12-31' }); // S.I.(N-1)
  const cr = compteResultatSIG(lines, { year: y });

  const colN = computeColumn(cumulN, cumulN1, mouvN, crVals(cr, 'n'));
  const colN1 = computeColumn(cumulN1, cumulN2, mouvN1, crVals(cr, 'n1'));

  // --- ZA : trésorerie nette au 1/1 (S.I. de N)
  const dZa = {
    zaActif: tresoActif(cumulN1),
    za472: netSigned(cumulN1, ['472']),
    zaPassif: tresoPassif(cumulN1),
  };
  dZa.za = dZa.zaActif + dZa.za472 - dZa.zaPassif;

  // N-1 : ZA = ZH − ZG (cohérent avec ZH = tréso nette S.F.(N-1))
  const zhN1 = tresoNette(cumulN1);
  const zaN1 = zhN1 - colN1.zg;
  const zhN = colN.zg + dZa.za;

  const R = round;
  const val = (d, k) => R(d[k]);

  const lignes = TFT_DEFS.map((def) => {
    let n, n1;
    if (def.ref === 'ZA') { n = R(dZa.za); n1 = R(zaN1); }
    else if (def.ref === 'ZH') { n = R(zhN); n1 = R(zhN1); }
    else { n = val(colN, def.ref.toLowerCase()); n1 = val(colN1, def.ref.toLowerCase()); }
    const l = { ref: def.ref, label: def.label, section: def.section, kind: def.kind, n, n1, note: def.note || '' };
    if (def.fqAValider) l.fqAValider = true;
    return l;
  });

  // --- Détail TBFT par section.
  // Les composantes sont des contributions signées : DETAIL_SIGN applique le
  // signe d'affichage aux clés dont la valeur brute est un montant positif à
  // soustraire. Les totaux (FA, FB… ZF) reprennent exactement les lignes TFT.
  // N-1 de ZA : seul le total est connu (ZA = ZH − ZG) — les composantes
  // S.I.(N-1) affichent « — ».
  const dAllN = { ...colN, ...dZa };
  const dAllN1 = { ...colN1, za: zaN1, zaActif: NaN, za472: NaN, zaPassif: NaN };
  const byRef = Object.fromEntries(lignes.map((l) => [l.ref, l]));
  const tbft = {};
  for (const sec of Object.keys(DETAIL_DEFS)) {
    tbft[sec] = DETAIL_DEFS[sec].map(([key, label, total]) => {
      const s = DETAIL_SIGN[key] || 1;
      const rawN = dAllN[key];
      const rawN1 = dAllN1[key];
      return {
        label,
        n: rawN == null || Number.isNaN(rawN) ? null : R(rawN * s),
        n1: rawN1 == null || Number.isNaN(rawN1) ? null : R(rawN1 * s),
        ...(total ? { total: true } : {}),
      };
    });
  }

  // --- Contrôles
  const tresoN = tresoNette(cumulN);
  const zh = byRef.ZH.n, zg = byRef.ZG.n;
  const somme = byRef.ZB.n + byRef.ZC.n + byRef.ZF.n;
  const controles = {
    zhEqTresoNette: zh === R(tresoN),
    zh,
    tresoNetteN: R(tresoN),
    ecartZH: zh - R(tresoN),
    zgEqSomme: zg === somme,
    zg,
    somme,
    ecartZG: zg - somme,
  };

  return {
    year: y,
    lignes,
    tbft,
    controles,
    fq: {
      remboursementsN: R(colN.remb),
      remboursementsN1: R(colN1.remb),
      retenuN: byRef.FQ.n,
      retenuN1: byRef.FQ.n1,
      alternatifN: R(colN.remb),
      alternatifN1: R(colN1.remb),
    },
    fqAValider: true,
  };
}
