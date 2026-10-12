// FiscalMind Africa — Webhook SasPay (remplace chariow-webhook, 11/10/2026).
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
    return new Response(JSON.stringify({ error: "POST uniquement" }), {
      status: 405, headers: { "content-type": "application/json", ...corsHeaders(req) },
    });
  }

  const secret = Deno.env.get("SASPAY_WEBHOOK_SECRET") || "";
  if (!secret) {
    console.error("[saspay-webhook] SASPAY_WEBHOOK_SECRET manquant");
    return new Response(JSON.stringify({ error: "Webhook non configuré" }), {
      status: 500, headers: { "content-type": "application/json", ...corsHeaders(req) },
    });
  }

  // 1. Vérifier la signature HMAC
  const signature = req.headers.get("x-webhook-signature") || "";
  const timestamp = req.headers.get("x-webhook-timestamp") || "";
  const corpsBrut = await req.text();

  // Anti-rejeu : timestamp ≤ 5 minutes
  const age = Date.now() - Number(timestamp) * 1000;
  if (!timestamp || isNaN(Number(timestamp)) || age < 0 || age > 5 * 60 * 1000) {
    console.warn("[saspay-webhook] Timestamp invalide ou expiré");
    return new Response(JSON.stringify({ error: "Timestamp invalide" }), {
      status: 401, headers: { "content-type": "application/json", ...corsHeaders(req) },
    });
  }

  const attendue = await hmacHex(secret, timestamp + "." + corpsBrut);
  if (!timingSafeEqual(signature.toLowerCase(), attendue.toLowerCase())) {
    console.warn("[saspay-webhook] Signature invalide");
    return new Response(JSON.stringify({ error: "Signature invalide" }), {
      status: 401, headers: { "content-type": "application/json", ...corsHeaders(req) },
    });
  }

  // 2. Traiter l'événement
  let event: any;
  try { event = JSON.parse(corpsBrut); }
  catch { return new Response(JSON.stringify({ error: "JSON invalide" }), { status: 400 }); }

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

  if (!email) {
    console.warn("[saspay-webhook] transaction.success sans email");
    return new Response(JSON.stringify({ error: "Email manquant" }), {
      status: 400, headers: { "content-type": "application/json", ...corsHeaders(req) },
    });
  }

  const mapping = PLAN_PAR_MONTANT[montant];
  if (!mapping) {
    console.warn("[saspay-webhook] Montant non reconnu :", montant);
    return new Response(JSON.stringify({ error: "Montant non reconnu", montant }), {
      status: 400, headers: { "content-type": "application/json", ...corsHeaders(req) },
    });
  }

  // 3. Activer la licence
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Trouver l'utilisateur par email
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = (users?.users || []).find((u: any) => (u.email || "").toLowerCase() === email);
  if (!user) {
    console.warn("[saspay-webhook] Utilisateur introuvable :", email);
    return new Response(JSON.stringify({ error: "Utilisateur introuvable" }), {
      status: 404, headers: { "content-type": "application/json", ...corsHeaders(req) },
    });
  }

  const expire = new Date(Date.now() + mapping.jours * 24 * 3600 * 1000).toISOString();
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
    return new Response(JSON.stringify({ error: "Échec activation" }), {
      status: 500, headers: { "content-type": "application/json", ...corsHeaders(req) },
    });
  }

  console.log(`[saspay-webhook] Licence activée : ${email} → ${mapping.plan} (${mapping.jours}j)`);
  return new Response(JSON.stringify({ ok: true, plan: mapping.plan, email }), {
    headers: { "content-type": "application/json", ...corsHeaders(req) },
  });
});
