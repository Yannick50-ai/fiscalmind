/**
 * CE (Compte d'exploitation) + PT (Plan de trésorerie) — moteurs ES purs.
 *
 * Port du classeur « NO-Pro.V2 » (feuilles COMPTE D'EXPLOITATION REEL/PREVISION
 * et PLAN DE TRESORERIE REEL/PREVISIONNEL), vérifié dans le fichier source :
 * table de correspondance (TDC) col FV (Code PT) / FW (Code CE) / FZ (N° compte) /
 * GA (Sens imputation Débit/Crédit) / GB (Signe) — voir
 * migration/analyse-liasse-ce-pt-ratios.md §3, §4 et annexe A.
 *
 * Conventions du moteur :
 *  - lignes aplaties { date: 'AAAA-MM-JJ', compte, debit, credit }
 *    (journal.js → toLines) ; montants en FCFA entiers ;
 *  - année civile (même hypothèse que le reste du SaaS) ;
 *  - CE : un poste vaut TOUJOURS le solde signé Σ(Mc − Md) de ses comptes,
 *    mois par mois. Le sens comptable normal fait le reste : un produit
 *    (compte créditeur) sort positif, une charge (compte débiteur) sort
 *    négative, une variation de stocks sort + (stockage) ou − (déstockage).
 *    C'est la règle d'affichage du classeur (« produits +, charges − »),
 *    appliquée ici sur le NET des mouvements (le classeur ne prenait qu'un
 *    seul sens Md_GL/Mc_GL : le net gère en plus avoirs et extournes, et
 *    garantit XI = résultat net du compte de résultat).
 *    Écart assumé avec le classeur : sa TDC ne mappe les variations
 *    (6031/6032/6033) qu'au débit ; le net (Mc − Md) est la règle OHADA
 *    correcte pour XA/XC.
 *  - PT : montants directionnels comme la TDC (E = crédits, D = débits),
 *    AF = attrape-tout résiduel — formule EXACTE de la TDC (lignes 364-387 :
 *    52/57 ±, moins les crédits E1–E4, plus les débits D1–D6) :
 *    AF = Σ(Md − Mc)[52,57] − ΣE + ΣD. Le PT est donc auto-équilibré :
 *    encaissements − décaissements + AF = variation réelle de trésorerie.
 *  - prévoir() : moteur de prévision du classeur
 *    prévision_mensuelle = réel_mensuel × (1 + variation_souhaitée / total_réel)
 *    (saisonnalité conservée). Écart assumé : si total_réel = 0 le classeur
 *    renvoie 0 (IFERROR) ; ici on répartit la variation uniformément
 *    (demande produit explicite).
 */

/* ------------------------------------------------------------------ */
/* 1. Mouvements mensuels                                              */
/* ------------------------------------------------------------------ */

/**
 * Mouvements débit/crédit par compte et par mois pour un exercice (année civile).
 * @param {Array} lines lignes aplaties { date, compte, debit, credit }
 * @param {Object} opts { year } (année civile, ex. 2025 ou '2025')
 * @returns {Object} { '401': { md: [12], mc: [12] }, ... } (mois 0 = janvier)
 */
export function monthlyMovements(lines, { year }) {
  const y = String(year);
  const out = {};
  for (const l of lines || []) {
    const d = String((l && l.date) || '');
    if (d.length < 7 || d.slice(0, 4) !== y) continue;
    const m = Number(d.slice(5, 7)) - 1;
    if (!(m >= 0 && m < 12)) continue;
    const c = String((l && l.compte) || '');
    if (!c) continue;
    let e = out[c];
    if (!e) e = out[c] = { md: new Array(12).fill(0), mc: new Array(12).fill(0) };
    e.md[m] += Math.round(Number(l.debit) || 0);
    e.mc[m] += Math.round(Number(l.credit) || 0);
  }
  return out;
}

/** Somme Md/Mc d'un mois sur des préfixes de comptes. */
function sumPrefixes(mm, prefixes, m) {
  let md = 0, mc = 0;
  for (const c of Object.keys(mm)) {
    let hit = false;
    for (const p of prefixes) { if (c.indexOf(p) === 0) { hit = true; break; } }
    if (!hit) continue;
    md += mm[c].md[m]; mc += mm[c].mc[m];
  }
  return { md, mc };
}

const ZERO12 = () => new Array(12).fill(0);

/* ------------------------------------------------------------------ */
/* 2. Compte d'exploitation (CE)                                       */
/* ------------------------------------------------------------------ */

// Table de correspondance compte → REF (annexe A de l'analyse).
// sens : 'P' produit (signe +1) · 'C' charge (signe −1) · 'V' variation algébrique (signe 0).
const CE_POSTES = [
  { ref: 'TA', label: 'Ventes de marchandises', comptes: ['701'], sens: 'P' },
  { ref: 'RA', label: 'Achats de marchandises', comptes: ['601'], sens: 'C' },
  { ref: 'RB', label: 'Variation de stocks de marchandises', comptes: ['6031'], sens: 'V' },
  { ref: 'TB', label: 'Ventes de produits fabriqués', comptes: ['702', '703', '704'], sens: 'P' },
  { ref: 'TC', label: 'Travaux, services vendus', comptes: ['705', '706'], sens: 'P' },
  { ref: 'TD', label: 'Produits accessoires', comptes: ['707'], sens: 'P' },
  { ref: 'TE', label: 'Production stockée (ou déstockage)', comptes: ['73'], sens: 'P' },
  { ref: 'TF', label: 'Production immobilisée', comptes: ['72'], sens: 'P' },
  { ref: 'TG', label: "Subventions d'exploitation", comptes: ['71'], sens: 'P' },
  { ref: 'TH', label: 'Autres produits', comptes: ['75'], sens: 'P' },
  { ref: 'TI', label: "Transferts de charges d'exploitation", comptes: ['781'], sens: 'P' },
  { ref: 'RC', label: 'Achats de matières premières et fournitures liées', comptes: ['602'], sens: 'C' },
  { ref: 'RD', label: 'Variation de stocks de matières premières', comptes: ['6032'], sens: 'V' },
  { ref: 'RE', label: 'Autres achats', comptes: ['604', '605', '608'], sens: 'C' },
  { ref: 'RF', label: "Variation de stocks d'autres approvisionnements", comptes: ['6033'], sens: 'V' },
  { ref: 'RG', label: 'Transports', comptes: ['61'], sens: 'C' },
  { ref: 'RH', label: 'Services extérieurs', comptes: ['62', '63'], sens: 'C' },
  { ref: 'RI', label: 'Impôts et taxes', comptes: ['64'], sens: 'C' },
  { ref: 'RJ', label: 'Autres charges', comptes: ['65'], sens: 'C' },
  { ref: 'RK', label: 'Charges de personnel', comptes: ['66'], sens: 'C' },
  { ref: 'TJ', label: 'Reprises d’amortissements, provisions et dépréciations', comptes: ['791', '798', '799'], sens: 'P' },
  { ref: 'RL', label: 'Dotations aux amortissements, aux provisions et dépréciations', comptes: ['681', '691'], sens: 'C' },
  { ref: 'TK', label: 'Revenus financiers et assimilés', comptes: ['77'], sens: 'P' },
  { ref: 'TL', label: 'Reprises de provisions et dépréciations financières', comptes: ['797'], sens: 'P' },
  { ref: 'TM', label: 'Transferts de charges financières', comptes: ['787'], sens: 'P' },
  { ref: 'RM', label: 'Frais financiers et charges assimilées', comptes: ['67'], sens: 'C' },
  { ref: 'RN', label: 'Dotations aux provisions et aux dépréciations financières', comptes: ['697'], sens: 'C' },
  { ref: 'TN', label: "Produits des cessions d'immobilisations", comptes: ['82'], sens: 'P' },
  { ref: 'TO', label: 'Autres Produits HAO', comptes: ['84', '86', '88'], sens: 'P' },
  { ref: 'RO', label: 'Valeurs comptables des cessions d’immobilisations', comptes: ['81'], sens: 'C' },
  { ref: 'RP', label: 'Autres Charges HAO', comptes: ['83', '85'], sens: 'C' },
  { ref: 'RQ', label: 'Participation des travailleurs', comptes: ['87'], sens: 'C' },
  { ref: 'RS', label: 'Impôts sur le résultat', comptes: ['89'], sens: 'C' },
];

// Soldes intermédiaires de gestion (annexe A) : chaque SIG somme des REFs
// déjà signés (postes ou SIG antérieurs), mois par mois.
const CE_SIG = [
  { ref: 'XA', label: 'Marge commerciale', refs: ['TA', 'RA', 'RB'] },
  { ref: 'XB', label: "Chiffre d'affaires", refs: ['TA', 'TB', 'TC', 'TD'] },
  { ref: 'XC', label: 'Valeur ajoutée', refs: ['XA', 'TB', 'TC', 'TD', 'TE', 'TF', 'TG', 'TH', 'TI', 'RC', 'RD', 'RE', 'RF', 'RG', 'RH', 'RI', 'RJ'] },
  { ref: 'XD', label: "Excédent brut d'exploitation", refs: ['XC', 'RK'] },
  { ref: 'XE', label: "Résultat d'exploitation", refs: ['XD', 'TJ', 'RL'] },
  { ref: 'XF', label: 'Résultat financier', refs: ['TK', 'TL', 'TM', 'RM', 'RN'] },
  { ref: 'XG', label: 'Résultat des activités ordinaires', refs: ['XE', 'XF'] },
  { ref: 'XH', label: 'Résultat hors activités ordinaires', refs: ['TN', 'TO', 'RO', 'RP'] },
  { ref: 'XI', label: 'Résultat net', refs: ['XG', 'XH', 'RQ', 'RS'] },
];

/**
 * Compte d'exploitation mensuel de gestion (réel).
 * @returns { year, postes: [{ ref, label, signe, mois: [12], total }],
 *            sig: [{ ref, label, mois: [12], total }] }
 */
export function compteExploitation(lines, { year }) {
  const mm = monthlyMovements(lines, { year });
  const postes = CE_POSTES.map(p => {
    const mois = ZERO12();
    for (let m = 0; m < 12; m++) {
      const { md, mc } = sumPrefixes(mm, p.comptes, m);
      mois[m] = mc - md;
    }
    return {
      ref: p.ref,
      label: p.label,
      signe: p.sens === 'C' ? -1 : (p.sens === 'V' ? 0 : 1),
      mois,
      total: mois.reduce((a, b) => a + b, 0),
    };
  });
  return { year: String(year), postes, sig: sigCE(postes) };
}

/**
 * Soldes intermédiaires de gestion XA→XI depuis des postes CE
 * (réels ou prévisionnels : mêmes REFs, mêmes formules).
 * @param {Array} postes [{ ref, mois: [12] }]
 * @returns {Array} [{ ref, label, mois: [12], total }]
 */
export function sigCE(postes) {
  const byRef = {};
  (postes || []).forEach(p => { byRef[p.ref] = p; });
  return CE_SIG.map(s => {
    const mois = ZERO12();
    for (let m = 0; m < 12; m++) {
      let v = 0;
      for (const r of s.refs) v += (byRef[r] ? byRef[r].mois[m] : 0);
      mois[m] = v;
    }
    const row = { ref: s.ref, label: s.label, mois, total: mois.reduce((a, b) => a + b, 0) };
    byRef[s.ref] = row;
    return row;
  });
}

/* ------------------------------------------------------------------ */
/* 3. Plan de trésorerie (PT)                                          */
/* ------------------------------------------------------------------ */

// Table de correspondance PT (TDC col FV/FZ/GA, §4 de l'analyse).
// E = encaissements (crédits), D = décaissements (débits), AF = résiduel.
const PT_REFS = [
  { ref: 'E1', label: 'Règlements Clients', comptes: ['411'], dir: 'credit' },
  { ref: 'E2', label: 'Apports en Capital / C/C Associés', comptes: ['10', '46'], dir: 'credit' },
  { ref: 'E3', label: 'Emprunts', comptes: ['16'], dir: 'credit' },
  { ref: 'E4', label: 'Autres produits (Cessions, etc.)', comptes: ['82', '745'], dir: 'credit' },
  { ref: 'D1', label: 'Règlements Fournisseurs', comptes: ['401'], dir: 'debit' },
  { ref: 'D2', label: 'Salaires', comptes: ['422'], dir: 'debit' },
  { ref: 'D3', label: 'Charges Sociales (CNPS/CSS…)', comptes: ['43'], dir: 'debit' },
  { ref: 'D4', label: 'Impôts & Taxes (TVA, IS…)', comptes: ['44'], dir: 'debit' },
  { ref: 'D5', label: 'Remboursement Emprunt', comptes: ['16', '67'], dir: 'debit' },
  { ref: 'D6', label: 'Investissements (Matériel…)', comptes: ['20', '21', '22', '23', '24', '25', '26', '27'], dir: 'debit' },
];

const PT_CASH = ['52', '57'];

/**
 * Plan de trésorerie mensuel par nature de flux (réel).
 * AF (Autres opérations) = attrape-tout résiduel, formule exacte de la TDC :
 * AF = variation nette de trésorerie − ΣE + ΣD.
 * @returns { year, refs: [{ ref, label, signe, mois: [12], total }],
 *            totaux: { encaissements: [12], decaissements: [12], net: [12] },
 *            solde: [12] } — solde = trésorerie cumulée (Σ net).
 */
export function planTresorerie(lines, { year }) {
  const mm = monthlyMovements(lines, { year });
  const enc = ZERO12(), dec = ZERO12(), cashNet = ZERO12();
  for (let m = 0; m < 12; m++) {
    const c = sumPrefixes(mm, PT_CASH, m);
    cashNet[m] = c.md - c.mc;
  }
  const refs = PT_REFS.map(p => {
    const mois = ZERO12();
    for (let m = 0; m < 12; m++) {
      const { md, mc } = sumPrefixes(mm, p.comptes, m);
      mois[m] = p.dir === 'credit' ? mc : md;
      if (p.ref.charAt(0) === 'E') enc[m] += mois[m]; else dec[m] += mois[m];
    }
    return {
      ref: p.ref,
      label: p.label,
      signe: p.ref.charAt(0) === 'E' ? 1 : -1,
      mois,
      total: mois.reduce((a, b) => a + b, 0),
    };
  });
  // AF inséré entre E4 et D1 (ordre du classeur : E1–E4, AF, D1–D6).
  const afMois = ZERO12();
  for (let m = 0; m < 12; m++) afMois[m] = cashNet[m] - enc[m] + dec[m];
  refs.splice(4, 0, {
    ref: 'AF', label: 'Autres opérations', signe: 0,
    mois: afMois, total: afMois.reduce((a, b) => a + b, 0),
  });
  const net = ZERO12(), solde = ZERO12();
  let cumul = 0;
  for (let m = 0; m < 12; m++) {
    net[m] = enc[m] - dec[m] + afMois[m]; // = cashNet[m] par construction
    cumul += net[m];
    solde[m] = cumul;
  }
  return {
    year: String(year),
    refs,
    totaux: { encaissements: enc, decaissements: dec, net },
    solde,
  };
}

/* ------------------------------------------------------------------ */
/* 4. Moteur de prévision                                              */
/* ------------------------------------------------------------------ */

/**
 * Projette une série mensuelle réelle vers le prévisionnel.
 * Formule du classeur : prévision_m = réel_m × (1 + variation / total_réel)
 * (la saisonnalité du réel est conservée ; l'utilisateur ne saisit qu'un
 * objectif global). Montants arrondis à l'entier, écart d'arrondi imputé
 * au mois le plus significatif.
 *
 * @param {Array<number>} reel 12 valeurs mensuelles réelles
 * @param {Object} objectifs { variation } (montant absolu, prioritaire —
 *   colonne AM « VARIATION SOUHAITEE » du classeur) ou { variationPct }
 *   (taux en %, ex. 10 = +10 % — colonne AL « Taux de variation souhaité »).
 *   variation négative = objectif de baisse.
 * @returns {Array<number>} 12 valeurs prévisionnelles (entiers)
 * Règles : variation = 0 → copie du réel ; total_réel = 0 (et variation ≠ 0)
 * → répartition uniforme de la variation sur 12 mois.
 */
export function prevoir(reel, objectifs) {
  const base = Array.from({ length: 12 }, (_, i) => Math.round(Number((reel || [])[i]) || 0));
  const obj = objectifs || {};
  const total = base.reduce((a, b) => a + b, 0);
  let variation = 0;
  if (obj.variation !== undefined && obj.variation !== null && obj.variation !== '') {
    variation = Math.round(Number(obj.variation) || 0);
  } else if (obj.variationPct !== undefined && obj.variationPct !== null && obj.variationPct !== '') {
    variation = Math.round((Number(obj.variationPct) || 0) / 100 * total);
  }
  if (variation === 0) return base.slice();
  const target = total + variation;
  let raw;
  if (total === 0) {
    raw = new Array(12).fill(variation / 12); // uniforme (le classeur renverrait 0)
  } else {
    const k = 1 + variation / total;
    raw = base.map(v => v * k);
  }
  const out = raw.map(v => Math.round(v));
  const drift = Math.round(target) - out.reduce((a, b) => a + b, 0);
  if (drift !== 0) {
    let idx = 11, best = -1;
    out.forEach((v, i) => { const a = Math.abs(v); if (a > best) { best = a; idx = i; } });
    out[idx] += drift;
  }
  return out;
}

/** Références CE (ordre d'affichage) — utile à l'UI. */
export function ceRefs() { return CE_POSTES.map(p => ({ ref: p.ref, label: p.label })); }

/** Références PT (ordre d'affichage) — utile à l'UI. */
export function ptRefs() {
  return [
    ...PT_REFS.slice(0, 4).map(p => ({ ref: p.ref, label: p.label })),
    { ref: 'AF', label: 'Autres opérations' },
    ...PT_REFS.slice(4).map(p => ({ ref: p.ref, label: p.label })),
  ];
}
