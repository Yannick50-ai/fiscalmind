-- FiscalMind Africa — Quota OCR mensuel par plan (correctif 12/10/2026).
-- Avant : seul un rate limit de 20 requêtes/minute, soit ~28 000/jour/compte —
-- un compte gratuit pouvait épuiser le crédit OCR.space (25 000/mois).
-- Après : quota mensuel de scans par plan, vérifié avant chaque appel OCR.space.
--
-- Quotas (scans/mois) : gratuit/demo = 50, essentiel/starter = 100, pro/enterprise = 200.
-- L'admin est illimité (géré dans la Edge Function, pas ici).
-- Surcharges possibles via la table fm_sys_settings (clé ocr_quota_<plan>), comme pour l'IA.

CREATE TABLE IF NOT EXISTS public.ocr_quotas (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  period text NOT NULL,
  scans_used integer NOT NULL DEFAULT 0
);

ALTER TABLE public.ocr_quotas ENABLE ROW LEVEL SECURITY;
-- Pas de policy : RLS sans policy = refusé par défaut pour anon/authenticated.
-- Seul service_role (via la Edge Function ocr) y accède.

-- Réservation atomique d'1 scan (même pattern que consume_quota pour le copilote).
CREATE OR REPLACE FUNCTION public.consume_ocr_quota(p_user_id uuid, p_period text, p_quota integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
v_new int;
begin
update public.ocr_quotas
set scans_used = scans_used + 1
where user_id = p_user_id
and period = p_period
and scans_used < p_quota
returning scans_used into v_new;
return v_new;
end;
$function$;

-- Verrouiller l'appel direct : seule la Edge Function (service_role) l'utilise.
REVOKE EXECUTE ON FUNCTION public.consume_ocr_quota(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ocr_quota(uuid, text, integer) TO service_role;
