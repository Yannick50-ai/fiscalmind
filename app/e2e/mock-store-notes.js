// Mock du store (app/src/store.js) pour le harnais e2e des notes annexes.
// Données en mémoire : window.__fmMockEntries / window.__fmMockSettings.
const entries = () => window.__fmMockEntries || [];
const settings = () => window.__fmMockSettings || (window.__fmMockSettings = {});

export async function loadEntries() { return entries(); }
export async function defaultPeriode() { return { debut: '2025-01-01', fin: '2025-12-31' }; }
export async function savePeriode(p) { settings().periode = p; return p; }
export async function loadCompany() { return settings().company || 'Mon entreprise'; }
export async function saveCompany(name) { settings().company = name; return name; }
export async function getSetting(key, fallback) {
  const s = settings();
  return Object.prototype.hasOwnProperty.call(s, key) ? s[key] : fallback;
}
export async function setSetting(key, value) { settings()[key] = value; return value; }
