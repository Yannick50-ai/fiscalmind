// Mock du store pour le harnais e2e de la page Configuration (section DSF).
export class CloudError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}
const settings = () => window.__fmMockSettings || (window.__fmMockSettings = {});
export async function loadEntries() { return []; }
export async function saveEntry(e) { return e; }
export async function deleteEntryById() { return true; }
export async function defaultPeriode() { return { debut: '2025-01-01', fin: '2025-12-31' }; }
export async function savePeriode(p) { settings().periode = p; return p; }
export async function loadCompany() { return settings().company || 'Mon entreprise'; }
export async function saveCompany(name) { settings().company = name; return name; }
export async function loadCompanyIfu() { return settings().company_ifu || ''; }
export async function saveCompanyIfu(v) { settings().company_ifu = v; return v; }
export async function loadCompanyRegime() { return settings().company_regime || ''; }
export async function saveCompanyRegime(v) { settings().company_regime = v; return v; }
export async function loadCountry() { return 'BF'; }
export async function loadTaxOverrides() { return {}; }
export async function saveTaxOverrides(o) { settings().tax_overrides = o; return o; }
export async function loadCompanyR1() { return settings().company_r1 || {}; }
export async function saveCompanyR1(r1) { settings().company_r1 = r1; return r1; }
export async function loadDirigeants() { return settings().company_dirigeants || []; }
export async function saveDirigeants(l) { settings().company_dirigeants = l; return l; }
export async function loadAssocies() { return settings().company_associes || []; }
export async function saveAssocies(l) { settings().company_associes = l; return l; }
export async function getSetting(key, fallback) {
  const s = settings();
  return Object.prototype.hasOwnProperty.call(s, key) ? s[key] : fallback;
}
export async function setSetting(key, value) { settings()[key] = value; return value; }
