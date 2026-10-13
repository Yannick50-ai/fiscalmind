// FiscalMind Africa — Webhook SasPay (remplace chariow-webhook, 11/10/2026).
// Correctifs 12/10/2026 (audit croisé) :
//   - Recherche utilisateur par email via RPC SQL (fini le listUsers() limité à 50)
//   - Idempotence : transaction_id stocké (contrainte unique) → rejeu ignoré
//   - Durées cumulées : renouvellement = max(expiration en cours, maintenant) + durée
//   - En-têtes CORS aussi sur la réponse "JSON invalide"
//
// Réception des événements SasPay :
//   - Vérification HMAC-SHA256 : signature = HMAC(secret, timestamp + "." + corps_brut)
//   - En-têtes : X-Webhook-Signature, X-Webhook-Timestamp
//   - Rejet si timestamp > 5 minutes (anti-rejeu)
//   - Événement transaction.success → activation licence (plan + durée via montant)
//
// Mapping montants (XOF) → plan :
//   14900 → essentiel (30 j) | 149000 → essentiel (365 j) | 10400 → essentiel fondateur (30 j)
//   44900 → pro (30 j)       | 449000 → pro (365 j)       | 31400 → pro fondateur (30 j)
//
// Secrets requis : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SASPAY_WEBHOOK_SECRET.
// SQL requis (à exécuter une fois dans le SQL Editor) :
//   CREATE TABLE IF NOT EXISTS public.saspay_transactions (
//     id bigserial PRIMARY KEY,
//     transaction_id text UNIQUE NOT NULL,
//     email text NOT NULL,
//     montant integer NOT NULL,
//     plan text NOT NULL,
//     created_at timestamptz DEFAULT now()
//   );
//   ALTER TABLE public.saspay_transactions ENABLE ROW LEVEL SECURITY;
//   CREATE OR REPLACE FUNCTION public.find_user_by_email(p_email text)
//   RETURNS TABLE (id uuid, email text, app_metadata jsonb)
//   LANGUAGE sql SECURITY DEFINER SET search_path = 'public, auth'
//   AS $$ SELECT id, email, raw_app_meta_data FROM auth.users
//          WHERE lower(email) = lower(p_email) LIMIT 1 $$;
//   REVOKE EXECUTE ON FUNCTION public.find_user_by_email(text) FROM PUBLIC, anon, authenticated;
//   GRANT EXECUTE ON FUNCTION public.find_user_by_email(text) TO service_role;

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const PLAN_PAR_MONTANT: Record<number, { plan: string; jours: number; fondateur?: boolean }> = {
  14900: { plan: "essentiel", jours: 30 },
  149000: { plan: "essentiel", jours: 365 },
  10400: { plan: "essentiel", jours: 30, fondateur: true },
  44900: { plan: "pro", jours: 30 },
  449000: { plan: "pro", jours: 365 },
  31400: { plan: "pro", jours: 30, fondateur: true },
};

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowed = ["https://fiscalmind-africa.pages.dev", "https://app.saspay.me"];
  const o = allowed.includes(origin) ? origin : allowed[0];
  return {
    "access-control-allow-origin": o,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-timestamp",
  };
}

function jsonError(req: Request, error: string, status: number, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ error, ...extra }), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(req) },
  });
}

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return jsonError(req, "POST uniquement", 405);
  }

  const secret = Deno.env.get("SASPAY_WEBHOOK_SECRET") || "";
  if (!secret) {
    console.error("[saspay-webhook] SASPAY_WEBHOOK_SECRET manquant");
    return jsonError(req, "Webhook non configuré", 500);
  }

  // 1. Vérifier la signature HMAC
  const signature = req.headers.get("x-webhook-signature") || "";
  const timestamp = req.headers.get("x-webhook-timestamp") || "";
  const corpsBrut = await req.text();

  // Anti-rejeu : timestamp ≤ 5 minutes
  const age = Date.now() - Number(timestamp) * 1000;
  if (!timestamp || isNaN(Number(timestamp)) || age < 0 || age > 5 * 60 * 1000) {
    console.warn("[saspay-webhook] Timestamp invalide ou expiré");
    return jsonError(req, "Timestamp invalide", 401);
  }

  const attendue = await hmacHex(secret, timestamp + "." + corpsBrut);
  if (!timingSafeEqual(signature.toLowerCase(), attendue.toLowerCase())) {
    console.warn("[saspay-webhook] Signature invalide");
    return jsonError(req, "Signature invalide", 401);
  }

  // 2. Traiter l'événement
  let event: any;
  try { event = JSON.parse(corpsBrut); }
  catch { return jsonError(req, "JSON invalide", 400); }

  // Test de connexion SasPay
  if (event.event === "webhook.test") {
    return new Response(JSON.stringify({ ok: true, message: "Webhook SasPay opérationnel" }), {
      headers: { "content-type": "application/json", ...corsHeaders(req) },
    });
  }

  if (event.event !== "transaction.success") {
    // On accuse réception des autres événements sans traitement
    return new Response(JSON.stringify({ ok: true, ignored: event.event }), {
      headers: { "content-type": "application/json", ...corsHeaders(req) },
    });
  }

  const data = event.data || {};
  const montant = Number(data.amount || data.montant || 0);
  const email = String(data.customer_email || data.email || data.customer?.email || "").toLowerCase().trim();
  const txId = String(data.transaction_id || data.id || data.reference || data.txn_id || "").trim();

  if (!email) {
    console.warn("[saspay-webhook] transaction.success sans email");
    return jsonError(req, "Email manquant", 400);
  }

  const mapping = PLAN_PAR_MONTANT[montant];
  if (!mapping) {
    console.warn("[saspay-webhook] Montant non reconnu :", montant);
    return jsonError(req, "Montant non reconnu", 400, { montant });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 3. Idempotence : ignorer les transactions déjà traitées
  if (txId) {
    const { error: txErr } = await supabase.from("saspay_transactions").insert({
      transaction_id: txId,
      email,
      montant,
      plan: mapping.plan,
    });
    if (txErr) {
      if (txErr.code === "23505") {
        console.log(`[saspay-webhook] Transaction déjà traitée : ${txId}`);
        return new Response(JSON.stringify({ ok: true, duplicate: true }), {
          headers: { "content-type": "application/json", ...corsHeaders(req) },
        });
      }
      console.error("[saspay-webhook] Échec enregistrement transaction :", txErr.message);
      return jsonError(req, "Échec enregistrement", 500);
    }
  } else {
    console.warn("[saspay-webhook] transaction.success sans ID de transaction (pas d'idempotence)");
  }

  // 4. Trouver l'utilisateur par email (RPC SQL, sans limite de 50)
  const { data: found, error: findErr } = await supabase.rpc("find_user_by_email", { p_email: email });
  if (findErr) {
    console.error("[saspay-webhook] Échec recherche utilisateur :", findErr.message);
    return jsonError(req, "Échec recherche utilisateur", 500);
  }
  const user = (found || [])[0];
  if (!user) {
    console.warn("[saspay-webhook] Utilisateur introuvable :", email);
    return jsonError(req, "Utilisateur introuvable", 404);
  }

  // 5. Activer la licence — durée cumulée avec l'expiration en cours
  const currentExpire = user.app_metadata?.plan_expires_at
    ? new Date(user.app_metadata.plan_expires_at).getTime()
    : 0;
  const base = Math.max(currentExpire, Date.now());
  const expire = new Date(base + mapping.jours * 24 * 3600 * 1000).toISOString();

  const { error: updErr } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...(user.app_metadata || {}),
      plan: mapping.plan,
      plan_expires_at: expire,
      plan_fondateur: mapping.fondateur || false,
      plan_source: "saspay",
    },
  });

  if (updErr) {
    console.error("[saspay-webhook] Échec activation :", updErr.message);
    return jsonError(req, "Échec activation", 500);
  }

  console.log(`[saspay-webhook] Licence activée : ${email} → ${mapping.plan} (${mapping.jours}j, expire ${expire})`);
  return new Response(JSON.stringify({ ok: true, plan: mapping.plan, email, expires_at: expire }), {
    headers: { "content-type": "application/json", ...corsHeaders(req) },
  });
});
