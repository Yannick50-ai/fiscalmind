// Edge Function « ocr » — passerelle vers OCR.space (la clé reste côté serveur).
//
// Déploiement : coller dans le dashboard Supabase, puis :
//   supabase secrets set OCR_SPACE_KEY=<clé>
//
// Garanties : utilisateur connecté obligatoire, CORS restreint au domaine,
// taille et type de fichier contrôlés, rate limit via fm_rate_limits,
// aucune clé ni donnée conservée.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";

const OCR_URL = "https://api.ocr.space/parse/image";
const MAX_CHARS = 1_800_000; // ~1,3 Mo de fichier une fois décodé (limite du plan gratuit OCR.space : 1 Mo)
const LANGS = new Set(["fre", "eng"]);
const DATA_URL = /^data:(image\/(png|jpe?g|webp|gif)|application\/pdf);base64,[A-Za-z0-9+/=]+$/;

// Quota mensuel OCR par plan (correctif 12/10/2026 — avant : aucun quota,
// un compte gratuit pouvait épuiser le crédit OCR.space à 20 req/min).
const OCR_QUOTAS: Record<string, number> = {
  gratuit: 50,
  essentiel: 100,
  pro: 200,
  // Aliases historiques
  demo: 50,
  starter: 100,
  enterprise: 200,
};

// Extraction IA des documents (12/10/2026) : l'IA analyse le texte OCR et
// extrait les données structurées, quel que soit le format du document.
// Consomme 1 question du quota copilote (même quota que le copilote).
const AI_URLS_OCR: Record<string, string> = {
  anthropic: "https://api.anthropic.com/v1/messages",
  xkiro: "https://api.xkiro.com/v1/messages",
};
const XKIRO_MODEL_OCR = "qwen/qwen3.8-max:free";

const EXTRACTION_PROMPT = `Tu es un expert-comptable SYSCOHADA. Analyse le texte OCR d'un document comptable et extrais les informations en JSON.

Règles :
- Détecte le type : "bordereau_dgi" (paiement d'impôts), "facture_achat", "facture_vente", "recu", "releve_bancaire", "autre"
- Pour un bordereau DGI : liste CHAQUE taxe avec son montant exact
- Les montants sont en francs CFA (XOF), sans décimales
- Comptes SYSCOHADA révisé : utilise les SOUS-COMPTES quand tu identifies un tiers précis. Exemples : 411001, 411002... pour les clients (411=clients) ; 401001, 401002... pour les fournisseurs (401=fournisseurs) ; 521001 pour la banque principale. Comptes de base : 441=IS, 442=IUTS, 443=TVA, 445=TVA récupérable, 447=autres impôts, 521=banque, 571=caisse, 601=achats marchandises, 621=transports, 631=impôts et taxes, 641=charges de personnel, 701=ventes marchandises, 706=services vendus, 771=produits exceptionnels.
- Date au format AAAA-MM-JJ
{FISCAL_CONTEXT}
Réponds UNIQUEMENT avec un JSON valide, sans texte avant ni après :
{
  "type": "bordereau_dgi",
  "date": "2026-10-11",
  "tiers": "DGI",
  "total": 471756,
  "lignes": [
    {"label": "TVA due", "montant": 116839, "compte": "443"},
    {"label": "IUTS", "montant": 2741, "compte": "442"}
  ]
}

Texte OCR à analyser :
`;

async function extractWithAI(
  admin: any,
  sysSettings: Record<string, string>,
  ocrText: string,
  userId: string,
  period: string,
  copilotQuota: number,
  isAdmin: boolean,
  fiscalContext: { tvaSubject: boolean; bicPrelevement: boolean } = { tvaSubject: true, bicPrelevement: false }
): Promise<any | null> {
  const aiProvider = sysSettings["ai_provider"] || "xkiro";
  const aiModel = sysSettings["ai_model"] || XKIRO_MODEL_OCR;
  const aiApiKey = sysSettings["ai_api_key"] || Deno.env.get("ANTHROPIC_API_KEY") || "";
  const aiUrl = AI_URLS_OCR[aiProvider] || AI_URLS_OCR.xkiro;
  if (!aiApiKey || !ocrText.trim()) return null;

  // Vérifier le quota copilote avant l'appel IA
  if (!isAdmin) {
    let { data: q } = await admin.from("copilot_quotas").select("*").eq("user_id", userId).single();
    if (!q || q.period !== period) {
      const { data } = await admin.from("copilot_quotas")
        .upsert({ user_id: userId, period, questions_used: 0 }, { onConflict: "user_id" })
        .select().single();
      q = data;
    }
    if ((q?.questions_used ?? 0) >= copilotQuota) {
      console.warn("[ocr] Quota copilote épuisé, extraction IA ignorée");
      return null;
    }
  }

  try {
    const fiscalNote = fiscalContext.tvaSubject
      ? (fiscalContext.bicPrelevement ? "- L'entreprise est assujettie à la TVA et applique le prélèvement BIC 2%." : "- L'entreprise est assujettie à la TVA.")
      : "- L'entreprise N'EST PAS assujettie à la TVA : ne pas extraire de TVA, même si le document en mentionne.";
    const prompt = EXTRACTION_PROMPT.replace("{FISCAL_CONTEXT}", fiscalNote);
    const resp = await fetch(aiUrl, {
      method: "POST",
      headers: {
        "x-api-key": aiApiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt + ocrText.slice(0, 8000) }],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!resp.ok) {
      console.error("[ocr] IA extraction: HTTP", resp.status);
      return null;
    }
    const j = await resp.json();
    const content = j.content?.[0]?.text || "";
    // Extraire le JSON de la réponse (peut être entouré de ```json ... ```)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    // Consommer 1 question du quota copilote
    if (!isAdmin) {
      await admin.rpc("consume_quota", { p_user_id: userId, p_period: period, p_quota: copilotQuota });
    }
    return parsed;
  } catch (e) {
    console.error("[ocr] IA extraction erreur:", e.message);
    return null;
  }
}
// CORS restreint : domaine production + previews Cloudflare Pages.
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://fiscalmind-africa.pages.dev",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ALLOWED_ORIGIN_RE = /^https:\/\/([a-z0-9-]+\.)?fiscalmind-africa\.pages\.dev$/;

Deno.serve(async (req) => {
  { const o = req.headers.get("origin") || ""; corsHeaders["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN_RE.test(o) ? o : "https://fiscalmind-africa.pages.dev"; }
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  // 1. Utilisateur authentifié
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Connexion requise" }, 401);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return json({ error: "Session invalide" }, 401);
  const user = data.user;

  // 2. Rate limit : max 20 lectures / minute / utilisateur (via fm_rate_limits).
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const { data: allowed, error: rlErr } = await admin.rpc("check_rate_limit", {
      p_user: user.id, p_endpoint: "ocr", p_max_hits: 20,
    });
    if (rlErr) console.error("[ocr] check_rate_limit:", rlErr.message);
    if (!rlErr && allowed === false) {
      return json({ error: "Trop de demandes, réessayez dans quelques minutes." }, 429);
    }
  } catch (e) {
    console.error("[ocr] rate limit:", e.message);
  }

  // 3. Validation de l'entrée
  let body;
  try { body = await req.json(); } catch { return json({ error: "JSON invalide" }, 400); }
  const img = typeof body.base64Image === "string" ? body.base64Image : "";
  if (!img || img.length > MAX_CHARS) return json({ error: "Fichier absent ou trop volumineux" }, 413);
  if (!DATA_URL.test(img)) return json({ error: "Type de fichier non pris en charge" }, 415);
  const lang = LANGS.has(String(body.language)) ? String(body.language) : "fre";

  // 3b. Quota mensuel OCR par plan (vérifié AVANT l'appel payant à OCR.space)
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  const appMeta = (user.app_metadata || {}) as Record<string, any>;
  const isAdmin = appMeta.is_admin === true;
  let plan = (appMeta.plan as string) || "gratuit";
  const planExp = appMeta.plan_expires_at as string | undefined;
  if (!isAdmin && planExp && new Date(planExp).getTime() < Date.now()) plan = "gratuit";
  // Surcharge éventuelle depuis fm_sys_settings (clé ocr_quota_<plan>), comme pour l'IA
  let ocrQuota = OCR_QUOTAS[plan] ?? OCR_QUOTAS.gratuit;
  try {
    const { data: orow } = await admin.from("fm_sys_settings").select("value").eq("key", "ocr_quota_" + plan).maybeSingle();
    const on = parseInt(orow?.value ?? "", 10);
    if (Number.isFinite(on) && on >= 0) ocrQuota = on;
  } catch (e) { console.error("[ocr] lecture ocr_quota:", e.message); }

  if (!isAdmin) {
    let { data: q } = await admin.from("ocr_quotas").select("*").eq("user_id", user.id).single();
    if (!q || q.period !== period) {
      const { data } = await admin.from("ocr_quotas")
        .upsert({ user_id: user.id, period, scans_used: 0 }, { onConflict: "user_id" })
        .select().single();
      q = data;
    }
    if ((q?.scans_used ?? 0) >= ocrQuota) {
      return json({ error: `Quota OCR mensuel atteint (${ocrQuota} scans/mois, plan ${plan}).` }, 429);
    }
  }

  // 4. Appel OCR.space avec la clé serveur.
  // La clé est lue depuis fm_sys_settings (gérable dans l'admin), avec
  // repli sur le secret OCR_SPACE_KEY.
  let key = Deno.env.get("OCR_SPACE_KEY") || "";
  try {
    const { data: row } = await admin.from("fm_sys_settings").select("value").eq("key", "ocr_api_key").maybeSingle();
    if (row && row.value) key = row.value;
  } catch (e) {
    console.error("[ocr] lecture ocr_api_key:", e.message);
  }
  if (!key) return json({ error: "Service OCR non configuré" }, 500);
  const form = new FormData();
  form.append("apikey", key);
  form.append("base64Image", img);
  form.append("language", lang);
  form.append("OCREngine", "2");
  form.append("scale", "true");
  try {
    const r = await fetch(OCR_URL, { method: "POST", body: form, signal: AbortSignal.timeout(60_000) });
    if (!r.ok) return json({ error: "Service OCR indisponible" }, 502);
    const j = await r.json();
    // Consommer 1 scan du quota mensuel (uniquement si l'appel a réussi)
    if (!isAdmin) {
      const { error: qErr } = await admin.rpc("consume_ocr_quota", {
        p_user_id: user.id, p_period: period, p_quota: ocrQuota,
      });
      if (qErr) console.error("[ocr] consume_ocr_quota:", qErr.message);
    }
    const parsedResults = (j.ParsedResults ?? []).map((p) => ({ ParsedText: p.ParsedText ?? "" }));
    const ocrText = parsedResults.map((p) => p.ParsedText).join("\n");

    // 5. Extraction IA des données structurées (12/10/2026)
    // L'IA comprend tous les formats de documents, pas seulement ceux codés en dur.
    let aiExtraction = null;
    if (ocrText.trim().length > 50) {
      // Charger les paramètres IA depuis fm_sys_settings
      const sysSettings: Record<string, string> = {};
      try {
        const { data: rows } = await admin.from("fm_sys_settings").select("key, value")
          .in("key", ["ai_provider", "ai_api_key", "ai_model", "quota_gratuit", "quota_essentiel", "quota_pro", "quota_demo", "quota_starter", "quota_enterprise"]);
        (rows || []).forEach((r: any) => { sysSettings[r.key] = r.value; });
      } catch (e) { console.error("[ocr] lecture sys_settings:", e.message); }
      // Quota copilote par plan (même quota que le copilote)
      const COPILOT_QUOTAS: Record<string, number> = { gratuit: 10, essentiel: 30, pro: 300, demo: 10, starter: 30, enterprise: 300 };
      let copilotQuota = COPILOT_QUOTAS[plan] ?? 10;
      const override = parseInt(sysSettings["quota_" + plan] || "", 10);
      if (Number.isFinite(override) && override >= 0) copilotQuota = override;

      // Contexte fiscal de l'entreprise (envoyé par le frontend)
      const fiscalContext = {
        tvaSubject: body.tvaSubject !== false,
        bicPrelevement: body.bicPrelevement === true,
      };
      aiExtraction = await extractWithAI(admin, sysSettings, ocrText, user.id, period, copilotQuota, isAdmin, fiscalContext);
    }

    // On ne renvoie que ce dont le client a besoin.
    return json({
      ParsedResults: parsedResults,
      IsErroredOnProcessing: !!j.IsErroredOnProcessing,
      aiExtraction,
    });
  } catch {
    return json({ error: "Délai dépassé" }, 504);
  }
});
