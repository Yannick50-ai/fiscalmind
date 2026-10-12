// Supabase Edge Function — Intégrations externes (admin uniquement)
// PATCH 09/10/2026 : volet 2 — lecture seule des statuts Chariow, Supabase
// (Management API) et Cloudflare (Pages) pour l'onglet admin.
// Modèle copié sur la fonction `admin-settings` (mêmes en-têtes CORS,
// même vérification JWT, droits lus depuis app_metadata.is_admin).
// Fichier : supabase/functions/admin-integrations/index.ts
// Secrets requis : SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// (fournis par Supabase) ; les clés d'API externes sont lues depuis
// fm_sys_settings (gérées par `admin-settings`) : chariow_api_key,
// supabase_mgmt_token, cloudflare_api_token (+ cloudflare_account_id).
//
// Endpoints (GET uniquement) :
//   ?service=chariow    → 20 dernières ventes, produits, pulse
//   ?service=supabase   → fonctions Edge déployées + invocations 24 h
//   ?service=cloudflare → 5 derniers déploiements du projet Pages
//
// La logique métier (formatage, masquage, erreurs FR) est le miroir de
// src/admin/integrations.js — toute modification doit être reportée des
// deux côtés.
//
// SÉCURITÉ :
// - GET réservé aux admins (user.app_metadata.is_admin === true,
//   jamais user_metadata). 401/403 sinon.
// - Les clés d'API ne sont JAMAIS exposées dans les réponses ni journalisées.
//   Les emails clients sont masqués (j***@gmail.com).
// - Timeout 20 s sur tous les appels externes (AbortSignal.timeout).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS — copié de la fonction admin-settings (obligatoire pour les fetch navigateur).
// CORS restreint : seules les origines fiscalmind-africa.pages.dev (prod + previews)
// sont acceptees. Remplace l'ancien "*" qui autorisait n'importe quel site a appeler
// la fonction (l'auth JWT reste la vraie protection).
const ALLOWED_ORIGIN_RE = /^https:\/\/([a-z0-9-]+\.)?fiscalmind-africa\.pages\.dev$/;
function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN_RE.test(origin) ? origin : "https://fiscalmind-africa.pages.dev",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

const INTEGRATION_SERVICES = ["chariow", "supabase", "cloudflare", "ocr", "xkiro", "quotas"];
const TARGET_SUPABASE_FUNCTIONS = [
  "copilot",
  "chariow-webhook",
  "admin-settings",
  "admin-users",
  "admin-stats",
];
const SUPABASE_PROJECT_REF = "eetmaaopaatbbwhwbdcx";
const CLOUDFLARE_PAGES_PROJECT = "fiscalmind-africa";
const FETCH_TIMEOUT_MS = 20000;
// User-Agent navigateur : le WAF Cloudflare devant api.chariow.com rejette
// les appels sans UA navigateur (erreur 1010).
const BROWSER_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

function json(req: Request, obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(req) },
  });
}

/** Masque un email : 1er caractère + ***@domaine (miroir de src/admin/integrations.js). */
function maskEmail(email: unknown): string {
  const e = String(email == null ? "" : email).trim();
  const at = e.indexOf("@");
  if (at <= 0 || at >= e.length - 1) return "••••";
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  return (local.length <= 1 ? local : local[0]) + "***@" + domain;
}

/** Normalise un payload API en tableau : [], { data: [] }, { items: [] }, { result: [] }. */
function toArray(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const k of ["data", "items", "result"]) {
      if (Array.isArray(payload[k])) return payload[k];
    }
  }
  return [];
}

/** Erreur HTTP d'une API externe (statut connu, message FR déjà formulé). */
class ExternalApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ExternalApiError";
    this.status = status;
  }
}

/** Message FR clair selon le statut HTTP d'une API externe. */
function httpErrorMessage(status: unknown, serviceLabel: string): string {
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
function networkErrorMessage(err: any): string {
  const name = err && err.name;
  if (name === "TimeoutError" || name === "AbortError")
    return "Le service ne répond pas (délai de 20 s dépassé).";
  return "Le service est injoignable (erreur réseau).";
}

/**
 * GET JSON sur une API externe avec timeout 20 s.
 * - réseau/timeout → Error(message FR) ; HTTP !ok → ExternalApiError ;
 * - JSON illisible → Error(message FR).
 */
async function apiGet(
  fetchImpl: typeof fetch,
  url: string,
  headers: Record<string, string>,
  serviceLabel: string
): Promise<any> {
  let resp: Response;
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

/** Exécute une section en dégradation gracieuse : échec → note l'erreur FR, renvoie null. */
async function safeSection(
  erreurs: Record<string, string>,
  key: string,
  fn: () => Promise<any>
): Promise<any> {
  try {
    return await fn();
  } catch (err: any) {
    erreurs[key] = err && err.message ? err.message : "Erreur inconnue.";
    return null;
  }
}

/** Lit un secret depuis fm_sys_settings via le client service_role (jamais exposé). */
async function getSecret(admin: any, key: string): Promise<string> {
  const { data } = await admin.from("fm_sys_settings").select("value").eq("key", key).maybeSingle();
  return data && typeof data.value === "string" ? data.value.trim() : "";
}

// --- Chariow ---------------------------------------------------------------

function chariowHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: "Bearer " + apiKey,
    Accept: "application/json",
    "User-Agent": BROWSER_UA,
  };
}

function formatChariowSale(raw: any, productsById: Record<string, string> = {}): Record<string, any> {
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
    "—";
  const montant = d.amount ?? d.total ?? d.total_amount ?? d.price ?? 0;
  const email = customer.email || d.email || d.customer_email || null;
  const statut = d.status || d.state || d.payment_status || "—";
  return {
    id,
    date,
    produit,
    montant: Number(montant) || 0,
    email_masque: email ? maskEmail(email) : "—",
    statut,
  };
}

function formatChariowProduct(raw: any): Record<string, any> {
  const d = raw || {};
  const price = d.price ?? d.amount ?? d.total ?? null;
  return { id: d.id ?? null, nom: d.name || d.title || "—", prix: Number(price) || 0 };
}

function formatChariowPulse(raw: any): Record<string, any> {
  const d = raw || {};
  const events = d.events || d.subscribed_events || [];
  const actif =
    d.active !== false && d.status !== "disabled" && d.enabled !== false && events.length > 0;
  return {
    actif: !!actif,
    id: d.id ?? null,
    url: d.url || d.webhook_url || null,
    evenements_configures: Array.isArray(events) ? events.map(String) : [],
    // L'API Chariow n'expose pas l'historique des envois.
    derniers_evenements: [],
  };
}

function pickMainPulse(pulses: any): any {
  const list = toArray(pulses);
  if (list.length === 0) return null;
  return (
    list.find((p) => {
      const url = String((p && (p.url || p.webhook_url)) || "").toLowerCase();
      return url.includes("supabase") || url.includes("webhook");
    }) || list[0]
  );
}

async function fetchChariowStatus(fetchImpl: typeof fetch, apiKey: string): Promise<Record<string, any>> {
  const headers = chariowHeaders(apiKey);
  const erreurs: Record<string, string> = {};
  const base = "https://api.chariow.com/v1";

  const salesRaw = await safeSection(erreurs, "sales", () =>
    apiGet(fetchImpl, `${base}/sales?per_page=20`, headers, "Chariow")
  );
  const productsRaw = await safeSection(erreurs, "products", () =>
    apiGet(fetchImpl, `${base}/products?per_page=20`, headers, "Chariow")
  );
  const pulsesRaw = await safeSection(erreurs, "pulse", () =>
    apiGet(fetchImpl, `${base}/pulses`, headers, "Chariow")
  );

  const products = erreurs.products ? null : toArray(productsRaw).map(formatChariowProduct);
  const productsById: Record<string, string> = {};
  if (products) for (const p of products) if (p.id != null) productsById[p.id] = p.nom;

  const sales = erreurs.sales
    ? null
    : toArray(salesRaw).slice(0, 20).map((s) => formatChariowSale(s, productsById));

  const pulseRaw = erreurs.pulse ? null : pickMainPulse(pulsesRaw);
  const pulse = pulseRaw ? formatChariowPulse(pulseRaw) : null;

  return { sales, products, pulse, erreurs };
}

// --- Supabase Management API -----------------------------------------------

function supabaseMgmtHeaders(token: string): Record<string, string> {
  return { Authorization: "Bearer " + token, Accept: "application/json" };
}

function supabaseFunctionStatsUrl(): string {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 3600 * 1000);
  const sql =
    "SELECT extract(log_attributes['request.path'], '.*/functions/v1/([^/?]+)') AS fn, " +
    "count(*) AS invocations, " +
    "countIf(toUInt32OrNull(log_attributes['response.status_code']) >= 400) AS erreurs " +
    "FROM logs " +
    "WHERE source = 'function_edge_logs' " +
    "GROUP BY fn";
  return (
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/analytics/endpoints/logs` +
    `?sql=${encodeURIComponent(sql)}` +
    `&iso_timestamp_start=${encodeURIComponent(start.toISOString())}` +
    `&iso_timestamp_end=${encodeURIComponent(end.toISOString())}`
  );
}

function parseSupabaseFunctionStats(body: any): Record<string, { invocations: number; tauxErreur: number | null }> {
  const out: Record<string, { invocations: number; tauxErreur: number | null }> = {};
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

async function fetchSupabaseStatus(fetchImpl: typeof fetch, token: string): Promise<Record<string, any>> {
  const headers = supabaseMgmtHeaders(token);
  const fnsRaw = await apiGet(
    fetchImpl,
    `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/functions`,
    headers,
    "Supabase"
  );
  const deployed = new Set(
    toArray(fnsRaw).map((f) => (f && (f.slug || f.name)) || null).filter(Boolean)
  );

  // Stats d'invocation : dégradation gracieuse (la Management API des offres
  // gratuites limite la rétention des logs ; l'endpoint analytics peut refuser).
  let stats: Record<string, { invocations: number; tauxErreur: number | null }> = {};
  let note: string | null = null;
  try {
    stats = parseSupabaseFunctionStats(await apiGet(fetchImpl, supabaseFunctionStatsUrl(), headers, "Supabase"));
  } catch (err: any) {
    note =
      "Statistiques d'invocation indisponibles : " +
      (err && err.message ? err.message : "erreur inconnue");
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
  const out: Record<string, any> = { functions };
  if (note) out.note = note;
  return out;
}

// --- Cloudflare --------------------------------------------------------------

function formatCloudflareDeployment(raw: any): Record<string, any> {
  const d = raw || {};
  const stage = d.latest_stage || {};
  const status = stage.status || d.status || "—";
  let statut: string;
  if (status === "success") statut = "réussi";
  else if (status === "failure" || status === "failed") statut = "échec";
  else if (status === "active" || status === "idle" || status === "queued" || status === "initializing")
    statut = "en cours";
  else statut = String(status);
  return { date: d.created_on || d.created_at || null, statut, url: d.url || null };
}

async function fetchCloudflareStatus(
  fetchImpl: typeof fetch,
  token: string,
  accountId: string
): Promise<Record<string, any>> {
  const headers = { Authorization: "Bearer " + token, Accept: "application/json" };
  const url =
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/` +
    `${CLOUDFLARE_PAGES_PROJECT}/deployments?per_page=5`;
  const body = await apiGet(fetchImpl, url, headers, "Cloudflare");
  if (body && body.success === false) {
    // Ne pas relayer le message brut de l'API (fuite d'infos potentielle) :
    // journaliser côté serveur, renvoyer un message générique au client.
    const first = Array.isArray(body.errors) && body.errors[0];
    console.error("[admin-integrations] Cloudflare API:", first ? (first.code ?? first.message) : "unknown");
    throw new Error("Cloudflare : requête rejetée. Vérifiez le token et l'Account ID.");
  }
  return { deployments: toArray(body && body.result).map(formatCloudflareDeployment) };
}

// --- Handler -----------------------------------------------------------------

Deno.serve(async (req) => {
  // Preflight CORS du navigateur : répondre 204 avec les en-têtes CORS.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!jwt) return json(req, { error: "Non authentifié" }, 401);

  // 1. Vérifier l'utilisateur via son JWT Supabase
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return json(req, { error: "Session invalide" }, 401);

  // 2. Droits admin — SÉCURITÉ : lus EXCLUSIVEMENT depuis app_metadata
  // (écriture serveur uniquement), jamais depuis user_metadata.
  const isAdmin = ((user.app_metadata || {}) as Record<string, any>).is_admin === true;
  if (!isAdmin) return json(req, { error: "Accès réservé aux administrateurs." }, 403);

  // 3. GET uniquement.
  if (req.method !== "GET") return json(req, { error: "GET uniquement" }, 405);
  const service = new URL(req.url).searchParams.get("service");
    if (!service || !INTEGRATION_SERVICES.includes(service)) {
    return json(req, { error: "Service inconnu (chariow|supabase|cloudflare|ocr|xkiro|quotas)." }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    if (service === "chariow") {
      const apiKey = await getSecret(admin, "chariow_api_key");
      if (!apiKey) {
        return json(req, { error: "Clé Chariow non configurée. Ajoutez-la dans l'onglet ⚙️ Paramètres." });
      }
      return json(await fetchChariowStatus(fetch, apiKey));
    }
    if (service === "supabase") {
      // v3 : stats 100 % base de données via service_role (plus de Management API,
      // plus de token nécessaire). Retourne taille BDD, lignes par table, fonctions.
      const TABLES = ["fm_entries", "fm_journals", "fm_chat", "fm_settings", "fm_audit", "fm_immos", "fm_assurances", "fm_sys_settings"];
      const tables: Array<{ nom: string; lignes: number | null }> = [];
      for (const t of TABLES) {
        try {
          const { count } = await admin.from(t).select("*", { count: "exact", head: true });
          tables.push({ nom: t, lignes: count });
        } catch {
          tables.push({ nom: t, lignes: null });
        }
      }
      let taille_bdd: string | null = null;
      try {
        const { data } = await admin.rpc("taille_bdd");
        taille_bdd = data as string;
      } catch { /* ignore */ }
      const functions = ["copilot", "chariow-webhook", "admin-settings", "admin-integrations", "admin-users", "admin-stats"]
        .map((nom) => ({ nom, statut: "🟢 En ligne" }));
      return json(req, { tables, taille_bdd, quota_bdd: "500 MB", functions });
    }
    if (false) { // ANCIEN BLOC SUPABASE (Management API) - DESACTIVE
      const token = await getSecret(admin, "supabase_mgmt_token");
      if (!token) {
        return json(req, { error: "Token Supabase non configuré. Ajoutez-le dans l'onglet ⚙️ Paramètres." });
      }
      return json(req, await fetchSupabaseStatus(fetch, token));
    }
    if (service === "ocr") {
      return json(req, await fetchOcrStatus(admin));
    }
    if (service === "xkiro") {
      return json(req, await fetchXkiroStatus(admin));
    }
    if (service === "quotas") {
      return json(req, await fetchUsersQuotas(admin));
    }
    // service === "cloudflare"
    const token = await getSecret(admin, "cloudflare_api_token");
    if (!token) {
      return json(req, { error: "Token Cloudflare non configuré. Ajoutez-le dans l'onglet ⚙️ Paramètres." });
    }
    const accountId = await getSecret(admin, "cloudflare_account_id");
    if (!accountId) {
      return json(req, { error: "Identifiant du compte Cloudflare non configuré. Ajoutez-le dans l'onglet ⚙️ Paramètres." });
    }
    return json(await fetchCloudflareStatus(fetch, token, accountId));
  } catch (err: any) {
    return json(req, { error: err && err.message ? err.message : "Erreur inattendue." }, 500);
  }
});

// Service OCR : vérifie que la clé est configurée et retourne le statut.
async function fetchOcrStatus(admin: any) {
  const key = await getSecret(admin, "ocr_api_key") || Deno.env.get("OCR_SPACE_KEY") || "";
  if (!key) {
    return { error: "Clé OCR non configurée. Ajoutez-la dans l'onglet ⚙️ Paramètres." };
  }
  // Compte les lectures OCR du jour et du mois (via fm_rate_limits).
  let lectures_jour = 0, lectures_mois = 0;
  try {
    const { data } = await admin.from("fm_rate_limits")
      .select("hits, window_start")
      .eq("endpoint", "ocr")
      .gte("window_start", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString());
    if (data) {
      const jour_limite = Date.now() - 24 * 3600 * 1000;
      for (const r of data) {
        const h = r.hits || 0;
        lectures_mois += h;
        if (new Date(r.window_start).getTime() >= jour_limite) lectures_jour += h;
      }
    }
  } catch { /* ignore */ }
  return {
    statut: "🟢 Configuré",
    cle_masquee: key.length > 10 ? key.slice(0, 6) + "••••" + key.slice(-4) : "••••",
    lectures_24h: lectures_jour,
    quota_mensuel: lectures_mois + " / 25 000",
    limite: "20 / minute",
  };
}

// Service xKiro (IA) : lit le quota réel via GET /v1/usage.
async function fetchXkiroStatus(admin: any) {
  const apiKey = await getSecret(admin, "ai_api_key") || Deno.env.get("ANTHROPIC_API_KEY") || "";
  if (!apiKey) {
    return { error: "Clé IA non configurée. Ajoutez-la dans l'onglet ⚙️ Paramètres." };
  }
  try {
    const resp = await fetch("https://api.xkiro.com/v1/usage", {
      headers: { "Authorization": "Bearer " + apiKey },
    });
    if (!resp.ok) {
      return { error: "xKiro injoignable (erreur " + resp.status + ")." };
    }
    const d = await resp.json();
    const ft = d.free_tokens || {};
    const wallet = d.wallet || {};
    return {
      statut: "🟢 Connecté",
      plan: d.plan || "Gratuit",
      tokens_jour: (ft.used ?? "—") + " / " + (ft.limit ?? "—"),
      solde_wallet: wallet.balance != null ? wallet.balance + " USD" : "—",
    };
  } catch {
    return { error: "xKiro injoignable." };
  }
}

// Quotas par utilisateur : OCR + IA sur les 30 derniers jours.
async function fetchUsersQuotas(admin: any) {
  const depuis = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  // 1. Liste des utilisateurs (emails).
  let users: Array<{ id: string; email: string }> = [];
  try {
    const { data } = await admin.auth.admin.listUsers();
    users = (data?.users || []).map((u: any) => ({ id: u.id, email: u.email || "—" }));
  } catch { /* ignore */ }
  // 2. Lectures OCR par utilisateur.
  const ocrParUser: Record<string, number> = {};
  try {
    const { data } = await admin.from("fm_rate_limits")
      .select("user_id, hits")
      .eq("endpoint", "ocr")
      .gte("window_start", depuis);
    for (const r of data || []) {
      ocrParUser[r.user_id] = (ocrParUser[r.user_id] || 0) + (r.hits || 0);
    }
  } catch { /* ignore */ }
  // 3. Tokens IA par utilisateur.
  const iaParUser: Record<string, number> = {};
  try {
    const { data } = await admin.from("copilot_usage")
      .select("user_id, input_tokens, output_tokens")
      .gte("created_at", depuis);
    for (const r of data || []) {
      iaParUser[r.user_id] = (iaParUser[r.user_id] || 0) + (r.input_tokens || 0) + (r.output_tokens || 0);
    }
  } catch { /* ignore */ }
  // 4. Fusion.
  const lignes = users.map((u) => ({
    email: u.email,
    ocr_lectures: ocrParUser[u.id] || 0,
    ia_tokens: iaParUser[u.id] || 0,
  })).sort((a, b) => (b.ocr_lectures + b.ia_tokens) - (a.ocr_lectures + a.ia_tokens));
  return { utilisateurs: lignes, total: lignes.length };
}
