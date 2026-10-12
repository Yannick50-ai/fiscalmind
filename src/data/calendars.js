/**
 * Données fiscales des 17 pays OHADA — FiscalMind Africa (étape 2 de la migration).
 * Généré par scripts/build-country-data.js — NE PAS ÉDITER À LA MAIN, relancer le script.
 * Sources : FM_COUNTRY_DATA.events (calendriers déployés) + periodicite issue des fiches rules.
 */

export const FISCAL_CALENDARS = {
  BF: [
    {
      mois: 1,
      jour: 15,
      label: "Acompte provisionnel IS",
      impot: "IS",
      periodicite: "Annuelle + 4 acomptes provisionnels"
    },
    {
      mois: 2,
      jour: 10,
      label: "Déclaration IUTS",
      impot: "SAL",
      periodicite: "Mensuelle (retenue à la source)"
    },
    {
      mois: 2,
      jour: 25,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 15,
      label: "Acompte provisionnel IS",
      impot: "IS",
      periodicite: "Annuelle + 4 acomptes provisionnels"
    },
    {
      mois: 3,
      jour: 25,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 5,
      label: "CNSS Employeurs",
      impot: "SOC",
      periodicite: "Trimestrielle"
    },
    {
      mois: 4,
      jour: 25,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 5,
      jour: 25,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 6,
      jour: 15,
      label: "Acompte provisionnel IS",
      impot: "IS",
      periodicite: "Annuelle + 4 acomptes provisionnels"
    },
    {
      mois: 6,
      jour: 25,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 25,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 8,
      jour: 25,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 5,
      label: "CNSS Employeurs",
      impot: "SOC",
      periodicite: "Trimestrielle"
    },
    {
      mois: 9,
      jour: 15,
      label: "Acompte provisionnel IS (3ème)",
      impot: "IS",
      periodicite: "Annuelle + 4 acomptes provisionnels"
    },
    {
      mois: 9,
      jour: 25,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 5,
      label: "CNSS Employeurs",
      impot: "SOC",
      periodicite: "Trimestrielle"
    },
    {
      mois: 10,
      jour: 10,
      label: "Déclaration IUTS",
      impot: "SAL",
      periodicite: "Mensuelle (retenue à la source)"
    },
    {
      mois: 10,
      jour: 25,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 31,
      label: "DSF Annuelle",
      impot: "ANNUEL",
      periodicite: "Annuelle"
    },
    {
      mois: 11,
      jour: 5,
      label: "CNSS Employeurs",
      impot: "SOC",
      periodicite: "Trimestrielle"
    },
    {
      mois: 11,
      jour: 25,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    }
  ],
  BJ: [
    {
      mois: 1,
      jour: 10,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 1,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 1,
      jour: 20,
      label: "Retenue sur salaires (ITS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 2,
      jour: 10,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 2,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 2,
      jour: 20,
      label: "Retenue sur salaires (ITS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 10,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 20,
      label: "Retenue sur salaires (ITS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 10,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 20,
      label: "Retenue sur salaires (ITS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 30,
      label: "États financiers annuels",
      impot: "ANNUEL",
      periodicite: "Annuelle"
    },
    {
      mois: 5,
      jour: 10,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 5,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 5,
      jour: 20,
      label: "Retenue sur salaires (ITS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 6,
      jour: 10,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 6,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 6,
      jour: 20,
      label: "Retenue sur salaires (ITS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 10,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 20,
      label: "Retenue sur salaires (ITS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 8,
      jour: 10,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 8,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 8,
      jour: 20,
      label: "Retenue sur salaires (ITS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 10,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 20,
      label: "Retenue sur salaires (ITS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 10,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 20,
      label: "Retenue sur salaires (ITS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 11,
      jour: 10,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 11,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 11,
      jour: 20,
      label: "Retenue sur salaires (ITS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 12,
      jour: 10,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 12,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 12,
      jour: 20,
      label: "Retenue sur salaires (ITS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    }
  ],
  CM: [
    {
      mois: 1,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 1,
      jour: 15,
      label: "Acomptes IS (1,1% du CA)",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 1,
      jour: 15,
      label: "Retenue IRPP sur salaires",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 1,
      jour: 15,
      label: "Déclaration sociale CNPS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 2,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 2,
      jour: 15,
      label: "Acomptes IS (1,1% du CA)",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 2,
      jour: 15,
      label: "Retenue IRPP sur salaires",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 2,
      jour: 15,
      label: "Déclaration sociale CNPS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 15,
      label: "Acomptes IS (1,1% du CA)",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 15,
      label: "Retenue IRPP sur salaires",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 15,
      label: "Déclaration sociale CNPS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 15,
      label: "États financiers annuels (DSF) + solde IS",
      impot: "ANNUEL",
      periodicite: "Annuelle"
    },
    {
      mois: 4,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 15,
      label: "Acomptes IS (1,1% du CA)",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 15,
      label: "Retenue IRPP sur salaires",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 15,
      label: "Déclaration sociale CNPS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 5,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 5,
      jour: 15,
      label: "Acomptes IS (1,1% du CA)",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 5,
      jour: 15,
      label: "Retenue IRPP sur salaires",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 5,
      jour: 15,
      label: "Déclaration sociale CNPS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 6,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 6,
      jour: 15,
      label: "Acomptes IS (1,1% du CA)",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 6,
      jour: 15,
      label: "Retenue IRPP sur salaires",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 6,
      jour: 15,
      label: "Déclaration sociale CNPS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 15,
      label: "Acomptes IS (1,1% du CA)",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 15,
      label: "Retenue IRPP sur salaires",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 15,
      label: "Déclaration sociale CNPS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 8,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 8,
      jour: 15,
      label: "Acomptes IS (1,1% du CA)",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 8,
      jour: 15,
      label: "Retenue IRPP sur salaires",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 8,
      jour: 15,
      label: "Déclaration sociale CNPS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 15,
      label: "Acomptes IS (1,1% du CA)",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 15,
      label: "Retenue IRPP sur salaires",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 15,
      label: "Déclaration sociale CNPS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 15,
      label: "Acomptes IS (1,1% du CA)",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 15,
      label: "Retenue IRPP sur salaires",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 15,
      label: "Déclaration sociale CNPS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 11,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 11,
      jour: 15,
      label: "Acomptes IS (1,1% du CA)",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 11,
      jour: 15,
      label: "Retenue IRPP sur salaires",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 11,
      jour: 15,
      label: "Déclaration sociale CNPS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 12,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 12,
      jour: 15,
      label: "Acomptes IS (1,1% du CA)",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 12,
      jour: 15,
      label: "Retenue IRPP sur salaires",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 12,
      jour: 15,
      label: "Déclaration sociale CNPS",
      impot: "SOC",
      periodicite: "Mensuelle"
    }
  ],
  KM: [
    {
      mois: 1,
      jour: 15,
      label: "Déclaration taxe sur la consommation",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 1,
      jour: 20,
      label: "Retenue sur salaires",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 1,
      jour: 20,
      label: "Retenue sur loyers (10 %)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 2,
      jour: 15,
      label: "Déclaration taxe sur la consommation",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 2,
      jour: 20,
      label: "Retenue sur salaires",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 2,
      jour: 20,
      label: "Retenue sur loyers (10 %)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 15,
      label: "Déclaration taxe sur la consommation",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 20,
      label: "Retenue sur salaires",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 20,
      label: "Retenue sur loyers (10 %)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 31,
      label: "IS + états financiers (liasse fiscale SYSCOHADA)",
      impot: "IS",
      periodicite: "Annuelle"
    },
    {
      mois: 3,
      jour: 31,
      label: "Déclaration IRPP",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 31,
      label: "TPU (taxe professionnelle unique)",
      impot: "ANNUEL",
      periodicite: "Annuelle"
    },
    {
      mois: 4,
      jour: 15,
      label: "Déclaration taxe sur la consommation",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 20,
      label: "Retenue sur salaires",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 20,
      label: "Retenue sur loyers (10 %)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 30,
      label: "IS + états financiers (liasse fiscale SYSCOHADA)",
      impot: "IS",
      periodicite: "Annuelle"
    },
    {
      mois: 5,
      jour: 15,
      label: "Déclaration taxe sur la consommation",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 5,
      jour: 20,
      label: "Retenue sur salaires",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 5,
      jour: 20,
      label: "Retenue sur loyers (10 %)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 6,
      jour: 15,
      label: "Déclaration taxe sur la consommation",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 6,
      jour: 20,
      label: "Retenue sur salaires",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 6,
      jour: 20,
      label: "Retenue sur loyers (10 %)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 15,
      label: "Déclaration taxe sur la consommation",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 20,
      label: "Retenue sur salaires",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 20,
      label: "Retenue sur loyers (10 %)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 8,
      jour: 15,
      label: "Déclaration taxe sur la consommation",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 8,
      jour: 20,
      label: "Retenue sur salaires",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 8,
      jour: 20,
      label: "Retenue sur loyers (10 %)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 15,
      label: "Déclaration taxe sur la consommation",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 20,
      label: "Retenue sur salaires",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 20,
      label: "Retenue sur loyers (10 %)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 15,
      label: "Déclaration taxe sur la consommation",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 20,
      label: "Retenue sur salaires",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 20,
      label: "Retenue sur loyers (10 %)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 11,
      jour: 15,
      label: "Déclaration taxe sur la consommation",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 11,
      jour: 20,
      label: "Retenue sur salaires",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 11,
      jour: 20,
      label: "Retenue sur loyers (10 %)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 12,
      jour: 15,
      label: "Déclaration taxe sur la consommation",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 12,
      jour: 20,
      label: "Retenue sur salaires",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 12,
      jour: 20,
      label: "Retenue sur loyers (10 %)",
      impot: "SAL",
      periodicite: "Mensuelle"
    }
  ],
  CI: [
    {
      mois: 1,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 1,
      jour: 15,
      label: "Retenue sur salaires (ITS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 1,
      jour: 15,
      label: "Déclaration sociale CNPS",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle"
    },
    {
      mois: 2,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 2,
      jour: 15,
      label: "Retenue sur salaires (ITS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 2,
      jour: 15,
      label: "Déclaration sociale CNPS",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle"
    },
    {
      mois: 3,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 15,
      label: "Retenue sur salaires (ITS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 15,
      label: "Déclaration sociale CNPS",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle"
    },
    {
      mois: 4,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 15,
      label: "Retenue sur salaires (ITS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 15,
      label: "Déclaration sociale CNPS",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle"
    },
    {
      mois: 4,
      jour: 30,
      label: "États financiers annuels",
      impot: "ANNUEL",
      periodicite: "Annuelle"
    },
    {
      mois: 5,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 5,
      jour: 15,
      label: "Retenue sur salaires (ITS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 5,
      jour: 15,
      label: "Déclaration sociale CNPS",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle"
    },
    {
      mois: 5,
      jour: 30,
      label: "États financiers annuels",
      impot: "ANNUEL",
      periodicite: "Annuelle"
    },
    {
      mois: 6,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 6,
      jour: 15,
      label: "Retenue sur salaires (ITS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 6,
      jour: 15,
      label: "Déclaration sociale CNPS",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle"
    },
    {
      mois: 7,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 15,
      label: "Retenue sur salaires (ITS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 15,
      label: "Déclaration sociale CNPS",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle"
    },
    {
      mois: 8,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 8,
      jour: 15,
      label: "Retenue sur salaires (ITS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 8,
      jour: 15,
      label: "Déclaration sociale CNPS",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle"
    },
    {
      mois: 9,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 15,
      label: "Retenue sur salaires (ITS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 15,
      label: "Déclaration sociale CNPS",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle"
    },
    {
      mois: 10,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 15,
      label: "Retenue sur salaires (ITS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 15,
      label: "Déclaration sociale CNPS",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle"
    },
    {
      mois: 11,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 11,
      jour: 15,
      label: "Retenue sur salaires (ITS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 11,
      jour: 15,
      label: "Déclaration sociale CNPS",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle"
    },
    {
      mois: 12,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 12,
      jour: 15,
      label: "Retenue sur salaires (ITS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 12,
      jour: 15,
      label: "Déclaration sociale CNPS",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle"
    }
  ],
  GA: [
    {
      mois: 1,
      jour: 20,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 2,
      jour: 20,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 1,
      label: "Acomptes IS",
      impot: "IS",
      periodicite: "Semestrielle"
    },
    {
      mois: 3,
      jour: 20,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 1,
      label: "Acomptes IS",
      impot: "IS",
      periodicite: "Semestrielle"
    },
    {
      mois: 4,
      jour: 20,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 30,
      label: "États financiers annuels (DSF) + solde IS",
      impot: "ANNUEL",
      periodicite: "Annuelle"
    },
    {
      mois: 5,
      jour: 20,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 6,
      jour: 20,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 20,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 8,
      jour: 20,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 20,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 20,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 11,
      jour: 20,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 12,
      jour: 20,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    }
  ],
  GN: [
    {
      mois: 3,
      jour: 1,
      label: "Acomptes IS",
      impot: "IS",
      periodicite: "Semestrielle"
    },
    {
      mois: 4,
      jour: 30,
      label: "États financiers annuels",
      impot: "ANNUEL",
      periodicite: "Annuelle"
    }
  ],
  GQ: [
    {
      mois: 1,
      jour: 15,
      label: "Cuota mínima fiscal (acompte IS)",
      impot: "IS",
      periodicite: "Semestrielle"
    },
    {
      mois: 6,
      jour: 30,
      label: "Déclaration statistique et fiscale (IS)",
      impot: "ANNUEL",
      periodicite: "Annuelle"
    },
    {
      mois: 7,
      jour: 15,
      label: "Cuota mínima fiscal (acompte IS)",
      impot: "IS",
      periodicite: "Semestrielle"
    }
  ],
  GW: [
    {
      mois: 1,
      jour: 15,
      label: "Déclaration IGVS",
      impot: "TVA",
      periodicite: "Mensuelle (à vérifier)"
    },
    {
      mois: 1,
      jour: 15,
      label: "Déclaration sociale",
      impot: "SOC",
      periodicite: "Mensuelle (à vérifier)"
    },
    {
      mois: 2,
      jour: 15,
      label: "Déclaration IGVS",
      impot: "TVA",
      periodicite: "Mensuelle (à vérifier)"
    },
    {
      mois: 2,
      jour: 15,
      label: "Déclaration sociale",
      impot: "SOC",
      periodicite: "Mensuelle (à vérifier)"
    },
    {
      mois: 3,
      jour: 15,
      label: "Déclaration IGVS",
      impot: "TVA",
      periodicite: "Mensuelle (à vérifier)"
    },
    {
      mois: 3,
      jour: 15,
      label: "Déclaration sociale",
      impot: "SOC",
      periodicite: "Mensuelle (à vérifier)"
    },
    {
      mois: 4,
      jour: 15,
      label: "Déclaration IGVS",
      impot: "TVA",
      periodicite: "Mensuelle (à vérifier)"
    },
    {
      mois: 4,
      jour: 15,
      label: "Déclaration sociale",
      impot: "SOC",
      periodicite: "Mensuelle (à vérifier)"
    },
    {
      mois: 5,
      jour: 15,
      label: "Déclaration IGVS",
      impot: "TVA",
      periodicite: "Mensuelle (à vérifier)"
    },
    {
      mois: 5,
      jour: 15,
      label: "Déclaration sociale",
      impot: "SOC",
      periodicite: "Mensuelle (à vérifier)"
    },
    {
      mois: 6,
      jour: 15,
      label: "Déclaration IGVS",
      impot: "TVA",
      periodicite: "Mensuelle (à vérifier)"
    },
    {
      mois: 6,
      jour: 15,
      label: "Déclaration sociale",
      impot: "SOC",
      periodicite: "Mensuelle (à vérifier)"
    },
    {
      mois: 7,
      jour: 15,
      label: "Déclaration IGVS",
      impot: "TVA",
      periodicite: "Mensuelle (à vérifier)"
    },
    {
      mois: 7,
      jour: 15,
      label: "Déclaration sociale",
      impot: "SOC",
      periodicite: "Mensuelle (à vérifier)"
    },
    {
      mois: 8,
      jour: 15,
      label: "Déclaration IGVS",
      impot: "TVA",
      periodicite: "Mensuelle (à vérifier)"
    },
    {
      mois: 8,
      jour: 15,
      label: "Déclaration sociale",
      impot: "SOC",
      periodicite: "Mensuelle (à vérifier)"
    },
    {
      mois: 9,
      jour: 15,
      label: "Déclaration IGVS",
      impot: "TVA",
      periodicite: "Mensuelle (à vérifier)"
    },
    {
      mois: 9,
      jour: 15,
      label: "Déclaration sociale",
      impot: "SOC",
      periodicite: "Mensuelle (à vérifier)"
    },
    {
      mois: 10,
      jour: 15,
      label: "Déclaration IGVS",
      impot: "TVA",
      periodicite: "Mensuelle (à vérifier)"
    },
    {
      mois: 10,
      jour: 15,
      label: "Déclaration sociale",
      impot: "SOC",
      periodicite: "Mensuelle (à vérifier)"
    },
    {
      mois: 11,
      jour: 15,
      label: "Déclaration IGVS",
      impot: "TVA",
      periodicite: "Mensuelle (à vérifier)"
    },
    {
      mois: 11,
      jour: 15,
      label: "Déclaration sociale",
      impot: "SOC",
      periodicite: "Mensuelle (à vérifier)"
    },
    {
      mois: 12,
      jour: 15,
      label: "Déclaration IGVS",
      impot: "TVA",
      periodicite: "Mensuelle (à vérifier)"
    },
    {
      mois: 12,
      jour: 15,
      label: "Déclaration sociale",
      impot: "SOC",
      periodicite: "Mensuelle (à vérifier)"
    }
  ],
  ML: [
    {
      mois: 1,
      jour: 15,
      label: "Retenue ITS",
      impot: "SAL",
      periodicite: "Annuelle"
    },
    {
      mois: 1,
      jour: 15,
      label: "Cotisations INPS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 1,
      jour: 31,
      label: "Déclaration annuelle des salaires (DAS)",
      impot: "SAL",
      periodicite: "Annuelle"
    },
    {
      mois: 2,
      jour: 15,
      label: "Retenue ITS",
      impot: "SAL",
      periodicite: "Annuelle"
    },
    {
      mois: 2,
      jour: 15,
      label: "Cotisations INPS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 15,
      label: "Retenue ITS",
      impot: "SAL",
      periodicite: "Annuelle"
    },
    {
      mois: 3,
      jour: 15,
      label: "Cotisations INPS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 15,
      label: "Retenue ITS",
      impot: "SAL",
      periodicite: "Annuelle"
    },
    {
      mois: 4,
      jour: 15,
      label: "Cotisations INPS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 30,
      label: "Déclaration IS + états financiers",
      impot: "IS",
      periodicite: "Trimestrielle"
    },
    {
      mois: 5,
      jour: 15,
      label: "Retenue ITS",
      impot: "SAL",
      periodicite: "Annuelle"
    },
    {
      mois: 5,
      jour: 15,
      label: "Cotisations INPS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 6,
      jour: 15,
      label: "Retenue ITS",
      impot: "SAL",
      periodicite: "Annuelle"
    },
    {
      mois: 6,
      jour: 15,
      label: "Cotisations INPS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 15,
      label: "Retenue ITS",
      impot: "SAL",
      periodicite: "Annuelle"
    },
    {
      mois: 7,
      jour: 15,
      label: "Cotisations INPS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 8,
      jour: 15,
      label: "Retenue ITS",
      impot: "SAL",
      periodicite: "Annuelle"
    },
    {
      mois: 8,
      jour: 15,
      label: "Cotisations INPS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 15,
      label: "Retenue ITS",
      impot: "SAL",
      periodicite: "Annuelle"
    },
    {
      mois: 9,
      jour: 15,
      label: "Cotisations INPS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 15,
      label: "Retenue ITS",
      impot: "SAL",
      periodicite: "Annuelle"
    },
    {
      mois: 10,
      jour: 15,
      label: "Cotisations INPS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 11,
      jour: 15,
      label: "Retenue ITS",
      impot: "SAL",
      periodicite: "Annuelle"
    },
    {
      mois: 11,
      jour: 15,
      label: "Cotisations INPS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 12,
      jour: 15,
      label: "Retenue ITS",
      impot: "SAL",
      periodicite: "Annuelle"
    },
    {
      mois: 12,
      jour: 15,
      label: "Cotisations INPS",
      impot: "SOC",
      periodicite: "Mensuelle"
    }
  ],
  NE: [
    {
      mois: 1,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 1,
      jour: 15,
      label: "Déclaration sociale (CNSS)",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 2,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 2,
      jour: 15,
      label: "Déclaration sociale (CNSS)",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 15,
      label: "Déclaration sociale (CNSS)",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 15,
      label: "Déclaration sociale (CNSS)",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 30,
      label: "Déclaration de résultats / IS",
      impot: "ANNUEL",
      periodicite: "Annuelle"
    },
    {
      mois: 5,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 5,
      jour: 15,
      label: "Déclaration sociale (CNSS)",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 6,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 6,
      jour: 15,
      label: "Déclaration sociale (CNSS)",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 15,
      label: "Déclaration sociale (CNSS)",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 8,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 8,
      jour: 15,
      label: "Déclaration sociale (CNSS)",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 15,
      label: "Déclaration sociale (CNSS)",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 15,
      label: "Déclaration sociale (CNSS)",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 11,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 11,
      jour: 15,
      label: "Déclaration sociale (CNSS)",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 12,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 12,
      jour: 15,
      label: "Déclaration sociale (CNSS)",
      impot: "SOC",
      periodicite: "Mensuelle"
    }
  ],
  CD: [
    {
      mois: 1,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 1,
      jour: 15,
      label: "Retenue IPR sur rémunérations",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 2,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 2,
      jour: 15,
      label: "Retenue IPR sur rémunérations",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 15,
      label: "Retenue IPR sur rémunérations",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 15,
      label: "Retenue IPR sur rémunérations",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 30,
      label: "Acomptes IBP",
      impot: "IS",
      periodicite: "3 acomptes/an + solde"
    },
    {
      mois: 4,
      jour: 30,
      label: "Déclaration IBP + états financiers annuels",
      impot: "ANNUEL",
      periodicite: "Annuelle"
    },
    {
      mois: 5,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 5,
      jour: 15,
      label: "Retenue IPR sur rémunérations",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 6,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 6,
      jour: 15,
      label: "Retenue IPR sur rémunérations",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 15,
      label: "Retenue IPR sur rémunérations",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 8,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 8,
      jour: 15,
      label: "Retenue IPR sur rémunérations",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 15,
      label: "Retenue IPR sur rémunérations",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 15,
      label: "Retenue IPR sur rémunérations",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 11,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 11,
      jour: 15,
      label: "Retenue IPR sur rémunérations",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 12,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 12,
      jour: 15,
      label: "Retenue IPR sur rémunérations",
      impot: "SAL",
      periodicite: "Mensuelle"
    }
  ],
  CF: [
    {
      mois: 1,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 1,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle"
    },
    {
      mois: 2,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 2,
      jour: 15,
      label: "Acomptes IS",
      impot: "IS",
      periodicite: "Annuelle"
    },
    {
      mois: 3,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 15,
      label: "Acomptes IS",
      impot: "IS",
      periodicite: "Annuelle"
    },
    {
      mois: 4,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle"
    },
    {
      mois: 4,
      jour: 30,
      label: "États financiers annuels (DSF) + solde IS + déclaration annuelle IRPP",
      impot: "IS",
      periodicite: "Annuelle"
    },
    {
      mois: 5,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 6,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 6,
      jour: 15,
      label: "Acomptes IS",
      impot: "IS",
      periodicite: "Annuelle"
    },
    {
      mois: 7,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle"
    },
    {
      mois: 8,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 15,
      label: "Acomptes IS",
      impot: "IS",
      periodicite: "Annuelle"
    },
    {
      mois: 10,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 15,
      label: "Acomptes IS",
      impot: "IS",
      periodicite: "Annuelle"
    },
    {
      mois: 10,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle"
    },
    {
      mois: 11,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 12,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    }
  ],
  CG: [
    {
      mois: 3,
      jour: 20,
      label: "Taxe spéciale sur les sociétés (TSS)",
      impot: "IS",
      periodicite: "Annuelle"
    },
    {
      mois: 4,
      jour: 30,
      label: "Solde IS + états financiers annuels",
      impot: "ANNUEL",
      periodicite: "Annuelle"
    }
  ],
  SN: [
    {
      mois: 1,
      jour: 10,
      label: "Déclarations sociales (CSS / IPRES)",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle selon effectif"
    },
    {
      mois: 1,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 1,
      jour: 15,
      label: "Retenue à la source sur salaires (VRS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 2,
      jour: 10,
      label: "Déclarations sociales (CSS / IPRES)",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle selon effectif"
    },
    {
      mois: 2,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 2,
      jour: 15,
      label: "Acomptes IS",
      impot: "IS",
      periodicite: "Semestrielle"
    },
    {
      mois: 2,
      jour: 15,
      label: "Retenue à la source sur salaires (VRS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 10,
      label: "Déclarations sociales (CSS / IPRES)",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle selon effectif"
    },
    {
      mois: 3,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 15,
      label: "Retenue à la source sur salaires (VRS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 10,
      label: "Déclarations sociales (CSS / IPRES)",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle selon effectif"
    },
    {
      mois: 4,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 15,
      label: "Retenue à la source sur salaires (VRS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 30,
      label: "Acomptes IS",
      impot: "IS",
      periodicite: "Semestrielle"
    },
    {
      mois: 4,
      jour: 30,
      label: "États financiers annuels / déclaration de résultat",
      impot: "ANNUEL",
      periodicite: "Annuelle"
    },
    {
      mois: 5,
      jour: 10,
      label: "Déclarations sociales (CSS / IPRES)",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle selon effectif"
    },
    {
      mois: 5,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 5,
      jour: 15,
      label: "Retenue à la source sur salaires (VRS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 6,
      jour: 10,
      label: "Déclarations sociales (CSS / IPRES)",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle selon effectif"
    },
    {
      mois: 6,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 6,
      jour: 15,
      label: "Retenue à la source sur salaires (VRS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 10,
      label: "Déclarations sociales (CSS / IPRES)",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle selon effectif"
    },
    {
      mois: 7,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 15,
      label: "Retenue à la source sur salaires (VRS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 8,
      jour: 10,
      label: "Déclarations sociales (CSS / IPRES)",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle selon effectif"
    },
    {
      mois: 8,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 8,
      jour: 15,
      label: "Retenue à la source sur salaires (VRS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 10,
      label: "Déclarations sociales (CSS / IPRES)",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle selon effectif"
    },
    {
      mois: 9,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 15,
      label: "Retenue à la source sur salaires (VRS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 10,
      label: "Déclarations sociales (CSS / IPRES)",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle selon effectif"
    },
    {
      mois: 10,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 15,
      label: "Retenue à la source sur salaires (VRS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 11,
      jour: 10,
      label: "Déclarations sociales (CSS / IPRES)",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle selon effectif"
    },
    {
      mois: 11,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 11,
      jour: 15,
      label: "Retenue à la source sur salaires (VRS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 12,
      jour: 10,
      label: "Déclarations sociales (CSS / IPRES)",
      impot: "SOC",
      periodicite: "Mensuelle ou trimestrielle selon effectif"
    },
    {
      mois: 12,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 12,
      jour: 15,
      label: "Retenue à la source sur salaires (VRS)",
      impot: "SAL",
      periodicite: "Mensuelle"
    }
  ],
  TD: [
    {
      mois: 1,
      jour: 15,
      label: "Minimum fiscal (acompte IS, 1,5% du CA)",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 1,
      jour: 15,
      label: "Acompte IRPP",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 2,
      jour: 15,
      label: "Minimum fiscal (acompte IS, 1,5% du CA)",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 2,
      jour: 15,
      label: "Acompte IRPP",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 15,
      label: "Minimum fiscal (acompte IS, 1,5% du CA)",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 15,
      label: "Acompte IRPP",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 15,
      label: "Minimum fiscal (acompte IS, 1,5% du CA)",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 15,
      label: "Acompte IRPP",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 5,
      jour: 15,
      label: "Minimum fiscal (acompte IS, 1,5% du CA)",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 5,
      jour: 15,
      label: "Acompte IRPP",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 6,
      jour: 15,
      label: "Minimum fiscal (acompte IS, 1,5% du CA)",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 6,
      jour: 15,
      label: "Acompte IRPP",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 15,
      label: "Minimum fiscal (acompte IS, 1,5% du CA)",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 15,
      label: "Acompte IRPP",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 8,
      jour: 15,
      label: "Minimum fiscal (acompte IS, 1,5% du CA)",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 8,
      jour: 15,
      label: "Acompte IRPP",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 15,
      label: "Minimum fiscal (acompte IS, 1,5% du CA)",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 15,
      label: "Acompte IRPP",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 15,
      label: "Minimum fiscal (acompte IS, 1,5% du CA)",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 15,
      label: "Acompte IRPP",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 11,
      jour: 15,
      label: "Minimum fiscal (acompte IS, 1,5% du CA)",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 11,
      jour: 15,
      label: "Acompte IRPP",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 12,
      jour: 15,
      label: "Minimum fiscal (acompte IS, 1,5% du CA)",
      impot: "IS",
      periodicite: "Mensuelle"
    },
    {
      mois: 12,
      jour: 15,
      label: "Acompte IRPP",
      impot: "IS",
      periodicite: "Mensuelle"
    }
  ],
  TG: [
    {
      mois: 1,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 1,
      jour: 15,
      label: "Retenue sur salaires (IRPP)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 1,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 1,
      jour: 31,
      label: "Acomptes IS / IRPP",
      impot: "IS",
      periodicite: "Trimestrielle"
    },
    {
      mois: 2,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 2,
      jour: 15,
      label: "Retenue sur salaires (IRPP)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 2,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 15,
      label: "Retenue sur salaires (IRPP)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 3,
      jour: 31,
      label: "États financiers annuels",
      impot: "ANNUEL",
      periodicite: "Annuelle"
    },
    {
      mois: 4,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 15,
      label: "Retenue sur salaires (IRPP)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 4,
      jour: 30,
      label: "États financiers annuels",
      impot: "ANNUEL",
      periodicite: "Annuelle"
    },
    {
      mois: 5,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 5,
      jour: 15,
      label: "Retenue sur salaires (IRPP)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 5,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 5,
      jour: 31,
      label: "Acomptes IS / IRPP",
      impot: "IS",
      periodicite: "Trimestrielle"
    },
    {
      mois: 6,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 6,
      jour: 15,
      label: "Retenue sur salaires (IRPP)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 6,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 15,
      label: "Retenue sur salaires (IRPP)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 7,
      jour: 31,
      label: "Acomptes IS / IRPP",
      impot: "IS",
      periodicite: "Trimestrielle"
    },
    {
      mois: 8,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 8,
      jour: 15,
      label: "Retenue sur salaires (IRPP)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 8,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 15,
      label: "Retenue sur salaires (IRPP)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 9,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 15,
      label: "Retenue sur salaires (IRPP)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 10,
      jour: 31,
      label: "Acomptes IS / IRPP",
      impot: "IS",
      periodicite: "Trimestrielle"
    },
    {
      mois: 11,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 11,
      jour: 15,
      label: "Retenue sur salaires (IRPP)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 11,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle"
    },
    {
      mois: 12,
      jour: 15,
      label: "Déclaration TVA",
      impot: "TVA",
      periodicite: "Mensuelle"
    },
    {
      mois: 12,
      jour: 15,
      label: "Retenue sur salaires (IRPP)",
      impot: "SAL",
      periodicite: "Mensuelle"
    },
    {
      mois: 12,
      jour: 15,
      label: "Déclaration sociale CNSS",
      impot: "SOC",
      periodicite: "Mensuelle"
    }
  ]
};

/** Échéances d'un pays, triées par mois puis jour. */
export function getCalendar(code) {
  return FISCAL_CALENDARS[String(code || '').toUpperCase()] || [];
}
/** Échéances d'un pays pour un mois donné (1-12). */
export function getMonthDeadlines(code, mois) {
  return getCalendar(code).filter((e) => e.mois === mois);
}
