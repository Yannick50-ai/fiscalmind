-- FiscalMind Africa — phase 8 : modules Classeur, Audit, Amortissements, Assurances.
-- Projet : eetmaaopaatbbwhwbdcx — À exécuter dans : Dashboard → SQL Editor → New query → Run.
-- Idempotent : `if not exists` / `drop policy if exists` partout (réexécutable sans risque).
-- RLS : chaque utilisateur ne voit que SES données (auth.uid() = user_id).

-- 1) Audit Readiness — une ligne par utilisateur : items [{id, group, title, priority, note, done}]
create table if not exists public.fm_audit (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.fm_audit enable row level security;
drop policy if exists "Users manage own audit" on public.fm_audit;
create policy "Users manage own audit" on public.fm_audit
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) Amortissements — une ligne par immobilisation : immo {id, designation, compte,
--    compteAmort, valeur, duree, dateMiseEnService, booked:[annees]}
create table if not exists public.fm_immos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  immo_id text not null,
  immo jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, immo_id)
);
create index if not exists fm_immos_user_id_idx on public.fm_immos(user_id);
alter table public.fm_immos enable row level security;
drop policy if exists "Users manage own immos" on public.fm_immos;
create policy "Users manage own immos" on public.fm_immos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3) Assurances — une ligne par police : assurance {id, assureur, numero, type, bien,
--    prime, dateSouscription, dateExpiration, primes:[annees], sinistres:[{id, date, statut, description, reclame, indemnise}]}
create table if not exists public.fm_assurances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assurance_id text not null,
  assurance jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, assurance_id)
);
create index if not exists fm_assurances_user_id_idx on public.fm_assurances(user_id);
alter table public.fm_assurances enable row level security;
drop policy if exists "Users manage own assurances" on public.fm_assurances;
create policy "Users manage own assurances" on public.fm_assurances
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Convertisseur : taux de référence modifiables -> fm_settings (clé 'fx_rates'), aucune table.
-- Configuration : fm_settings (clés 'company', 'company_ifu', 'company_regime',
-- 'country', 'tax_overrides'), aucune table.
-- Classeur : écritures -> fm_entries (existante) ; justificatifs -> R2 + table `documents` (existante).
