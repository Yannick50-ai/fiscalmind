// FiscalMind Africa — Gestion d'équipe (multi-utilisateurs, 11/10/2026).
//
// Actions :
//   - create_team : crée l'équipe du propriétaire (plan Pro → 3 membres max)
//   - invite : invite un membre par email
//   - accept : accepte une invitation
//   - list : liste les membres de l'équipe
//   - remove : retire un membre
//   - my_team : retourne l'équipe de l'utilisateur (owner ou membre)
//
// Secrets requis : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const MAX_MEMBRES_PAR_PLAN: Record<string, number> = {
  gratuit: 1,
  essentiel: 1,
  pro: 3,
  demo: 1,
  starter: 1,
  enterprise: 3,
};

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowed = ["https://fiscalmind-africa.pages.dev"];
  const o = allowed.includes(origin) ? origin : allowed[0];
  return {
    "access-control-allow-origin": o,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST uniquement" }), { status: 405, headers: cors(req) });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Authentifier l'utilisateur
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: cors(req) });
  }
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Session invalide" }), { status: 401, headers: cors(req) });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action || "";

  const plan = ((user.app_metadata as any)?.plan || "gratuit").toLowerCase();
  const maxMembres = MAX_MEMBRES_PAR_PLAN[plan] ?? 1;

  // Helper : trouver l'équipe de l'utilisateur (comme owner ou membre)
  async function findMyTeam() {
    const { data: owned } = await supabase.from("fm_teams").select("*").eq("owner_id", user.id).maybeSingle();
    if (owned) return { team: owned, role: "owner" };
    const { data: membership } = await supabase.from("fm_team_members").select("team_id, fm_teams(*)").eq("user_id", user.id).maybeSingle();
    if (membership) return { team: (membership as any).fm_teams, role: "member" };
    return { team: null, role: null };
  }

  try {
    // --- my_team : infos équipe ---
    if (action === "my_team") {
      const { team, role } = await findMyTeam();
      if (!team) return new Response(JSON.stringify({ team: null, membres: [], max: maxMembres, plan }), { headers: { "content-type": "application/json", ...cors(req) } });
      const { data: membres } = await supabase.from("fm_team_members").select("id, email, role, accepted_at, invited_at").eq("team_id", team.id);
      return new Response(JSON.stringify({ team, role, membres: membres || [], max: maxMembres, plan }), { headers: { "content-type": "application/json", ...cors(req) } });
    }

    // --- create_team : créer mon équipe ---
    if (action === "create_team") {
      const { team } = await findMyTeam();
      if (team) return new Response(JSON.stringify({ error: "Équipe déjà existante" }), { status: 400, headers: cors(req) });
      const { data, error } = await supabase.from("fm_teams").insert({
        owner_id: user.id,
        name: body.name || "Mon équipe",
        plan,
        max_members: maxMembres,
      }).select().single();
      if (error) throw error;
      // Le propriétaire est aussi membre
      await supabase.from("fm_team_members").insert({
        team_id: data.id, user_id: user.id, email: user.email, role: "owner", accepted_at: new Date().toISOString(),
      });
      return new Response(JSON.stringify({ ok: true, team: data }), { headers: { "content-type": "application/json", ...cors(req) } });
    }

    // --- invite : inviter par email (owner uniquement) ---
    if (action === "invite") {
      const { team, role } = await findMyTeam();
      if (!team || role !== "owner") {
        return new Response(JSON.stringify({ error: "Seul le propriétaire peut inviter" }), { status: 403, headers: cors(req) });
      }
      const email = String(body.email || "").toLowerCase().trim();
      if (!email || !email.includes("@")) {
        return new Response(JSON.stringify({ error: "Email invalide" }), { status: 400, headers: cors(req) });
      }
      // Vérifier la limite
      const { count } = await supabase.from("fm_team_members").select("id", { count: "exact", head: true }).eq("team_id", team.id);
      if ((count || 0) >= maxMembres) {
        return new Response(JSON.stringify({ error: `Limite de ${maxMembres} membre(s) atteinte pour le plan ${plan}` }), { status: 400, headers: cors(req) });
      }
      // Vérifier si déjà invité
      const { data: existing } = await supabase.from("fm_team_members").select("id").eq("team_id", team.id).eq("email", email).maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ error: "Cet email est déjà invité" }), { status: 400, headers: cors(req) });
      }
      // Trouver l'utilisateur par email (s'il a déjà un compte)
      const { data: users } = await supabase.auth.admin.listUsers();
      const targetUser = (users?.users || []).find((u: any) => (u.email || "").toLowerCase() === email);

      const { data, error } = await supabase.from("fm_team_members").insert({
        team_id: team.id,
        user_id: targetUser?.id || "00000000-0000-0000-0000-000000000000", // placeholder si pas encore de compte
        email,
        role: "member",
      }).select().single();
      if (error) throw error;

      return new Response(JSON.stringify({
        ok: true,
        invitation: data,
        has_account: !!targetUser,
        message: targetUser
          ? "Invitation envoyée. Le membre doit accepter depuis son compte."
          : "Invitation créée. Le destinataire doit d'abord créer un compte FiscalMind avec cet email.",
      }), { headers: { "content-type": "application/json", ...cors(req) } });
    }

    // --- accept : accepter une invitation ---
    if (action === "accept") {
      const email = (user.email || "").toLowerCase();
      const { data: invitations } = await supabase.from("fm_team_members")
        .select("id, team_id").eq("email", email).is("accepted_at", null);
      if (!invitations?.length) {
        return new Response(JSON.stringify({ error: "Aucune invitation en attente" }), { status: 404, headers: cors(req) });
      }
      // Mettre à jour avec le vrai user_id et accepted_at
      for (const inv of invitations) {
        await supabase.from("fm_team_members").update({
          user_id: user.id,
          accepted_at: new Date().toISOString(),
        }).eq("id", inv.id);
      }
      return new Response(JSON.stringify({ ok: true, accepted: invitations.length }), { headers: { "content-type": "application/json", ...cors(req) } });
    }

    // --- remove : retirer un membre (owner uniquement) ---
    if (action === "remove") {
      const { team, role } = await findMyTeam();
      if (!team || role !== "owner") {
        return new Response(JSON.stringify({ error: "Seul le propriétaire peut retirer un membre" }), { status: 403, headers: cors(req) });
      }
      const memberId = body.member_id;
      if (!memberId) return new Response(JSON.stringify({ error: "member_id requis" }), { status: 400, headers: cors(req) });
      const { error } = await supabase.from("fm_team_members").delete().eq("id", memberId).eq("team_id", team.id).neq("role", "owner");
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json", ...cors(req) } });
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), { status: 400, headers: cors(req) });
  } catch (e: any) {
    console.error("[team]", e.message);
    return new Response(JSON.stringify({ error: e.message || "Erreur serveur" }), { status: 500, headers: cors(req) });
  }
});
