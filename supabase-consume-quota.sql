-- FiscalMind Africa — fonction consume_quota (vérifiée en production le 10/10/2026)
-- Réservation atomique d'1 question de quota copilote. Le WHERE questions_used < p_quota
-- rend l'opération atomique : en cas de requêtes parallèles, une seule passe.
-- Appelée depuis la Edge Function copilot via admin.rpc("consume_quota", {...}).

CREATE OR REPLACE FUNCTION public.consume_quota(p_user_id uuid, p_period text, p_quota integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
v_new int;
begin
update public.copilot_quotas
set questions_used = questions_used + 1
where user_id = p_user_id
and period = p_period
and questions_used < p_quota
returning questions_used into v_new;
return v_new;
end;
$function$;
