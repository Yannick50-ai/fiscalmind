-- ============================================================================
-- FiscalMind Africa — schéma SaaS 100 % cloud (à exécuter dans le dashboard
-- Supabase, SQL Editor, par Yannick). Rien n'est stocké en local côté app :
-- écritures, journaux, historique copilote et préférences vivent ici.
--
-- Idempotent : réexécutable sans doublon (CREATE TABLE IF NOT EXISTS).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Écritures du journal (format canonique du moteur :
--    { id, date, journal, piece, libelle, lignes: [...] })
-- ----------------------------------------------------------------------------
create table if not exists public.fm_entries (
  user_id  uuid not null references auth.users(id) on delete cascade,
  entry_id text not null,
  entry    jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, entry_id)
);

-- ----------------------------------------------------------------------------
-- 2. Journaux personnalisés (les codes par défaut sont constants côté app)
-- ----------------------------------------------------------------------------
create table if not exists public.fm_journals (
  user_id uuid not null references auth.users(id) on delete cascade,
  code    text not null,
  label   text not null,
  created_at timestamptz not null default now(),
  unique (user_id, code)
);

-- ----------------------------------------------------------------------------
-- 3. Historique copilote (une ligne par utilisateur, 100 messages max
--    gérés côté app : [{ role: 'user'|'assistant', text, ts }])
-- ----------------------------------------------------------------------------
create table if not exists public.fm_chat (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. Préférences (entreprise, pays, période, exercice…)
-- ----------------------------------------------------------------------------
create table if not exists public.fm_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  key     text not null,
  value   jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- ----------------------------------------------------------------------------
-- updated_at : dernier écrit gagne (conflit simple)
-- ----------------------------------------------------------------------------
create or replace function public.fm_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists fm_entries_touch on public.fm_entries;
create trigger fm_entries_touch
  before update on public.fm_entries
  for each row execute function public.fm_touch_updated_at();

drop trigger if exists fm_chat_touch on public.fm_chat;
create trigger fm_chat_touch
  before update on public.fm_chat
  for each row execute function public.fm_touch_updated_at();

drop trigger if exists fm_settings_touch on public.fm_settings;
create trigger fm_settings_touch
  before update on public.fm_settings
  for each row execute function public.fm_touch_updated_at();

-- ----------------------------------------------------------------------------
-- RLS : chaque utilisateur ne voit/modifie que ses propres lignes
-- ----------------------------------------------------------------------------
alter table public.fm_entries  enable row level security;
alter table public.fm_journals enable row level security;
alter table public.fm_chat     enable row level security;
alter table public.fm_settings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'fm_own_entries') then
    create policy fm_own_entries on public.fm_entries
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'fm_own_journals') then
    create policy fm_own_journals on public.fm_journals
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'fm_own_chat') then
    create policy fm_own_chat on public.fm_chat
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'fm_own_settings') then
    create policy fm_own_settings on public.fm_settings
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
