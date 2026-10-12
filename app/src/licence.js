// FiscalMind Africa — état de licence / quota du copilote.
//
// Port de `fmSetPlan()` de l'appli d'origine : après connexion, l'appli
// interroge la Edge Function `copilot` ({ action: 'quota' }) qui renvoie
// { plan, remaining, ... }. plan === 'admin' => droits d'administration
// (is_admin est lu depuis app_metadata côté serveur, jamais modifiable
// par le client — correctif de sécurité du 7 oct. 2026).

import { supabaseService, getAccessToken, getSession } from './auth.js';

let _quota = null; // { plan, remaining, info } ou null
let _refreshing = null;

/** Interroge le quota et met en cache. Retourne { plan, remaining, info } ou null. */
export function refreshQuota() {
  if (_refreshing) return _refreshing;
  _refreshing = (async () => {
    try {
      const session = getSession();
      if (!session) { _quota = null; return null; }
      const svc = supabaseService();
      if (!svc) { _quota = null; return null; }
      const token = await getAccessToken();
      if (!token) { _quota = null; return null; }
      const q = await svc.getQuota({ accessToken: token });
      _quota = { plan: q.plan || 'demo', remaining: q.remaining, info: q };
    } catch (e) {
      _quota = null;
    } finally {
      _refreshing = null;
    }
    updateNavVisibility();
    return _quota;
  })();
  return _refreshing;
}

/** Dernière info de quota connue (ou null). */
export function getQuotaInfo() { return _quota; }

/** L'utilisateur courant est-il admin ? (plan 'admin' renvoyé par le serveur) */
export function isAdmin() { return !!_quota && _quota.plan === 'admin'; }

/** Texte du badge de quota pour l'en-tête du copilote. */
export function quotaBadgeText() {
  if (!_quota) return '';
  if (_quota.plan === 'admin') return '∞ illimité';
  if (_quota.remaining !== undefined && _quota.remaining !== null) {
    return _quota.plan.toUpperCase() + ' · ' + _quota.remaining + ' restantes';
  }
  return _quota.plan.toUpperCase();
}

/** Affiche/masque les boutons Admin (nav basse + tiroir) selon les droits. */
export function updateNavVisibility() {
  const show = isAdmin() ? '' : 'none';
  document.querySelectorAll('[data-route="admin"]').forEach((btn) => {
    btn.style.display = show;
  });
}

/** Oublie le quota en cache (à la déconnexion). */
export function clearQuota() {
  _quota = null;
  updateNavVisibility();
}
