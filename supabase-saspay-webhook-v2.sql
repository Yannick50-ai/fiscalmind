-- FiscalMind Africa — SQL d'accompagnement du webhook SasPay (correctifs 12/10/2026).
-- À exécuter UNE FOIS dans le SQL Editor Supabase AVANT de redéployer la fonction saspay-webhook.
--
-- 1. Table d'idempotence : chaque transaction SasPay n'est traitée qu'une fois.
-- 2. Fonction find_user_by_email : recherche un utilisateur par email sans la limite
--    de 50 de auth.admin.listUsers().

-- 1. Table des transactions traitées
CREATE TABLE IF NOT EXISTS public.saspay_transactions (
  id bigserial PRIMARY KEY,
  transaction_id text UNIQUE NOT NULL,
  email text NOT NULL,
  montant integer NOT NULL,
  plan text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.saspay_transactions ENABLE ROW LEVEL SECURITY;
-- Pas de policy : RLS activé sans policy = accès refusé par défaut pour anon/authenticated.
-- Seul service_role (bypass RLS) y accède, via la fonction Edge saspay-webhook.

-- 2. Recherche utilisateur par email (remplace listUsers)
CREATE OR REPLACE FUNCTION public.find_user_by_email(p_email text)
RETURNS TABLE (id uuid, email text, app_metadata jsonb)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public, auth'
AS $$
  SELECT id, email, raw_app_meta_data
  FROM auth.users
  WHERE lower(email) = lower(p_email)
  LIMIT 1
$$;

-- Verrouiller l'accès : seul service_role peut l'appeler
REVOKE EXECUTE ON FUNCTION public.find_user_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_by_email(text) TO service_role;
