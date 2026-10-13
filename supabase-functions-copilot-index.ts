// Supabase Edge Function — Copilote fiscal IA avec quotas mensuels
// PATCH 08/10/2026 : action 'quota' + bypass admin (is_admin → plan 'admin', quota illimité).
// PATCH 09/10/2026 : paramètres IA lus depuis fm_sys_settings (fonction
//   admin-settings) — ai_provider, ai_api_key, ai_model en PRIORITÉ,
//   fallback sur Deno.env ANTHROPIC_API_KEY ; quotas surchargeables
//   (quota_demo/starter/pro/enterprise). URL et modèle par défaut = xKiro.
// Fichier : supabase/functions/copilot/index.ts
// Secrets requis : SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// (fournis par Supabase) ; clé IA lue en priorité depuis fm_sys_settings,
// fallback sur ANTHROPIC_API_KEY. La clé n'est JAMAIS journalisée.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS — obligatoire pour les appels fetch() depuis le navigateur (sinon le
// preflight OPTIONS échoue et le navigateur bloque quota/copilot/admin).
// PATCH 08/10/2026 16h50 : la fonction redéployée sans ces en-têtes rendait
// l'onglet Admin invisible (refreshQuota() échouait silencieusement).
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

const PLAN_QUOTAS: Record<string, number> = {
  gratuit: 10, // plan gratuit : 10 questions IA/mois
  essentiel: 30,
  pro: 300,
  // Aliases historiques (migration Chariow → SasPay, 11/10/2026)
  demo: 10,
  starter: 30,
  enterprise: 300,
};
const ANTHROPIC_MODEL = "claude-haiku-4-5"; // défaut si ai_provider = 'anthropic'
const XKIRO_MODEL = "qwen/qwen3.8-max:free"; // défaut si ai_provider = 'xkiro' (fournisseur actuel)
const AI_URLS: Record<string, string> = {
  anthropic: "https://api.anthropic.com/v1/messages",
  xkiro: "https://api.xkiro.com/v1/messages",
};

// Prompt système — version de travail, À FAIRE VALIDER par Yannick (voir SYSTEM_PROMPT.md)
const SYSTEM_PROMPT = `Tu es le copilote comptable et fiscal de FiscalMind Africa, destiné aux PME de la zone OHADA.
Règles :
- Référentiel : SYSCOHADA révisé (2018). Fiscalité : le PAYS DE L'UTILISATEUR est précisé en fin de prompt avec ses taux et organismes — applique-les obligatoirement.
- Comptes : utilise les SOUS-COMPTES du plan SYSCOHADA révisé quand tu proposes des écritures (ex. 411001 pour un client nommé, 401001 pour un fournisseur nommé, 521001 pour la banque principale). Ne reste pas aux comptes racines (411, 401) quand le tiers est identifié.
- Réponds en français, ton professionnel, concis, structuré (listes si pertinent). Montants dans la monnaie du pays de l'utilisateur.
- Cite les références (articles du CGI, numéros de comptes) uniquement si tu les connais avec certitude. Ne JAMAIS inventer un numéro d'article : en cas de doute, écris « à vérifier dans le CGI en vigueur » et propose la démarche de vérification.
- Refuse poliment tout conseil de fraude ou d'optimisation agressive ; propose l'alternative conforme.
- Hors sujet comptable/fiscal : redirige poliment vers ton domaine.
- Termine chaque réponse à enjeu par : « À faire valider par votre expert-comptable avant application. »`;

// Données fiscales par pays OHADA (compact) — 08/10/2026
// Sources officielles par pays (référentiel 11/10/2026) — pour citation par le copilote.
const COUNTRY_SOURCES: Record<string, string> = {
  "Burkina Faso": "DGI : https://dgi.bf/ · CNSS : https://cnssbf.org/",
  "Bénin": "DGI : https://impots.bj/ · CNSS : https://cnss.bj/",
  "RD Congo": "DGI : https://dgi.gouv.cd/ · CNSS : https://cnss.cd/",
  "République centrafricaine": "DGI : source en cours de validation · CNSS : https://cnsscentrafrique.org/",
  "République du Congo": "DGI : source en cours de validation · CNSS : https://www.cnss.cg/",
  "Côte d'Ivoire": "DGI : http://dgi.gouv.ci/ · CNPS : https://www.cnps.ci/",
  "Cameroun": "DGI : https://www.impots.cm/fr/dgi · CNPS : https://www.cnps.cm/fr/",
  "Gabon": "DGI : https://dgi.ga/ · CNSS : https://cnss.ga/",
  "Guinée": "DGI : https://dgi.gov.gn/ · CNSS : https://cnss.gov.gn/",
  "Guinée équatoriale": "DGI : source en cours de validation · INSESO : https://www.inseso.org/fr/",
  "Guinée-Bissau": "Administration fiscale : source en cours de validation · INSS : https://www.inss.gw/pt",
  "Comores": "DGI : source en cours de validation · Sécurité sociale : source en cours de validation",
  "Mali": "DGI : https://www.dgi.gouv.ml/ · INPS : source en cours de validation",
  "Niger": "DGI : https://finances.gouv.ne/ · CNSS : https://cnss.ne/",
  "Sénégal": "DGID : source en cours de validation · CNSS/IPRES : source en cours de validation",
  "Tchad": "DGI : https://dgi.td/ · CNPS : source en cours de validation",
  "Togo": "Direction des impôts : source en cours de validation · CNSS : https://cnss.tg/",
};
const COUNTRY_TAX: Record<string, {tva: string; is: string; salary: string; social: string; authority: string; currency: string; caution: string}> = {  "Burkina Faso": { tva: "18 %", is: "27,5 %", salary: "IUTS", social: "CNSS (employeur 16 %, salarié 5,5 %, total 21,5 %)", authority: "DGI (téléprocédures eSINTAX)", currency: "XOF", caution: "" },
  "Bénin": { tva: "18 %", is: "30 %", salary: "ITS (Impôt sur les Traitements et Salaires)", social: "CNSS (Caisse Nationale de Sécurité Sociale du Bénin)", authority: "DGI (Direction Générale des Impôts)", currency: "XOF", caution: "" },
  "RD Congo": { tva: "16 %", is: "30 %", salary: "IPR (Impôt professionnel sur les rémunérations)", social: "CNSS (employeur 13 %, salarié 5 %, total 18 % — hors INPP/ONEM)", authority: "DGI (Direction Générale des Impôts)", currency: "CDF", caution: "" },
  "République centrafricaine": { tva: "19 %", is: "30 %", salary: "IRPP", social: "CNSS", authority: "DGI", currency: "XAF", caution: "" },
  "République du Congo": { tva: "18 %", is: "28 %", salary: "IRPP", social: "CNSS", authority: "DGI", currency: "XAF", caution: "" },
  "Côte d'Ivoire": { tva: "18 %", is: "25 %", salary: "ITS (Impôt sur les Traitements et Salaires)", social: "CNPS (Caisse Nationale de Prévoyance Sociale)", authority: "DGI (Direction Générale des Impôts)", currency: "XOF", caution: "" },
  "Cameroun": { tva: "19,25 %", is: "33 %", salary: "IRPP", social: "CNPS", authority: "DGI", currency: "XAF", caution: "" },
  "Gabon": { tva: "18 %", is: "30 %", salary: "IRPP", social: "CNSS", authority: "DGI", currency: "XAF", caution: "" },
  "Guinée": { tva: "20 %", is: "30 %", salary: "RTS (Retenue sur les Traitements et Salaires) / IRPP", social: "CNSS (employeur 18 %, salarié 5 %, total 23 % — confirmé)", authority: "DNI (Direction Nationale des Impôts)", currency: "GNF", caution: "" },
  "Guinée équatoriale": { tva: "15 %", is: "25 %", salary: "Impuesto sobre Sueldos y Salarios", social: "INSESO (Instituto Nacional de Seguridad Social)", authority: "Direction Générale des Impôts et Contributions (Ministère des Finances)", currency: "XAF", caution: "" },
  "Guinée-Bissau": { tva: "10 %", is: "25 %", salary: "Imposto Profissional", social: "Segurança Social (≈14 % employeur, ≈8 % salarié, provisoire)", authority: "DGCI (Direcção-Geral das Contribuições e Impostos)", currency: "XOF", caution: "Données à confiance basse : signale « à vérifier »." },
  "Comores": { tva: "10 %", is: "35 %", salary: "IRPP", social: "CNSPS + Caisse de retraite des Comores", authority: "DGI (Direction Générale des Impôts)", currency: "KMF", caution: "" },
  "Mali": { tva: "18 %", is: "30 %", salary: "ITS", social: "INPS (employeur 18,9-21,9 % selon risque, salarié 6,66 % — afficher fourchette)", authority: "DGI", currency: "XOF", caution: "" },
  "Niger": { tva: "19 %", is: "30 %", salary: "ITS", social: "CNSS (employeur 16,4 % +0,5 % ANPE séparé, salarié 5,25 %, total 21,65 %)", authority: "DGI", currency: "XOF", caution: "" },
  "Sénégal": { tva: "18 %", is: "30 %", salary: "IR (retenue à la source sur les salaires)", social: "CSS + IPRES", authority: "DGID", currency: "XOF", caution: "" },
  "Tchad": { tva: "18 %", is: "35 %", salary: "IRPP", social: "CNPS", authority: "DGI", currency: "XAF", caution: "" },
  "Togo": { tva: "18 %", is: "27 %", salary: "IRPP (Impôt sur le Revenu des Personnes Physiques) — catégorie revenus d'emplois", social: "CNSS (Caisse Nationale de Sécurité Sociale)", authority: "OTR (Office Togolais des Recettes)", currency: "XOF", caution: "" },
};

function countryContext(country: unknown, taxOverrides?: Record<string, any>, fiscalContext?: Record<string, any>): string {
  const key = typeof country === "string" && COUNTRY_TAX[country] ? country : "Burkina Faso";
  const c = COUNTRY_TAX[key];
  const ov = taxOverrides || {};
  const fc = fiscalContext || {};
  const fmt = (v: any) => String(v).replace(".", ",") + " %";
  const num = (v: any) => v !== undefined && v !== null && !isNaN(Number(v));
  const tva = num(ov.tva) ? fmt(ov.tva) + " (personnalisé par l'utilisateur)" : c.tva;
  const is = num(ov.is) ? fmt(ov.is) + " (personnalisé par l'utilisateur)" : c.is;
  let social = c.social;
  if (num(ov.emp) || num(ov.sal)) {
    const e = num(ov.emp) ? fmt(ov.emp) : "?";
    const sa = num(ov.sal) ? fmt(ov.sal) : "?";
    social = "employeur " + e + ", salarié " + sa + " (personnalisé par l'utilisateur)";
  }
  // Contexte fiscal de l'entreprise (12/10/2026)
  let fiscalNote = "";
  if (fc.tvaSubject === false) {
    fiscalNote = " L'entreprise N'EST PAS assujettie à la TVA : ne jamais conseiller de facturer ou récupérer la TVA.";
  }
  if (fc.bicPrelevement === true) {
    fiscalNote += " L'entreprise applique le prélèvement BIC de 2% sur ses achats.";
  }
  return `\n\nPAYS DE L'UTILISATEUR : ${key} — applique OBLIGATOIREMENT sa fiscalité : TVA ${tva} · IS ${is} · Impôt sur salaires : ${c.salary} · Sécurité sociale : ${social} · Administration fiscale : ${c.authority} · Montants en ${c.currency}.${c.caution ? " " + c.caution : ""}${fiscalNote} Sources officielles du pays : ${COUNTRY_SOURCES[key] || "sources en cours de validation"}. Quand tu cites un taux ou une règle, mentionne la source officielle correspondante. Si un taux est marqué « à vérifier », signale-le explicitement au lieu de l'affirmer.`;
}

function json(req: Request, obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(req) },
  });
}

Deno.serve(async (req) => {
  // Preflight CORS du navigateur : répondre 204 avec les en-têtes CORS.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") return json(req, { error: "POST uniquement" }, 405);

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

  const body = await req.json().catch(() => ({}));
  const { question, country, taxOverrides, fiscalContext, action } = body;

  // Plan et droits — SÉCURITÉ : lus EXCLUSIVEMENT depuis app_metadata (écriture serveur uniquement).
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  const appMeta = (user.app_metadata || {}) as Record<string, any>;
  const isAdmin = appMeta.is_admin === true;
  let plan = (appMeta.plan as string) || "gratuit";
  if (isAdmin) plan = "admin"; // l'admin est illimité sur tout le site
  const planExp = appMeta.plan_expires_at as string | undefined;
  if (!isAdmin && planExp && new Date(planExp).getTime() < Date.now()) plan = "gratuit"; // abonnement expiré → retour au gratuit

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1b. Paramètres système (table fm_sys_settings, gérés depuis l'onglet Admin
  // « Paramètres » via la fonction admin-settings) : fournisseur IA, clé API,
  // modèle et surcharges de quotas. Priorité : table > constantes/secrets
  // d'environnement. La clé n'est JAMAIS journalisée.
  let SYS: Record<string, string> = {};
  try {
    const { data: rows } = await admin.from("fm_sys_settings").select("key,value");
    for (const r of (rows || [])) SYS[r.key] = r.value;
  } catch {
    // Table absente ou inaccessible : on garde les valeurs par défaut.
  }
  const aiProvider = SYS["ai_provider"] || "xkiro";
  const aiModel = SYS["ai_model"] || (aiProvider === "anthropic" ? ANTHROPIC_MODEL : XKIRO_MODEL);
  const aiApiKey = SYS["ai_api_key"] || Deno.env.get("ANTHROPIC_API_KEY") || "";
  const aiUrl = aiProvider === "anthropic" ? AI_URLS.anthropic : AI_URLS.xkiro;
  const quotaOverride = (p: string): number | null => {
    const raw = SYS["quota_" + p];
    if (raw === undefined) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const quota = isAdmin ? Infinity : (quotaOverride(plan) ?? PLAN_QUOTAS[plan] ?? PLAN_QUOTAS.demo);

  // 2. Action 'quota' : renvoie l'état du plan sans consommer de question (appelée au login par l'app).
  if (action === "quota") {
    if (isAdmin) return json(req, { plan: "admin", remaining: null, unlimited: true, period });
    let { data: q } = await admin.from("copilot_quotas").select("*").eq("user_id", user.id).single();
    if (!q || q.period !== period) {
      const { data } = await admin
        .from("copilot_quotas")
        .upsert({ user_id: user.id, plan, period, questions_used: 0 }, { onConflict: "user_id" })
        .select()
        .single();
      q = data;
    }
    const used = q ? q.questions_used : 0;
    return json(req, { plan, remaining: Math.max(0, quota - used), period, plan_expires_at: planExp || null });
  }

  // 3. Valider la question
  if (!question || typeof question !== "string" || question.trim().length < 2 || question.length > 2000) {
    return json(req, { error: "Question invalide" }, 400);
  }

  // 3b. Rate limit anti-rafale : max 10 questions/minute/utilisateur (sauf admin).
  // Protège le budget IA contre les scripts qui martèleraient l'endpoint.
  // Complète le quota mensuel (vérifié en étape 4).
  if (!isAdmin) {
    const { data: allowed, error: rlErr } = await admin.rpc("check_rate_limit", {
      p_user: user.id, p_endpoint: "copilot", p_max_hits: 10,
    });
    if (rlErr) console.error("[copilot] check_rate_limit:", rlErr.message);
    if (!rlErr && allowed === false) {
      return json(req, { error: "Trop de requêtes. Réessayez dans une minute." }, 429);
    }
  }

  // 4. Quota mensuel (sauf admin : illimité)
  let newUsed: number | null = null;
  if (!isAdmin) {
    let { data: q } = await admin.from("copilot_quotas").select("*").eq("user_id", user.id).single();
    if (!q || q.period !== period) {
      const { data } = await admin
        .from("copilot_quotas")
        .upsert({ user_id: user.id, plan, period, questions_used: 0 }, { onConflict: "user_id" })
        .select()
        .single();
      q = data;
    }
    if (!q) return json(req, { error: "Erreur quota" }, 500);
    if (q.questions_used >= quota) {
      return json(req, { error: "Quota mensuel épuisé", remaining: 0, plan }, 402);
    }

    // Réservation atomique d'1 question avant l'appel IA (fonction SQL consume_quota :
    // UPDATE ... WHERE questions_used < quota RETURNING — anti-abus requêtes parallèles)
    const { data: reserved, error: qResErr } = await admin.rpc("consume_quota", {
      p_user_id: user.id, p_period: period, p_quota: quota,
    });
    if (qResErr || reserved === null || reserved === undefined) {
      return json(req, { error: "Quota mensuel épuisé", remaining: 0, plan }, 402);
    }
    newUsed = reserved as number;
  }

  // 5. Appel IA — fournisseur configurable depuis les paramètres admin
  // (fm_sys_settings). xKiro est compatible avec le format Anthropic, donc le
  // même corps de requête sert pour les deux fournisseurs. Le prompt système
  // est mis en cache (coût divisé par ~10).
  if (!aiApiKey) {
    return json(req, { error: "Clé API IA non configurée (onglet Admin → Paramètres)." }, 503);
  }
  const resp = await fetch(aiUrl, {
    method: "POST",
    headers: {
      "x-api-key": aiApiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: aiModel,
      max_tokens: 1000,
      system: [{ type: "text", text: SYSTEM_PROMPT + countryContext(country, taxOverrides, fiscalContext), cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: question }],
    }),
  });
  if (!resp.ok) {
    // L'IA n'a pas répondu : on rend la question réservée (si le compteur n'a pas bougé entre-temps)
    if (!isAdmin && newUsed !== null) {
      await admin.from("copilot_quotas")
        .update({ questions_used: newUsed - 1 })
        .eq("user_id", user.id).eq("period", period).eq("questions_used", newUsed);
    }
    return json(req, { error: "IA indisponible, réessayez dans un instant" }, 502);
  }
  const data = await resp.json();
  const answer = (data.content || [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n");
  const usage = data.usage || {};

  // 6. Journaliser les tokens (suivi des coûts)
  await admin.from("copilot_usage").insert({
    user_id: user.id,
    period,
    input_tokens: usage.input_tokens ?? 0,
    output_tokens: usage.output_tokens ?? 0,
  });

  const remaining = isAdmin ? null : Math.max(0, quota - (newUsed as number));
  return json(req, { answer, remaining, plan, unlimited: isAdmin });
});
