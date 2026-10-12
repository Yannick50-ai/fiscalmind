/**
 * Bilan modèle 2 (système allégé OHADA) — moteur pur, zéro dépendance.
 *
 * Implémente fidèlement la logique du classeur DSF de Yannick
 * (voir migration/analyse-dsf-ohada.md §1, §2 et ANNEXE A/B) :
 *  - colonnes Brut | Amort/Dépréc | Net N | Net N-1 (Net = Brut − Amort) ;
 *  - Brut = soldes finals débiteurs (sfd), Amort/Dépréc = soldes finals
 *    créditeurs (sfc) des 28/29, Passif = soldes finals créditeurs ;
 *  - comptes mixtes ventilés par sens : 40 déb→BH / créd→DJ,
 *    41 déb→BI / créd→DI (419 exclu de BI → DI) ;
 *  - 478 isolé en BU (exclu de BJ), 479 isolé en DV (exclu de DM).
 *
 * `bilanModele2(entries, { year, resNet })` :
 *  - entries : écritures canoniques { id, date, journal, piece, libelle,
 *    lignes: [{ compte, debit, credit }] } (ou lignes plates) ;
 *  - year    : exercice (année civile, cf. previous-year.js) ;
 *  - resNet  : résultat net de l'exercice (ligne CJ). Par défaut
 *    resultatNet(mouvN) — même sémantique que bilanData(soldesCumul, resNet).
 *
 * Retourne :
 *  { year, resNet, resNetN1,
 *    actif:  [{ ref, label, brut, amort, netN, netN1, total?, detail? }],
 *    passif: [{ ref, label, brut: null, amort: null, netN, netN1, total?, detail? }],
 *    totaux: { brutA, amortA, netAN, netAN1, netPN, netPN1 },
 *    controles: { actifEqPassif, actifEqPassifN1 } }
 *
 * Les sous-totaux (AD, AI, AQ, AZ, BG, BK, BT, BZ / CP, DD, DF, DP, DT, DZ)
 * portent `total: true` et la liste `detail` de leurs sous-rubriques
 * (aplatissables en UI). Pure ES module, aucun DOM, aucun stockage.
 */

import { previousYearBalances } from './previous-year.js';
import { resultatNet } from './financial-statements.js';

/* ------------------------------------------------------------------ */
/* Sommes par sens (équivalent exact du sfd / sfc du classeur)          */
/* ------------------------------------------------------------------ */

/** Somme des soldes débiteurs (positifs) des comptes dont le n° commence
 *  par l'un des `prefixes`, sauf ceux commençant par un préfixe de `minus`. */
function sfd(soldes, prefixes, minus) {
  let t = 0;
  for (const c of Object.keys(soldes || {})) {
    if (!prefixes.some((p) => c.startsWith(p))) continue;
    if (minus && minus.some((p) => c.startsWith(p))) continue;
    const s = soldes[c].solde;
    if (s > 0) t += s;
  }
  return t;
}

/** Somme des soldes créditeurs (en valeur positive) — même filtrage. */
function sfc(soldes, prefixes, minus) {
  let t = 0;
  for (const c of Object.keys(soldes || {})) {
    if (!prefixes.some((p) => c.startsWith(p))) continue;
    if (minus && minus.some((p) => c.startsWith(p))) continue;
    const s = soldes[c].solde;
    if (s < 0) t -= s;
  }
  return t;
}

/* ------------------------------------------------------------------ */
/* Tables de rubriques (refs officielles modèle 2 — ANNEXE A/B)         */
/* ------------------------------------------------------------------ */

// Notes annexes officielles par réf (imprimé DGI Burkina Faso — système normal).
// Les totaux n'ont pas de numéro de note sur l'imprimé.
const NOTES_ACTIF = {
  AD: '3', AE: '3', AF: '3', AG: '3', AH: '3', AI: '3', AJ: '3', AK: '3',
  AL: '3', AM: '3', AN: '3', AP: '3', AQ: '4', AR: '4', AS: '4',
  BA: '5', BB: '6', BH: '17', BI: '7', BJ: '8',
  BQ: '9', BR: '10', BS: '11', BU: '12',
};
const NOTES_PASSIF = {
  CA: '13', CB: '13', CD: '14', CE: '3C', CF: '14', CG: '14', CH: '14',
  CL: '15', CM: '15', DA: '16', DB: '16', DC: '16',
  DH: '5', DI: '7', DJ: '17', DK: '18', DM: '19', DN: '19',
  DQ: '20', DR: '20', DV: '12',
};

// [ref, label, brutPrefixes, brutMinus, amortPrefixes, amortMinus]
const ACTIF_BRUT = [
  ['AE', 'Frais de recherche et prospection', ['211', '2181'], null, ['2811', '2911'], null],
  ['AF', 'Brevets, licences, logiciels', ['212', '213', '214'], null, ['2812', '2813', '2814', '2912', '2913', '2914'], null],
  ['AG', 'Fonds commercial, droit au bail', ['215', '216'], null, ['2815', '2816', '2915', '2916'], null],
  ['AH', 'Autres immobilisations incorporelles', ['217', '218'], ['2181'], ['2817', '2818', '2917', '2919'], null],
  ['AJ', 'Terrains', ['22'], null, ['282', '292'], null],
  ['AK', 'Bâtiments', ['231', '232', '233', '237'], null, ['2831', '2832', '2837', '2931', '2932', '2933', '2937', '2939'], null],
  ['AL', 'Aménagements, agencements', ['234', '235', '238', '239'], null, ['283', '2939'], ['2831', '2832', '2833', '2837']],
  ['AM', 'Matériel, mobilier, actifs biologiques', ['24'], ['245', '2495'], ['284', '294'], ['2845', '2945', '2949']],
  ['AN', 'Matériel de transport', ['245', '2495'], null, ['2845', '2945', '2949'], null],
  ['AP', 'Avances et acomptes sur immobilisations', ['25'], null, ['295'], null],
  ['AR', 'Titres de participation', ['26'], null, ['296'], null],
  ['AS', 'Autres immobilisations financières', ['27'], null, ['297'], null],
  ['BA', 'Actif circulant HAO', ['485', '486'], null, ['498'], null],
  ['BB', 'Stocks et encours', ['31', '32', '33', '34', '35', '36', '37', '38'], null, ['39'], null],
  ['BH', 'Fournisseurs, avances versées', ['40'], null, ['490'], null],
  ['BI', 'Clients', ['41'], ['419'], ['491'], null],
  ['BJ', 'Autres créances', ['42', '43', '44', '46', '47'], ['478'], ['492', '493', '495', '496', '497'], null],
  ['BQ', 'Titres de placement', ['50'], null, ['590'], null],
  ['BR', 'Valeurs à encaisser', ['51'], null, ['591'], null],
  ['BS', 'Banques, chèques, caisse', ['52', '53', '54', '57', '581', '582'], null, ['592', '593'], null],
  ['BU', 'Écarts de conversion – actif', ['478'], null, [], null],
];

// Sous-totaux actif : [ref, label, refs des sous-rubriques]
const ACTIF_TOTAUX = [
  ['AD', 'IMMOBILISATIONS INCORPORELLES', ['AE', 'AF', 'AG', 'AH']],
  ['AI', 'IMMOBILISATIONS CORPORELLES', ['AJ', 'AK', 'AL', 'AM', 'AN']],
  ['AQ', 'IMMOBILISATIONS FINANCIÈRES', ['AR', 'AS']],
  ['AZ', 'TOTAL ACTIF IMMOBILISÉ', ['AD', 'AP', 'AI', 'AQ']],
  ['BG', 'CRÉANCES ET EMPLOIS ASSIMILÉS', ['BH', 'BI', 'BJ']],
  ['BK', 'TOTAL ACTIF CIRCULANT', ['BA', 'BB', 'BG']],
  ['BT', 'TOTAL TRÉSORERIE-ACTIF', ['BQ', 'BR', 'BS']],
  ['BZ', 'TOTAL GÉNÉRAL', ['AZ', 'BK', 'BT', 'BU']],
];

// [ref, label, prefixes, minus] — valeurs = soldes créditeurs (sfc)
const PASSIF = [
  ['CA', 'Capital', ['101', '102', '103', '104'], null],
  ['CB', 'Apporteurs, capital non appelé (−)', ['109'], null, 'special'],
  ['CD', 'Primes liées au capital', ['105'], null],
  ['CE', 'Écarts de réévaluation', ['106'], null],
  ['CF', 'Réserves indisponibles', ['111', '112', '113'], null],
  ['CG', 'Réserves libres', ['118'], null],
  ['CH', 'Report à nouveau (+/−)', ['121', '129'], null, 'special'],
  ['CJ', 'Résultat net de l’exercice', null, null, 'resnet'],
  ['CL', 'Subventions d’investissement', ['14'], null],
  ['CM', 'Provisions réglementées', ['15'], null],
  ['DA', 'Emprunts et dettes financières',
    ['161', '162', '163', '164', '165', '166', '167', '168', '181', '182', '183', '184'], null],
  ['DB', 'Dettes de location-acquisition', ['17'], null],
  ['DC', 'Provisions pour risques et charges', ['19'], null],
  ['DH', 'Dettes circulantes HAO', ['481', '482', '484', '488', '4998'], null],
  ['DI', 'Clients, avances reçues', ['41'], null],
  ['DJ', 'Fournisseurs d’exploitation', ['40'], null],
  ['DK', 'Dettes fiscales et sociales', ['42', '43', '44'], null],
  ['DM', 'Autres dettes', ['185', '45', '46', '47'], ['479']],
  ['DN', 'Provisions pour risques (court terme)', ['499', '599'], ['4998']],
  ['DQ', 'Banques, crédits d’escompte', ['564', '565'], null],
  ['DR', 'Banques, crédits de trésorerie', ['52', '53', '561', '566'], null],
  ['DV', 'Écart de conversion – passif', ['479'], null],
];

// Sous-totaux passif : [ref, label, refs]
const PASSIF_TOTAUX = [
  ['CP', 'TOTAL CAPITAUX PROPRES', ['CA', 'CB', 'CD', 'CE', 'CF', 'CG', 'CH', 'CJ', 'CL', 'CM']],
  ['DD', 'TOTAL DETTES FINANCIÈRES', ['DA', 'DB', 'DC']],
  ['DF', 'TOTAL RESSOURCES STABLES', ['CP', 'DD']],
  ['DP', 'TOTAL PASSIF CIRCULANT', ['DH', 'DI', 'DJ', 'DK', 'DM', 'DN']],
  ['DT', 'TOTAL TRÉSORERIE-PASSIF', ['DQ', 'DR']],
  ['DZ', 'TOTAL GÉNÉRAL', ['DF', 'DP', 'DT', 'DV']],
];

/* ------------------------------------------------------------------ */
/* Construction                                                        */
/* ------------------------------------------------------------------ */

function round(n) { return Math.round(Number(n) || 0); }

/**
 * Bilan modèle 2 complet (actif AA→BZ, passif CA→DZ).
 * Ne modifie jamais les écritures passées en argument.
 */
export function bilanModele2(entries, { year, resNet } = {}) {
  if (!Number.isInteger(Number(year))) {
    throw new Error('bilanModele2 : year doit être une année entière (ex. 2025).');
  }
  const y = Number(year);
  const { cumulN, cumulN1, mouvN, mouvN1 } = previousYearBalances(entries, { year: y });

  const res = resNet === undefined || resNet === null
    ? round(resultatNet(mouvN))
    : round(resNet);
  const res1 = round(resultatNet(mouvN1));

  // --- lignes élémentaires actif : valeurs brutes (non arrondies) ---
  const aRows = {};
  for (const [ref, label, bP, bM, aP, aM] of ACTIF_BRUT) {
    aRows[ref] = {
      ref, label,
      _b: sfd(cumulN, bP, bM), _a: sfc(cumulN, aP, aM),
      _b1: sfd(cumulN1, bP, bM), _a1: sfc(cumulN1, aP, aM),
    };
  }
  const sumA = (refs, k) => refs.reduce((t, r) => t + (aRows[r] ? aRows[r][k] : 0), 0);
  for (const [ref, label, refs] of ACTIF_TOTAUX) {
    aRows[ref] = {
      ref, label, total: true, detail: refs.slice(),
      _b: sumA(refs, '_b'), _a: sumA(refs, '_a'),
      _b1: sumA(refs, '_b1'), _a1: sumA(refs, '_a1'),
    };
  }

  // --- lignes élémentaires passif : valeurs brutes (sfc, signe positif) ---
  const pRows = {};
  for (const [ref, label, prefixes, minus, kind] of PASSIF) {
    let v, v1;
    if (kind === 'resnet') { v = res; v1 = res1; }
    else if (kind === 'special' && ref === 'CB') {
      // 109 : sfc − sfd
      v = sfc(cumulN, prefixes) - sfd(cumulN, prefixes);
      v1 = sfc(cumulN1, prefixes) - sfd(cumulN1, prefixes);
    } else if (kind === 'special' && ref === 'CH') {
      // 121 sfc − 129 sfd
      v = sfc(cumulN, ['121']) - sfd(cumulN, ['129']);
      v1 = sfc(cumulN1, ['121']) - sfd(cumulN1, ['129']);
    } else {
      v = sfc(cumulN, prefixes, minus);
      v1 = sfc(cumulN1, prefixes, minus);
    }
    pRows[ref] = { ref, label, _v: v, _v1: v1 };
  }
  const sumP = (refs, k) => refs.reduce((t, r) => t + (pRows[r] ? pRows[r][k] : 0), 0);
  for (const [ref, label, refs] of PASSIF_TOTAUX) {
    pRows[ref] = { ref, label, total: true, detail: refs.slice(), _v: sumP(refs, '_v'), _v1: sumP(refs, '_v1') };
  }

  // --- finalisation (arrondi d'affichage ; les contrôles restent sur le brut) ---
  const finA = (r) => {
    const out = {
      ref: r.ref, label: r.label, note: NOTES_ACTIF[r.ref] || '',
      brut: round(r._b), amort: round(r._a),
      netN: round(r._b - r._a), netN1: round(r._b1 - r._a1),
    };
    if (r.total) out.total = true;
    if (r.detail) out.detail = r.detail;
    return out;
  };
  const finP = (r) => {
    const out = {
      ref: r.ref, label: r.label, note: NOTES_PASSIF[r.ref] || '',
      brut: null, amort: null,
      netN: round(r._v), netN1: round(r._v1),
    };
    if (r.total) out.total = true;
    if (r.detail) out.detail = r.detail;
    return out;
  };

  const ordreA = [];
  for (const [ref] of ACTIF_BRUT) ordreA.push(ref);
  // Intercale les sous-totaux à leur place officielle
  const placeA = ['AE', 'AF', 'AG', 'AH', 'AD', 'AJ', 'AK', 'AL', 'AM', 'AN', 'AI', 'AP', 'AR', 'AS', 'AQ', 'AZ',
    'BA', 'BB', 'BH', 'BI', 'BJ', 'BG', 'BK', 'BQ', 'BR', 'BS', 'BT', 'BU', 'BZ'];
  const ordreP = ['CA', 'CB', 'CD', 'CE', 'CF', 'CG', 'CH', 'CJ', 'CL', 'CM', 'CP',
    'DA', 'DB', 'DC', 'DD', 'DF', 'DH', 'DI', 'DJ', 'DK', 'DM', 'DN', 'DP', 'DQ', 'DR', 'DT', 'DV', 'DZ'];

  const actif = placeA.map((ref) => finA(aRows[ref]));
  const passif = ordreP.map((ref) => finP(pRows[ref]));

  // --- totaux et contrôles (sur valeurs brutes, tolérance 1 FCFA d'arrondi) ---
  const raw = {
    brutA: aRows.BZ._b, amortA: aRows.BZ._a,
    netAN: aRows.BZ._b - aRows.BZ._a, netAN1: aRows.BZ._b1 - aRows.BZ._a1,
    netPN: pRows.DZ._v, netPN1: pRows.DZ._v1,
  };
  return {
    year: y,
    resNet: res, resNetN1: res1,
    actif, passif,
    totaux: {
      brutA: round(raw.brutA), amortA: round(raw.amortA),
      netAN: round(raw.netAN), netAN1: round(raw.netAN1),
      netPN: round(raw.netPN), netPN1: round(raw.netPN1),
    },
    controles: {
      actifEqPassif: Math.abs(raw.netAN - raw.netPN) < 1,
      actifEqPassifN1: Math.abs(raw.netAN1 - raw.netPN1) < 1,
      ecart: round(raw.netAN - raw.netPN),
      ecartN1: round(raw.netAN1 - raw.netPN1),
    },
  };
}
