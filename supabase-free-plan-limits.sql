-- FiscalMind Africa — Limites du plan Gratuit appliquées côté serveur (correctif 12/10/2026).
-- Le contrôle existait uniquement dans le navigateur (journal.js) : contournable en
-- écrivant directement dans fm_entries avec son JWT. Ce trigger l'applique en base.
--
-- Règle : plan 'gratuit' ou 'demo' (ou sans plan) → max 30 écritures par mois calendaire.
-- Les plans payants ('essentiel', 'pro', ...) et l'admin ne sont pas limités.
-- Un abonnement expiré (plan_expires_at dépassé) retombe au gratuit.

CREATE OR REPLACE FUNCTION public.check_free_plan_entry_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public, auth'
AS $$
DECLARE
  v_plan text;
  v_expires_at timestamptz;
  v_count integer;
BEGIN
  SELECT raw_app_meta_data->>'plan',
         (raw_app_meta_data->>'plan_expires_at')::timestamptz
    INTO v_plan, v_expires_at
    FROM auth.users WHERE id = NEW.user_id;

  v_plan := COALESCE(v_plan, 'gratuit');

  -- Abonnement expiré → traité comme gratuit
  IF v_expires_at IS NOT NULL AND v_expires_at < now() THEN
    v_plan := 'gratuit';
  END IF;

  IF v_plan IN ('gratuit', 'demo') THEN
    SELECT count(*) INTO v_count
    FROM public.fm_entries
    WHERE user_id = NEW.user_id
      AND created_at >= date_trunc('month', now());

    IF v_count >= 30 THEN
      RAISE EXCEPTION
        'Limite du plan Gratuit atteinte (30 écritures/mois). Passez au plan Essentiel pour des écritures illimitées.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_free_plan_entry_limit ON public.fm_entries;
CREATE TRIGGER trg_free_plan_entry_limit
BEFORE INSERT ON public.fm_entries
FOR EACH ROW
EXECUTE FUNCTION public.check_free_plan_entry_limit();

-- Le trigger s'exécute avec les droits du propriétaire (SECURITY DEFINER) :
-- aucun GRANT nécessaire, mais on verrouille l'appel direct par précaution.
REVOKE EXECUTE ON FUNCTION public.check_free_plan_entry_limit() FROM PUBLIC, anon, authenticated;
