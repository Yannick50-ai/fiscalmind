/**
 * Ratios de gestion (20 ratios, 5 catégories) — moteur pur, zéro dépendance.
 *
 * Port fidèle de la feuille « RATIOS DE GESTION » du classeur NO-Pro.V2
 * (voir migration/analyse-liasse-ce-pt-ratios.md §5 et ANNEXE B) :
 *  - 20 ratios calculés sur N et N-1, avec norme du classeur et
 *    interprétation courte ;
 *  - réutilise les moteurs existants (bilanModele2.js, compteResultatSIG —
 *    interfaces lues, fichiers NON modifiés) au lieu de recalculer SIG et
 *    postes du bilan ;
 *  - les sommes par compte spécifiques (DSO/DPO/CAF) sont calculées sur les
 *    vues de previous-year.js (cumulN / mouvN / …), sans toucher aux moteurs.
 *
 * ⚠ Trois ratios sont marqués « à valider » (aValider: true) car les formules
 * du classeur sont douteuses (cf. analyse § « Zones ambiguës ») :
 *   1. DSO : base de 306 jours dans le classeur (pas 360) — à confirmer ;
 *   2. BFR N-1 : la formule du classeur s'auto-référence (colonne N du BFR
 *      lui-même) — ici BFR N-1 = FRNG N-1 − Trésorerie nette N-1 ;
 *   3. DPO : formule tronquée à l'affichage — dénominateur reconstruit
 *      (achats 60-61 + TVA récupérable 445).
 * Pour ces trois-là, la valeur calculée est affichée avec le badge
 * « ⚠ à valider » et la formule utilisée en légende.
 *
 * `ratiosGestion(entries, { year, effectif })` :
 *  - entries : écritures canoniques { id, date, journal, piece, libelle,
 *    lignes: [{ compte, debit, credit }] } (ou lignes plates) ;
 *  - year    : exercice (année civile) ;
 *  - effectif : (optionnel) effectif salarié pour le ratio de productivité ;
 *    sans effectif, ce ratio vaut null (pas de valeur trompeuse).
 *
 * Retourne :
 *  { year,
 *    categories: [{ titre, ratios: [{
 *      code, label, n, n1, unite, norme, interpretation,
 *      aValider?, noteValider?, formule, seuil?
 *    }] }] }
 *  - n / n1 : valeur N / N-1 (null si non calculable, ex. division par 0) ;
 *  - unite  : 'pct' (fraction, ex. 0.25 = 25 %) | 'x' (multiple) | 'j' (jours)
 *             | 'fcfa' | 'ans' ;
 *  - seuil  : { min?, max? } cible normative exploitable par l'UI (jauge).
 *
 * Pure ES module, aucun DOM, aucun localStorage/sessionStorage.
 */

import { previousYearBalances } from './previous-year.js';
import { bilanModele2 } from './bilan-modele2.js';
import { compteResultatSIG } from './compte-resultat-sig.js';

/* ------------------------------------------------------------------ */
/* Sommes par sens (équivalent exact du sfd / sfc du classeur)          */
/* ------------------------------------------------------------------ */

/** Somme des soldes débiteurs (positifs) des comptes commençant par `prefixes`. */
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

/** Division sûre : null si le dénominateur est nul (pas de valeur trompeuse). */
function div(a, b) {
  const d = Number(b);
  if (!isFinite(d) || d === 0) return null;
  const r = Number(a) / d;
  return isFinite(r) ? r : null;
}

function round(n, decimals) {
  if (n == null) return null;
  const v = Number(n);
  if (!isFinite(v)) return null;
  const f = Math.pow(10, decimals == null ? 4 : decimals);
  return Math.round(v * f) / f;
}

function roundFcfa(n) {
  if (n == null) return null;
  const v = Number(n);
  return isFinite(v) ? Math.round(v) : null;
}

/* ------------------------------------------------------------------ */
/* Construction                                                        */
/* ------------------------------------------------------------------ */

/**
 * Capacité d'autofinancement (NOTE 34 du classeur, K13) :
 * RN + dotations (681/691/697) − reprises (791/798/799/797)
 * + VCEAC (81) − produits des cessions (82).
 */
function cafOf(mouv, xi) {
  const dot = sfd(mouv, ['681', '691', '697']);
  const rep = sfc(mouv, ['791', '798', '799', '797']) - sfd(mouv, ['791', '798', '799', '797']);
  const vceac = sfd(mouv, ['81']);
  const pceac = sfc(mouv, ['82']) - sfd(mouv, ['82']);
  return roundFcfa(xi + dot - rep + vceac - pceac);
}

export function ratiosGestion(entries, { year, effectif } = {}) {
  if (!Number.isInteger(Number(year))) {
    throw new Error('ratiosGestion : year doit être une année entière (ex. 2025).');
  }
  const y = Number(year);

  // Moteurs existants (interfaces lues, non modifiés) + vues N/N-1.
  const bilan = bilanModele2(entries, { year: y });
  const cr = compteResultatSIG(entries, { year: y });
  const { cumulN, cumulN1, mouvN, mouvN1 } = previousYearBalances(entries, { year: y });

  // Postes du bilan : netN / netN1 par ref (actif OU passif).
  const brow = (ref, n1) => {
    const row = bilan.actif.find((r) => r.ref === ref)
      || bilan.passif.find((r) => r.ref === ref)
      || {};
    const v = n1 ? row.netN1 : row.netN;
    return v == null ? 0 : v;
  };
  // Lignes du CR : n / n1 par ref.
  const crow = (ref, n1) => {
    const row = cr.lignes.find((r) => r.ref === ref) || {};
    const v = n1 ? row.n1 : row.n;
    return v == null ? 0 : v;
  };

  const ratio = (code, label, unite, get, norme, interpretation, extra) =>
    Object.assign(
      { code, label, unite,
        n: get(valsN), n1: get(valsN1),
        norme, interpretation,
        formule: (extra && extra.formule) || '' },
      extra || {},
    );

  /** Toutes les valeurs intermédiaires pour N (n1=false) ou N-1 (n1=true). */
  function valuesFor(n1) {
    // --- Postes du bilan modèle 2 (mêmes refs que le classeur) ---
    const CP = brow('CP', n1);   // M21 — capitaux propres
    const DZ = brow('DZ', n1);   // M39 — total passif
    const BZ = brow('BZ', n1);   // H39 — total actif
    const DF = brow('DF', n1);   // M26 — capitaux permanents
    const AZ = brow('AZ', n1);   // H26 — actif immobilisé net
    const BK = brow('BK', n1);   // H33 — actif circulant
    const DP = brow('DP', n1);   // M33 — passif circulant (dettes circulant)
    const BT = brow('BT', n1);   // H37 — trésorerie actif
    const DT = brow('DT', n1);   // M37 — trésorerie passif
    const DD = brow('DD', n1);   // M25 — dettes financières
    const CJ = n1 ? bilan.resNetN1 : bilan.resNet; // M18 — résultat net
    // --- SIG (compte de résultat) ---
    const XB = crow('XB', n1);   // I18 — chiffre d'affaires
    const XD = crow('XD', n1);   // I34 — EBE
    const XI = crow('XI', n1);   // I52 — résultat net
    // --- Soldes par compte (DSO/DPO/CAF) ---
    const cumul = n1 ? cumulN1 : cumulN;
    const mouv = n1 ? mouvN1 : mouvN;

    const FRNG = roundFcfa(DF - AZ);            // NOTE34!K14
    const TN = roundFcfa(BT - DT);              // trésorerie nette (E21)
    const BFR = (FRNG == null || TN == null) ? null : roundFcfa(FRNG - TN);
    const EN = roundFcfa(DD + DT - BT);         // endettement net
    const CAF = cafOf(mouv, XI);

    // DSO : créances clients 411 × 306 / (CA HT + TVA facturée 443)
    const cre411 = sfd(cumul, ['411']);
    const tvaCA = sfc(mouv, ['443']) - sfd(mouv, ['443']);
    const DSO = round(div(cre411 * 306, XB + tvaCA), 1);

    // DPO : dettes fournisseurs 401 × 360 / (achats 60-61 + TVA récupérable 445)
    const det401 = sfc(cumul, ['401']);
    const achHT = sfd(mouv, ['60', '61']);
    const tvaAch = sfd(mouv, ['445']);
    const DPO = round(div(det401 * 360, achHT + tvaAch), 1);

    const rotBFR = BFR == null ? null : round(div(BFR * 360, XB), 1);

    const eff = Number(effectif);
    const hasEff = isFinite(eff) && eff > 0;

    return {
      CP, DZ, BZ, DF, AZ, BK, DP, BT, DT, DD, CJ, XB, XD, XI,
      FRNG, TN, BFR, EN, CAF, DSO, DPO, rotBFR,
      productivite: hasEff ? roundFcfa(div(XB, eff)) : null,
      hasEff,
    };
  }

  const valsN = valuesFor(false);
  const valsN1 = valuesFor(true);

  return {
    year: y,
    categories: [
      { titre: '🏛️ Structure financière', ratios: [
        /* --- 1. Structure financière (ratios 1, 6, 2, 13, 12, 11, 3, 20, 19) --- */
        ratio('AUTONOMIE', 'Autonomie financière', 'pct',
          (v) => round(div(v.CP, v.DZ)),
          '> 20–25 %',
          'Part des capitaux propres dans le financement total : plus elle est élevée, moins l’entreprise dépend de ses créanciers.',
          { seuil: { min: 0.20 }, formule: 'Capitaux propres (CP) / Total passif (DZ)' }),
        ratio('SOLVABILITE', 'Solvabilité générale', 'x',
          (v) => round(div(v.BZ, v.DZ - v.CP), 2),
          '> 1',
          'L’actif total couvre l’ensemble des dettes : au-delà de 1, les créanciers sont protégés même en cas de liquidation.',
          { seuil: { min: 1 }, formule: 'Total actif (BZ) / (Total passif − Capitaux propres)' }),
        ratio('FIN-IMMO', 'Financement des immobilisations', 'x',
          (v) => round(div(v.DF, v.AZ), 2),
          '> 1',
          'Les ressources stables (capitaux permanents) couvrent les immobilisations : gage d’équilibre financier à long terme.',
          { seuil: { min: 1 }, formule: 'Capitaux permanents (DF) / Actif immobilisé net (AZ)' }),
        ratio('INDEPENDANCE', 'Indépendance financière', 'x',
          (v) => round(div(v.CP, v.DD), 2),
          '> 1',
          'Les capitaux propres couvrent les dettes financières : au-delà de 1, l’entreprise finance elle-même son développement.',
          { seuil: { min: 1 }, formule: 'Capitaux propres (CP) / Dettes financières (DD)' }),
        ratio('GEARING', 'Gearing (endettement net / capitaux propres)', 'x',
          (v) => round(div(v.EN, v.CP), 2),
          '< 1',
          'Poids de l’endettement net face aux fonds propres : sous 1, l’endettement reste maîtrisé.',
          { seuil: { max: 1 }, formule: '(Dettes financières + Trésorerie passif − Trésorerie actif) / Capitaux propres' }),
        ratio('CAP-REMBOURS', 'Capacité de remboursement', 'ans',
          (v) => round(div(v.EN, v.XD), 1),
          '< 3–4 ans',
          'Nombre d’années d’excédent brut d’exploitation nécessaires pour rembourser l’endettement net.',
          { seuil: { max: 4 }, formule: 'Endettement net / EBE (XD)' }),
        ratio('PRODUCTIVITE', 'Productivité (CA par salarié)', 'fcfa',
          (v) => v.productivite,
          'croissant, vs secteur',
          valsN.hasEff
            ? 'Chiffre d’affaires généré par salarié : à suivre dans le temps et à comparer au secteur.'
            : 'Effectif non renseigné : indiquez-le dans « Mon entreprise » pour activer ce ratio.',
          { formule: 'Chiffre d’affaires (XB) / Effectif' }),
        ratio('FRNG', 'Fonds de roulement net global (FRNG)', 'fcfa',
          (v) => v.FRNG,
          '> 0',
          'Excédent des ressources stables sur l’actif immobilisé : il finance le cycle d’exploitation.',
          { seuil: { min: 0 }, formule: 'Capitaux permanents (DF) − Actif immobilisé net (AZ)' }),
        ratio('BFR', 'Besoin en fonds de roulement (BFR)', 'fcfa',
          (v) => v.BFR,
          '± selon activité',
          'Besoin de financement né du décalage entre encaissements et décaissements d’exploitation.',
          { aValider: true,
            noteValider: 'La formule N-1 du classeur est suspecte (elle s’auto-référence) : ici BFR N-1 = FRNG N-1 − Trésorerie nette N-1.',
            formule: 'BFR = FRNG − Trésorerie nette (classeur : NOTE34!K14 − trésorerie nette)' }),
      ] },
      { titre: '💧 Liquidité', ratios: [
        /* --- 2. Liquidité (ratios 4, 14, 15) --- */
        ratio('LIQUIDITE', 'Liquidité générale', 'x',
          (v) => round(div(v.BK, v.DP), 2),
          '> 1',
          'L’actif circulant couvre les dettes à court terme : au-delà de 1, l’entreprise honore ses échéances.',
          { seuil: { min: 1 }, formule: 'Actif circulant (BK) / Passif circulant (DP)' }),
        ratio('TRESO-IMM', 'Trésorerie immédiate', 'x',
          (v) => round(div(v.BT, v.DP + v.DT), 2),
          '0,1 – 0,3',
          'Part des dettes à court terme payable immédiatement : entre 0,1 et 0,3, la trésorerie est saine sans dormir.',
          { seuil: { min: 0.1, max: 0.3 }, formule: 'Trésorerie actif (BT) / (Passif circulant + Trésorerie passif)' }),
        ratio('TRESO-NETTE', 'Trésorerie nette', 'fcfa',
          (v) => v.TN,
          '> 0',
          'Trésorerie actif moins trésorerie passif : positive, elle confirme l’équilibre financier.',
          { seuil: { min: 0 }, formule: 'Trésorerie actif (BT) − Trésorerie passif (DT)' }),
      ] },
      { titre: '📈 Rentabilité', ratios: [
        /* --- 3. Rentabilité (ratios 8, 7, 9, 10) --- */
        ratio('MARGE-NETTE', 'Marge bénéficiaire nette', 'pct',
          (v) => round(div(v.XI, v.XB)),
          'selon secteur',
          'Part du chiffre d’affaires transformée en bénéfice : à comparer aux références du secteur.',
          { formule: 'Résultat net (XI) / Chiffre d’affaires (XB)' }),
        ratio('ROE', 'ROE — rentabilité des capitaux propres', 'pct',
          (v) => round(div(v.CJ, v.CP)),
          '> 10–15 %',
          'Bénéfice rapporté aux capitaux propres : mesure le rendement de l’investissement des associés.',
          { seuil: { min: 0.10 }, formule: 'Résultat net (CJ) / Capitaux propres (CP)' }),
        ratio('ROA', 'ROA — rentabilité de l’actif', 'pct',
          (v) => round(div(v.CJ, v.BZ)),
          '> 5 %',
          'Bénéfice rapporté à l’actif total : mesure l’efficacité économique de l’outil de production.',
          { seuil: { min: 0.05 }, formule: 'Résultat net (CJ) / Total actif (BZ)' }),
        ratio('MARGE-BRUTE', 'Marge brute d’exploitation (EBE / CA)', 'pct',
          (v) => round(div(v.XD, v.XB)),
          'à maximiser',
          'Excédent brut d’exploitation sur chiffre d’affaires : le cœur de la performance opérationnelle.',
          { formule: 'EBE (XD) / Chiffre d’affaires (XB)' }),
      ] },
      { titre: '🔄 Activité', ratios: [
        /* --- 4. Activité (ratios 16, 17, 18) --- */
        ratio('DSO', 'DSO — délai de règlement clients', 'j',
          (v) => v.DSO,
          '< délai contractuel',
          'Jours de chiffre d’affaires immobilisés en créances clients : plus il est court, mieux la trésorerie respire.',
          { aValider: true,
            noteValider: 'Le classeur calcule en base 306 jours (et non 360) — valeur à confirmer avant usage.',
            formule: 'Créances clients (411) × 306 / (CA HT + TVA facturée 443)' }),
        ratio('DPO', 'DPO — délai de règlement fournisseurs', 'j',
          (v) => v.DPO,
          'à optimiser',
          'Jours d’achats financés par les fournisseurs : un DPO supérieur au DSO soulage la trésorerie.',
          { aValider: true,
            noteValider: 'Formule du classeur tronquée à l’affichage : le dénominateur est reconstruit ici (achats TTC) — à valider.',
            formule: 'Dettes fournisseurs (401) × 360 / (Achats 60-61 + TVA récupérable 445)' }),
        ratio('ROT-BFR', 'Rotation du BFR (jours de CA)', 'j',
          (v) => v.rotBFR,
          'le plus bas possible',
          'Jours de chiffre d’affaires absorbés par le besoin en fonds de roulement : à réduire pour libérer de la trésorerie.',
          { formule: 'BFR × 360 / Chiffre d’affaires (XB)' }),
      ] },
      { titre: '💰 Capacité d’autofinancement', ratios: [
        /* --- 5. Capacité d'autofinancement (ratio 5) --- */
        ratio('CAF', 'Capacité d’autofinancement (CAF)', 'fcfa',
          (v) => v.CAF,
          '> 0',
          'Ressources internes dégagées par l’activité : elles financent investissements et remboursements sans emprunt.',
          { seuil: { min: 0 },
            formule: 'Résultat net + dotations (681/691/697) − reprises (791/798/799/797) + VCEAC (81) − produits de cession (82)' }),
      ] },
    ],
  };
}
