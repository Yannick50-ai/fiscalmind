/**
 * Notes annexes OHADA (1–36) — Phase 4 de la migration FiscalMind Africa.
 *
 * Référence : analyse-dsf-ohada.md §5 — trois familles :
 *  1. Tableaux de mouvements (3A, 3C, 28) : ouverture = S.I., flux = MOUV. N,
 *     clôture = ouverture + flux(+) − flux(−). Les MOUV. viennent de `mouvN`
 *     (previous-year.js) : { compte: { md, mc, solde } }.
 *  2. Soldes N / N-1 + variation % (4, 6–14, 15A, 16A, 17–27A, 29, 30, 32–34) :
 *     postes du bilan → soldes cumulés (cumulN/cumulN1), postes du résultat →
 *     mouvements de l'exercice (mouvN/mouvN1). Montants présentés en valeur
 *     absolue (sens naturel du poste), sauf note 34 (SIG signés) et totaux
 *     nets des notes 29/30.
 *  3. Manuelles (1, 2, 3B, 3D, 3E, 5, 15B, 16B, 16C, 27B, 31, 35, 36) :
 *     formulaires de saisie ; les valeurs sont injectées via `manuelles`
 *     (persistées côté app en `fm_settings`, clés `notes_man_<n>`).
 *
 * `notesAnnexes(entries, { year, manuelles })` → `{ year, notes }`,
 * chaque note : `{ numero, titre, statut: 'calculee'|'manuelle',
 * type: 'mouvements'|'soldes'|'manuelle', colonnes, lignes, formulaire }`.
 *  - mouvements : lignes { label, compte, ouverture, plus, moins, cloture }
 *  - soldes     : lignes { label, compte, n, n1, varPct } (varPct null si N-1 = 0)
 *  - manuelle   : formulaire [{ key, label, type, value }], lignes []
 *
 * Pure ES module, zéro dépendance métier autre que les moteurs existants
 * (previous-year, labels, compte-resultat-sig) — aucun DOM, aucun stockage.
 */

import { previousYearBalances } from './previous-year.js';
import { accountLabel } from './labels.js';
import { compteResultatSIG } from './compte-resultat-sig.js';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Somme { md, mc, solde } des comptes dont le n° commence par un préfixe. */
export function sumPrefixes(map, prefixes) {
  const prefs = Array.isArray(prefixes) ? prefixes : [prefixes];
  let md = 0, mc = 0, solde = 0;
  for (const key of Object.keys(map || {})) {
    if (prefs.some((p) => key === p || key.startsWith(p))) {
      const v = map[key] || {};
      md += v.md || 0;
      mc += v.mc || 0;
      solde += v.solde || 0;
    }
  }
  return { md, mc, solde };
}

/** Variation % N vs N-1 ; null quand N-1 = 0 (non calculable). */
export function variationPct(n, n1) {
  const a = Number(n) || 0;
  const b = Number(n1) || 0;
  if (b === 0) return null;
  return ((a - b) / Math.abs(b)) * 100;
}

function fmtVarPct(v) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const s = v.toFixed(1).replace('.', ',');
  return (v >= 0 ? '+' : '') + s + ' %';
}

/** Normalise un poste : '31' → { prefix: '31' } (chaîne ou objet acceptés). */
function normPoste(p, defaults) {
  const o = typeof p === 'string' ? { prefix: p } : (p || {});
  return Object.assign({ champ: 'abs' }, defaults || {}, o);
}

/** −0 → 0 (les comparaisons strictes distinguent les deux). */
function nz(v) {
  return v === 0 ? 0 : v;
}

/* ------------------------------------------------------------------ */
/* Constructeurs de notes calculées                                    */
/* ------------------------------------------------------------------ */

/**
 * Tableau de mouvements.
 * postes : [{ prefix, label?, ouvSens: 'D'|'C', plus: 'md'|'mc' }]
 *  - ouverture : S.I. (cumulN1) au sens naturel du compte ;
 *  - plus/moins : mouvements N (mouvN), clôture = ouv + plus − moins.
 */
function buildMouvements({ numero, titre, bal, postes, colPlus, colMoins }) {
  const lignes = postes.map((raw) => {
    const p = normPoste(raw);
    const ouvBal = sumPrefixes(bal.cumulN1, p.prefix);
    const mouv = sumPrefixes(bal.mouvN, p.prefix);
    const ouverture = nz(p.ouvSens === 'C' ? -ouvBal.solde : ouvBal.solde);
    const plus = nz(p.plus === 'md' ? mouv.md : mouv.mc);
    const moins = nz(p.plus === 'md' ? mouv.mc : mouv.md);
    return {
      label: p.label || accountLabel(p.prefix),
      compte: p.prefix,
      ouverture,
      plus,
      moins,
      cloture: ouverture + plus - moins,
    };
  });
  const tot = (k) => lignes.reduce((a, l) => a + (l[k] || 0), 0);
  lignes.push({
    label: 'TOTAL', compte: '', isTotal: true,
    ouverture: tot('ouverture'), plus: tot('plus'), moins: tot('moins'), cloture: tot('cloture'),
  });
  return {
    numero, titre, statut: 'calculee', type: 'mouvements',
    colonnes: ['Rubrique', 'Ouverture', colPlus, colMoins, 'Clôture'],
    lignes, formulaire: [],
  };
}

/**
 * Soldes N / N-1 + variation %.
 * postes : [{ prefix, label?, champ: 'abs'|'md'|'mc' }]
 * source 'cumul' (bilan, classes 1-5) ou 'mouv' (résultat, classes 6/7/8).
 * total : 'sum' (défaut) ou fonction (lignes) → { n, n1 } (ex. résultat net).
 */
function buildSoldes({ numero, titre, bal, source, postes, total }) {
  const cumul = source === 'cumul';
  const pick = (v, champ) => (champ === 'md' ? v.md : champ === 'mc' ? v.mc : Math.abs(v.solde));
  const lignes = postes.map((raw) => {
    const p = normPoste(raw);
    const n = pick(sumPrefixes(cumul ? bal.cumulN : bal.mouvN, p.prefix), p.champ || 'abs');
    const n1 = pick(sumPrefixes(cumul ? bal.cumulN1 : bal.mouvN1, p.prefix), p.champ || 'abs');
    return {
      label: p.label || accountLabel(p.prefix),
      compte: p.prefix, n, n1, varPct: variationPct(n, n1),
    };
  });
  let t;
  if (typeof total === 'function') {
    t = total(lignes);
  } else {
    t = { n: lignes.reduce((a, l) => a + l.n, 0), n1: lignes.reduce((a, l) => a + l.n1, 0) };
  }
  lignes.push({
    label: 'TOTAL', compte: '', isTotal: true,
    n: t.n, n1: t.n1, varPct: variationPct(t.n, t.n1),
  });
  return {
    numero, titre, statut: 'calculee', type: 'soldes',
    colonnes: ['Rubrique', 'N', 'N-1', 'Variation %'],
    lignes, formulaire: [],
  };
}

/** Note manuelle : formulaire de saisie (valeurs injectées via `manuelles`). */
function buildManuelle({ numero, titre, formulaire, valeurs }) {
  const vals = valeurs || {};
  return {
    numero, titre, statut: 'manuelle', type: 'manuelle',
    colonnes: [], lignes: [],
    formulaire: formulaire.map((f) => Object.assign({}, f, {
      value: vals[f.key] !== undefined && vals[f.key] !== null ? String(vals[f.key]) : '',
    })),
  };
}

/** Note 34 : synthèse des SIG (depuis compteResultatSIG, valeurs signées). */
function buildNote34(entries, year) {
  const cr = compteResultatSIG(entries, { year });
  const lignes = cr.lignes
    .filter((l) => l.isSig)
    .map((l) => ({
      label: l.label, compte: l.ref, n: l.n, n1: l.n1, varPct: variationPct(l.n, l.n1),
    }));
  return {
    numero: '34',
    titre: 'Fiche de synthèse des principaux indicateurs financiers',
    statut: 'calculee', type: 'soldes',
    colonnes: ['Indicateur (SIG)', 'N', 'N-1', 'Variation %'],
    lignes, formulaire: [],
  };
}

/** Total net « produits − charges » (notes 29 et 30). */
function totalNet(lignes) {
  // Convention : lignes[0] = charges, lignes[1] = produits.
  return { n: lignes[1].n - lignes[0].n, n1: lignes[1].n1 - lignes[0].n1 };
}

/* ------------------------------------------------------------------ */
/* Définitions des 44 notes (ordre officiel)                           */
/* ------------------------------------------------------------------ */

const TXT = (label) => [{ key: 'texte', label, type: 'textarea' }];

const NOTES_DEF = [
  { numero: '1', titre: 'Dettes garanties par des sûretés réelles et engagements financiers', kind: 'manuelle', formulaire: TXT('Dettes garanties par des sûretés réelles et engagements financiers (détail libre)') },
  { numero: '2', titre: 'Informations obligatoires', kind: 'manuelle', formulaire: TXT('Informations obligatoires (détail libre)') },
  {
    numero: '3A', titre: 'Immobilisations brutes', kind: 'mouvements',
    // '20' absent du plan migré → libellé explicite (pas de modification du plan).
    postes: ['20', '21', '22', '23', '24', '25', '26', '27'].map((p) => ({
      prefix: p, ouvSens: 'D', plus: 'md',
      label: p === '20' ? 'Charges immobilisées' : undefined,
    })),
    colPlus: 'Acquisitions', colMoins: 'Cessions',
  },
  { numero: '3B', titre: 'Biens pris en location-acquisition', kind: 'manuelle', formulaire: TXT('Biens pris en location-acquisition (détail libre)') },
  {
    numero: '3C', titre: 'Amortissements', kind: 'mouvements',
    postes: [{ prefix: '28', ouvSens: 'C', plus: 'mc' }],
    colPlus: 'Dotations', colMoins: 'Sorties',
  },
  { numero: '3D', titre: 'Plus-values et moins-values sur cessions d’immobilisations', kind: 'manuelle', formulaire: TXT('Plus-values et moins-values sur cessions (détail libre)') },
  { numero: '3E', titre: 'Informations sur les réévaluations', kind: 'manuelle', formulaire: TXT('Réévaluations effectuées par l’entreprise (détail libre)') },
  { numero: '4', titre: 'Immobilisations financières', kind: 'soldes', source: 'cumul', postes: ['271', '272', '273', '274', '275'] },
  { numero: '5', titre: 'Actif circulant et dettes circulantes HAO', kind: 'manuelle', formulaire: TXT('Actif circulant et dettes circulantes HAO (détail libre)') },
  { numero: '6', titre: 'Stocks', kind: 'soldes', source: 'cumul', postes: ['31', '32', '33'] },
  { numero: '7', titre: 'Clients', kind: 'soldes', source: 'cumul', postes: ['411', '412', '413', '414', '415', '416', '417', '418'] },
  { numero: '8', titre: 'Autres créances', kind: 'soldes', source: 'cumul', postes: ['42', '43', '44', '45', '46', '471', '472', '473', '474', '475', '476', '477'] },
  { numero: '8A', titre: 'Tableau d’étalement des charges immobilisées', kind: 'manuelle', formulaire: TXT('Charges immobilisées — tableau d’étalement (détail libre)') },
  { numero: '9', titre: 'Titres de placement', kind: 'soldes', source: 'cumul', postes: ['501', '502', '503', '504'] },
  { numero: '10', titre: 'Valeurs à encaisser', kind: 'soldes', source: 'cumul', postes: ['51'] },
  { numero: '11', titre: 'Disponibilités', kind: 'soldes', source: 'cumul', postes: ['52', '53', '54', '56', '57', '58'] },
  { numero: '12', titre: 'Écarts de conversion et transferts de charges', kind: 'soldes', source: 'cumul', postes: ['478', '479'] },
  { numero: '13', titre: 'Capital : valeur nominale des actions ou parts', kind: 'soldes', source: 'cumul', postes: ['101', '102', '103', '104', '105'] },
  { numero: '14', titre: 'Primes et réserves', kind: 'soldes', source: 'cumul', postes: ['11'] },
  { numero: '15A', titre: 'Subventions et provisions réglementées', kind: 'soldes', source: 'cumul', postes: ['14'] },
  { numero: '15B', titre: 'Autres fonds propres', kind: 'manuelle', formulaire: TXT('Autres fonds propres (détail libre)') },
  { numero: '16A', titre: 'Dettes financières', kind: 'soldes', source: 'cumul', postes: ['16', '17', '18'] },
  {
    numero: '16B', titre: 'Engagements de retraite et avantages assimilés (méthode actuarielle)', kind: 'manuelle',
    formulaire: [
      { key: 'moins_1an', label: 'Échéance à moins d’1 an (FCFA)', type: 'number' },
      { key: 'un_a_5ans', label: 'Échéance de 1 à 5 ans (FCFA)', type: 'number' },
      { key: 'plus_5ans', label: 'Échéance à plus de 5 ans (FCFA)', type: 'number' },
    ],
  },
  { numero: '16B bis', titre: 'Engagements de retraite et avantages assimilés — informations complémentaires', kind: 'manuelle', formulaire: TXT('Engagements de retraite — informations complémentaires (détail libre)') },
  { numero: '16C', titre: 'Actifs et passifs éventuels', kind: 'manuelle', formulaire: TXT('Actifs et passifs éventuels (détail libre)') },
  { numero: '17', titre: 'Fournisseurs d’exploitation', kind: 'soldes', source: 'cumul', postes: ['401', '402', '408'] },
  { numero: '18', titre: 'Dettes fiscales et sociales', kind: 'soldes', source: 'cumul', postes: ['43', '44'] },
  { numero: '19', titre: 'Autres dettes et provisions pour risques à court terme', kind: 'soldes', source: 'cumul', postes: ['42', '45', '46', '47', '48', '49'] },
  { numero: '20', titre: 'Banques, crédits d’escompte et trésorerie', kind: 'soldes', source: 'cumul', postes: ['52', '53', '56'] },
  { numero: '21', titre: 'Chiffre d’affaires et autres produits', kind: 'soldes', source: 'mouv', postes: ['701', '702', '703', '704', '705', '706', '707'].map((p) => ({ prefix: p, champ: 'mc' })) },
  { numero: '22', titre: 'Achats', kind: 'soldes', source: 'mouv', postes: ['601', '602', '604', '605', '608'].map((p) => ({ prefix: p, champ: 'md' })) },
  { numero: '23', titre: 'Transports', kind: 'soldes', source: 'mouv', postes: [{ prefix: '61', champ: 'md' }] },
  { numero: '24', titre: 'Services extérieurs', kind: 'soldes', source: 'mouv', postes: ['621', '622', '623', '624', '625', '626', '627', '628'].map((p) => ({ prefix: p, champ: 'md' })) },
  { numero: '25', titre: 'Impôts et taxes', kind: 'soldes', source: 'mouv', postes: [{ prefix: '64', champ: 'md' }] },
  { numero: '26', titre: 'Autres charges', kind: 'soldes', source: 'mouv', postes: [{ prefix: '65', champ: 'md' }] },
  { numero: '27A', titre: 'Charges et dettes de personnel', kind: 'soldes', source: 'mouv', postes: ['661', '662', '663', '664', '666', '667', '668'].map((p) => ({ prefix: p, champ: 'md' })) },
  {
    numero: '27B', titre: 'Effectif, masse salariale et personnel extérieur', kind: 'manuelle',
    formulaire: [
      { key: 'effectif_moyen', label: 'Effectif moyen', type: 'number' },
      { key: 'masse_salariale', label: 'Masse salariale (FCFA)', type: 'number' },
      { key: 'personnel_exterieur', label: 'Personnel extérieur (nombre)', type: 'number' },
    ],
  },
  {
    numero: '28', titre: 'Provisions', kind: 'mouvements',
    postes: [
      { prefix: '19', ouvSens: 'C', plus: 'mc' },
      { prefix: '29', ouvSens: 'C', plus: 'mc' },
      { prefix: '39', ouvSens: 'C', plus: 'mc' },
      { prefix: '49', ouvSens: 'C', plus: 'mc' },
      { prefix: '59', ouvSens: 'C', plus: 'mc' },
      { prefix: '69', label: 'Dotations aux provisions et aux dépréciations (69)', ouvSens: 'D', plus: 'md' },
    ],
    colPlus: 'Dotations', colMoins: 'Reprises',
  },
  {
    numero: '29', titre: 'Charges et revenus financiers', kind: 'soldes', source: 'mouv',
    postes: [
      { prefix: '67', champ: 'md', label: 'Charges financières (67)' },
      { prefix: '77', champ: 'mc', label: 'Revenus financiers (77)' },
    ],
    total: totalNet, totalLabel: 'RÉSULTAT FINANCIER',
  },
  {
    numero: '30', titre: 'Autres charges et produits HAO', kind: 'soldes', source: 'mouv',
    postes: [
      { prefix: '81', champ: 'md', label: 'Valeurs comptables des cessions HAO (81)' },
      { prefix: '83', champ: 'md', label: 'Charges HAO (83)' },
      { prefix: '85', champ: 'md', label: 'Dotations HAO (85)' },
      { prefix: '82', champ: 'mc', label: 'Produits des cessions HAO (82)' },
      { prefix: '84', champ: 'mc', label: 'Produits HAO (84)' },
      { prefix: '86', champ: 'mc', label: 'Reprises HAO (86)' },
    ],
    total: (lignes) => {
      const charges = lignes.slice(0, 3).reduce((a, l) => a + l.n, 0);
      const produits = lignes.slice(3).reduce((a, l) => a + l.n, 0);
      const charges1 = lignes.slice(0, 3).reduce((a, l) => a + l.n1, 0);
      const produits1 = lignes.slice(3).reduce((a, l) => a + l.n1, 0);
      return { n: produits - charges, n1: produits1 - charges1 };
    },
    totalLabel: 'RÉSULTAT HAO',
  },
  { numero: '31', titre: 'Répartition du résultat et éléments caractéristiques des cinq derniers exercices', kind: 'manuelle', formulaire: TXT('Répartition du résultat — cinq derniers exercices (détail libre)') },
  { numero: '32', titre: 'Production de l’exercice', kind: 'soldes', source: 'mouv', postes: [{ prefix: '72', champ: 'mc' }, { prefix: '73', champ: 'mc' }] },
  { numero: '33', titre: 'Achats destinés à la production', kind: 'soldes', source: 'mouv', postes: [{ prefix: '601', champ: 'md' }, { prefix: '602', champ: 'md' }] },
  { numero: '34', titre: 'Fiche de synthèse des principaux indicateurs financiers', kind: 'sig' },
  { numero: '35', titre: 'Liste des informations sociales, environnementales et sociétales', kind: 'manuelle', formulaire: TXT('Informations sociales, environnementales et sociétales (détail libre)') },
  { numero: '36', titre: 'Tables des codes', kind: 'manuelle', formulaire: TXT('Tables des codes (détail libre)') },
];

/** Liste ordonnée { numero, titre, statut } pour le sélecteur de l’UI. */
export const NOTES_TITRES = NOTES_DEF.map((d) => ({
  numero: d.numero,
  titre: d.titre,
  statut: d.kind === 'manuelle' ? 'manuelle' : 'calculee',
}));

/** Clé fm_settings d’une note manuelle. */
export function manualSettingKey(numero) {
  return 'notes_man_' + String(numero);
}

/* ------------------------------------------------------------------ */
/* API principale                                                       */
/* ------------------------------------------------------------------ */

/**
 * Calcule les 44 notes annexes pour l’exercice `year` (année civile).
 * @param {Array} entries écritures canoniques { id, date, journal, piece, libelle, lignes }
 * @param {Object} opts { year, manuelles: { [numero]: { champ: valeur } } }
 * @returns { year, notes: [...] }
 */
export function notesAnnexes(entries, { year, manuelles } = {}) {
  const bal = previousYearBalances(entries, { year }); // lève si année invalide
  const man = manuelles && typeof manuelles === 'object' ? manuelles : {};
  const notes = NOTES_DEF.map((def) => {
    if (def.kind === 'mouvements') {
      return buildMouvements({ numero: def.numero, titre: def.titre, bal, postes: def.postes, colPlus: def.colPlus, colMoins: def.colMoins });
    }
    if (def.kind === 'soldes') {
      const note = buildSoldes({ numero: def.numero, titre: def.titre, bal, source: def.source, postes: def.postes, total: def.total });
      if (def.totalLabel) note.lignes[note.lignes.length - 1].label = def.totalLabel;
      return note;
    }
    if (def.kind === 'sig') return buildNote34(entries, bal.year);
    return buildManuelle({ numero: def.numero, titre: def.titre, formulaire: def.formulaire, valeurs: man[def.numero] });
  });
  return { year: bal.year, notes };
}

export { fmtVarPct };
