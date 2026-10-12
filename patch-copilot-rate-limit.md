# Patch rate limiting pour la fonction copilot (à appliquer via dashboard Supabase)
# Insérer APRÈS le bloc "// 3. Valider la question" et AVANT "// 4. Quota mensuel"

## Code à insérer :

  // 3b. Rate limit anti-rafale : max 10 questions/minute/utilisateur (sauf admin).
  // Protège le budget IA contre les scripts qui martèleraient l'endpoint.
  if (!isAdmin) {
    const { data: allowed, error: rlErr } = await admin.rpc("check_rate_limit", {
      p_user: user.id, p_endpoint: "copilot", p_max_hits: 10,
    });
    if (rlErr) console.error("[copilot] check_rate_limit:", rlErr.message);
    if (!rlErr && allowed === false) {
      return json({ error: "Trop de requêtes. Réessayez dans une minute." }, 429);
    }
  }

## Prérequis SQL (exécuter d'abord) : voir supabase-fm-rate-limits.sql
## (crée public.fm_rate_limits + fonction check_rate_limit)

## Recherche/remplacement pour le dashboard :
# ANCRE (chercher) :
  // 4. Quota mensuel (sauf admin : illimité)
# REMPLACER PAR (insérer le bloc 3b juste avant) :
  // 3b. Rate limit anti-rafale : max 10 questions/minute/utilisateur (sauf admin).
  // Protège le budget IA contre les scripts qui martèleraient l'endpoint.
  if (!isAdmin) {
    const { data: allowed, error: rlErr } = await admin.rpc("check_rate_limit", {
      p_user: user.id, p_endpoint: "copilot", p_max_hits: 10,
    });
    if (rlErr) console.error("[copilot] check_rate_limit:", rlErr.message);
    if (!rlErr && allowed === false) {
      return json({ error: "Trop de requêtes. Réessayez dans une minute." }, 429);
    }
  }

  // 4. Quota mensuel (sauf admin : illimité)
