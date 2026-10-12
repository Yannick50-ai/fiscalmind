/**
 * FiscalMind Africa — paramètres système (fm_sys_settings), fonctions pures.
 *
 * Miroir côté frontend des règles appliquées par la Edge Function
 * `admin-settings` : whitelist des clés autorisées, masquage des secrets
 * avant affichage. La fonction Deno duplique ces règles localement
 * (elle ne peut pas importer ce fichier) : toute modification ici doit
 * être reportée dans supabase-functions-admin-settings-index.ts.
 */

/** Clés de paramètres autorisées (whitelist stricte côté serveur). */
export const SETTING_KEYS = [
  'ai_provider',
  'ai_api_key',
  'ai_model',
  'quota_demo',
  'quota_starter',
  'quota_pro',
  'quota_enterprise',
];

/** Clés sensibles : leur valeur est masquée avant d'être renvoyée au frontend. */
export const SENSITIVE_SETTING_KEYS = ['ai_api_key'];

/** Valeurs autorisées pour ai_provider. */
export const AI_PROVIDERS = ['xkiro', 'anthropic'];

/** La clé fait-elle partie de la whitelist ? */
export function isAllowedSettingKey(key) {
  return typeof key === 'string' && SETTING_KEYS.includes(key);
}

/**
 * Masque un secret pour affichage : garde les 6 premiers et les 4 derniers
 * caractères, remplace le milieu par « •••• ».
 * Ex. : 'sk-xt-abcdef123456c146' → 'sk-xt-a••••c146'.
 * Les secrets trop courts sont masqués intégralement.
 */
export function maskSecret(value) {
  const s = String(value == null ? '' : value);
  if (s.length <= 10) return '••••';
  return s.slice(0, 6) + '••••' + s.slice(-4);
}

/**
 * Applique le masquage aux clés sensibles d'un objet { key: value }.
 * Retourne un nouvel objet (l'original n'est pas modifié).
 */
export function maskSettings(settings) {
  const src = settings || {};
  const out = {};
  for (const k of Object.keys(src)) {
    out[k] = SENSITIVE_SETTING_KEYS.includes(k) ? maskSecret(src[k]) : src[k];
  }
  return out;
}
