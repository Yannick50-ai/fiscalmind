/**
 * Données fiscales des 17 pays OHADA — FiscalMind Africa (étape 2 de la migration).
 * Généré par scripts/build-country-data.js — NE PAS ÉDITER À LA MAIN, relancer le script.
 * Sources : FM_COUNTRY_DATA.rules (fiches stratégiques déployées le 8 oct. 2026).
 */

export const FICHES = {
  BF: {
    TVA: {
      nom: "Taxe sur la Valeur Ajoutée",
      periodicite: "Mensuelle",
      taux: "18 % (taux normal) · 10 % (taux réduit, produits de première nécessité)",
      echeance: "Déclaration et paiement au plus tard le 25 du mois suivant",
      penalites: "10 % des droits + intérêts de retard par mois",
      base: "Chiffre d\’affaires taxable (collectée − déductible)",
      conseil: "Rapprochez chaque mois votre CA déclaré du CA comptable : c\’est le premier point contrôlé en vérification."
    },
    IS: {
      nom: "Impôt sur les Sociétés",
      periodicite: "Annuelle + 4 acomptes provisionnels",
      taux: "27,5 % du bénéfice imposable (taux standard CGI, confirmé DGI)",
      echeance: "Acomptes les 15/03, 15/06, 15/09, 15/12 · Solde après clôture",
      penalites: "Majoration de 10 % + intérêts en cas de retard ou d\’insuffisance d\’acompte",
      base: "Bénéfice comptable retraité fiscalement",
      conseil: "Calibrez vos acomptes sur le bénéfice prévisionnel : un acompte trop faible génère des pénalités, trop élevé immobilise votre trésorerie."
    },
    SAL: {
      nom: "Impôt Unique sur les Traitements et Salaires",
      periodicite: "Mensuelle (retenue à la source)",
      taux: "Barème progressif par tranches de salaire",
      echeance: "Déclaration et reversement au plus tard le 10 du mois suivant",
      penalites: "Pénalités de retard + responsabilité de l\’employeur collecteur",
      base: "Salaires bruts, primes et avantages en nature",
      conseil: "Vérifiez que chaque bulletin de paie est cohérent avec la DADS : les écarts déclenchent des redressements automatiques."
    },
    SOC: {
      nom: "Caisse Nationale de Sécurité Sociale",
      periodicite: "Trimestrielle",
      taux: "Part patronale 16 % · part salariale 5,5 % · total 21,5 % (CNSS)",
      echeance: "Déclaration et paiement dans le mois suivant chaque trimestre",
      penalites: "Majoration de retard sur les cotisations non versées",
      base: "Salaires bruts plafonnés",
      conseil: "Déclarez tous vos employés dès l\’embauche : le travail non déclaré coûte bien plus cher que les cotisations."
    },
    ANNUEL: {
      nom: "Déclaration Statistique et Fiscale",
      periodicite: "Annuelle",
      taux: "—",
      echeance: "Dépôt au plus tard le 31 octobre suivant la clôture",
      penalites: "Amende forfaitaire par mois de retard + risque de taxation d\’office",
      base: "États financiers de l\’exercice (bilan, compte de résultat, TAFIRE, notes annexes)",
      conseil: "Préparez la DSF dès la clôture : c\’est la pièce maîtresse de tout contrôle fiscal."
    }
  },
  BJ: {
    TVA: {
      nom: "TVA",
      periodicite: "Mensuelle",
      taux: "Taux normal : 18 % — Taux normal 18 % (taux harmonisé UEMOA), confirmé par deux fiches pays indépendantes. Exonérations : banques, assurances, produits agricoles, livres, gaz domest",
      echeance: "au plus tard le 10 de chaque mois, au titre du mois précédent",
      penalites: "Sanctions prévues par la législation fiscale — à vérifier auprès de DGI (Direction Générale des Impôts).",
      base: "Chiffre d’affaires taxable (collectée − déductible)",
      conseil: "Rapprochez chaque mois votre CA déclaré du CA comptable : c’est le premier point contrôlé en vérification."
    },
    IS: {
      nom: "IS (Impôt sur les Sociétés)",
      periodicite: "Trimestrielle",
      taux: "30 % du bénéfice imposable — Art. 156 du CGI (version 2012, non modifié par les lois de finances récentes recensées) : 25 % du bénéfice imposable pour les industries et entreprises minières",
      echeance: "à vérifier",
      penalites: "Majoration et intérêts en cas de retard — à vérifier auprès de DGI (Direction Générale des Impôts).",
      base: "Bénéfice comptable retraité fiscalement",
      conseil: "Calibrez vos acomptes sur le bénéfice prévisionnel : un acompte trop faible génère des pénalités, trop élevé immobilise votre trésorerie."
    },
    SAL: {
      nom: "ITS (Impôt sur les Traitements et Salaires)",
      periodicite: "Mensuelle",
      taux: "Retenue à la source par l'employeur, calculée sur le salaire brut (sans déduction de la CNSS). Barème mensuel progressif (CGI 2022+) : 0 % jusqu'à 60 000 FCFA ; 10 % de 60 001 à 150 000 ; 15 % de 150 ",
      echeance: "avant le 20 du mois suivant (déclaration + versement)",
      penalites: "Pénalités de retard + responsabilité de l’employeur collecteur.",
      base: "Salaires bruts, primes et avantages en nature",
      conseil: "Vérifiez la cohérence entre bulletins de paie et déclarations sociales : les écarts déclenchent des redressements."
    },
    SOC: {
      nom: "CNSS (Caisse Nationale de Sécurité Sociale du Bénin)",
      periodicite: "Mensuelle",
      taux: "Part patronale : 16,4 % à 19,4 % · Part salariale : 3,6 % — Part salariale : 3,6 % (branche pensions). Part patronale : 6,4 % (pensions) + 9 % (prestations familiales) + 1 à 4 % (r",
      echeance: "avant le 15 du mois suivant (déclaration + paiement)",
      penalites: "Majoration de retard sur les cotisations non versées.",
      base: "Salaires bruts (plafonds éventuels)",
      conseil: "Déclarez tous vos employés dès l’embauche : le travail non déclaré coûte bien plus cher que les cotisations."
    },
    ANNUEL: {
      nom: "États financiers annuels",
      periodicite: "Annuelle",
      taux: "—",
      echeance: "au plus tard le 30 avril de chaque année",
      penalites: "Amende forfaitaire par mois de retard + risque de taxation d’office.",
      base: "États financiers de l’exercice (bilan, compte de résultat, TAFIRE, notes annexes)",
      conseil: "Préparez la liasse dès la clôture : c’est la pièce maîtresse de tout contrôle fiscal."
    }
  },
  CM: {
    TVA: {
      nom: "TVA",
      periodicite: "Mensuelle",
      taux: "Taux normal : 19,25 % — Taux normal 19,25% = 17,5% + centimes additionnels communaux (CAC) de 10% de la TVA. Taux réduit 10% sur le logement social (loi de finances 2026). 0% sur les e",
      echeance: "le 15 du mois suivant",
      penalites: "Sanctions prévues par la législation fiscale — à vérifier auprès de DGI.",
      base: "Chiffre d’affaires taxable (collectée − déductible)",
      conseil: "Rapprochez chaque mois votre CA déclaré du CA comptable : c’est le premier point contrôlé en vérification."
    },
    IS: {
      nom: "IS",
      periodicite: "Mensuelle",
      taux: "33 % du bénéfice imposable — 33% (30% + CAC 10%) si CA > 3 milliards F ; 27,5% (25% + CAC) si CA < 3 milliards F. Impôt minimum forfaitaire (IMF) : 2,2% ou 5,5% du CA selon les cas.",
      echeance: "avant le 15 du mois suivant",
      penalites: "Majoration et intérêts en cas de retard — à vérifier auprès de DGI.",
      base: "Bénéfice comptable retraité fiscalement",
      conseil: "Calibrez vos acomptes sur le bénéfice prévisionnel : un acompte trop faible génère des pénalités, trop élevé immobilise votre trésorerie."
    },
    SAL: {
      nom: "IRPP",
      periodicite: "Mensuelle",
      taux: "Barème annuel progressif (hors CAC) : 0 à 2 000 000 F : 10% ; 2 000 001 à 3 000 000 : 15% ; 3 000 001 à 5 000 000 : 25% ; plus de 5 000 000 : 35%. Majoration CAC de 10% sur l'impôt. Abattement annuel ",
      echeance: "dans les 15 premiers jours du mois suivant (art. 105 CGI)",
      penalites: "Pénalités de retard + responsabilité de l’employeur collecteur.",
      base: "Salaires bruts, primes et avantages en nature",
      conseil: "Vérifiez la cohérence entre bulletins de paie et déclarations sociales : les écarts déclenchent des redressements."
    },
    SOC: {
      nom: "CNPS",
      periodicite: "Mensuelle",
      taux: "Part patronale : 4,2% (PVID) + 7% (prestations familiales) + 1,75% à 5% (accidents du travail, selon le groupe de risque) · Part salariale : 4,2% (PVID) — Plafond cotisable PVID : 750 000 F/mois. AT employeur seul : 1,75% / 2,5% / 5% selon le groupe de risque.",
      echeance: "paiement au plus tard le 15 du mois suivant",
      penalites: "Majoration de retard sur les cotisations non versées.",
      base: "Salaires bruts (plafonds éventuels)",
      conseil: "Déclarez tous vos employés dès l’embauche : le travail non déclaré coûte bien plus cher que les cotisations."
    },
    ANNUEL: {
      nom: "États financiers annuels (DSF) + solde IS",
      periodicite: "Annuelle",
      taux: "—",
      echeance: "15 mars",
      penalites: "Amende forfaitaire par mois de retard + risque de taxation d’office.",
      base: "États financiers de l’exercice (bilan, compte de résultat, TAFIRE, notes annexes)",
      conseil: "Préparez la liasse dès la clôture : c’est la pièce maîtresse de tout contrôle fiscal."
    }
  },
  KM: {
    TVA: {
      nom: "Taxe sur la consommation (il n'existe pas de TVA aux Comores)",
      periodicite: "Mensuelle",
      taux: "Taux normal : 10 % — Impôt indirect sur l'ensemble des produits importés et les opérations intérieures non exonérées (CGI art. 139-142) ; taux 10 %. Exceptions (art. 152) : 0 % prod",
      echeance: "avant le 15 de chaque mois (opérations du mois précédent)",
      penalites: "Sanctions prévues par la législation fiscale — à vérifier auprès de DGI (Direction Générale des Impôts).",
      base: "Chiffre d’affaires taxable (collectée − déductible)",
      conseil: "Rapprochez chaque mois votre CA déclaré du CA comptable : c’est le premier point contrôlé en vérification."
    },
    IS: {
      nom: "IS",
      periodicite: "Annuelle",
      taux: "35 % du bénéfice imposable — CGI art. 33 ; 50 % si le CA dépasse 500 000 000 FC pour les EPIC et les sociétés à capitaux publics. Acompte à l'importation : 10 % de la valeur pour les import",
      echeance: "31 mars (CGI art. 42) ; la DGI a fixé le 30 avril comme date butoir pour 2026",
      penalites: "Majoration et intérêts en cas de retard — à vérifier auprès de DGI (Direction Générale des Impôts).",
      base: "Bénéfice comptable retraité fiscalement",
      conseil: "Calibrez vos acomptes sur le bénéfice prévisionnel : un acompte trop faible génère des pénalités, trop élevé immobilise votre trésorerie."
    },
    SAL: {
      nom: "IRPP",
      periodicite: "Mensuelle",
      taux: "Barème progressif CGI art. 97 : 0-150 000 FC exonéré (art. 47) ; 5 % (150 001-500 000) ; 10 % (500 001-1 000 000) ; 15 % (1 000 001-1 500 000) ; 20 % (1 500 001-2 500 000) ; 25 % (2 500 001-3 500 000)",
      echeance: "reversée au plus tard le 20 du mois suivant le paiement du loyer",
      penalites: "Pénalités de retard + responsabilité de l’employeur collecteur.",
      base: "Salaires bruts, primes et avantages en nature",
      conseil: "Vérifiez la cohérence entre bulletins de paie et déclarations sociales : les écarts déclenchent des redressements."
    },
    SOC: {
      nom: "CNSPS + Caisse de retraite des Comores",
      periodicite: "À vérifier",
      taux: "Part patronale : 5 % (retraite, non-fonctionnaires) ; 12 % (retraite, fonctionnaires) ; + AT-MP 2,5 à 5 % et maternité 1 % (CNSPS) · Part salariale : 3 % (retraite, non-fonctionnaires) ; 5 % (retraite, fonctionnaires) — Assurance maladie obligatoire : taux non communiqués. Taux issus des décrets cités par sme-measurement.org (décret 14-17",
      echeance: "à vérifier",
      penalites: "Majoration de retard sur les cotisations non versées.",
      base: "Salaires bruts (plafonds éventuels)",
      conseil: "Déclarez tous vos employés dès l’embauche : le travail non déclaré coûte bien plus cher que les cotisations."
    },
    ANNUEL: {
      nom: "TPU (taxe professionnelle unique)",
      periodicite: "Annuelle",
      taux: "—",
      echeance: "avant le 31 mars",
      penalites: "Amende forfaitaire par mois de retard + risque de taxation d’office.",
      base: "États financiers de l’exercice (bilan, compte de résultat, TAFIRE, notes annexes)",
      conseil: "Préparez la liasse dès la clôture : c’est la pièce maîtresse de tout contrôle fiscal."
    }
  },
  CI: {
    TVA: {
      nom: "TVA",
      periodicite: "Mensuelle",
      taux: "Taux normal : 18 % — Taux normal 18 % (taux harmonisé UEMOA). Taux réduit de 9 % sur certains intrants de production (à vérifier). Déclarations mensuelles au plus tard le 15 du mois",
      echeance: "au plus tard le 15 du mois suivant (DGE : 10/15/20 selon la catégorie)",
      penalites: "Sanctions prévues par la législation fiscale — à vérifier auprès de DGI (Direction Générale des Impôts).",
      base: "Chiffre d’affaires taxable (collectée − déductible)",
      conseil: "Rapprochez chaque mois votre CA déclaré du CA comptable : c’est le premier point contrôlé en vérification."
    },
    IS: {
      nom: "BIC (Impôt sur les Bénéfices Industriels et Commerciaux)",
      periodicite: "Trimestrielle",
      taux: "25 % du bénéfice imposable — Taux uniforme de 25 % pour les personnes morales et physiques, avec un minimum forfaitaire assis sur le chiffre d'affaires. Échéances des acomptes provisionnels",
      echeance: "à vérifier",
      penalites: "Majoration et intérêts en cas de retard — à vérifier auprès de DGI (Direction Générale des Impôts).",
      base: "Bénéfice comptable retraité fiscalement",
      conseil: "Calibrez vos acomptes sur le bénéfice prévisionnel : un acompte trop faible génère des pénalités, trop élevé immobilise votre trésorerie."
    },
    SAL: {
      nom: "ITS (Impôt sur les Traitements et Salaires)",
      periodicite: "Mensuelle",
      taux: "Retenue à la source opérée par l'employeur sur les salaires bruts imposables. Déclaration et reversement dans les 15 premiers jours de chaque mois pour le mois précédent ; déclarations trimestrielles ",
      echeance: "dans les 15 premiers jours du mois suivant",
      penalites: "Pénalités de retard + responsabilité de l’employeur collecteur.",
      base: "Salaires bruts, primes et avantages en nature",
      conseil: "Vérifiez la cohérence entre bulletins de paie et déclarations sociales : les écarts déclenchent des redressements."
    },
    SOC: {
      nom: "CNPS (Caisse Nationale de Prévoyance Sociale)",
      periodicite: "Mensuelle ou trimestrielle",
      taux: "Part patronale : 15,45 % à 18,45 % · Part salariale : 6,3 % — Retraite : 14 % au total (7,7 % employeur / 6,3 % salarié). Prestations familiales 5 % + assurance maternité 0,75 % + ac",
      echeance: "dans les 15 premiers jours qui suivent le mois ou le trimestre échu",
      penalites: "Majoration de retard sur les cotisations non versées.",
      base: "Salaires bruts (plafonds éventuels)",
      conseil: "Déclarez tous vos employés dès l’embauche : le travail non déclaré coûte bien plus cher que les cotisations."
    },
    ANNUEL: {
      nom: "États financiers annuels",
      periodicite: "Annuelle",
      taux: "—",
      echeance: "30 avril (grandes entreprises) ; 30 mai (autres) — à vérifier",
      penalites: "Amende forfaitaire par mois de retard + risque de taxation d’office.",
      base: "États financiers de l’exercice (bilan, compte de résultat, TAFIRE, notes annexes)",
      conseil: "Préparez la liasse dès la clôture : c’est la pièce maîtresse de tout contrôle fiscal."
    }
  },
  GA: {
    TVA: {
      nom: "TVA",
      periodicite: "Mensuelle",
      taux: "Taux normal : 18 % — Taux normal 18%. Taux réduits 10% et 5%. 0% sur les exportations. Contribution spéciale de solidarité (CSS) : 1%.",
      echeance: "au plus tard le 20 du mois suivant (art. 237 CGI)",
      penalites: "Sanctions prévues par la législation fiscale — à vérifier auprès de DGI.",
      base: "Chiffre d’affaires taxable (collectée − déductible)",
      conseil: "Rapprochez chaque mois votre CA déclaré du CA comptable : c’est le premier point contrôlé en vérification."
    },
    IS: {
      nom: "IS",
      periodicite: "Semestrielle",
      taux: "30 % du bénéfice imposable — 30% droit commun ; 35% pour les entreprises des secteurs pétrolier et minier. Impôt minimum forfaitaire (IMF) : 1% du CA, minimum 500 000 F.",
      echeance: "30 novembre (1/4) et 30 janvier (1/3)",
      penalites: "Majoration et intérêts en cas de retard — à vérifier auprès de DGI.",
      base: "Bénéfice comptable retraité fiscalement",
      conseil: "Calibrez vos acomptes sur le bénéfice prévisionnel : un acompte trop faible génère des pénalités, trop élevé immobilise votre trésorerie."
    },
    SAL: {
      nom: "IRPP",
      periodicite: "Mensuelle",
      taux: "Barème progressif, taux marginal max 35% (Livret fiscal 2026, Kreston). Tranches mensuelles (source unique détaillée, à vérifier) : jusqu'à 80 000 F exonéré ; 80 001 à 300 000 : 5% ; 300 001 à 1 000 0",
      echeance: "à vérifier",
      penalites: "Pénalités de retard + responsabilité de l’employeur collecteur.",
      base: "Salaires bruts, primes et avantages en nature",
      conseil: "Vérifiez la cohérence entre bulletins de paie et déclarations sociales : les écarts déclenchent des redressements."
    },
    SOC: {
      nom: "CNSS",
      periodicite: "Trimestrielle",
      taux: "Part patronale : 8% (retraites) + 7% (prestations familiales) + 1,75% (AT/MP) · Part salariale : 4% (retraites) — Taux et plafond (1 500 000 F/mois) issus d'une seule source (guide fiscal) : à vérifier. Déclaration trimestrielle (DTS)",
      echeance: "à vérifier",
      penalites: "Majoration de retard sur les cotisations non versées.",
      base: "Salaires bruts (plafonds éventuels)",
      conseil: "Déclarez tous vos employés dès l’embauche : le travail non déclaré coûte bien plus cher que les cotisations."
    },
    ANNUEL: {
      nom: "États financiers annuels (DSF) + solde IS",
      periodicite: "Annuelle",
      taux: "—",
      echeance: "30 avril",
      penalites: "Amende forfaitaire par mois de retard + risque de taxation d’office.",
      base: "États financiers de l’exercice (bilan, compte de résultat, TAFIRE, notes annexes)",
      conseil: "Préparez la liasse dès la clôture : c’est la pièce maîtresse de tout contrôle fiscal."
    }
  },
  GN: {
    TVA: {
      nom: "TVA",
      periodicite: "Mensuelle",
      taux: "Taux normal : 20 % — Taux standard de 20 % depuis 2016 (passage de 18 % à 20 % en 2016, selon une thèse universitaire fondée sur les données de la DGI). À vérifier — la Guinée n'éta",
      echeance: "délai mensuel à vérifier",
      penalites: "Sanctions prévues par la législation fiscale — à vérifier auprès de DNI (Direction Nationale des Impôts).",
      base: "Chiffre d’affaires taxable (collectée − déductible)",
      conseil: "Rapprochez chaque mois votre CA déclaré du CA comptable : c’est le premier point contrôlé en vérification."
    },
    IS: {
      nom: "IS (Impôt sur les Sociétés)",
      periodicite: "Semestrielle",
      taux: "30 % du bénéfice imposable — Taux de 30 % selon Trading Economics (référence déc. 2025), en baisse par rapport à 35 %. L'ancien guide des impôts du ministère du Budget indiquait 35 % — la b",
      echeance: "au plus tard le 15 juin et le 15 septembre (chaque acompte = 1/3 de l'IS de l'exercice précédent)",
      penalites: "Majoration et intérêts en cas de retard — à vérifier auprès de DNI (Direction Nationale des Impôts).",
      base: "Bénéfice comptable retraité fiscalement",
      conseil: "Calibrez vos acomptes sur le bénéfice prévisionnel : un acompte trop faible génère des pénalités, trop élevé immobilise votre trésorerie."
    },
    SAL: {
      nom: "RTS (Retenue sur les Traitements et Salaires) / IRPP",
      periodicite: "Mensuelle",
      taux: "Retenue à la source par l'employeur à chaque paiement de salaire. Barème mensuel progressif (source secondaire récente) : 0 % (0 à 1 000 000 GNF), 5 % (1 000 001 à 5 000 000), 10 % (5 000 001 à 10 000",
      echeance: "à vérifier",
      penalites: "Pénalités de retard + responsabilité de l’employeur collecteur.",
      base: "Salaires bruts, primes et avantages en nature",
      conseil: "Vérifiez la cohérence entre bulletins de paie et déclarations sociales : les écarts déclenchent des redressements."
    },
    SOC: {
      nom: "CNSS (Caisse Nationale de Sécurité Sociale)",
      periodicite: "À vérifier",
      taux: "Part patronale : 18 % · Part salariale : 5 % · Total : 23 % (confirmé CNSS Guinée)",
      echeance: "à vérifier",
      penalites: "Majoration de retard sur les cotisations non versées.",
      base: "Salaires bruts (plafonds éventuels)",
      conseil: "Déclarez tous vos employés dès l’embauche : le travail non déclaré coûte bien plus cher que les cotisations."
    },
    ANNUEL: {
      nom: "États financiers annuels",
      periodicite: "Annuelle",
      taux: "—",
      echeance: "au plus tard le 30 avril de l'année suivante",
      penalites: "Amende forfaitaire par mois de retard + risque de taxation d’office.",
      base: "États financiers de l’exercice (bilan, compte de résultat, TAFIRE, notes annexes)",
      conseil: "Préparez la liasse dès la clôture : c’est la pièce maîtresse de tout contrôle fiscal."
    }
  },
  GQ: {
    TVA: {
      nom: "IVA",
      periodicite: "Mensuelle",
      taux: "Taux normal : 15 % — Taux général 15 % (inchangé) ; taux réduit 6 % → 5 % (produits de base, Loi 1/2024) ; taux zéro pour les produits de base des annexes I et I bis. Remboursement ",
      echeance: "mensuelle : opérations du mois précédent, paiement immédiat (jour exact à vérifier)",
      penalites: "Sanctions prévues par la législation fiscale — à vérifier auprès de Direction Générale des Impôts et Contributions (Ministère des Finances).",
      base: "Chiffre d’affaires taxable (collectée − déductible)",
      conseil: "Rapprochez chaque mois votre CA déclaré du CA comptable : c’est le premier point contrôlé en vérification."
    },
    IS: {
      nom: "IS (Impuesto sobre Sociedades)",
      periodicite: "Semestrielle",
      taux: "25 % du bénéfice imposable — 35 % → 25 % depuis la Loi n° 1/2024 du 19 nov. 2024 (bénéfice net) ; l'IBN (activités commerciales des associations/fondations) aussi à 25 % ; acompte semestrie",
      echeance: "du 1er au 15 juillet et du 1er au 15 janvier",
      penalites: "Majoration et intérêts en cas de retard — à vérifier auprès de Direction Générale des Impôts et Contributions (Ministère des Finances).",
      base: "Bénéfice comptable retraité fiscalement",
      conseil: "Calibrez vos acomptes sur le bénéfice prévisionnel : un acompte trop faible génère des pénalités, trop élevé immobilise votre trésorerie."
    },
    SAL: {
      nom: "Impuesto sobre Sueldos y Salarios",
      periodicite: "Mensuelle",
      taux: "Retenue à la source par l'employeur. Taux maximal 35 % → 25 % (Loi 1/2024) ; minimum exonéré relevé de 1 M à 1,4 M FCFA/an. Nouveau barème progressif à vérifier (l'ancien : 0-1M exonéré, 10 % 1-3M, 15",
      echeance: "mensuelle (jour exact à vérifier)",
      penalites: "Pénalités de retard + responsabilité de l’employeur collecteur.",
      base: "Salaires bruts, primes et avantages en nature",
      conseil: "Vérifiez la cohérence entre bulletins de paie et déclarations sociales : les écarts déclenchent des redressements."
    },
    SOC: {
      nom: "INSESO (Instituto Nacional de Seguridad Social)",
      periodicite: "Mensuelle",
      taux: "Part patronale : 21,5 % · Part salariale : 4,5 % — Base = salaire de base. Pas de couverture chômage par l'INSESO.",
      echeance: "mensuelle (délai exact à vérifier auprès de l'INSESO)",
      penalites: "Majoration de retard sur les cotisations non versées.",
      base: "Salaires bruts (plafonds éventuels)",
      conseil: "Déclarez tous vos employés dès l’embauche : le travail non déclaré coûte bien plus cher que les cotisations."
    },
    ANNUEL: {
      nom: "Déclaration générale de la rente annuelle (DGRA)",
      periodicite: "Annuelle",
      taux: "—",
      echeance: "à vérifier (l'ancien régime prévoyait fin mars)",
      penalites: "Amende forfaitaire par mois de retard + risque de taxation d’office.",
      base: "États financiers de l’exercice (bilan, compte de résultat, TAFIRE, notes annexes)",
      conseil: "Préparez la liasse dès la clôture : c’est la pièce maîtresse de tout contrôle fiscal."
    }
  },
  GW: {
    TVA: {
      nom: "IGVS (pas de TVA classique)",
      periodicite: "Mensuelle (à vérifier)",
      taux: "Taux normal : 10 % — La Guinée-Bissau n'applique pas la TVA au sens UEMOA : la taxe sur la consommation est l'Imposto Geral sobre Vendas e Serviços (IGVS) à 10% (un taux majoré de 1",
      echeance: "le 15 du mois suivant les opérations (TDUS et CA — à vérifier)",
      penalites: "Sanctions prévues par la législation fiscale — à vérifier auprès de DGCI (Direcção-Geral das Contribuições e Impostos).",
      base: "Chiffre d’affaires taxable (collectée − déductible)",
      conseil: "Rapprochez chaque mois votre CA déclaré du CA comptable : c’est le premier point contrôlé en vérification."
    },
    IS: {
      nom: "Contribuição Industrial",
      periodicite: "Annuelle",
      taux: "25 % du bénéfice imposable — 25% des revenus d'activités commerciales ou industrielles (système normal). Paiements par compte en 4 prestations : juin, septembre, décembre et mars. Retenue à",
      echeance: "échéance à vérifier",
      penalites: "Majoration et intérêts en cas de retard — à vérifier auprès de DGCI (Direcção-Geral das Contribuições e Impostos).",
      base: "Bénéfice comptable retraité fiscalement",
      conseil: "Calibrez vos acomptes sur le bénéfice prévisionnel : un acompte trop faible génère des pénalités, trop élevé immobilise votre trésorerie."
    },
    SAL: {
      nom: "Imposto Profissional",
      periodicite: "Mensuelle (à vérifier)",
      taux: "Retenue à la source sur les revenus du travail. Taux : travailleurs salariés (por conta de outrem) entre 11% et 12% ; travailleurs indépendants entre 10% et 25%. Liquidation par la Repartição de Finan",
      echeance: "à vérifier",
      penalites: "Pénalités de retard + responsabilité de l’employeur collecteur.",
      base: "Salaires bruts, primes et avantages en nature",
      conseil: "Vérifiez la cohérence entre bulletins de paie et déclarations sociales : les écarts déclenchent des redressements."
    },
    SOC: {
      nom: "Segurança Social",
      periodicite: "Mensuelle (à vérifier)",
      taux: "Part patronale : ≈14 % · Part salariale : ≈8 % · Total : ≈22 % (provisoire — à vérifier, accidents du travail possiblement en plus)",
      echeance: "avant le 15 du mois suivant (à vérifier)",
      penalites: "Majoration de retard sur les cotisations non versées.",
      base: "Salaires bruts (plafonds éventuels)",
      conseil: "Déclarez tous vos employés dès l’embauche : le travail non déclaré coûte bien plus cher que les cotisations."
    },
    ANNUEL: {
      nom: "États financiers annuels",
      periodicite: "Annuelle",
      taux: "—",
      echeance: "à vérifier",
      penalites: "Amende forfaitaire par mois de retard + risque de taxation d’office.",
      base: "États financiers de l’exercice (bilan, compte de résultat, TAFIRE, notes annexes)",
      conseil: "Préparez la liasse dès la clôture : c’est la pièce maîtresse de tout contrôle fiscal."
    }
  },
  ML: {
    TVA: {
      nom: "TVA",
      periodicite: "Mensuelle",
      taux: "Taux normal : 18 % — Taux normal 18% ; taux réduit 5% (matériel informatique et solaire, certains produits).",
      echeance: "mensuelle (jour exact à vérifier)",
      penalites: "Sanctions prévues par la législation fiscale — à vérifier auprès de DGI.",
      base: "Chiffre d’affaires taxable (collectée − déductible)",
      conseil: "Rapprochez chaque mois votre CA déclaré du CA comptable : c’est le premier point contrôlé en vérification."
    },
    IS: {
      nom: "IS",
      periodicite: "Trimestrielle",
      taux: "30 % du bénéfice imposable — 30% du bénéfice réalisé (site DGI Mali) ; minimum 1% du chiffre d'affaires HT en cas de déficit (au moins 763 500 FCFA à partir de 50 M FCFA de CA).",
      echeance: "dans les 15 derniers jours de mars, juillet et novembre",
      penalites: "Majoration et intérêts en cas de retard — à vérifier auprès de DGI.",
      base: "Bénéfice comptable retraité fiscalement",
      conseil: "Calibrez vos acomptes sur le bénéfice prévisionnel : un acompte trop faible génère des pénalités, trop élevé immobilise votre trésorerie."
    },
    SAL: {
      nom: "ITS",
      periodicite: "Annuelle",
      taux: "Impôt sur les traitements et salaires ; retenue à la source par l'employeur. Barème annuel progressif (Loi n°2016-10) : 0 à 330 000 : 0% ; 330 001 à 578 400 : 5% ; 578 401 à 1 176 400 : 12% ; 1 176 40",
      echeance: "avant le 31 janvier",
      penalites: "Pénalités de retard + responsabilité de l’employeur collecteur.",
      base: "Salaires bruts, primes et avantages en nature",
      conseil: "Vérifiez la cohérence entre bulletins de paie et déclarations sociales : les écarts déclenchent des redressements."
    },
    SOC: {
      nom: "INPS (AMO santé via CANAM)",
      periodicite: "Mensuelle",
      taux: "Part patronale : 18,9–21,9 % (selon taux accident du travail) · Part salariale : 6,66 % — afficher une fourchette, pas un taux unique",
      echeance: "avant le 15 du mois suivant ; 15 premiers jours du trimestre si moins de 10 salariés",
      penalites: "Majoration de retard sur les cotisations non versées.",
      base: "Salaires bruts (plafonds éventuels)",
      conseil: "Déclarez tous vos employés dès l’embauche : le travail non déclaré coûte bien plus cher que les cotisations."
    },
    ANNUEL: {
      nom: "États financiers annuels",
      periodicite: "Annuelle",
      taux: "—",
      echeance: "à vérifier",
      penalites: "Amende forfaitaire par mois de retard + risque de taxation d’office.",
      base: "États financiers de l’exercice (bilan, compte de résultat, TAFIRE, notes annexes)",
      conseil: "Préparez la liasse dès la clôture : c’est la pièce maîtresse de tout contrôle fiscal."
    }
  },
  NE: {
    TVA: {
      nom: "TVA",
      periodicite: "Mensuelle",
      taux: "Taux normal : 19 % — Taux normal 19% (art. 226 CGI — exception UEMOA, la plupart des pays étant à 18%) ; taux réduit 5% (importation/vente intérieure de sucre et d'huile alimentaire",
      echeance: "avant le 15 du mois suivant (à vérifier)",
      penalites: "Sanctions prévues par la législation fiscale — à vérifier auprès de DGI.",
      base: "Chiffre d’affaires taxable (collectée − déductible)",
      conseil: "Rapprochez chaque mois votre CA déclaré du CA comptable : c’est le premier point contrôlé en vérification."
    },
    IS: {
      nom: "IS",
      periodicite: "Trimestrielle",
      taux: "30 % du bénéfice imposable — 30% du bénéfice net imposable, sans abattement (art. 27 CGI).",
      echeance: "échéances à vérifier",
      penalites: "Majoration et intérêts en cas de retard — à vérifier auprès de DGI.",
      base: "Bénéfice comptable retraité fiscalement",
      conseil: "Calibrez vos acomptes sur le bénéfice prévisionnel : un acompte trop faible génère des pénalités, trop élevé immobilise votre trésorerie."
    },
    SAL: {
      nom: "ITS",
      periodicite: "Mensuelle",
      taux: "Impôt unique sur les traitements, salaires et revenus assimilés ; retenue à la source. Barème mensuel progressif (depuis 2010) : 1 à 25 000 : 1% ; 25 001 à 50 000 : 2% ; 50 001 à 100 000 : 6% ; 100 00",
      echeance: "délai de reversement à vérifier",
      penalites: "Pénalités de retard + responsabilité de l’employeur collecteur.",
      base: "Salaires bruts, primes et avantages en nature",
      conseil: "Vérifiez la cohérence entre bulletins de paie et déclarations sociales : les écarts déclenchent des redressements."
    },
    SOC: {
      nom: "CNSS",
      periodicite: "Mensuelle",
      taux: "Part patronale : 16,4 % (+0,5 % ANPE séparé si applicable) · Part salariale : 5,25 % · Total : 21,65 % — plafond annuel 6 000 000",
      echeance: "déclaration et paiement avant le 15 du mois suivant",
      penalites: "Majoration de retard sur les cotisations non versées.",
      base: "Salaires bruts (plafonds éventuels)",
      conseil: "Déclarez tous vos employés dès l’embauche : le travail non déclaré coûte bien plus cher que les cotisations."
    },
    ANNUEL: {
      nom: "Déclaration de résultats / IS",
      periodicite: "Annuelle",
      taux: "—",
      echeance: "au plus tard le 30 avril (art. 28 CGI)",
      penalites: "Amende forfaitaire par mois de retard + risque de taxation d’office.",
      base: "États financiers de l’exercice (bilan, compte de résultat, TAFIRE, notes annexes)",
      conseil: "Préparez la liasse dès la clôture : c’est la pièce maîtresse de tout contrôle fiscal."
    }
  },
  CD: {
    TVA: {
      nom: "TVA",
      periodicite: "Mensuelle",
      taux: "Taux normal : 16 % — Taux normal 16 % (ordonnance-loi 10/001 du 20/08/2010, décret 011/42 art. 93) ; exportations 0 %. Taux réduits introduits par la LFR n° 26/032 du 07/08/2026 : 8",
      echeance: "au plus tard le 15 du mois suivant, avec paiement",
      penalites: "Sanctions prévues par la législation fiscale — à vérifier auprès de DGI (Direction Générale des Impôts).",
      base: "Chiffre d’affaires taxable (collectée − déductible)",
      conseil: "Rapprochez chaque mois votre CA déclaré du CA comptable : c’est le premier point contrôlé en vérification."
    },
    IS: {
      nom: "IBP (Impôt professionnel sur les bénéfices et profits)",
      periodicite: "3 acomptes/an + solde",
      taux: "30 % du bénéfice imposable — CGI art. 83 (L.F. 18/025) : 30 % du bénéfice fiscal, personnes morales et physiques, droit commun. Retenue de 14 % sur les rémunérations de prestations de servi",
      echeance: "3e acompte : 25 novembre (20 % de l'impôt déclaré au 30 avril précédent) ; 1er et 2e acomptes : avant le 1er août et avant le 1er décembre selon la loi 006/03 (à vérifier)",
      penalites: "Majoration et intérêts en cas de retard — à vérifier auprès de DGI (Direction Générale des Impôts).",
      base: "Bénéfice comptable retraité fiscalement",
      conseil: "Calibrez vos acomptes sur le bénéfice prévisionnel : un acompte trop faible génère des pénalités, trop élevé immobilise votre trésorerie."
    },
    SAL: {
      nom: "IPR (Impôt professionnel sur les rémunérations)",
      periodicite: "Mensuelle",
      taux: "Retenue à la source mensuelle par l'employeur. Barème annuel DGI (dgi.gouv.cd) : 3 % (0-1 944 000 FC), 15 % (1 944 001-21 600 000), 30 % (21 600 001-43 200 000), 40 % (au-delà de 43 200 000). IPR jama",
      echeance: "au plus tard le 15 du mois suivant le versement des rémunérations",
      penalites: "Pénalités de retard + responsabilité de l’employeur collecteur.",
      base: "Salaires bruts, primes et avantages en nature",
      conseil: "Vérifiez la cohérence entre bulletins de paie et déclarations sociales : les écarts déclenchent des redressements."
    },
    SOC: {
      nom: "CNSS (Caisse Nationale de Sécurité Sociale)",
      periodicite: "À vérifier",
      taux: "Part patronale : 13 % (pensions 5 % + risques pro 1,5 % + alloc. familiales 6,5 %) · Part salariale : 5 % · Total CNSS : 18 % — hors INPP/ONEM",
      echeance: "à vérifier",
      penalites: "Majoration de retard sur les cotisations non versées.",
      base: "Salaires bruts (plafonds éventuels)",
      conseil: "Déclarez tous vos employés dès l’embauche : le travail non déclaré coûte bien plus cher que les cotisations."
    },
    ANNUEL: {
      nom: "Déclaration récapitulative annuelle IPR",
      periodicite: "Annuelle",
      taux: "—",
      echeance: "à vérifier",
      penalites: "Amende forfaitaire par mois de retard + risque de taxation d’office.",
      base: "États financiers de l’exercice (bilan, compte de résultat, TAFIRE, notes annexes)",
      conseil: "Préparez la liasse dès la clôture : c’est la pièce maîtresse de tout contrôle fiscal."
    }
  },
  CF: {
    TVA: {
      nom: "TVA",
      periodicite: "Mensuelle",
      taux: "Taux normal : 19 % — Taux normal 19% depuis 2006. Taux réduit 5% (produits listés). 0% sur les exportations. Déclaration mensuelle au plus tard le 15 du mois suivant.",
      echeance: "au plus tard le 15 du mois suivant",
      penalites: "Sanctions prévues par la législation fiscale — à vérifier auprès de DGI.",
      base: "Chiffre d’affaires taxable (collectée − déductible)",
      conseil: "Rapprochez chaque mois votre CA déclaré du CA comptable : c’est le premier point contrôlé en vérification."
    },
    IS: {
      nom: "IS",
      periodicite: "Annuelle",
      taux: "30 % du bénéfice imposable — 30% droit commun ; 20% secteur agricole. Impôt minimum : 1,85% du CA (minimum 1 850 000 F), 0,3% pour l'agricole (minimum 300 000 F). Acomptes : réel simplifié ",
      echeance: "30 avril",
      penalites: "Majoration et intérêts en cas de retard — à vérifier auprès de DGI.",
      base: "Bénéfice comptable retraité fiscalement",
      conseil: "Calibrez vos acomptes sur le bénéfice prévisionnel : un acompte trop faible génère des pénalités, trop élevé immobilise votre trésorerie."
    },
    SAL: {
      nom: "IRPP",
      periodicite: "Mensuelle",
      taux: "Barème annuel (CGI, confirmé par le guide fiscal de nov. 2023) : 0 à 378 000 F : 0% ; 378 001 à 1 680 000 : 8% ; 1 680 001 à 3 360 000 : 15% ; 3 360 001 à 5 040 000 : 28% ; plus de 5 040 000 : 40%. Im",
      echeance: "à vérifier",
      penalites: "Pénalités de retard + responsabilité de l’employeur collecteur.",
      base: "Salaires bruts, primes et avantages en nature",
      conseil: "Vérifiez la cohérence entre bulletins de paie et déclarations sociales : les écarts déclenchent des redressements."
    },
    SOC: {
      nom: "CNSS",
      periodicite: "Mensuelle ou trimestrielle",
      taux: "Part patronale : 19% (prestations familiales et maternité 12% + risques professionnels 3% + PVID 4%) · Part salariale : 3% (PVID) — Taux fixés par décret. Déclaration mensuelle si 20 salariés et plus, sinon dans les 15 jours après la fin de chaque trim",
      echeance: "mensuelle si 20 salariés et plus, sinon dans les 15 jours après la fin du trimestre",
      penalites: "Majoration de retard sur les cotisations non versées.",
      base: "Salaires bruts (plafonds éventuels)",
      conseil: "Déclarez tous vos employés dès l’embauche : le travail non déclaré coûte bien plus cher que les cotisations."
    },
    ANNUEL: {
      nom: "États financiers annuels",
      periodicite: "Annuelle",
      taux: "—",
      echeance: "à vérifier",
      penalites: "Amende forfaitaire par mois de retard + risque de taxation d’office.",
      base: "États financiers de l’exercice (bilan, compte de résultat, TAFIRE, notes annexes)",
      conseil: "Préparez la liasse dès la clôture : c’est la pièce maîtresse de tout contrôle fiscal."
    }
  },
  CG: {
    TVA: {
      nom: "TVA",
      periodicite: "Mensuelle",
      taux: "Taux normal : 18 % — Taux normal 18% + centimes additionnels de 5% assis sur la TVA, soit 18,9% effectif. Taux réduit 5% (5,25% effectif). Délai de déclaration mensuelle : à vérifie",
      echeance: "à vérifier",
      penalites: "Sanctions prévues par la législation fiscale — à vérifier auprès de DGI.",
      base: "Chiffre d’affaires taxable (collectée − déductible)",
      conseil: "Rapprochez chaque mois votre CA déclaré du CA comptable : c’est le premier point contrôlé en vérification."
    },
    IS: {
      nom: "IS",
      periodicite: "Annuelle",
      taux: "28 % du bénéfice imposable — 28% depuis la loi de finances 2026 (loi 42-2025) ; 30% avant 2026. Personnes physiques : 25% (microfinance, enseignement privé), 28% (mines, carrières, immobili",
      echeance: "30 avril",
      penalites: "Majoration et intérêts en cas de retard — à vérifier auprès de DGI.",
      base: "Bénéfice comptable retraité fiscalement",
      conseil: "Calibrez vos acomptes sur le bénéfice prévisionnel : un acompte trop faible génère des pénalités, trop élevé immobilise votre trésorerie."
    },
    SAL: {
      nom: "IRPP",
      periodicite: "Mensuelle",
      taux: "Barème annuel : 0 à 464 000 F : 1% ; 464 001 à 1 000 000 : 10% ; 1 000 001 à 3 000 000 : 25% ; plus de 3 000 000 : 40%. Quotient familial (parts, maximum 6,5). TUS : 7,5% salarié (mensuelle) + 7,5% em",
      echeance: "à vérifier",
      penalites: "Pénalités de retard + responsabilité de l’employeur collecteur.",
      base: "Salaires bruts, primes et avantages en nature",
      conseil: "Vérifiez la cohérence entre bulletins de paie et déclarations sociales : les écarts déclenchent des redressements."
    },
    SOC: {
      nom: "CNSS",
      periodicite: "Trimestrielle",
      taux: "Part patronale : 8% (pension) + 12,28% (AT/MP 2,25% + prestations familiales 10,03%) + 4,55% (CAMU, à vérifier) · Part salariale : 4% (pension) + 2,27% (CAMU, à vérifier) — Plafond pension : 1 200 000 F/mois ; plafond AT/MP+PF : 600 000 F/mois. TOL : 1 000 F/salarié/mois. Cotisations CNSS ver",
      echeance: "au cours du premier mois de chaque trimestre civil (à vérifier)",
      penalites: "Majoration de retard sur les cotisations non versées.",
      base: "Salaires bruts (plafonds éventuels)",
      conseil: "Déclarez tous vos employés dès l’embauche : le travail non déclaré coûte bien plus cher que les cotisations."
    },
    ANNUEL: {
      nom: "Taxe spéciale sur les sociétés (TSS)",
      periodicite: "Annuelle",
      taux: "—",
      echeance: "20 mars",
      penalites: "Amende forfaitaire par mois de retard + risque de taxation d’office.",
      base: "États financiers de l’exercice (bilan, compte de résultat, TAFIRE, notes annexes)",
      conseil: "Préparez la liasse dès la clôture : c’est la pièce maîtresse de tout contrôle fiscal."
    }
  },
  SN: {
    TVA: {
      nom: "TVA",
      periodicite: "Mensuelle",
      taux: "Taux normal : 18 % — Taux normal 18% (art. 369 CGI) ; taux réduit 10% pour les prestations d'hébergement et de restauration des établissements touristiques agréés.",
      echeance: "dépôt et paiement avant le 15 du mois suivant",
      penalites: "Sanctions prévues par la législation fiscale — à vérifier auprès de DGID.",
      base: "Chiffre d’affaires taxable (collectée − déductible)",
      conseil: "Rapprochez chaque mois votre CA déclaré du CA comptable : c’est le premier point contrôlé en vérification."
    },
    IS: {
      nom: "IS",
      periodicite: "Semestrielle",
      taux: "30 % du bénéfice imposable — 30% du bénéfice imposable (art. 36 CGI) ; impôt minimum forfaitaire (IMF) de 0,5% du chiffre d'affaires de l'année précédente en cas de déficit, plafonné à 5 00",
      echeance: "1er acompte avant le 15 février N+1 ; 2e acompte avant le 30 avril N+1",
      penalites: "Majoration et intérêts en cas de retard — à vérifier auprès de DGID.",
      base: "Bénéfice comptable retraité fiscalement",
      conseil: "Calibrez vos acomptes sur le bénéfice prévisionnel : un acompte trop faible génère des pénalités, trop élevé immobilise votre trésorerie."
    },
    SAL: {
      nom: "IR (retenue à la source sur les salaires)",
      periodicite: "Mensuelle",
      taux: "Retenue à la source par l'employeur (VRS - versements retenus à la source). Barème annuel progressif (art. 173 CGI, loi 2022-19) : 0 à 630 000 : 0% ; 630 001 à 1 500 000 : 20% ; 1 500 001 à 4 000 000 ",
      echeance: "avant le 15 du mois suivant (à vérifier)",
      penalites: "Pénalités de retard + responsabilité de l’employeur collecteur.",
      base: "Salaires bruts, primes et avantages en nature",
      conseil: "Vérifiez la cohérence entre bulletins de paie et déclarations sociales : les écarts déclenchent des redressements."
    },
    SOC: {
      nom: "CSS + IPRES",
      periodicite: "Mensuelle ou trimestrielle selon effectif",
      taux: "Part patronale : CSS : 7% prestations familiales + 1/3/5% accidents du travail (plafond 63 000 FCFA/mois) ; IPRES : 8,4% régime général (plafond 256 000 FCFA) + 3,6% régime cadre (plafond 768 000 FCFA) · Part salariale : 5,6% (IPRES régime général, plafond 256 000 FCFA/mois) ; +2,4% régime cadre (plafond 768 000 FCFA) — CSS entièrement à la charge de l'employeur ; IPRES partagée (régime général 14% au total). IPM (assurance maladie) oblig",
      echeance: "règlement au plus tard le 10 du mois suivant la période (à vérifier)",
      penalites: "Majoration de retard sur les cotisations non versées.",
      base: "Salaires bruts (plafonds éventuels)",
      conseil: "Déclarez tous vos employés dès l’embauche : le travail non déclaré coûte bien plus cher que les cotisations."
    },
    ANNUEL: {
      nom: "États financiers annuels / déclaration de résultat",
      periodicite: "Annuelle",
      taux: "—",
      echeance: "avant le 30 avril N+1 (à vérifier)",
      penalites: "Amende forfaitaire par mois de retard + risque de taxation d’office.",
      base: "États financiers de l’exercice (bilan, compte de résultat, TAFIRE, notes annexes)",
      conseil: "Préparez la liasse dès la clôture : c’est la pièce maîtresse de tout contrôle fiscal."
    }
  },
  TD: {
    TVA: {
      nom: "TVA",
      periodicite: "Mensuelle",
      taux: "Taux normal : 18 % — Taux normal 18%. Taux réduit 9% sur les produits locaux de première nécessité (source unique, à vérifier). 0% sur les exportations. Délai de la déclaration mens",
      echeance: "à vérifier",
      penalites: "Sanctions prévues par la législation fiscale — à vérifier auprès de DGI.",
      base: "Chiffre d’affaires taxable (collectée − déductible)",
      conseil: "Rapprochez chaque mois votre CA déclaré du CA comptable : c’est le premier point contrôlé en vérification."
    },
    IS: {
      nom: "IS",
      periodicite: "Mensuelle",
      taux: "35 % du bénéfice imposable — 35% (art. 143 CGI). Minimum fiscal : 1,5% du CA HT, versé mensuellement au plus tard le 15 du mois suivant ; plancher 1 000 000 F (régime simplifié) / 2 000 000",
      echeance: "avant le 15 du mois suivant",
      penalites: "Majoration et intérêts en cas de retard — à vérifier auprès de DGI.",
      base: "Bénéfice comptable retraité fiscalement",
      conseil: "Calibrez vos acomptes sur le bénéfice prévisionnel : un acompte trop faible génère des pénalités, trop élevé immobilise votre trésorerie."
    },
    SAL: {
      nom: "IRPP",
      periodicite: "Annuelle",
      taux: "Barème annuel sur le revenu de travail (art. 1 IV CGI, réforme 2017 / LF 2019) : 0 à 800 000 F : 0% ; 800 001 à 2 500 000 : 10% ; 2 500 001 à 7 500 000 : 20% ; plus de 7 500 000 : 35%. Revenus du capi",
      echeance: "avant le 1er mai",
      penalites: "Pénalités de retard + responsabilité de l’employeur collecteur.",
      base: "Salaires bruts, primes et avantages en nature",
      conseil: "Vérifiez la cohérence entre bulletins de paie et déclarations sociales : les écarts déclenchent des redressements."
    },
    SOC: {
      nom: "CNPS",
      periodicite: "Mensuelle ou trimestrielle",
      taux: "Part patronale : 16,5% (PVID 5% + AT/MP 4% + prestations familiales et maternité 7,5%) · Part salariale : 3,5% (PVID) — Plafond : 500 000 F/mois. Déclaration mensuelle (20 salariés et plus) ou trimestrielle (moins de 20 salariés).",
      echeance: "mensuelle si 20 salariés et plus, trimestrielle sinon",
      penalites: "Majoration de retard sur les cotisations non versées.",
      base: "Salaires bruts (plafonds éventuels)",
      conseil: "Déclarez tous vos employés dès l’embauche : le travail non déclaré coûte bien plus cher que les cotisations."
    },
    ANNUEL: {
      nom: "États financiers annuels / déclaration annuelle IS",
      periodicite: "Annuelle",
      taux: "—",
      echeance: "à vérifier",
      penalites: "Amende forfaitaire par mois de retard + risque de taxation d’office.",
      base: "États financiers de l’exercice (bilan, compte de résultat, TAFIRE, notes annexes)",
      conseil: "Préparez la liasse dès la clôture : c’est la pièce maîtresse de tout contrôle fiscal."
    }
  },
  TG: {
    TVA: {
      nom: "TVA",
      periodicite: "Mensuelle",
      taux: "Taux normal : 18 % — Taux normal 18 % (taux harmonisé UEMOA), confirmé par le guide fiscal OTR. Seuil d'assujettissement relevé de 60 à 100 millions FCFA (loi de finances 2025). Aut",
      echeance: "au plus tard le 15 du mois",
      penalites: "Sanctions prévues par la législation fiscale — à vérifier auprès de OTR (Office Togolais des Recettes).",
      base: "Chiffre d’affaires taxable (collectée − déductible)",
      conseil: "Rapprochez chaque mois votre CA déclaré du CA comptable : c’est le premier point contrôlé en vérification."
    },
    IS: {
      nom: "IS (Impôt sur les Sociétés)",
      periodicite: "Trimestrielle",
      taux: "27 % du bénéfice imposable — Taux fixé à 27 % du bénéfice imposable (art. 113 du CGI, version mise à jour 2023). Objectif affiché : réduction progressive vers le taux plancher de 25 % de la",
      echeance: "31/01 (1er acompte), 31/05 (2e, avec régularisation), 31/07 (3e), 31/10 (4e)",
      penalites: "Majoration et intérêts en cas de retard — à vérifier auprès de OTR (Office Togolais des Recettes).",
      base: "Bénéfice comptable retraité fiscalement",
      conseil: "Calibrez vos acomptes sur le bénéfice prévisionnel : un acompte trop faible génère des pénalités, trop élevé immobilise votre trésorerie."
    },
    SAL: {
      nom: "IRPP (Impôt sur le Revenu des Personnes Physiques) — catégorie revenus d'emplois",
      periodicite: "Mensuelle",
      taux: "Retenue à la source par l'employeur. Barème annuel progressif sur le revenu net imposable : 0,5 % (0 à 900 000 FCFA), 7 % (900 001 à 4 000 000), 15 % (4 000 001 à 6 000 000), 25 % (6 000 001 à 10 000 ",
      echeance: "dans les 15 premiers jours du mois suivant la retenue",
      penalites: "Pénalités de retard + responsabilité de l’employeur collecteur.",
      base: "Salaires bruts, primes et avantages en nature",
      conseil: "Vérifiez la cohérence entre bulletins de paie et déclarations sociales : les écarts déclenchent des redressements."
    },
    SOC: {
      nom: "CNSS (Caisse Nationale de Sécurité Sociale)",
      periodicite: "Mensuelle",
      taux: "Part patronale : 20,28 % · Part salariale : 4 % — Prestations familiales 10,03 % (employeur seul), accidents du travail 2,25 % (employeur seul), assurance pensions 12 % (",
      echeance: "versement dans les 15 premiers jours du mois suivant",
      penalites: "Majoration de retard sur les cotisations non versées.",
      base: "Salaires bruts (plafonds éventuels)",
      conseil: "Déclarez tous vos employés dès l’embauche : le travail non déclaré coûte bien plus cher que les cotisations."
    },
    ANNUEL: {
      nom: "États financiers annuels",
      periodicite: "Annuelle",
      taux: "—",
      echeance: "au plus tard le 31 mars N+1 (IRPP) / 30 avril N+1 (IS)",
      penalites: "Amende forfaitaire par mois de retard + risque de taxation d’office.",
      base: "États financiers de l’exercice (bilan, compte de résultat, TAFIRE, notes annexes)",
      conseil: "Préparez la liasse dès la clôture : c’est la pièce maîtresse de tout contrôle fiscal."
    }
  }
};

/** Fiche stratégique d'un impôt pour un pays (clés: TVA, IS, SAL, SOC, ANNUEL). */
export function getFiche(code, impot) {
  const c = FICHES[String(code || '').toUpperCase()];
  return (c && c[impot]) || null;
}
