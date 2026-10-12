// Mock du store (app/src/store.js) pour le harnais e2e des fiches DSF.
// Données en mémoire : window.__fmMockEntries / window.__fmMockSettings.
// L'identification est volontairement INCOMPLÈTE (téléphone manquant) pour
// que la recevabilité affiche au moins un contrôle ❌ et un contrôle ✅
// (bilan équilibré sur le jeu fourni).
const entries = () => window.__fmMockEntries || [];
const settings = () => window.__fmMockSettings || (window.__fmMockSettings = {});

export async function loadEntries() { return entries(); }
export async function defaultPeriode() { return { debut: '2025-01-01', fin: '2025-12-31' }; }
export async function loadCompany() { return settings().company || 'Mon entreprise'; }
export async function loadCompanyIfu() { return settings().company_ifu || ''; }
export async function loadCompanyRegime() { return settings().company_regime || ''; }
export async function loadCompanyR1() { return settings().company_r1 || {}; }
export async function loadDirigeants() { return settings().company_dirigeants || []; }
export async function loadAssocies() { return settings().company_associes || []; }
export async function getSetting(key, fallback) {
  const s = settings();
  return Object.prototype.hasOwnProperty.call(s, key) ? s[key] : fallback;
}
export async function setSetting(key, value) { settings()[key] = value; return value; }
