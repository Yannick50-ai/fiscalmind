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
    // On ne renvoie que ce dont le client a besoin.
    return json({
      ParsedResults: (j.ParsedResults ?? []).map((p) => ({ ParsedText: p.ParsedText ?? "" })),
      IsErroredOnProcessing: !!j.IsErroredOnProcessing,
    });
  } catch {
    return json({ error: "Délai dépassé" }, 504);
  }
});
