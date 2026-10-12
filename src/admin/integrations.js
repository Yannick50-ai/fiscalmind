/**
 * FiscalMind Africa — intégrations externes (Chariow / Supabase / Cloudflare),
 * fonctions pures + orchestration d'appels HTTP (fetch injectable).
 *
 * Miroir côté local des règles appliquées par la Edge Function
 * `admin-integrations` (voir supabase-functions-admin-integrations-index.ts) :
 * formatage des réponses, masquage des emails, messages d'erreur FR,
 * timeouts, dégradation gracieuse par section. La fonction Deno duplique
 * ces règles (elle ne peut pas importer ce fichier) : toute modification
 * ici doit être reportée dans supabase-functions-admin-integrations-index.ts.
 *
 * AUCUNE clé d'API ne transite ici en clair dans les réponses : seules les
 * fonctions de formatage (données publiques du compte) sont exposées.
 */

export { maskSecret } from './sys-settings.js';

/** Services supportés par ?service=... */
export const INTEGRATION_SERVICES = ['chariow', 'supabase', 'cloudflare'];

/** Clé fm_sys_settings lue pour chaque service. */
export const INTEGRATION_KEY_FOR_SERVICE = {
  chariow: 'chariow_api_key',
  supabase: 'supabase_mgmt_token',
  cloudflare: 'cloudflare_api_token',
};

/** Fonctions Edge surveillées dans l'onglet Supabase. */
export const TARGET_SUPABASE_FUNCTIONS = [
  'copilot',
  'chariow-webhook',
  'admin-settings',
  'admin-users',
  'admin-stats',
];

export const SUPABASE_PROJECT_REF = 'eetmaaopaatbbwhwbdcx';
export const CLOUDFLARE_PAGES_PROJECT = 'fiscalmind-africa';
export const FETCH_TIMEOUT_MS = 20000;

/**
 * User-Agent navigateur : le WAF Cloudflare devant api.chariow.com rejette
 * les appels sans UA navigateur (erreur 1010). Même contrainte que le CLI
 * chariow (~/workspace/skills/chariow/).
 */
export const BROWSER_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

/** Le paramètre ?service=... est-il connu ? (normalisé : minuscules, espaces rognés) */
export function isKnownService(service) {
  if (typeof service !== 'string') return false;
  return INTEGRATION_SERVICES.includes(service.trim().toLowerCase());
}

/**
 * Masque un email pour affichage : 1er caractère + ***@domaine.
 * Ex. : 'jean.dupont@gmail.com' → 'j***@gmail.com'.
 */
export function maskEmail(email) {
  const e = String(email == null ? '' : email).trim();
  const at = e.indexOf('@');
  if (at <= 0 || at >= e.length - 1) return '••••';
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  return (local.length <= 1 ? local : local[0]) + '***@' + domain;
}

/** Normalise un payload API en tableau : accepte [], { data: [] }, { items: [] }, { result: [] }. */
export function toArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    for (const k of ['data', 'items', 'result']) {
      if (Array.isArray(payload[k])) return payload[k];
    }
  }
  return [];
}

/** Erreur HTTP d'une API externe (statut connu, message FR déjà formulé). */
export class ExternalApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ExternalApiError';
    this.status = status;
  }
}

/** Message FR clair selon le statut HTTP d'une API externe. */
export function httpErrorMessage(status, serviceLabel) {
  const s = Number(status);
  if (s === 401)
    return `${serviceLabel} : clé rejetée (non autorisée). Vérifiez-la dans l'onglet ⚙️ Paramètres.`;
  if (s === 403) return `${serviceLabel} : accès refusé (droits insuffisants).`;
  if (s === 404) return `${serviceLabel} : ressource introuvable.`;
  if (s === 429) return `${serviceLabel} : trop de requêtes, réessayez dans quelques minutes.`;
  if (s >= 500) return `${serviceLabel} : erreur interne du service (HTTP ${s}).`;
  return `${serviceLabel} : le service a répondu avec une erreur (HTTP ${s}).`;
}

/** Message FR clair pour une erreur réseau / timeout. */
export function networkErrorMessage(err) {
  const name = err && err.name;
  if (name === 'TimeoutError' || name === 'AbortError')
    return 'Le service ne répond pas (délai de 20 s dépassé).';
  return 'Le service est injoignable (erreur réseau).';
}

/**
 * GET JSON sur une API externe avec timeout 20 s.
 * - réseau/timeout → Error(message FR)
 * - HTTP !ok → ExternalApiError(statut, message FR)
 * - JSON illisible → Error(message FR)
 * fetchImpl : (url, init) => Promise<{ ok, status, json() }> (injectable pour les tests).
 */
export async function apiGet(fetchImpl, url, headers, serviceLabel) {
  let resp;
  try {
    resp = await fetchImpl(url, {
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    throw new Error(networkErrorMessage(err));
  }
  if (!resp.ok) throw new ExternalApiError(resp.status, httpErrorMessage(resp.status, serviceLabel));
  try {
    return await resp.json();
  } catch {
    throw new Error(`${serviceLabel} : réponse illisible (JSON invalide).`);
  }
}

/** Exécute une section en dégradation gracieuse : en cas d'échec, note l'erreur FR et renvoie null. */
export async function safeSection(erreurs, key, fn) {
  try {
    return await fn();
  } catch (err) {
    erreurs[key] = err && err.message ? err.message : 'Erreur inconnue.';
    return null;
  }
}

// ---------------------------------------------------------------------------
// Chariow — GET https://api.chariow.com/v1/... (Authorization: Bearer)
// ---------------------------------------------------------------------------

/** En-têtes pour l'API Chariow (Bearer + UA navigateur requis par le WAF). */
export function chariowHeaders(apiKey) {
  return {
    Authorization: 'Bearer ' + apiKey,
    Accept: 'application/json',
    'User-Agent': BROWSER_UA,
  };
}

/**
 * Formate une vente Chariow → { id, date, produit, montant, email_masque, statut }.
 * Tolère les variantes de champs (objet imbriqué sale/product/customer ou plat).
 */
export function formatChariowSale(raw, productsById = {}) {
  const d = raw || {};
  const product = d.product || {};
  const customer = d.customer || {};
  const id = d.id ?? d.sale_id ?? null;
  const date = d.created_at || d.createdAt || d.date || null;
  const productId = d.product_id || d.productId || product.id || null;
  const produit =
    product.name ||
    d.product_name ||
    d.productName ||
    (productId && productsById[productId]) ||
    productId ||
    '—';
  const montant = d.amount ?? d.total ?? d.total_amount ?? d.price ?? 0;
  const email = customer.email || d.email || d.customer_email || null;
  const statut = d.status || d.state || d.payment_status || '—';
  return {
    id,
    date,
    produit,
    montant: Number(montant) || 0,
    email_masque: email ? maskEmail(email) : '—',
    statut,
  };
}

/** Formate un produit Chariow → { id, nom, prix }. */
export function formatChariowProduct(raw) {
  const d = raw || {};
  const price = d.price ?? d.amount ?? d.total ?? null;
  return {
    id: d.id ?? null,
    nom: d.name || d.title || '—',
    prix: Number(price) || 0,
  };
}

/**
 * Formate un pulse (webhook) Chariow → { actif, id, url, evenements_configures, derniers_evenements }.
 * L'API Chariow n'expose pas l'historique des envois : derniers_evenements
 * reste vide (documenté), les événements souscrits sont dans evenements_configures.
 */
export function formatChariowPulse(raw) {
  const d = raw || {};
  const events = d.events || d.subscribed_events || [];
  const actif =
    d.active !== false && d.status !== 'disabled' && d.enabled !== false && events.length > 0;
  return {
    actif: !!actif,
    id: d.id ?? null,
    url: d.url || d.webhook_url || null,
    evenements_configures: Array.isArray(events) ? events.map(String) : [],
    derniers_evenements: [],
  };
}

/** Choisit le pulse principal : celui qui pointe vers Supabase/webhook, sinon le premier. */
export function pickMainPulse(pulses) {
  const list = toArray(pulses);
  if (list.length === 0) return null;
  return (
    list.find((p) => {
      const url = String((p && (p.url || p.webhook_url)) || '').toLowerCase();
      return url.includes('supabase') || url.includes('webhook');
    }) || list[0]
  );
}

/**
 * Statut Chariow complet avec dégradation par section :
 * { sales: [...20 dernières] | null, products: [...] | null, pulse: {...} | null,
 *   erreurs: { sales?, products?, pulse? } }.
 * sales/produits/pulse à null + message FR dans `erreurs` si l'endpoint échoue.
 */
export async function fetchChariowStatus(fetchImpl, apiKey) {
  const headers = chariowHeaders(apiKey);
  const erreurs = {};
  const base = 'https://api.chariow.com/v1';

  const salesRaw = await safeSection(erreurs, 'sales', () =>
    apiGet(fetchImpl, `${base}/sales?per_page=20`, headers, 'Chariow')
  );
  const productsRaw = await safeSection(erreurs, 'products', () =>
    apiGet(fetchImpl, `${base}/products?per_page=20`, headers, 'Chariow')
  );
  const pulsesRaw = await safeSection(erreurs, 'pulse', () =>
    apiGet(fetchImpl, `${base}/pulses`, headers, 'Chariow')
  );

  const products = erreurs.products
    ? null
    : toArray(productsRaw).map(formatChariowProduct);
  const productsById = {};
  if (products) for (const p of products) if (p.id != null) productsById[p.id] = p.nom;

  const sales = erreurs.sales
    ? null
    : toArray(salesRaw)
        .slice(0, 20)
        .map((s) => formatChariowSale(s, productsById));

  const pulseRaw = erreurs.pulse ? null : pickMainPulse(pulsesRaw);
  const pulse = pulseRaw ? formatChariowPulse(pulseRaw) : null;

  return { sales, products, pulse, erreurs };
}

// ---------------------------------------------------------------------------
// Supabase Management API — https://api.supabase.com/v1 (Bearer token)
// ---------------------------------------------------------------------------

/** En-têtes pour la Management API Supabase. */
export function supabaseMgmtHeaders(token) {
  return { Authorization: 'Bearer ' + token, Accept: 'application/json' };
}

/**
 * Requête ClickHouse (table unifiée `logs`) : invocations et erreurs par
 * fonction sur les dernières 24 h. Endpoint GET-only, fenêtre ≤ 24 h,
 * timestamps ISO avec suffixe Z (contrainte API constatée le 09/10/2026).
 */
export function supabaseFunctionStatsUrl() {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 3600 * 1000);
  const sql =
    "SELECT extract(log_attributes['request.path'], '.*/functions/v1/([^/?]+)') AS fn, " +
    'count(*) AS invocations, ' +
    "countIf(toUInt32OrNull(log_attributes['response.status_code']) >= 400) AS erreurs " +
    'FROM logs ' +
    "WHERE source = 'function_edge_logs' " +
    'GROUP BY fn';
  return (
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/analytics/endpoints/logs` +
    `?sql=${encodeURIComponent(sql)}` +
    `&iso_timestamp_start=${encodeURIComponent(start.toISOString())}` +
    `&iso_timestamp_end=${encodeURIComponent(end.toISOString())}`
  );
}

/** Parse les lignes de la requête analytics → { [slug]: { invocations, tauxErreur } }. */
export function parseSupabaseFunctionStats(body) {
  const out = {};
  for (const row of toArray(body && (body.result ?? body))) {
    const fn = row && row.fn;
    if (!fn) continue;
    const inv = Number(row.invocations) || 0;
    const err = Number(row.erreurs) || 0;
    out[fn] = {
      invocations: inv,
      tauxErreur: inv > 0 ? Math.round((err / inv) * 1000) / 10 : null,
    };
  }
  return out;
}

/**
 * Statut Supabase : { functions: [{ nom, deployee, invocations_24h, taux_erreur }], note? }.
 * - La liste des fonctions déployées (GET /v1/projects/{ref}/functions) est
 *   bloquante : en échec → lève (le handler répond { error }).
 * - Les stats d'invocation (analytics/logs) sont dégradées : en échec →
 *   invocations_24h/taux_erreur à null + note explicative.
 */
export async function fetchSupabaseStatus(fetchImpl, token) {
  const headers = supabaseMgmtHeaders(token);
  const fnsRaw = await apiGet(
    fetchImpl,
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/functions`,
    headers,
    'Supabase'
  );
  const deployed = new Set(
    toArray(fnsRaw)
      .map((f) => (f && (f.slug || f.name)) || null)
      .filter(Boolean)
  );

  let stats = {};
  let note = null;
  try {
    stats = parseSupabaseFunctionStats(await apiGet(fetchImpl, supabaseFunctionStatsUrl(), headers, 'Supabase'));
  } catch (err) {
    note =
      "Statistiques d'invocation indisponibles : " +
      (err && err.message ? err.message : 'erreur inconnue');
  }

  const functions = TARGET_SUPABASE_FUNCTIONS.map((nom) => {
    const s = stats[nom];
    return {
      nom,
      deployee: deployed.has(nom),
      invocations_24h: s ? s.invocations : null,
      taux_erreur: s ? s.tauxErreur : null,
    };
  });
  const out = { functions };
  if (note) out.note = note;
  return out;
}

// ---------------------------------------------------------------------------
// Cloudflare — https://api.cloudflare.com/client/v4 (Authorization: Bearer)
// ---------------------------------------------------------------------------

/** Formate un déploiement Pages → { date, statut, url }. */
export function formatCloudflareDeployment(raw) {
  const d = raw || {};
  const stage = d.latest_stage || {};
  const status = stage.status || d.status || '—';
  let statut;
  if (status === 'success') statut = 'réussi';
  else if (status === 'failure' || status === 'failed') statut = 'échec';
  else if (status === 'active' || status === 'idle' || status === 'queued' || status === 'initializing')
    statut = 'en cours';
  else statut = String(status);
  return {
    date: d.created_on || d.created_at || null,
    statut,
    url: d.url || null,
  };
}

/**
 * Statut Cloudflare : { deployments: [5 derniers { date, statut, url }] }.
 * En échec (réseau, 401, success:false) → lève (le handler répond { error }).
 */
export async function fetchCloudflareStatus(fetchImpl, token, accountId) {
  const headers = { Authorization: 'Bearer ' + token, Accept: 'application/json' };
  const url =
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/` +
    `${CLOUDFLARE_PAGES_PROJECT}/deployments?per_page=5`;
  const body = await apiGet(fetchImpl, url, headers, 'Cloudflare');
  if (body && body.success === false) {
    const first = Array.isArray(body.errors) && body.errors[0];
    const msg = first ? first.message || (first.code != null ? 'code ' + first.code : null) : null;
    throw new Error('Cloudflare : ' + (msg || 'requête rejetée.'));
  }
  return { deployments: toArray(body && body.result).map(formatCloudflareDeployment) };
}
