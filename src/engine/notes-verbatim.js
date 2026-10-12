/**
 * FiscalMind Africa — Notes annexes VERBATIM (imprimé officiel DGI Burkina Faso).
 *
 * Reproduction textuelle exacte des 46 tableaux officiels des notes annexes.
 * Chaque note définit sa structure officielle : colonnes, lignes, libellés.
 *
 * Patterns :
 * - 'comparatif' : Libellés | Exercice N | Exercice N-1 | Variation en %
 * - 'mouvement'  : Situations et mouvements (A/B/C/D)
 * - 'special'    : structure unique
 * - 'texte'      : zone de texte libre
 */

// ============================================================================
// NOTE 1 — DETTES GARANTIES PAR DES SURETES REELLES ET ENGAGEMENTS FINANCIERS
// ============================================================================
const N1 = {
  numero: '1', titre: 'DETTES GARANTIES PAR DES SURETES REELLES ET LES ENGAGEMENTS FINANCIERS',
  pattern: 'texte',
  champs: [
    { key: 'dettes_garanties', label: 'Dettes garanties par des sûretés réelles (détail par nature de sûreté, montant, échéance)' },
    { key: 'engagements', label: 'Engagements financiers (détail : cautions, avals, garanties données/reçues)' },
  ],
};

// ============================================================================
// NOTE 2 — INFORMATIONS OBLIGATOIRES
// ============================================================================
const N2 = {
  numero: '2', titre: 'INFORMATIONS OBLIGATOIRES',
  pattern: 'texte',
  champs: [
    { key: 'infos', label: 'Informations obligatoires (événements post-clôture, méthodes, dérogations, etc.)' },
  ],
};

// ============================================================================
// NOTE 3A — IMMOBILISATION BRUTE (déjà défini, structure multi-niveaux)
// ============================================================================
const N3A = {
  numero: '3A', titre: 'IMMOBILISATION BRUTE',
  pattern: 'mouvement',
  colonnes: ['A: Montant brut à l’ouverture', 'B: Augmentations (Acquisitions | Apports | Créations | Virements | Réévaluation)', 'C: Diminutions (Cessions | Scissions | Hors service | Virements)', 'D=A+B-C: Montant brut à la clôture'],
  lignes: [
    { label: 'IMMOBILISATIONS INCORPORELLES', header: true },
    { label: 'Frais de développement et de prospection', comptes: ['211'] },
    { label: 'Brevets, licences, logiciels, et droits similaires', comptes: ['212', '213', '214'] },
    { label: 'Fonds commercial et droits au bail', comptes: ['215', '216'] },
    { label: 'Autres immobilisations incorporelles', comptes: ['217', '218'] },
    { label: 'IMMOBILISATIONS CORPORELLES', header: true },
    { label: 'Terrains hors immeuble de placement', comptes: ['221'] },
    { label: 'Terrains - immeuble de placement', comptes: ['222'] },
    { label: 'Bâtiments hors immeuble de placement', comptes: ['231', '232'] },
    { label: 'Bâtiments - immeuble de placement', comptes: ['233'] },
    { label: 'Aménagements, agencements et installations', comptes: ['234', '235', '238', '239'] },
    { label: 'Matériel, mobilier et actifs biologiques', comptes: ['24'] },
    { label: 'Matériel de transport', comptes: ['245'] },
    { label: 'AVANCES ET ACOMPTES VERSES SUR IMMOBILISATIONS', header: true },
    { label: 'Immobilisations incorporelles', comptes: ['251'] },
    { label: 'Immobilisations corporelles', comptes: ['252'] },
    { label: 'IMMOBILISATIONS FINANCIERES', header: true },
    { label: 'Titres de participation', comptes: ['26'] },
    { label: 'Autres immobilisations financières', comptes: ['27'] },
    { label: 'TOTAL GENERAL', total: true },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 3B — BIENS PRIS EN LOCATION ACQUISITION
// ============================================================================
const N3B = {
  numero: '3B', titre: 'BIENS PRIS EN LOCATION ACQUISITION',
  pattern: 'mouvement',
  note: '(1) I : Crédit-bail immobilier ; M : Crédit-bail mobilier ; A : Autres contrats (dédoubler le poste si montants significatifs).',
  colonnes: ['Nature du contrat (I ; M ; A) (1)', 'A: Montant brut à l’ouverture', 'B: Augmentations', 'C: Diminutions', 'D=A+B-C: Montant brut à la clôture'],
  lignes: [
    { label: 'Terrains', comptes: [] },
    { label: 'Bâtiments', comptes: [] },
    { label: 'Matériel, mobilier et actifs biologiques', comptes: [] },
    { label: 'Matériel de transport', comptes: [] },
    { label: 'TOTAL IMMOBILISATIONS EN LOCATION-ACQUISITION', total: true },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 3C — IMMOBILISATIONS : AMORTISSEMENTS
// ============================================================================
const N3C = {
  numero: '3C', titre: 'IMMOBILISATIONS : AMORTISSEMENTS',
  pattern: 'mouvement',
  colonnes: [
    'A: Amortissements cumulés à l’ouverture de l’exercice',
    'B: Augmentations : Dotations de l’exercice',
    'C: Diminutions (Amortissements relatifs aux éléments sortis de l’actif | Reprises d’amortissements | Virements poste à poste)',
    'D=A+B-C: Cumul des amortissements à la clôture de l’exercice',
  ],
  lignes: [
    { label: 'Frais de développement et de prospection', comptes: ['2811'] },
    { label: 'Brevets, licences, logiciels, et droits similaires', comptes: ['2812', '2813', '2814'] },
    { label: 'Fonds commercial et droits au bail', comptes: ['2815', '2816'] },
    { label: 'Autres immobilisations incorporelles', comptes: ['2817', '2818'] },
    { label: 'SOUS TOTAL : IMMOBILISATIONS INCORPORELLES', subtotal: true },
    { label: 'Terrains hors immeuble de placement', comptes: [] },
    { label: 'Terrains - immeuble de placement', comptes: [] },
    { label: 'Bâtiments hors immeuble de placement', comptes: ['2831', '2832'] },
    { label: 'Bâtiments - immeuble de placement', comptes: ['2833'] },
    { label: 'Aménagements, agencements et installations', comptes: ['2834', '2835', '2838', '2839'] },
    { label: 'Matériel, mobilier et actifs biologiques', comptes: ['284'] },
    { label: 'Matériel de transport', comptes: ['2845'] },
    { label: 'SOUS TOTAL : IMMOBILISATIONS CORPORELLES', subtotal: true },
    { label: 'TOTAL GENERAL', total: true },
  ],
  pied: 'Total des Dotations de l’exercice\n\nCommentaires :',
};

// ============================================================================
// NOTE 3D — PLUS-VALUES ET MOINS-VALUES DE CESSION
// ============================================================================
const N3D = {
  numero: '3D', titre: 'IMMOBILISATION : PLUS-VALUES ET MOINS-VALUES DE CESSIONS',
  pattern: 'special',
  colonnes: ['A: Montant brut', 'B: Amortissements pratiqués', 'C=A-B: Valeur comptable nette', 'D: Prix de cession', 'E=D-C: Plus-value ou moins-value'],
  lignes: [
    { label: 'Frais de développement et de prospection' },
    { label: 'Brevets, licences, logiciels, et droits similaires' },
    { label: 'Fonds commercial et droits au bail' },
    { label: 'Autres immobilisations incorporelles' },
    { label: 'SOUS TOTAL : IMMOBILISATIONS INCORPORELLES', subtotal: true },
    { label: 'Terrains' },
    { label: 'Bâtiments' },
    { label: 'Aménagements, agencements et installations' },
    { label: 'Matériel, mobilier et actifs biologiques' },
    { label: 'Matériel de transport' },
    { label: 'SOUS TOTAL : IMMOBILISATIONS CORPORELLES', subtotal: true },
    { label: 'Titres de participation' },
    { label: 'Autres immobilisations financières' },
    { label: 'SOUS TOTAL : IMMOBILISATIONS FINANCIERE', subtotal: true },
    { label: 'TOTAL GENERAL', total: true },
  ],
};

// ============================================================================
// NOTE 3E — INFORMATIONS SUR LES REEVALUATIONS
// ============================================================================
const N3E = {
  numero: '3E', titre: 'INFORMATIONS SUR LES REEVALUATIONS EFFECTUEES PAR L’ENTITE',
  pattern: 'texte',
  champs: [
    { key: 'nature_date', label: 'Nature et date des réévaluations (2000 caractères maximum)' },
    { key: 'methode', label: 'Méthode de réévaluation utilisée (2000 caractères maximum)' },
    { key: 'traitement_fiscal', label: 'Traitement fiscal de l’écart de réévaluation et des amortissements supplémentaires (2000 caractères maximum)' },
    { key: 'ecart_capital', label: 'Montant de l’écart incorporé au capital' },
  ],
  tableau: {
    colonnes: ['Eléments réévalués par poste du bilan', 'Montants en coûts historiques', 'Montant réévalués', 'Ecarts de réévaluation', 'Amortissements supplémentaires'],
    lignes: [{ label: 'Total général', total: true }],
  },
};

// ============================================================================
// NOTE 4 — IMMOBILISATIONS FINANCIERES
// ============================================================================
const N4 = {
  numero: '4', titre: 'IMMOBILISATIONS FINANCIERES',
  pattern: 'comparatif',
  colonnesSup: ['Créances à un an au plus', 'Créances à plus d’un an et à deux ans au plus', 'Créances à plus de deux ans'],
  lignes: [
    { label: 'Titres de participation', comptes: ['26'] },
    { label: 'Prêts et créances', comptes: ['27'] },
    { label: 'Prêts au personnel', comptes: ['273'] },
    { label: 'Créances sur l’Etat', comptes: ['274'] },
    { label: 'Titres immobilisés', comptes: ['275'] },
    { label: 'Dépôts et cautionnements', comptes: ['276'] },
    { label: 'Intérêts courus', comptes: ['277'] },
    { label: 'Créances rattachées à des avances et participations à des GIE', comptes: ['278'] },
    { label: 'Immobilisations financières diverses', comptes: ['279'] },
    { label: 'TOTAL BRUT', total: true },
    { label: 'Dépréciations titres de participation', comptes: ['296'] },
    { label: 'Dépréciations autres immobilisations', comptes: ['297'] },
    { label: 'TOTAL NET DE DEPRECIATION', total: true },
  ],
  tableau2: {
    titre: 'Liste des filiales et participations :',
    colonnes: ['Dénomination sociale', 'Localisation (ville / pays)', 'Valeur d’acquisition', '% Détenu', 'Montant des capitaux propres filiale', 'Résultat dernier exercice filiale (1)', 'Part de bénéfice reçue de la filiale (2)'],
    note: '(1): Préciser s’il s’agit du résultat de l’exercice N ou du résultat de l’exercice N-1 / (2): S’il s’agit du résultat de l’exercice n-1, renseigner la colonne "part du bénéfice reçue de la filiale"',
  },
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 5 — ACTIF CIRCULANT ET DETTES CIRCULANTES HAO
// ============================================================================
const N5 = {
  numero: '5', titre: 'ACTIF CIRCULANT ET DETTES CIRCULANTES HAO',
  pattern: 'comparatif',
  sections: [
    {
      titre: 'ACTIF CIRCULANT HAO',
      lignes: [
        { label: 'Créances sur cessions d’immobilisations', comptes: ['482'] },
        { label: 'Autres créances hors activités ordinaires', comptes: ['483', '484', '485', '486'] },
        { label: 'TOTAL BRUT', total: true },
        { label: 'Dépréciations des créances HAO', comptes: ['498'] },
        { label: 'TOTAL NET DE DEPRECIATION', total: true },
      ],
    },
    {
      titre: 'DETTES CIRCULANTES HAO',
      lignes: [
        { label: 'Fournisseurs d’investissements', comptes: ['481'] },
        { label: 'Fournisseurs d’investissements effets à payer', comptes: ['481'] },
        { label: 'Versements restant à effectuer sur titres de participation et titres immobilisés non libérés', comptes: ['472'] },
        { label: 'Autres dettes hors activités ordinaires', comptes: ['471', '473', '474', '475', '476'] },
        { label: 'TOTAL', total: true },
      ],
    },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 6 — STOCKS ET ENCOURS
// ============================================================================
const N6 = {
  numero: '6', titre: 'STOCKS ET ENCOURS (1)',
  pattern: 'comparatif',
  colonnes: ['Exercice N', 'Exercice N-1', 'Variation de stock en valeur absolue', 'Variation en %'],
  lignes: [
    { label: 'Marchandises', comptes: ['31'] },
    { label: 'Matières premières et fournitures liées', comptes: ['321', '322'] },
    { label: 'Autres approvisionnements', comptes: ['323', '324', '325', '326', '327', '328'] },
    { label: 'Produits en cours', comptes: ['331', '332'] },
    { label: 'Services en cours', comptes: ['333', '334'] },
    { label: 'Produits finis', comptes: ['335', '336'] },
    { label: 'Produits intermédiaires', comptes: ['337', '338'] },
    { label: 'Stocks en cours de route, en consignation ou en dépôt', comptes: ['381', '382', '383', '384', '385', '386'] },
    { label: 'TOTAL BRUT STOCKS ET ENCOURS', total: true },
    { label: 'Dépréciations des stocks', comptes: ['39'] },
    { label: 'TOTAL NET DE DEPRECIATION', total: true },
  ],
  note: '(1) Les stocks H.A.O. seront inscrits dans l’actif circulant H.A.O. que lorsque leur montant total est significatif (supérieur à 5% du total de l’actif circulant).',
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 7 — CLIENTS
// ============================================================================
const N7 = {
  numero: '7', titre: 'CLIENTS',
  pattern: 'comparatif',
  colonnesSup: ['Créances à un an au plus', 'Créances à plus d’un an et à deux ans au plus', 'Créances à plus de deux ans'],
  lignes: [
    { label: 'Clients (hors réserves de propriété Groupe)', comptes: ['411'] },
    { label: 'Clients effets à recevoir (hors réserves de propriété Groupe)', comptes: ['412'] },
    { label: 'Clients et effets à recevoir avec réserves de propriété', comptes: ['413'] },
    { label: 'Clients et effets à recevoir Groupe', comptes: ['414'] },
    { label: 'Créances sur cession d’immobilisations', comptes: ['415'] },
    { label: 'Clients effets escomptés et non échus', comptes: ['416'] },
    { label: 'Créances litigieuses ou douteuses', comptes: ['417', '418'] },
    { label: 'TOTAL BRUT', total: true },
    { label: 'Dépréciations', comptes: ['491'] },
    { label: 'TOTAL NET DE DEPRECIATION', total: true },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 8 — AUTRES CREANCES
// ============================================================================
const N8 = {
  numero: '8', titre: 'AUTRES CREANCES',
  pattern: 'comparatif',
  lignes: [
    { label: 'Avances et acomptes versés sur commandes', comptes: ['409'] },
    { label: 'Créances sur le personnel', comptes: ['42'] },
    { label: 'Créances sur l’Etat et organismes publics', comptes: ['43', '44', '45'] },
    { label: 'Créances sur associés et groupe', comptes: ['46'] },
    { label: 'Autres créances diverses', comptes: ['471', '472', '473', '474', '475', '476', '477'] },
    { label: 'TOTAL BRUT', total: true },
    { label: 'Dépréciations', comptes: ['49'] },
    { label: 'TOTAL NET DE DEPRECIATION', total: true },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 8A — TABLEAU D’ETALEMENT DES CHARGES IMMOBILISEES
// ============================================================================
const N8A = {
  numero: '8A', titre: 'TABLEAU D’ETALEMENT DES CHARGES IMMOBILISEES',
  pattern: 'special',
  colonnes: ['Nature des charges immobilisées', 'Montant brut', 'Durée d’étalement', 'Dotation de l’exercice', 'Cumul des amortissements', 'Valeur nette'],
  lignes: [
    { label: 'Frais d’établissement' },
    { label: 'Charges à répartir' },
    { label: 'Primes de remboursement des obligations' },
    { label: 'TOTAL', total: true },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 9 — TITRES DE PLACEMENT
// ============================================================================
const N9 = {
  numero: '9', titre: 'TITRES DE PLACEMENT',
  pattern: 'comparatif',
  lignes: [
    { label: 'Actions propres', comptes: ['501'] },
    { label: 'Actions', comptes: ['502'] },
    { label: 'Obligations', comptes: ['503'] },
    { label: 'Autres titres de placement', comptes: ['504', '505', '506'] },
    { label: 'TOTAL BRUT', total: true },
    { label: 'Dépréciations', comptes: ['59'] },
    { label: 'TOTAL NET DE DEPRECIATION', total: true },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 10 — VALEURS A ENCAISSER
// ============================================================================
const N10 = {
  numero: '10', titre: 'VALEURS A ENCAISSER',
  pattern: 'comparatif',
  lignes: [
    { label: 'Effets à encaisser', comptes: ['511'] },
    { label: 'Effets à l’encaissement', comptes: ['512'] },
    { label: 'Chèques à encaisser', comptes: ['513'] },
    { label: 'Chèques à l’encaissement', comptes: ['514'] },
    { label: 'Cartes de crédit à encaisser', comptes: ['515'] },
    { label: 'Autres valeurs à encaisser', comptes: ['516', '517', '518'] },
    { label: 'TOTAL BRUT VALEURS A ENCAISSER', total: true },
    { label: 'Dépréciations des valeurs à encaisser', comptes: ['59'] },
    { label: 'TOTAL NET DE DEPRECIATION', total: true },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 11 — DISPONIBILITES
// ============================================================================
const N11 = {
  numero: '11', titre: 'DISPONIBILITES',
  pattern: 'comparatif',
  lignes: [
    { label: 'Banques locales', comptes: ['521'] },
    { label: 'Banques autres Etats région', comptes: ['522'] },
    { label: 'Banques, dépôt à terme', comptes: ['523'] },
    { label: 'Autres Banques', comptes: ['524', '525'] },
    { label: 'Banques intérêts courus', comptes: ['526'] },
    { label: 'Chèques postaux', comptes: ['531'] },
    { label: 'Autres établissements financiers', comptes: ['532', '533'] },
    { label: 'Etablissements financiers intérêts courus', comptes: ['534'] },
    { label: 'Instruments de trésorerie', comptes: ['54'] },
    { label: 'Caisse', comptes: ['571'] },
    { label: 'Caisse électronique mobile', comptes: ['572'] },
    { label: 'Régies d’avances et virements accréditifs', comptes: ['573', '574'] },
    { label: 'TOTAL BRUT DISPONIBILITES', total: true },
    { label: 'Dépréciations', comptes: ['59'] },
    { label: 'TOTAL NET DE DEPRECIATION', total: true },
  ],
  pied: 'Commentaires :',
  note: 'NB : Banques et intérêts courus et Etablissements financiers intérêts courus figurent dans cette rubrique en négatif si le compte principal attaché est débiteur.',
};

// ============================================================================
// NOTE 12 — ECARTS DE CONVERSION ET TRANSFERTS DE CHARGES
// ============================================================================
const N12 = {
  numero: '12', titre: 'ECARTS DE CONVERSION ET TRANSFERTS DE CHARGES',
  pattern: 'comparatif',
  sections: [
    {
      titre: 'ECARTS DE CONVERSION',
      lignes: [
        { label: 'Ecarts de conversion - Actif', comptes: ['478'] },
        { label: 'Ecarts de conversion - Passif', comptes: ['479'] },
        { label: 'TOTAL', total: true },
      ],
    },
    {
      titre: 'TRANSFERTS DE CHARGES',
      lignes: [
        { label: 'Transferts de charges d’exploitation', comptes: ['781'] },
        { label: 'Transferts de charges financières', comptes: ['787'] },
        { label: 'Transferts de charges HAO', comptes: ['848'] },
        { label: 'TOTAL', total: true },
      ],
    },
  ],
  pied: 'Commentaires :',
};

export const NOTES_VERBATIM = {
  '1': N1, '2': N2, '3A': N3A, '3B': N3B, '3C': N3C, '3D': N3D, '3E': N3E,
  '4': N4, '5': N5, '6': N6, '7': N7, '8': N8, '8A': N8A, '9': N9,
  '10': N10, '11': N11, '12': N12,
};

export function getNoteVerbatim(numero) {
  return NOTES_VERBATIM[String(numero)] || null;
}

// ============================================================================
// NOTE 13 — CAPITAL : VALEUR NOMINALE DES ACTIONS OU PARTS
// ============================================================================
const N13 = {
  numero: '13', titre: 'CAPITAL : VALEUR NOMINALE DES ACTIONS OU PARTS',
  pattern: 'special',
  soustitre: 'Valeur nominale des actions ou parts ====>',
  colonnes: ['Nom et prénoms ou raison sociale', 'N° IFU (le cas échéant)', 'Nationalité', 'Nature des actions ou parts (Ordinaires ou préférences)', 'Nombre', 'Montant total', 'Cessions ou remboursements en cours d’exercice'],
  lignes: [
    { label: 'Apporteurs, capital non appelé' },
    { label: 'TOTAL', total: true },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 14 — PRIMES ET RESERVES
// ============================================================================
const N14 = {
  numero: '14', titre: 'PRIMES ET RESERVES',
  pattern: 'comparatif',
  colonnes: ['Exercice N', 'Exercice N-1', 'Variation en valeur absolue'],
  lignes: [
    { label: 'Prime d’apport', comptes: ['111'] },
    { label: 'Prime d’émission', comptes: ['112'] },
    { label: 'Prime de fusion', comptes: ['113'] },
    { label: 'Prime de conversion', comptes: ['114'] },
    { label: 'Autres primes', comptes: ['115', '116'] },
    { label: 'TOTAL PRIMES', total: true },
    { label: 'Réserves légales', comptes: ['121'] },
    { label: 'Réserves statutaires', comptes: ['122'] },
    { label: 'Réserves de plus-values nettes à long terme', comptes: ['123'] },
    { label: 'Réserves d’attribution gratuite d’actions au personnel salarié et aux dirigeants', comptes: ['124'] },
    { label: 'Autres réserves réglementées', comptes: ['125', '126'] },
    { label: 'TOTAL RESERVES INDISPONIBLES', total: true },
    { label: 'Réserves libres', comptes: ['131'] },
    { label: 'Report à nouveau', comptes: ['12'] },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 15A — SUBVENTIONS ET PROVISIONS REGLEMENTEES
// ============================================================================
const N15A = {
  numero: '15A', titre: 'SUBVENTIONS D’INVESTISSEMENT ET PROVISIONS REGLEMENTEES',
  pattern: 'comparatif',
  colonnes: ['NOTE', 'Exercice N', 'Exercice N-1', 'Variation en valeur absolue', 'Variation en %', 'Régime fiscal', 'Échéances'],
  lignes: [
    { label: 'Etats', comptes: ['141'] },
    { label: 'Régions', comptes: ['142'] },
    { label: 'Départements', comptes: ['143'] },
    { label: 'Communes et collectivités publiques décentralisées', comptes: ['144'] },
    { label: 'Entités publiques ou mixtes', comptes: ['145'] },
    { label: 'Entités et organismes privés', comptes: ['146'] },
    { label: 'Organisme internationaux', comptes: ['147'] },
    { label: 'Autres', comptes: ['148'] },
    { label: 'TOTAL SUBVENTIONS', total: true },
    { label: 'Amortissements dérogatoires', comptes: ['151'] },
    { label: 'Plus-value de cession à réinvestir', comptes: ['152'] },
    { label: 'Provision spéciale de réévaluation', comptes: ['153'] },
    { label: 'Provisions réglementés relatives aux immobilisations', comptes: ['154'] },
    { label: 'Provisions réglementés relatives aux stocks', comptes: ['155'] },
    { label: 'Provisions pour investissement', comptes: ['156'] },
    { label: 'Autres provisions et fonds réglementés', comptes: ['157', '158'] },
    { label: 'TOTAL PROVISIONS REGLEMENTEES', total: true },
    { label: 'TOTAL SUBVENTIONS ET PROVISIONS REGLEMENTEES', total: true },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 15B — AUTRES FONDS PROPRES
// ============================================================================
const N15B = {
  numero: '15B', titre: 'AUTRES FONDS PROPRES (1)',
  pattern: 'comparatif',
  colonnes: ['NOTE', 'Exercice N', 'Exercice N-1', 'Variation en valeur absolue', 'Variation en %', 'Échéances'],
  lignes: [
    { label: 'Titres participatifs', comptes: ['161'] },
    { label: 'Avances conditionnées', comptes: ['162'] },
    { label: 'Titres subordonnés à durée indéterminée (T.S.D.I.)', comptes: ['163'] },
    { label: 'Obligations remboursables en actions (O.R.A.)', comptes: ['164'] },
    { label: 'Autres avances et dettes assorties de conditions particulières', comptes: ['165', '166'] },
    { label: 'TOTAL AUTRES FONDS PROPRES', total: true },
  ],
  note: '(1) Le cas échéant, une rubrique "Autres fonds propres" (montant des émissions de titres participatifs, avances conditionnées, …) sur une ligne séparée est intercalée entre les rubriques "TOTAL CAPITAUX PROPRES ET RESSOURCES ASSIMILEES" et "emprunts et dettes financières" si le montant des autres fonds propres est significatif.',
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 16A — DETTES FINANCIERES ET RESSOURCES ASSIMILEES
// ============================================================================
const N16A = {
  numero: '16A', titre: 'DETTES FINANCIERES ET RESSOURCES ASSIMILEES',
  pattern: 'comparatif',
  colonnes: ['Exercice N', 'Exercice N-1', 'Variation en valeur absolue', 'Variation en %', 'Dettes à un an au plus', 'Dettes à plus d’un an et à deux ans au plus', 'Dettes à plus de deux ans'],
  lignes: [
    { label: 'Emprunts obligataires', comptes: ['161', '162'] },
    { label: 'Emprunts et dettes auprès des établissements de crédit', comptes: ['163', '164'] },
    { label: 'Avances reçues de l’Etat', comptes: ['165'] },
    { label: 'Avances reçues et comptes courants bloqués', comptes: ['166'] },
    { label: 'Dépôts et cautionnements reçus', comptes: ['167'] },
    { label: 'Intérêts courus', comptes: ['168'] },
    { label: 'Avances assorties de conditions particulières', comptes: ['169'] },
    { label: 'Autres emprunts et dettes', comptes: ['171', '172'] },
    { label: 'Dettes liées à des participations', comptes: ['173'] },
    { label: 'Comptes permanents bloqués des établissements et succursales', comptes: ['174'] },
    { label: 'TOTAL EMPRUNTS ET DETTES FINANCIERES', total: true },
    { label: 'Crédit bail immobilier', comptes: ['175'] },
    { label: 'Crédit bail mobilier', comptes: ['176'] },
    { label: 'Location vente', comptes: ['177'] },
    { label: 'Intérêts courus', comptes: ['178'] },
    { label: 'Autres dettes de location acquisition', comptes: ['179'] },
    { label: 'TOTAL DETTES DE LOCATION ACQUISITION', total: true },
    { label: 'Provisions pour litiges', comptes: ['191'] },
    { label: 'Provisions pour garantie données aux clients', comptes: ['192'] },
    { label: 'Provisions pour pertes sur marchés à achèvement futur', comptes: ['193'] },
    { label: 'Provisions pour pertes de change', comptes: ['194'] },
    { label: 'Provisions pour impôts', comptes: ['195'] },
    { label: 'Provisions pour pensions et obligations similaires', comptes: ['196'] },
    { label: 'Actif du régime de retraite', comptes: ['197'] },
    { label: 'Provisions pour restructuration', comptes: ['198'] },
    { label: 'Provisions pour amendes et pénalités', comptes: ['1991'] },
    { label: 'Provisions de propre assureur', comptes: ['1992'] },
    { label: 'Provisions pour démantèlement et remise en état', comptes: ['1993'] },
    { label: 'Provisions de droits à déduction', comptes: ['1994'] },
    { label: 'Autres provisions', comptes: ['1995', '1996', '1997', '1998'] },
    { label: 'TOTAL PROVISIONS POUR RISQUES ET CHARGES', total: true },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 16B — ENGAGEMENTS DE RETRAITE (METHODE ACTUARIELLE)
// ============================================================================
const N16B = {
  numero: '16B', titre: 'ENGAGEMENTS DE RETRAITE ET AVANTAGES ASSIMILES : (METHODE ACTUARIELLE)',
  pattern: 'special',
  sections: [
    {
      titre: 'HYPOTHESES ACTUARIELLES',
      colonnes: ['Libellés', 'Exercice N', 'Exercice N-1'],
      lignes: [
        { label: 'Taux d’augmentation des salaires' },
        { label: 'Taux d’actualisation' },
        { label: 'Taux d’inflation' },
        { label: 'Probabilité d’être présent dans l’entité à la date de départ à la retraite (expérience passée)' },
        { label: 'Probabilité d’être en vie à l’âge de départ à la retraite (table de mortalité)' },
        { label: 'Taux de rendement effectif des actifs du régime' },
      ],
    },
    {
      titre: 'VARIATION DE LA VALEUR DE L’ENGAGEMENT DE RETRAITE AU COURS DE L’EXERCICE',
      colonnes: ['Libellés', 'Exercice N', 'Exercice N-1'],
      lignes: [
        { label: 'Obligation au titre des engagements de retraite à l’ouverture' },
        { label: 'Coût des services rendus au cours de l’exercice' },
        { label: 'Coût financier' },
        { label: 'Pertes actuarielles / (gain)' },
        { label: 'Prestations payées au cours de l’exercice' },
        { label: 'Coût des services passés' },
        { label: 'Obligation au titre des engagements de retraite à la clôture', total: true },
      ],
    },
    {
      titre: 'ANALYSE DE SENSIBILITE DES HYPOTHESES ACTUARIELLES',
      colonnes: ['Libellés', 'Exercice N - Augmentation', 'Exercice N - Diminution', 'Exercice N-1 - Augmentation', 'Exercice N-1 - Diminution'],
      lignes: [
        { label: 'Taux d’actualisation (variation de …..%)' },
        { label: 'Taux de progression des salaires (variation de ……%)' },
        { label: 'Taux de départ du personnel (variation de ….. %)' },
      ],
    },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 16B bis — ENGAGEMENTS DE RETRAITE (SUITE)
// ============================================================================
const N16BBIS = {
  numero: '16B bis', titre: 'ENGAGEMENTS DE RETRAITE ET AVANTAGES ASSIMILES : (METHODE ACTUARIELLE SUITE)',
  pattern: 'special',
  sections: [
    {
      titre: 'ACTIF/PASSIF NET COMPTABILISE AU TITRE DES REGIMES FINANCES',
      colonnes: ['Libellés', 'Exercice N', 'Exercice N-1'],
      lignes: [
        { label: 'Valeur actuelle de l’obligation résultant de régimes financés' },
        { label: 'Valeur actuelle des actifs affectés aux plans de retraite' },
        { label: 'Excédent / Déficit de régime', total: true },
      ],
    },
    {
      titre: 'VALEUR ACTUELLE DES ACTIFS DU REGIME',
      colonnes: ['Libellés', 'Exercice N - Rendement attendu', 'Exercice N - Juste valeur des actifs', 'Exercice N-1 - Rendement attendu', 'Exercice N-1 - Juste valeur des actifs'],
      lignes: [
        { label: 'Actions' },
        { label: 'Obligations' },
        { label: 'Autres' },
        { label: 'Total', total: true },
      ],
    },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 16C — ACTIFS ET PASSIFS EVENTUELS
// ============================================================================
const N16C = {
  numero: '16C', titre: 'ACTIFS ET PASSIFS EVENTUELS',
  pattern: 'comparatif',
  colonnes: ['Libellés', 'Exercice N', 'Exercice N-1'],
  lignes: [
    { label: 'Actif éventuel', header: true },
    { label: 'Litiges' },
    { label: 'Passif éventuel', header: true },
    { label: 'Litiges' },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 17 — FOURNISSEURS D’EXPLOITATION
// ============================================================================
const N17 = {
  numero: '17', titre: 'FOURNISSEURS D’EXPLOITATION',
  pattern: 'comparatif',
  colonnes: ['Exercice N', 'Exercice N-1', 'Variation en %', 'Dettes à un an au plus', 'Dettes à plus d’un an et à deux ans au plus', 'Dettes à plus de deux ans'],
  lignes: [
    { label: 'Fournisseurs dettes en compte (hors groupe)', comptes: ['401'] },
    { label: 'Fournisseurs effets à payer (hors groupe)', comptes: ['402'] },
    { label: 'Fournisseurs dettes et effets à payer groupe', comptes: ['403'] },
    { label: 'Fournisseurs factures non parvenues (hors groupe)', comptes: ['4081'] },
    { label: 'Fournisseurs factures non parvenues groupe', comptes: ['4082'] },
    { label: 'TOTAL FOURNISSEURS', total: true },
    { label: 'Fournisseurs, avances et acomptes (hors groupe)', comptes: ['4091'] },
    { label: 'Fournisseurs, avances et acomptes groupe', comptes: ['4092'] },
    { label: 'Autres fournisseurs débiteurs', comptes: ['4093', '4094'] },
    { label: 'TOTAL AVANCES FOURNISSEURS', total: true },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 18 — DETTES FISCALES ET SOCIALES
// ============================================================================
const N18 = {
  numero: '18', titre: 'DETTES FISCALES ET SOCIALES',
  pattern: 'comparatif',
  lignes: [
    { label: 'Dettes fiscales', header: true },
    { label: 'Impôts sur les sociétés', comptes: ['441'] },
    { label: 'Autres impôts et taxes', comptes: ['442', '443', '444', '445', '446', '447', '448'] },
    { label: 'SOUS-TOTAL DETTES FISCALES', subtotal: true },
    { label: 'Dettes sociales', header: true },
    { label: 'Personnel', comptes: ['42'] },
    { label: 'Organismes sociaux', comptes: ['43'] },
    { label: 'SOUS-TOTAL DETTES SOCIALES', subtotal: true },
    { label: 'TOTAL DETTES FISCALES ET SOCIALES', total: true },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 19 — AUTRES DETTES ET PROVISIONS POUR RISQUES A COURT TERME
// ============================================================================
const N19 = {
  numero: '19', titre: 'AUTRES DETTES ET PROVISIONS POUR RISQUES A COURT TERME',
  pattern: 'comparatif',
  lignes: [
    { label: 'Associés et groupe', comptes: ['46'] },
    { label: 'Créditeurs divers', comptes: ['47'] },
    { label: 'Provisions pour risques à court terme', comptes: ['499'] },
    { label: 'TOTAL', total: true },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 20 — BANQUES, CREDITS D’ESCOMPTE ET TRESORERIE
// ============================================================================
const N20 = {
  numero: '20', titre: 'BANQUES, CREDITS D’ESCOMPTE ET TRESORERIE',
  pattern: 'comparatif',
  lignes: [
    { label: 'Banques, crédits d’escompte', comptes: ['521'] },
    { label: 'Banques, crédits de trésorerie', comptes: ['522'] },
    { label: 'Banques, autres crédits', comptes: ['523', '524'] },
    { label: 'TOTAL', total: true },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 21 — CHIFFRE D’AFFAIRES ET AUTRES PRODUITS
// ============================================================================
const N21 = {
  numero: '21', titre: 'CHIFFRE D’AFFAIRES ET AUTRES PRODUITS',
  pattern: 'comparatif',
  lignes: [
    { label: 'Ventes de marchandises', comptes: ['701'] },
    { label: 'Ventes de produits finis', comptes: ['702'] },
    { label: 'Ventes de produits intermédiaires', comptes: ['703'] },
    { label: 'Ventes de produits résiduels', comptes: ['704'] },
    { label: 'Travaux facturés', comptes: ['705'] },
    { label: 'Services vendus', comptes: ['706'] },
    { label: 'Produits accessoires', comptes: ['707'] },
    { label: 'TOTAL CHIFFRE D’AFFAIRES', total: true },
    { label: 'Production immobilisée', comptes: ['72'] },
    { label: 'Production stockée (variation)', comptes: ['73'] },
    { label: 'Subventions d’exploitation', comptes: ['71'] },
    { label: 'Autres produits', comptes: ['75'] },
    { label: 'Transferts de charges d’exploitation', comptes: ['781'] },
    { label: 'TOTAL AUTRES PRODUITS', total: true },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 22 — ACHATS
// ============================================================================
const N22 = {
  numero: '22', titre: 'ACHATS',
  pattern: 'comparatif',
  lignes: [
    { label: 'Achats de marchandises', comptes: ['601'] },
    { label: 'Achats de matières premières et fournitures liées', comptes: ['602'] },
    { label: 'Autres achats', comptes: ['604', '605'] },
    { label: 'Frais sur achats', comptes: ['608'] },
    { label: 'TOTAL ACHATS', total: true },
    { label: 'Variation des stocks', comptes: ['603'] },
    { label: 'TOTAL ACHATS ET VARIATIONS', total: true },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 23 — TRANSPORTS
// ============================================================================
const N23 = {
  numero: '23', titre: 'TRANSPORTS',
  pattern: 'comparatif',
  lignes: [
    { label: 'Transports sur achats', comptes: ['611'] },
    { label: 'Transports sur ventes', comptes: ['612'] },
    { label: 'Transports du personnel', comptes: ['613'] },
    { label: 'Autres transports', comptes: ['614', '615', '616'] },
    { label: 'TOTAL', total: true },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 24 — SERVICES EXTERIEURS
// ============================================================================
const N24 = {
  numero: '24', titre: 'SERVICES EXTERIEURS',
  pattern: 'comparatif',
  lignes: [
    { label: 'Locations', comptes: ['622'] },
    { label: 'Redevances de crédit-bail', comptes: ['623'] },
    { label: 'Entretien et réparations', comptes: ['624'] },
    { label: 'Primes d’assurance', comptes: ['625'] },
    { label: 'Etudes et recherches', comptes: ['626'] },
    { label: 'Publicité et relations publiques', comptes: ['627'] },
    { label: 'Frais de télécommunication', comptes: ['628'] },
    { label: 'Autres services extérieurs', comptes: ['621', '629'] },
    { label: 'TOTAL', total: true },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 25 — IMPOTS ET TAXES
// ============================================================================
const N25 = {
  numero: '25', titre: 'IMPOTS ET TAXES',
  pattern: 'comparatif',
  lignes: [
    { label: 'Impôts et taxes directs', comptes: ['641'] },
    { label: 'Impôts et taxes indirects', comptes: ['642'] },
    { label: 'Droits d’enregistrement', comptes: ['643'] },
    { label: 'Amendes fiscales', comptes: ['646'] },
    { label: 'Autres impôts et taxes', comptes: ['644', '645', '647', '648'] },
    { label: 'TOTAL', total: true },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 26 — AUTRES CHARGES
// ============================================================================
const N26 = {
  numero: '26', titre: 'AUTRES CHARGES',
  pattern: 'comparatif',
  lignes: [
    { label: 'Pertes sur créances', comptes: ['651'] },
    { label: 'Redevances pour brevets et licences', comptes: ['652'] },
    { label: 'Jetons de présence', comptes: ['653'] },
    { label: 'Autres charges diverses', comptes: ['654', '655', '656', '657', '658'] },
    { label: 'TOTAL', total: true },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 27A — CHARGES DE PERSONNEL
// ============================================================================
const N27A = {
  numero: '27A', titre: 'CHARGES DE PERSONNEL',
  pattern: 'comparatif',
  lignes: [
    { label: 'Appointements et salaires', comptes: ['661'] },
    { label: 'Primes et gratifications', comptes: ['662'] },
    { label: 'Indemnités', comptes: ['663'] },
    { label: 'Charges sociales', comptes: ['664'] },
    { label: 'Autres charges de personnel', comptes: ['665', '666', '667', '668'] },
    { label: 'TOTAL', total: true },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 27B — EFFECTIFS, MASSE SALARIALE ET PERSONNEL EXTERIEUR
// ============================================================================
const N27B = {
  numero: '27B', titre: 'EFFECTIFS, MASSE SALARIALE ET PERSONNEL EXTERIEUR',
  pattern: 'special',
  sections: [
    {
      titre: 'EFFECTIFS',
      colonnes: ['Catégories', 'Effectif N', 'Effectif N-1', 'Masse salariale N', 'Masse salariale N-1'],
      lignes: [
        { label: 'Cadres supérieurs' },
        { label: 'Cadres moyens' },
        { label: 'Agents de maîtrise' },
        { label: 'Employés et ouvriers' },
        { label: 'TOTAL', total: true },
      ],
    },
    {
      titre: 'PERSONNEL EXTERIEUR',
      colonnes: ['Nature', 'Montant N', 'Montant N-1'],
      lignes: [
        { label: 'Intérimaires' },
        { label: 'Personnel détaché' },
        { label: 'TOTAL', total: true },
      ],
    },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 28 — PROVISIONS ET DEPRECIATIONS INSCRITES AU BILAN
// ============================================================================
const N28 = {
  numero: '28', titre: 'PROVISIONS ET DEPRECIATIONS INSCRITES AU BILAN',
  pattern: 'mouvement',
  colonnes: ['A: Montant à l’ouverture', 'B: Dotations', 'C: Reprises', 'D=A+B-C: Montant à la clôture'],
  lignes: [
    { label: 'Provisions réglementées', comptes: ['15'] },
    { label: 'Provisions pour risques et charges', comptes: ['19'] },
    { label: 'Dépréciations des immobilisations', comptes: ['29'] },
    { label: 'Dépréciations des stocks', comptes: ['39'] },
    { label: 'Dépréciations des créances', comptes: ['49'] },
    { label: 'Dépréciations des titres de placement', comptes: ['59'] },
    { label: 'TOTAL', total: true },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 29 — CHARGES ET REVENUS FINANCIERS
// ============================================================================
const N29 = {
  numero: '29', titre: 'CHARGES ET REVENUS FINANCIERS',
  pattern: 'comparatif',
  sections: [
    {
      titre: 'CHARGES FINANCIERES',
      lignes: [
        { label: 'Intérêts et charges assimilées', comptes: ['671'] },
        { label: 'Pertes de change', comptes: ['676'] },
        { label: 'Autres charges financières', comptes: ['672', '673', '674', '675', '677', '678'] },
        { label: 'TOTAL CHARGES FINANCIERES', total: true },
      ],
    },
    {
      titre: 'REVENUS FINANCIERS',
      lignes: [
        { label: 'Revenus des titres de participation', comptes: ['771'] },
        { label: 'Revenus des autres immobilisations financières', comptes: ['772'] },
        { label: 'Gains de change', comptes: ['776'] },
        { label: 'Autres revenus financiers', comptes: ['773', '774', '775', '777', '778'] },
        { label: 'TOTAL REVENUS FINANCIERS', total: true },
      ],
    },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 30 — AUTRES CHARGES ET PRODUITS HAO
// ============================================================================
const N30 = {
  numero: '30', titre: 'AUTRES CHARGES ET PRODUITS HAO',
  pattern: 'comparatif',
  sections: [
    {
      titre: 'CHARGES HAO',
      lignes: [
        { label: 'Valeurs comptables des cessions d’immobilisations', comptes: ['81'] },
        { label: 'Autres charges HAO', comptes: ['83', '84', '85', '86'] },
        { label: 'TOTAL CHARGES HAO', total: true },
      ],
    },
    {
      titre: 'PRODUITS HAO',
      lignes: [
        { label: 'Produits des cessions d’immobilisations', comptes: ['82'] },
        { label: 'Autres produits HAO', comptes: ['84', '85', '86', '87'] },
        { label: 'TOTAL PRODUITS HAO', total: true },
      ],
    },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 31 — REPARTITION DU RESULTAT ET ELEMENTS CARACTERISTIQUES
// ============================================================================
const N31 = {
  numero: '31', titre: 'REPARTITION DU RESULTAT ET AUTRES ELEMENTS CARACTERISTIQUES DES 5 DERNIERS EXERCICES',
  pattern: 'special',
  colonnes: ['Libellés', 'Exercice N', 'Exercice N-1', 'Exercice N-2', 'Exercice N-3', 'Exercice N-4'],
  lignes: [
    { label: 'Capital en fin d’exercice' },
    { label: 'Nombre d’actions ordinaires' },
    { label: 'Chiffre d’affaires HT' },
    { label: 'Résultat net' },
    { label: 'Dividendes distribués' },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 32 — PRODUCTION DE L’EXERCICE
// ============================================================================
const N32 = {
  numero: '32', titre: 'PRODUCTION DE L’EXERCICE',
  pattern: 'comparatif',
  lignes: [
    { label: 'Production vendue', comptes: ['702', '703', '704', '705', '706'] },
    { label: 'Production stockée (variation)', comptes: ['73'] },
    { label: 'Production immobilisée', comptes: ['72'] },
    { label: 'TOTAL PRODUCTION', total: true },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 33 — ACHATS DESTINES A LA PRODUCTION
// ============================================================================
const N33 = {
  numero: '33', titre: 'ACHATS DESTINES A LA PRODUCTION',
  pattern: 'comparatif',
  lignes: [
    { label: 'Achats de matières premières', comptes: ['601', '602'] },
    { label: 'Variation des stocks de matières', comptes: ['6031', '6032'] },
    { label: 'Autres achats', comptes: ['604', '605'] },
    { label: 'TOTAL', total: true },
  ],
  pied: 'Commentaires :',
};

// ============================================================================
// NOTE 34 — FICHE DE SYNTHESE DES PRINCIPAUX INDICATEURS FINANCIERS
// ============================================================================
const N34 = {
  numero: '34', titre: 'FICHE DE SYNTHESE DES PRINCIPAUX INDICATEURS FINANCIERS',
  pattern: 'special',
  note: 'Cette fiche est calculée automatiquement à partir des soldes intermédiaires de gestion.',
  lignes: [
    { label: 'Chiffre d’affaires' },
    { label: 'Marge commerciale' },
    { label: 'Valeur ajoutée' },
    { label: 'Excédent brut d’exploitation' },
    { label: 'Résultat d’exploitation' },
    { label: 'Résultat financier' },
    { label: 'Résultat des activités ordinaires' },
    { label: 'Résultat HAO' },
    { label: 'Résultat net' },
    { label: 'Capacité d’autofinancement' },
  ],
};

// ============================================================================
// NOTE 35 — INFORMATIONS SOCIALES, ENVIRONNEMENTALES ET SOCIETALES
// ============================================================================
const N35 = {
  numero: '35', titre: 'LISTE DES INFORMATIONS SOCIALES, ENVIRONNEMENTALES ET SOCIETALES A FOURNIR',
  pattern: 'texte',
  champs: [
    { key: 'sociales', label: 'Informations sociales (emploi, conditions de travail, formation, etc.)' },
    { key: 'environnementales', label: 'Informations environnementales (impacts, mesures, etc.)' },
    { key: 'societales', label: 'Informations sociétales (parties prenantes, territoires, etc.)' },
  ],
};

// ============================================================================
// NOTE 36 — TABLES DES CODES
// ============================================================================
const N36 = {
  numero: '36', titre: 'TABLES DES CODES',
  pattern: 'texte',
  champs: [
    { key: 'codes', label: 'Tables des codes utilisés (journaux, comptes spéciaux, etc.)' },
  ],
};

// --- Registre complet ---
Object.assign(NOTES_VERBATIM, {
  '13': N13, '14': N14, '15A': N15A, '15B': N15B, '16A': N16A,
  '16B': N16B, '16B bis': N16BBIS, '16C': N16C, '17': N17, '18': N18,
  '19': N19, '20': N20, '21': N21, '22': N22, '23': N23, '24': N24,
  '25': N25, '26': N26, '27A': N27A, '27B': N27B, '28': N28, '29': N29,
  '30': N30, '31': N31, '32': N32, '33': N33, '34': N34, '35': N35, '36': N36,
});
