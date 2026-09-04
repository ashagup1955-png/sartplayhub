-- PlayHub owner-only administration layer.
-- Run this AFTER a PlayHub owner account has been created in Supabase Auth.
-- Replace the email below with YOUR Supabase Auth email, then run it once.

create table if not exists public.playhub_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.playhub_admins enable row level security;

drop policy if exists "admins can read admin list" on public.playhub_admins;
create policy "admins can read admin list" on public.playhub_admins
for select to authenticated
using (exists (select 1 from public.playhub_admins a where a.user_id = auth.uid()));

-- BOOTSTRAP YOUR OWNER ACCOUNT:
-- Replace the email and run the INSERT below once.
insert into public.playhub_admins (user_id)
select id from auth.users where lower(email) = lower('YOUR_EMAIL_HERE')
on conflict (user_id) do nothing;

-- Owner test helper. The client can call this safely; it only returns true/false.
create or replace function public.is_playhub_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.playhub_admins where user_id = auth.uid());
$$;

grant execute on function public.is_playhub_owner() to anon, authenticated;

-- Static/bundled catalog controls. "deleted" hides a built-in game from the catalog;
-- the actual bundled file remains in the deployment until you remove it from the ZIP.
create table if not exists public.game_catalog_controls (
  game_id text primary key,
  deleted boolean not null default false,
  name text,
  description text,
  category text,
  emoji text,
  tags text,
  updated_at timestamptz not null default now(),
  updated_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  constraint game_catalog_controls_name_len check (name is null or char_length(name) between 1 and 80),
  constraint game_catalog_controls_desc_len check (description is null or char_length(description) between 1 and 500)
);

alter table public.game_catalog_controls enable row level security;

drop policy if exists "catalog controls are readable" on public.game_catalog_controls;
create policy "catalog controls are readable" on public.game_catalog_controls
for select using (true);

drop policy if exists "only owner can insert catalog controls" on public.game_catalog_controls;
create policy "only owner can insert catalog controls" on public.game_catalog_controls
for insert to authenticated
with check (exists (select 1 from public.playhub_admins a where a.user_id = auth.uid()) and updated_by = auth.uid());

drop policy if exists "only owner can update catalog controls" on public.game_catalog_controls;
create policy "only owner can update catalog controls" on public.game_catalog_controls
for update to authenticated
using (exists (select 1 from public.playhub_admins a where a.user_id = auth.uid()))
with check (exists (select 1 from public.playhub_admins a where a.user_id = auth.uid()) and updated_by = auth.uid());

drop policy if exists "only owner can delete catalog controls" on public.game_catalog_controls;
create policy "only owner can delete catalog controls" on public.game_catalog_controls
for delete to authenticated
using (exists (select 1 from public.playhub_admins a where a.user_id = auth.uid()));

-- Harden the game table: only the owner can update/delete ANY game record.
drop policy if exists "owner can update any game" on public.games;
create policy "owner can update any game" on public.games
for update to authenticated
using (exists (select 1 from public.playhub_admins a where a.user_id = auth.uid()))
with check (exists (select 1 from public.playhub_admins a where a.user_id = auth.uid()));

drop policy if exists "owner can delete any game" on public.games;
create policy "owner can delete any game" on public.games
for delete to authenticated
using (exists (select 1 from public.playhub_admins a where a.user_id = auth.uid()));

-- Only the owner can update/delete game files; uploads remain available to authenticated users.
drop policy if exists "owner can update game files" on storage.objects;
create policy "owner can update game files" on storage.objects
for update to authenticated
using (bucket_id = 'game-files' and exists (select 1 from public.playhub_admins a where a.user_id = auth.uid()))
with check (bucket_id = 'game-files' and exists (select 1 from public.playhub_admins a where a.user_id = auth.uid()));

drop policy if exists "owner can delete game files" on storage.objects;
create policy "owner can delete game files" on storage.objects
for delete to authenticated
using (bucket_id = 'game-files' and exists (select 1 from public.playhub_admins a where a.user_id = auth.uid()));
