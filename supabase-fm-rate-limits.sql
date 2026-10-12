-- FiscalMind Africa — Rate limiting temporel (anti-rafale) pour le copilote
-- À exécuter dans l'éditeur SQL Supabase (une seule fois).
-- Complète le quota mensuel (consume_quota) avec une fenêtre glissante par minute.

-- Table des fenêtres de requêtes par utilisateur et endpoint
CREATE TABLE IF NOT EXISTS public.fm_rate_limits (
  user_id uuid NOT NULL,
  endpoint text NOT NULL DEFAULT 'copilot',
  window_start timestamptz NOT NULL,
  hits int NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, endpoint)
);

-- RLS activé, aucune policy publique : seul service_role (Edge Functions) y accède
ALTER TABLE public.fm_rate_limits ENABLE ROW LEVEL SECURITY;

-- Fonction atomique : vérifie et incrémente le compteur de la minute en cours.
-- Retourne TRUE si l'appel est autorisé (hits <= p_max_hits), FALSE sinon (429).
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_user uuid, p_endpoint text, p_max_hits int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_hits int;
  v_window timestamptz := date_trunc('minute', now());
BEGIN
  INSERT INTO public.fm_rate_limits (user_id, endpoint, window_start, hits)
  VALUES (p_user, p_endpoint, v_window, 1)
  ON CONFLICT (user_id, endpoint) DO UPDATE
  SET hits = CASE WHEN fm_rate_limits.window_start = v_window
                  THEN fm_rate_limits.hits + 1 ELSE 1 END,
      window_start = v_window
  RETURNING hits INTO v_hits;
  RETURN v_hits <= p_max_hits;
END;
$function$;

-- Nettoyage : supprime les fenêtres de plus d'une heure (à lancer via cron/pg_cron si dispo)
-- DELETE FROM public.fm_rate_limits WHERE window_start < now() - interval '1 hour';
