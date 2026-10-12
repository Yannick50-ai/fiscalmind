/**
 * Génère src/data/countries.js, calendars.js et fiches.js depuis :
 *  - ~/workspace/fiscal-pays-recherche/*.json (recherche officielle, 17 pays)
 *  - FM_COUNTRY_DATA extrait de fiscalmind-app.html (état déployé le 8 oct. 2026,
 *    incluant les corrections d'expert vérifiées par Yannick)
 *
 * Usage : node scripts/build-country-data.js
 * Sorties : src/data/countries.js, src/data/calendars.js, src/data/fiches.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION = path.resolve(__dirname, '..');
const JSON_DIR = path.join(process.env.HOME, 'workspace/fiscal-pays-recherche');

// --- 1. Charger les JSON de recherche ---
const jsonByCode = {};
for (const f of fs.readdirSync(JSON_DIR).filter((f) => f.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(JSON_DIR, f), 'utf8'));
  jsonByCode[j.code] = j;
}

// --- 2. Charger FM_COUNTRY_DATA depuis le HTML (état déployé) ---
const htmlPath = path.join(process.env.HOME, 'workspace/your_files/fiscalmind-africa/fiscalmind-app.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const start = html.indexOf('const FM_COUNTRY_DATA = {');
const end = html.indexOf('\n        function fmCountryData()', start);
const literal = html.slice(start, end).replace('const FM_COUNTRY_DATA =', '').trim().replace(/;$/, '');
const FM = new Function(`return (${literal})`)();

// --- 3. Corrections sociales vérifiées par expert (déployées le 8 oct. 2026) ---
// Priroitaires sur les JSON bruts. Source : vérification experte Yannick (DGI/CNSS/Cleiss).
const VERIFIED_SOCIAL = {
  BF: { employer: 16, employee: 5.5, combined: 21.5, basis: 'salaire brut', org: 'CNSS', status: 'Confirmé (CNSS)', notes: '' },
  GN: { employer: 18, employee: 5, combined: 23, basis: 'salaire soumis', org: 'CNSS', status: 'Confirmé par CNSS', notes: '' },
  GW: { employer: 14, employee: 8, combined: 22, basis: 'à vérifier', org: 'Segurança Social', status: 'Provisoire — à vérifier', notes: 'Taux approximatifs (≈14 % / ≈8 %), à confirmer.' },
  ML: { employer: { min: 18.9, max: 21.9 }, employee: 6.66, combined: null, basis: 'salaire brut', org: 'INPS', status: 'Partiellement confirmé — afficher fourchette', notes: 'Part patronale : fourchette selon le risque professionnel.' },
  NE: { employer: 16.4, employee: 5.25, combined: 21.65, basis: 'salaire plafonné (6 000 000/an)', org: 'CNSS', status: 'Confirmé avec périmètre', notes: 'ANPE 0,5 % en plus, versée séparément.' },
  CD: { employer: 13, employee: 5, combined: 18, basis: 'salaire brut', org: 'CNSS', status: 'Confirmé pour CNSS — hors INPP/ONEM', notes: 'Périmètre CNSS uniquement.' },
};

// --- 4. Données sociales issues des JSON (non vérifiées par expert) ---
// Valeurs numériques extraites fidèlement des chaînes des JSON ; calculs documentés.
const JSON_SOCIAL = {
  BJ: { employer: { min: 16.4, max: 19.4 }, employee: 3.6, combined: null, basis: 'salaires bruts (pas de plafond)', org: 'CNSS', status: 'À vérifier', notes: 'JSON : 6,4 % (pensions) + 9 % (PF) + 1 à 4 % (risques pro).' },
  CM: { employer: { min: 12.95, max: 16.2 }, employee: 4.2, combined: null, basis: 'salaire brut (PVID plafonné 750 000 F/mois)', org: 'CNPS', status: 'À vérifier', notes: 'JSON : 4,2 % PVID + 7 % PF + 1,75 à 5 % AT selon risque.' },
  KM: { employer: { min: 8.5, max: 11 }, employee: 3, combined: null, basis: 'salaire', org: 'CNSPS', status: 'À vérifier', notes: 'Non-fonctionnaires. Fonctionnaires : 12 % / 5 %. JSON : 5 % retraite + 2,5 à 5 % AT-MP + 1 % maternité.' },
  CI: { employer: { min: 15.45, max: 18.45 }, employee: 6.3, combined: null, basis: 'salaires bruts (plafonds)', org: 'CNPS', status: 'À vérifier', notes: 'Retraite 7,7 % / 6,3 % ; PF 5 % + maternité 0,75 % + AT 2 à 5 % (employeur seul).' },
  GA: { employer: 16.75, employee: 4, combined: 20.75, basis: 'salaires bruts (plafond 1 500 000 F/mois)', org: 'CNSS', status: 'À vérifier (source unique)', notes: 'JSON : 8 % retraites + 7 % PF + 1,75 % AT/MP.' },
  GQ: { employer: 21.5, employee: 4.5, combined: 26, basis: 'salaire de base', org: 'INSESO', status: 'À vérifier', notes: '' },
  CF: { employer: 19, employee: 3, combined: 22, basis: 'salaires', org: 'CNSS', status: 'À vérifier', notes: 'JSON : 12 % PF/maternité + 3 % risques pro + 4 % PVID.' },
  CG: { employer: 24.83, employee: 6.27, combined: 31.1, basis: 'salaires (plafonds)', org: 'CNSS', status: 'À vérifier (CAMU à vérifier)', notes: 'JSON : 8 % + 12,28 % + 4,55 % CAMU (employeur) ; 4 % + 2,27 % CAMU (salarié).' },
  SN: { employer: { min: 16.4, max: 20.4 }, employee: 5.6, combined: null, basis: 'salaires (plafonds)', org: 'CSS + IPRES', status: 'À vérifier', notes: 'Régime général : 7 % PF + 1 à 5 % AT + 8,4 % IPRES. Hors régime cadre et IPM.' },
  TD: { employer: 16.5, employee: 3.5, combined: 20, basis: 'salaires (plafond 500 000 F/mois)', org: 'CNPS', status: 'À vérifier', notes: 'JSON : 5 % PVID + 4 % AT/MP + 7,5 % PF/maternité.' },
  TG: { employer: 20.28, employee: 4, combined: 24.28, basis: 'salaires bruts', org: 'CNSS', status: 'À vérifier (source unique)', notes: 'JSON : 8 % / 4 % pensions + 10,03 % PF + 2,25 % AT (employeur seul).' },
};

const CONFIDENCE_TO_STATUT = { haute: 'Confirmé', moyenne: 'Partiellement vérifié', basse: 'À vérifier' };
const fmtNum = (v) => (typeof v === 'number' ? String(v).replace('.', ',') : v);

// --- 5. Construire COUNTRIES ---
const COUNTRIES = [];
for (const nom of Object.keys(FM)) {
  const f = FM[nom];
  const code = f.code;
  const j = jsonByCode[code];
  if (!j) throw new Error('JSON manquant pour ' + code);
  const social = VERIFIED_SOCIAL[code] || JSON_SOCIAL[code];
  if (!social) throw new Error('Données sociales manquantes pour ' + code);
  COUNTRIES.push({
    code,
    nom: j.country,
    devise: j.currency || f.currency,
    administrationFiscale: j.tax_authority || f.taxAuthority,
    orgSocial: social.org,
    impotSalaires: j.salary_tax ? j.salary_tax.name : f.salaryTax,
    tva: j.tva.rate,
    is: j.is.rate,
    statut: CONFIDENCE_TO_STATUT[j.confidence] || 'À vérifier',
    labels: f.labels,
    social: { ...social },
    _sources: { json: `${code.toLowerCase()}.json`, verifie: Boolean(VERIFIED_SOCIAL[code]) },
  });
}
COUNTRIES.sort((a, b) => a.code.localeCompare(b.code));

// --- 6. Construire FISCAL_CALENDARS depuis events ---
const FISCAL_CALENDARS = {};
for (const nom of Object.keys(FM)) {
  const f = FM[nom];
  const list = [];
  for (const [m0, evs] of Object.entries(f.events || {})) {
    for (const e of evs) {
      const rule = (f.rules || {})[e.b] || {};
      list.push({
        mois: Number(m0) + 1,
        jour: e.d,
        label: e.t,
        impot: e.b,
        periodicite: rule.periodicite || '',
      });
    }
  }
  list.sort((a, b) => a.mois - b.mois || a.jour - b.jour);
  FISCAL_CALENDARS[f.code] = list;
}

// --- 7. Construire FICHES depuis rules ---
const FICHES = {};
for (const nom of Object.keys(FM)) {
  const f = FM[nom];
  FICHES[f.code] = {};
  for (const [k, r] of Object.entries(f.rules || {})) {
    FICHES[f.code][k] = {
      nom: r.name, periodicite: r.periodicite, taux: r.taux,
      echeance: r.echeance, penalites: r.penalites, base: r.base, conseil: r.conseil,
    };
  }
}

// --- 8. Émettre les modules ---
const outDir = path.join(MIGRATION, 'src', 'data');
fs.mkdirSync(outDir, { recursive: true });

const header = (src) => `/**\n * Données fiscales des 17 pays OHADA — FiscalMind Africa (étape 2 de la migration).\n * Généré par scripts/build-country-data.js — NE PAS ÉDITER À LA MAIN, relancer le script.\n * Sources : ${src}\n */\n`;

const js = (v) => JSON.stringify(v, null, 2).replace(/"([^"]+)":/g, '$1:');

let countriesSrc = header("fiscal-pays-recherche/*.json + FM_COUNTRY_DATA (déployé 8 oct. 2026, corrections expertes incluses). Voir NOTES.md pour la provenance valeur par valeur.");
countriesSrc += `\nexport const COUNTRIES = ${js(COUNTRIES)};\n`;
countriesSrc += `
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
`;
fs.writeFileSync(path.join(outDir, 'countries.js'), countriesSrc);

let calSrc = header('FM_COUNTRY_DATA.events (calendriers déployés) + periodicite issue des fiches rules.');
calSrc += `\nexport const FISCAL_CALENDARS = ${js(FISCAL_CALENDARS)};\n`;
calSrc += `
/** Échéances d'un pays, triées par mois puis jour. */
export function getCalendar(code) {
  return FISCAL_CALENDARS[String(code || '').toUpperCase()] || [];
}
/** Échéances d'un pays pour un mois donné (1-12). */
export function getMonthDeadlines(code, mois) {
  return getCalendar(code).filter((e) => e.mois === mois);
}
`;
fs.writeFileSync(path.join(outDir, 'calendars.js'), calSrc);

let fichesSrc = header('FM_COUNTRY_DATA.rules (fiches stratégiques déployées le 8 oct. 2026).');
fichesSrc += `\nexport const FICHES = ${js(FICHES)};\n`;
fichesSrc += `
/** Fiche stratégique d'un impôt pour un pays (clés: TVA, IS, SAL, SOC, ANNUEL). */
export function getFiche(code, impot) {
  const c = FICHES[String(code || '').toUpperCase()];
  return (c && c[impot]) || null;
}
`;
fs.writeFileSync(path.join(outDir, 'fiches.js'), fichesSrc);

console.log('OK —', COUNTRIES.length, 'pays,', Object.values(FISCAL_CALENDARS).flat().length, 'échéances,',
  Object.values(FICHES).reduce((n, c) => n + Object.keys(c).length, 0), 'fiches.');
