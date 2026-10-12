// FiscalMind Africa — gestion de session (coquille applicative).
//
// Par défaut : session en mémoire uniquement (re-connexion à chaque rechargement).
// Option "Se souvenir de moi" (case à cocher sur la page de connexion) :
// la session Supabase est alors persistée en localStorage et restaurée
// automatiquement au démarrage (jamais le mot de passe en clair).
// La landing reste publique ; toutes les pages applicatives exigent une
// session (l'essai gratuit = inscription → plan démo 14 jours, modèle existant).

import { createClient } from '@supabase/supabase-js';
import { createSupabaseService, supabaseConfigFromEnv } from '../../src/services/supabase.js';

let _service = null;
let _serviceTried = false;
/** Session courante { uid, email } ou null — mémoire uniquement. */
let _session = null;

/** Service Supabase réel, ou null si non configuré (jamais d'exception ici). */
export function supabaseService() {
  if (_serviceTried) return _service;
  _serviceTried = true;
  try {
    const env = {
      SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
      SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    };
    const { url, anonKey } = supabaseConfigFromEnv(env);
    // "Se souvenir de moi" : persiste la session Supabase en localStorage.
    // Sinon (défaut) : session en mémoire uniquement, reconnexion à chaque rechargement.
    const persist = getRememberMe();
    _service = createSupabaseService({
      url,
      anonKey,
      createClient: (u, k, opts) =>
        createClient(u, k, {
          ...(opts || {}),
          auth: { ...((opts && opts.auth) || {}), persistSession: persist },
        }),
    });
  } catch (e) {
    _service = null; // non configuré -> les pages applicatives affichent une erreur
  }
  return _service;
}

/** Préférence "Se souvenir de moi" (localStorage, jamais le mot de passe). */
export function getRememberMe() {
  try {
    return localStorage.getItem('fm_remember_me') === '1';
  } catch (e) {
    return false;
  }
}

/** Mémorise la préférence ; force la recréation du client Supabase au prochain appel. */
export function setRememberMe(v) {
  try {
    if (v) localStorage.setItem('fm_remember_me', '1');
    else localStorage.removeItem('fm_remember_me');
  } catch (e) { /* stockage indisponible */ }
  // Recrée le client avec le bon persistSession au prochain supabaseService().
  _service = null;
  _serviceTried = false;
}

export function isSupabaseConfigured() { return supabaseService() !== null; }

/**
 * Jeton d'accès de la session Supabase réelle, ou null.
 * Jamais stocké : relu depuis le client à chaque appel.
 */
export async function getAccessToken() {
  const svc = supabaseService();
  if (!svc) return null;
  try {
    const s = await svc.getSession();
    return (s && s.access_token) || null;
  } catch (e) {
    return null;
  }
}

/** Session courante : { uid, email } ou null (mémoire uniquement). */
export function getSession() {
  return _session;
}

/** Hook de test e2e : injecte une session en mémoire (sans effet réseau).
 *  Exposé uniquement en DEV — jamais en production (import.meta.env.DEV). */
export function _setTestSession(s) { _session = s || null; }
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.__fmSetSession = _setTestSession;
}

/** Connexion réelle via Supabase. Retourne { ok, error }. */
export async function signInReal(email, password, remember = false) {
  // Applique la préférence "Se souvenir de moi" AVANT de créer le client.
  setRememberMe(!!remember);
  const svc = supabaseService();
  if (!svc) return { ok: false, error: 'Connexion serveur non configurée.' };
  const { data, error } = await svc.signIn({ email, password });
  if (error || !data || !data.user) {
    return { ok: false, error: friendlyAuthError(error) };
  }
  _session = { uid: data.user.id, email: data.user.email };
  return { ok: true, session: _session };
}

/**
 * Tente de restaurer une session persistée ("Se souvenir de moi" coché
 * lors d'une visite précédente). À appeler au démarrage de l'appli.
 * Retourne la session restaurée ou null.
 */
export async function restorePersistedSession() {
  if (_session) return _session;
  if (!getRememberMe()) return null;
  const svc = supabaseService();
  if (!svc) return null;
  try {
    const s = await svc.getSession();
    if (s && s.user) {
      _session = { uid: s.user.id, email: s.user.email };
      return _session;
    }
  } catch (e) { /* session invalide ou expirée */ }
  return null;
}

/** Inscription réelle via Supabase. Retourne { ok, error, needsConfirmation }. */
export async function signUpReal(email, password, name) {
  const svc = supabaseService();
  if (!svc) return { ok: false, error: 'Connexion serveur non configurée.' };
  const { data, error } = await svc.signUp({ email, password, name });
  if (error) return { ok: false, error: friendlyAuthError(error) };
  if (data && data.user && data.session) {
    _session = { uid: data.user.id, email: data.user.email };
    return { ok: true, session: _session };
  }
  // Inscription OK mais confirmation email requise
  // Note : si l'email existe déjà, Supabase envoie un email de récupération au lieu d'une confirmation
  return { ok: true, needsConfirmation: true };
}

/** Déconnexion (mémoire + Supabase si configuré). */
export async function signOut() {
  const svc = supabaseService();
  if (svc) { try { await svc.signOut(); } catch (e) { /* silencieux */ } }
  _session = null;
}

function friendlyAuthError(error) {
  const m = String((error && error.message) || '');
  if (/invalid login credentials/i.test(m)) return 'Email ou mot de passe incorrect.';
  if (/user already registered|already exists/i.test(m)) return 'Un compte existe déjà avec cet email.';
  if (/email not confirmed/i.test(m)) return 'Confirmez votre email avant de vous connecter.';
  if (/password/i.test(m) && /short|weak|6/i.test(m)) return 'Mot de passe trop court (6 caractères minimum).';
  return m || 'Erreur de connexion.';
}
