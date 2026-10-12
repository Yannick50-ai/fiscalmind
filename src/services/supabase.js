/**
 * Service Supabase — client, auth et appels aux Edge Functions.
 *
 * Comportements portés de fiscalmind-app.html (lecture seule) :
 * - client créé via supabase.createClient(URL, ANON_KEY)  (~l.1973)
 * - auth : signInWithPassword / signUp (+ options.data { name, plan: 'demo' }) / signOut / getSession (~l.2176, 2194, 2261)
 * - appels Edge Functions avec `Authorization: Bearer <access_token>` (~l.2032, 2344, 3009) :
 *     POST /functions/v1/copilot        { question, country, taxOverrides }  (fmLiveAnswer)
 *     POST /functions/v1/copilot        { action: 'quota' }                  (quota au login)
 *     GET  /functions/v1/admin-users     (liste des inscrits)
 *     GET  /functions/v1/admin-stats     (statistiques admin)
 *     POST /functions/v1/r2-storage      { action, ...payload }               (fmR2Call)
 *
 * AUCUN secret en dur : URL et clé ANON via variables d'environnement
 * (SUPABASE_URL / SUPABASE_ANON_KEY). La clé ANON est publique par design
 * mais ne doit jamais être écrite dans le code.
 */

/** Lit la config depuis l'environnement. Lève si incomplète. */
export function supabaseConfigFromEnv(env = {}) {
  const url = env.SUPABASE_URL || env.FM_SUPABASE_URL || '';
  const anonKey = env.SUPABASE_ANON_KEY || env.FM_SUPABASE_ANON || '';
  if (!url || !anonKey) {
    throw new Error('Configuration Supabase manquante : définissez SUPABASE_URL et SUPABASE_ANON_KEY');
  }
  return { url: url.replace(/\/$/, ''), anonKey };
}

/**
 * Fabrique le service Supabase.
 * @param {object} p
 * @param {string} p.url - URL du projet Supabase
 * @param {string} p.anonKey - clé ANON (publique)
 * @param {function} p.createClient - injecté (ex. `createClient` de @supabase/supabase-js) ; jamais bundlé ici
 * @param {function} [p.fetchImpl] - fetch injectable (défaut : globalThis.fetch)
 */
export function createSupabaseService({ url, anonKey, createClient, fetchImpl = globalThis.fetch }) {
  if (!url || !anonKey) throw new Error('createSupabaseService : url et anonKey requis');
  if (typeof createClient !== 'function') {
    throw new Error("createSupabaseService : createClient requis — injectez celui de @supabase/supabase-js");
  }
  if (typeof fetchImpl !== 'function') throw new Error('createSupabaseService : fetchImpl invalide');

  const client = createClient(url, anonKey, { global: { fetch: fetchImpl } });

  /** Appel générique à une Edge Function (Bearer JWT utilisateur). */
  async function edgeFunction({ fn, accessToken, body, method }) {
    if (!fn) throw new Error('edgeFunction : nom de fonction requis');
    if (!accessToken) {
      const e = new Error('Non connecté');
      e.code = 'NOT_AUTHENTICATED';
      throw e;
    }
    const m = method || (body !== undefined ? 'POST' : 'GET');
    const headers = { Authorization: 'Bearer ' + accessToken };
    const init = { method: m, headers };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetchImpl(`${url}/functions/v1/${fn}`, init);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = new Error(json.error || 'Erreur ' + res.status);
      e.status = res.status;
      e.fn = fn;
      throw e;
    }
    return { status: res.status, ...json };
  }

  return {
    /** Client brut (usage avancé). */
    client,

    /** Connexion : { email, password } → { data, error } (supabase-js). */
    async signIn({ email, password }) {
      return client.auth.signInWithPassword({ email, password });
    },

    /** Inscription : crée le compte avec plan 'demo' en user_metadata. */
    async signUp({ email, password, name }) {
      // Redirige la confirmation email vers LE SITE COURANT (staging ou prod),
      // pas vers la Site URL du projet (l'ancienne prod). L'URL doit figurer
      // dans les Redirect URLs autorisées côté Supabase (Auth → URL Configuration).
      // Le paramètre confirmed=1 est AVANT le # pour survivre à la redirection Supabase.
      const options = { data: { name, plan: 'demo' } };
      if (typeof window !== 'undefined' && window.location && window.location.origin) {
        options.emailRedirectTo = window.location.origin + '/?confirmed=1#/connexion';
      }
      return client.auth.signUp({ email, password, options });
    },

    /** Déconnexion. */
    async signOut() {
      return client.auth.signOut();
    },

    /** Session courante ou null. */
    async getSession() {
      const { data } = await client.auth.getSession();
      return (data && data.session) || null;
    },

    /** Utilisateur courant ou null. */
    async getUser() {
      const { data } = await client.auth.getUser();
      return (data && data.user) || null;
    },

    /** Abonnement aux changements d'état d'auth (passthrough). */
    onAuthStateChange(cb) {
      return client.auth.onAuthStateChange(cb);
    },

    edgeFunction,

    /** Question au copilote fiscal. */
    async askCopilot({ accessToken, question, country, taxOverrides }) {
      return edgeFunction({
        fn: 'copilot',
        accessToken,
        body: { question, country, taxOverrides: taxOverrides || {} },
      });
    },

    /** Quota du copilote (plan, restantes, expiration). */
    async getQuota({ accessToken }) {
      return edgeFunction({ fn: 'copilot', accessToken, body: { action: 'quota' } });
    },

    /** Admin : liste des inscrits. */
    async adminListUsers({ accessToken }) {
      return edgeFunction({ fn: 'admin-users', accessToken });
    },

    /** Admin : statistiques globales. */
    async adminStats({ accessToken }) {
      return edgeFunction({ fn: 'admin-stats', accessToken });
    },

    /**
     * Admin : état des intégrations externes (Edge Function 'admin-integrations').
     * GET ?service=chariow|supabase|cloudflare avec le JWT en Authorization.
     */
    async adminIntegrations({ accessToken, service }) {
      if (!service) throw new Error('adminIntegrations : service requis');
      return edgeFunction({
        fn: 'admin-integrations?service=' + encodeURIComponent(service),
        accessToken,
        method: 'GET',
      });
    },

    /**
     * Admin : paramètres système (Edge Function 'admin-settings').
     * - Sans key → GET : renvoie { settings } (clé API déjà masquée).
     * - Avec { key, value } → POST : enregistre le paramètre (whitelist serveur).
     * - Avec { action: 'test_ai' } → POST : teste l'API IA configurée.
     */
    async adminSettings({ accessToken, key, value, action }) {
      if (action === 'test_ai') {
        return edgeFunction({ fn: 'admin-settings', accessToken, body: { action: 'test_ai' } });
      }
      if (key !== undefined) {
        if (!key) throw new Error('adminSettings : clé requise');
        return edgeFunction({ fn: 'admin-settings', accessToken, body: { key, value: value ?? '' } });
      }
      return edgeFunction({ fn: 'admin-settings', accessToken });
    },

    /**
     * Admin : action d'écriture sur admin-users (port fidèle de `licensePost`
     * de l'appli d'origine). Actions : 'set_plan' {user_id, plan, days},
     * 'set_admin' {user_id, is_admin}, 'revoke' {user_id},
     * 'delete_user' {user_id}, 'resolve_unmatched' {row_id}.
     */
    async adminAction({ accessToken, action, ...params }) {
      if (!action) throw new Error('adminAction : action requise');
      return edgeFunction({ fn: 'admin-users', accessToken, body: { action, ...params } });
    },

    /** Appel à la fonction r2-storage : { action, ...payload }. */
    async r2Call({ accessToken, action, payload }) {
      return edgeFunction({ fn: 'r2-storage', accessToken, body: { action, ...(payload || {}) } });
    },
  };
}
