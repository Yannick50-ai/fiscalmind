/**
 * FiscalMind Africa — Convertisseur de devises (pur).
 *
 * Taux repris de l'ancien site (taux de référence hors-ligne, octobre 2026) :
 * AUCUNE API externe n'était utilisée. Dans la migration, ces taux deviennent
 * MODIFIABLES et sont stockés en fm_settings (clé 'fx_rates') — jamais en dur
 * côté logique métier. Matrice complète : rates[FROM][TO] = multiplicateur.
 */

export const FX_CURRENCIES = ['XOF', 'USD', 'EUR', 'NGN', 'GBP'];

export const FX_SYMBOLS = { XOF: 'CFA', USD: '$', EUR: '€', NGN: '₦', GBP: '£' };

/** Taux de référence initiaux (port de l'ancien site, modifiables ensuite). */
export const DEFAULT_FX_RATES = {
  USD: { XOF: 601.23, EUR: 0.913, NGN: 412.5, GBP: 0.789 },
  EUR: { XOF: 659.02, USD: 1.095, NGN: 452.1, GBP: 0.865 },
  NGN: { XOF: 1.45, USD: 0.00242, EUR: 0.00221, GBP: 0.00191 },
  GBP: { XOF: 761.5, USD: 1.267, EUR: 1.156, NGN: 523.4 },
  XOF: { USD: 0.00166, EUR: 0.00152, NGN: 0.69, GBP: 0.00131 },
};

/** Taux FROM -> TO (1 si identiques, null si inconnu). */
export function fxRate(rates, from, to) {
  if (from === to) return 1;
  const r = rates && rates[from] && rates[from][to];
  const v = Number(r);
  return v > 0 ? v : null;
}

/** Conversion arrondie à 2 décimales (null si taux inconnu). */
export function convert(amount, from, to, rates) {
  const r = fxRate(rates, from, to);
  if (r === null) return null;
  const a = Number(amount) || 0;
  return Math.round(a * r * 100) / 100;
}

/**
 * Nettoie une matrice de taux saisie (immuable). Les cases vides/invalides
 * conservent la valeur précédente ; la diagonale reste 1.
 */
export function sanitizeFxRates(raw, previous) {
  const prev = previous || DEFAULT_FX_RATES;
  const out = {};
  for (const from of FX_CURRENCIES) {
    out[from] = {};
    for (const to of FX_CURRENCIES) {
      if (from === to) { out[from][to] = 1; continue; }
      const v = Number(raw && raw[from] && raw[from][to]);
      out[from][to] = v > 0 ? v : (prev[from] && prev[from][to]) || null;
    }
  }
  return out;
}
