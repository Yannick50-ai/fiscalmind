/**
 * Données fiscales des 17 pays OHADA — FiscalMind Africa (étape 2 de la migration).
 * Généré par scripts/build-country-data.js — NE PAS ÉDITER À LA MAIN, relancer le script.
 * Sources : fiscal-pays-recherche/*.json + FM_COUNTRY_DATA (déployé 8 oct. 2026, corrections expertes incluses). Voir NOTES.md pour la provenance valeur par valeur.
 */

export const COUNTRIES = [
  {
    code: "BF",
    nom: "Burkina Faso",
    devise: "XOF",
    administrationFiscale: "DGI (téléprocédures eSINTAX)",
    orgSocial: "CNSS",
    impotSalaires: "IUTS",
    tva: 18,
    is: 27.5,
    statut: "Partiellement vérifié",
    labels: {
      TVA: "TVA",
      IS: "IS",
      SAL: "IUTS",
      SOC: "CNSS",
      ANNUEL: "DSF"
    },
    social: {
      employer: 16,
      employee: 5.5,
      combined: 21.5,
      basis: "salaire brut",
      org: "CNSS",
      status: "Confirmé (CNSS)",
      notes: ""
    },
    _sources: {
      json: "bf.json",
      verifie: true
    }
  },
  {
    code: "BJ",
    nom: "Bénin",
    devise: "XOF",
    administrationFiscale: "DGI (Direction Générale des Impôts)",
    orgSocial: "CNSS",
    impotSalaires: "ITS (Impôt sur les Traitements et Salaires)",
    tva: 18,
    is: 30,
    statut: "Partiellement vérifié",
    labels: {
      TVA: "TVA",
      IS: "IS (Impôt sur les Sociétés)",
      SAL: "ITS (Impôt sur les Traitements et Salaires)",
      SOC: "CNSS (Caisse Nationale de Sécurité Sociale du Bénin)",
      ANNUEL: "États financiers"
    },
    social: {
      employer: {
        min: 16.4,
        max: 19.4
      },
      employee: 3.6,
      combined: null,
      basis: "salaires bruts (pas de plafond)",
      org: "CNSS",
      status: "À vérifier",
      notes: "JSON : 6,4 % (pensions) + 9 % (PF) + 1 à 4 % (risques pro)."
    },
    _sources: {
      json: "bj.json",
      verifie: false
    }
  },
  {
    code: "CD",
    nom: "RD Congo",
    devise: "CDF",
    administrationFiscale: "DGI (Direction Générale des Impôts)",
    orgSocial: "CNSS",
    impotSalaires: "IPR (Impôt professionnel sur les rémunérations)",
    tva: 16,
    is: 30,
    statut: "Confirmé",
    labels: {
      TVA: "TVA",
      IS: "IBP (Impôt professionnel sur les bénéfices et profits)",
      SAL: "IPR (Impôt professionnel sur les rémunérations)",
      SOC: "CNSS (Caisse Nationale de Sécurité Sociale)",
      ANNUEL: "États financiers"
    },
    social: {
      employer: 13,
      employee: 5,
      combined: 18,
      basis: "salaire brut",
      org: "CNSS",
      status: "Confirmé pour CNSS — hors INPP/ONEM",
      notes: "Périmètre CNSS uniquement."
    },
    _sources: {
      json: "cd.json",
      verifie: true
    }
  },
  {
    code: "CF",
    nom: "République centrafricaine",
    devise: "XAF",
    administrationFiscale: "DGI",
    orgSocial: "CNSS",
    impotSalaires: "IRPP",
    tva: 19,
    is: 30,
    statut: "Confirmé",
    labels: {
      TVA: "TVA",
      IS: "IS",
      SAL: "IRPP",
      SOC: "CNSS",
      ANNUEL: "États financiers"
    },
    social: {
      employer: 19,
      employee: 3,
      combined: 22,
      basis: "salaires",
      org: "CNSS",
      status: "À vérifier",
      notes: "JSON : 12 % PF/maternité + 3 % risques pro + 4 % PVID."
    },
    _sources: {
      json: "cf.json",
      verifie: false
    }
  },
  {
    code: "CG",
    nom: "République du Congo",
    devise: "XAF",
    administrationFiscale: "DGI",
    orgSocial: "CNSS",
    impotSalaires: "IRPP",
    tva: 18,
    is: 28,
    statut: "Partiellement vérifié",
    labels: {
      TVA: "TVA",
      IS: "IS",
      SAL: "IRPP",
      SOC: "CNSS",
      ANNUEL: "États financiers"
    },
    social: {
      employer: 24.83,
      employee: 6.27,
      combined: 31.1,
      basis: "salaires (plafonds)",
      org: "CNSS",
      status: "À vérifier (CAMU à vérifier)",
      notes: "JSON : 8 % + 12,28 % + 4,55 % CAMU (employeur) ; 4 % + 2,27 % CAMU (salarié)."
    },
    _sources: {
      json: "cg.json",
      verifie: false
    }
  },
  {
    code: "CI",
    nom: "Côte d'Ivoire",
    devise: "XOF",
    administrationFiscale: "DGI (Direction Générale des Impôts)",
    orgSocial: "CNPS",
    impotSalaires: "ITS (Impôt sur les Traitements et Salaires)",
    tva: 18,
    is: 25,
    imf: 0.5, // Impôt Minimum Forfaitaire — relevé du classeur NO-Pro.V2 (8 oct. 2026)
    statut: "Partiellement vérifié",
    labels: {
      TVA: "TVA",
      IS: "BIC (Impôt sur les Bénéfices Industriels et Commerciaux)",
      SAL: "ITS (Impôt sur les Traitements et Salaires)",
      SOC: "CNPS (Caisse Nationale de Prévoyance Sociale)",
      ANNUEL: "États financiers"
    },
    social: {
      employer: {
        min: 15.45,
        max: 18.45
      },
      employee: 6.3,
      combined: null,
      basis: "salaires bruts (plafonds)",
      org: "CNPS",
      status: "À vérifier",
      notes: "Retraite 7,7 % / 6,3 % ; PF 5 % + maternité 0,75 % + AT 2 à 5 % (employeur seul)."
    },
    _sources: {
      json: "ci.json",
      verifie: false
    }
  },
  {
    code: "CM",
    nom: "Cameroun",
    devise: "XAF",
    administrationFiscale: "DGI",
    orgSocial: "CNPS",
    impotSalaires: "IRPP",
    tva: 19.25,
    is: 33,
    statut: "Confirmé",
    labels: {
      TVA: "TVA",
      IS: "IS",
      SAL: "IRPP",
      SOC: "CNPS",
      ANNUEL: "États financiers"
    },
    social: {
      employer: {
        min: 12.95,
        max: 16.2
      },
      employee: 4.2,
      combined: null,
      basis: "salaire brut (PVID plafonné 750 000 F/mois)",
      org: "CNPS",
      status: "À vérifier",
      notes: "JSON : 4,2 % PVID + 7 % PF + 1,75 à 5 % AT selon risque."
    },
    _sources: {
      json: "cm.json",
      verifie: false
    }
  },
  {
    code: "GA",
    nom: "Gabon",
    devise: "XAF",
    administrationFiscale: "DGI",
    orgSocial: "CNSS",
    impotSalaires: "IRPP",
    tva: 18,
    is: 30,
    statut: "Partiellement vérifié",
    labels: {
      TVA: "TVA",
      IS: "IS",
      SAL: "IRPP",
      SOC: "CNSS",
      ANNUEL: "États financiers"
    },
    social: {
      employer: 16.75,
      employee: 4,
      combined: 20.75,
      basis: "salaires bruts (plafond 1 500 000 F/mois)",
      org: "CNSS",
      status: "À vérifier (source unique)",
      notes: "JSON : 8 % retraites + 7 % PF + 1,75 % AT/MP."
    },
    _sources: {
      json: "ga.json",
      verifie: false
    }
  },
  {
    code: "GN",
    nom: "Guinée",
    devise: "GNF",
    administrationFiscale: "DNI (Direction Nationale des Impôts)",
    orgSocial: "CNSS",
    impotSalaires: "RTS (Retenue sur les Traitements et Salaires) / IRPP",
    tva: 20,
    is: 30,
    statut: "À vérifier",
    labels: {
      TVA: "TVA",
      IS: "IS (Impôt sur les Sociétés)",
      SAL: "RTS (Retenue sur les Traitements et Salaires) / IRPP",
      SOC: "CNSS (Caisse Nationale de Sécurité Sociale)",
      ANNUEL: "États financiers"
    },
    social: {
      employer: 18,
      employee: 5,
      combined: 23,
      basis: "salaire soumis",
      org: "CNSS",
      status: "Confirmé par CNSS",
      notes: ""
    },
    _sources: {
      json: "gn.json",
      verifie: true
    }
  },
  {
    code: "GQ",
    nom: "Guinée équatoriale",
    devise: "XAF",
    administrationFiscale: "Direction Générale des Impôts et Contributions (Ministère des Finances)",
    orgSocial: "INSESO",
    impotSalaires: "Impuesto sobre Sueldos y Salarios",
    tva: 15,
    is: 25,
    statut: "Partiellement vérifié",
    labels: {
      TVA: "IVA",
      IS: "IS (Impuesto sobre Sociedades)",
      SAL: "Impuesto sobre Sueldos y Salarios",
      SOC: "INSESO (Instituto Nacional de Seguridad Social)",
      ANNUEL: "États financiers"
    },
    social: {
      employer: 21.5,
      employee: 4.5,
      combined: 26,
      basis: "salaire de base",
      org: "INSESO",
      status: "À vérifier",
      notes: ""
    },
    _sources: {
      json: "gq.json",
      verifie: false
    }
  },
  {
    code: "GW",
    nom: "Guinée-Bissau",
    devise: "XOF",
    administrationFiscale: "DGCI (Direcção-Geral das Contribuições e Impostos)",
    orgSocial: "Segurança Social",
    impotSalaires: "Imposto Profissional",
    tva: 10,
    is: 25,
    statut: "À vérifier",
    labels: {
      TVA: "IGVS (pas de TVA classique)",
      IS: "Contribuição Industrial",
      SAL: "Imposto Profissional",
      SOC: "Segurança Social",
      ANNUEL: "États financiers"
    },
    social: {
      employer: 14,
      employee: 8,
      combined: 22,
      basis: "à vérifier",
      org: "Segurança Social",
      status: "Provisoire — à vérifier",
      notes: "Taux approximatifs (≈14 % / ≈8 %), à confirmer."
    },
    _sources: {
      json: "gw.json",
      verifie: true
    }
  },
  {
    code: "KM",
    nom: "Comores",
    devise: "KMF",
    administrationFiscale: "DGI (Direction Générale des Impôts)",
    orgSocial: "CNSPS",
    impotSalaires: "IRPP",
    tva: 10,
    is: 35,
    statut: "Confirmé",
    labels: {
      TVA: "Taxe sur la consommation (il n'existe pas de TVA aux Comores)",
      IS: "IS",
      SAL: "IRPP",
      SOC: "CNSPS + Caisse de retraite des Comores",
      ANNUEL: "États financiers"
    },
    social: {
      employer: {
        min: 8.5,
        max: 11
      },
      employee: 3,
      combined: null,
      basis: "salaire",
      org: "CNSPS",
      status: "À vérifier",
      notes: "Non-fonctionnaires. Fonctionnaires : 12 % / 5 %. JSON : 5 % retraite + 2,5 à 5 % AT-MP + 1 % maternité."
    },
    _sources: {
      json: "km.json",
      verifie: false
    }
  },
  {
    code: "ML",
    nom: "Mali",
    devise: "XOF",
    administrationFiscale: "DGI",
    orgSocial: "INPS",
    impotSalaires: "ITS",
    tva: 18,
    is: 30,
    statut: "Partiellement vérifié",
    labels: {
      TVA: "TVA",
      IS: "IS",
      SAL: "ITS",
      SOC: "INPS (AMO santé via CANAM)",
      ANNUEL: "États financiers"
    },
    social: {
      employer: {
        min: 18.9,
        max: 21.9
      },
      employee: 6.66,
      combined: null,
      basis: "salaire brut",
      org: "INPS",
      status: "Partiellement confirmé — afficher fourchette",
      notes: "Part patronale : fourchette selon le risque professionnel."
    },
    _sources: {
      json: "ml.json",
      verifie: true
    }
  },
  {
    code: "NE",
    nom: "Niger",
    devise: "XOF",
    administrationFiscale: "DGI",
    orgSocial: "CNSS",
    impotSalaires: "ITS",
    tva: 19,
    is: 30,
    statut: "Partiellement vérifié",
    labels: {
      TVA: "TVA",
      IS: "IS",
      SAL: "ITS",
      SOC: "CNSS",
      ANNUEL: "États financiers"
    },
    social: {
      employer: 16.4,
      employee: 5.25,
      combined: 21.65,
      basis: "salaire plafonné (6 000 000/an)",
      org: "CNSS",
      status: "Confirmé avec périmètre",
      notes: "ANPE 0,5 % en plus, versée séparément."
    },
    _sources: {
      json: "ne.json",
      verifie: true
    }
  },
  {
    code: "SN",
    nom: "Sénégal",
    devise: "XOF",
    administrationFiscale: "DGID",
    orgSocial: "CSS + IPRES",
    impotSalaires: "IR (retenue à la source sur les salaires)",
    tva: 18,
    is: 30,
    statut: "Confirmé",
    labels: {
      TVA: "TVA",
      IS: "IS",
      SAL: "IR (retenue à la source sur les salaires)",
      SOC: "CSS + IPRES",
      ANNUEL: "États financiers"
    },
    social: {
      employer: {
        min: 16.4,
        max: 20.4
      },
      employee: 5.6,
      combined: null,
      basis: "salaires (plafonds)",
      org: "CSS + IPRES",
      status: "À vérifier",
      notes: "Régime général : 7 % PF + 1 à 5 % AT + 8,4 % IPRES. Hors régime cadre et IPM."
    },
    _sources: {
      json: "sn.json",
      verifie: false
    }
  },
  {
    code: "TD",
    nom: "Tchad",
    devise: "XAF",
    administrationFiscale: "DGI",
    orgSocial: "CNPS",
    impotSalaires: "IRPP",
    tva: 18,
    is: 35,
    statut: "Partiellement vérifié",
    labels: {
      TVA: "TVA",
      IS: "IS",
      SAL: "IRPP",
      SOC: "CNPS",
      ANNUEL: "États financiers"
    },
    social: {
      employer: 16.5,
      employee: 3.5,
      combined: 20,
      basis: "salaires (plafond 500 000 F/mois)",
      org: "CNPS",
      status: "À vérifier",
      notes: "JSON : 5 % PVID + 4 % AT/MP + 7,5 % PF/maternité."
    },
    _sources: {
      json: "td.json",
      verifie: false
    }
  },
  {
    code: "TG",
    nom: "Togo",
    devise: "XOF",
    administrationFiscale: "OTR (Office Togolais des Recettes)",
    orgSocial: "CNSS",
    impotSalaires: "IRPP (Impôt sur le Revenu des Personnes Physiques) — catégorie revenus d'emplois",
    tva: 18,
    is: 27,
    statut: "Partiellement vérifié",
    labels: {
      TVA: "TVA",
      IS: "IS (Impôt sur les Sociétés)",
      SAL: "IRPP (Impôt sur le Revenu des Personnes Physiques) — catégorie revenus d'emplois",
      SOC: "CNSS (Caisse Nationale de Sécurité Sociale)",
      ANNUEL: "États financiers"
    },
    social: {
      employer: 20.28,
      employee: 4,
      combined: 24.28,
      basis: "salaires bruts",
      org: "CNSS",
      status: "À vérifier (source unique)",
      notes: "JSON : 8 % / 4 % pensions + 10,03 % PF + 2,25 % AT (employeur seul)."
    },
    _sources: {
      json: "tg.json",
      verifie: false
    }
  }
];

/** Pays par code ISO (ex. 'BF'). Retourne null si inconnu. */
export function getCountry(code) {
  const c = String(code || '').toUpperCase();
  return COUNTRIES.find((p) => p.code === c) || null;
}
/** Les 17 codes pays OHADA. */
export function countryCodes() {
  return COUNTRIES.map((p) => p.code);
}
/**
 * Applique des surcharges de taux personnalisées (Paramètres → Paramètres fiscaux).
 * Pur : ne modifie pas l'objet d'origine. Seules les valeurs numériques finies sont prises.
 * overrides: { tva?, is?, employer?, employee? } (nombres, en %)
 */
export function applyTaxOverrides(country, overrides) {
  const o = overrides || {};
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  const tva = num(o.tva); const is = num(o.is);
  const emp = num(o.employer); const sal = num(o.employee);
  if (tva === null && is === null && emp === null && sal === null) return country;
  const next = JSON.parse(JSON.stringify(country));
  if (tva !== null) next.tva = tva;
  if (is !== null) next.is = is;
  if (emp !== null || sal !== null) {
    if (emp !== null) next.social.employer = emp;
    if (sal !== null) next.social.employee = sal;
    const e = next.social.employer; const s = next.social.employee;
    next.social.combined = (typeof e === 'number' && typeof s === 'number') ? e + s : null;
    next.social.status = "Personnalisé par l'utilisateur";
  }
  return next;
}
