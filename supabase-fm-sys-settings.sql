-- ============================================================
-- FiscalMind Africa — Paramètres système (fm_sys_settings)
-- ============================================================
-- Paires clé/valeur modifiables depuis l'onglet Admin « Paramètres »
-- via la Edge Function `admin-settings`.
--
-- SÉCURITÉ : RLS activé SANS AUCUNE policy → aucun accès direct,
-- même pour un utilisateur authentifié. Seules les Edge Functions
-- disposant de la clé service_role peuvent lire et écrire.
-- La clé API IA n'est jamais renvoyée en clair : la fonction
-- `admin-settings` la masque avant de la servir au frontend.
--
-- Clés reconnues (whitelist côté fonction) :
--   ai_provider    : 'xkiro' | 'anthropic'
--   ai_api_key     : clé API du fournisseur IA (sensible, masquée)
--   ai_model       : identifiant du modèle (ex. qwen/qwen3.8-max:free)
--   quota_demo, quota_starter, quota_pro, quota_enterprise : entiers
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fm_sys_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID NULL,
  CONSTRAINT fm_sys_settings_key_not_empty CHECK (char_length(key) > 0)
);

COMMENT ON TABLE public.fm_sys_settings IS
  'Paramètres système du SaaS (fournisseur IA, clé API, modèle, quotas) — modifiables uniquement via la Edge Function admin-settings.';
COMMENT ON COLUMN public.fm_sys_settings.key IS
  'Clé du paramètre (whitelist côté fonction : ai_provider, ai_api_key, ai_model, quota_demo, quota_starter, quota_pro, quota_enterprise).';
COMMENT ON COLUMN public.fm_sys_settings.value IS
  'Valeur du paramètre, en texte (les quotas sont des entiers stockés en texte).';
COMMENT ON COLUMN public.fm_sys_settings.updated_at IS
  'Date de dernière modification.';
COMMENT ON COLUMN public.fm_sys_settings.updated_by IS
  'UUID de l''administrateur auteur de la modification (NULL si écriture système).';

ALTER TABLE public.fm_sys_settings ENABLE ROW LEVEL SECURITY;
-- AUCUNE policy volontairement : accès réservé au service_role
-- dans les Edge Functions (admin-settings, copilot).
