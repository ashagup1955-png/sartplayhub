-- PlayHub Supabase schema
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_emoji text default '🎮',
  created_at timestamptz not null default now()
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null check (char_length(description) between 1 and 500),
  category text not null,
  emoji text default '🎮',
  tags text default '',
  storage_path text not null unique,
  file_size bigint not null check (file_size > 0 and file_size <= 8388608),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.games enable row level security;

drop policy if exists "profiles are readable by everyone" on profiles;
create policy "profiles are readable by everyone" on public.profiles for select using (true);
drop policy if exists "users create own profile" on profiles;
create policy "users create own profile" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "users update own profile" on profiles;
create policy "users update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "published games are readable" on games;
create policy "published games are readable" on public.games for select using (true);
drop policy if exists "users create own games" on games;
create policy "users create own games" on public.games for insert with check (auth.uid() = owner_id);
drop policy if exists "owner can update any game" on games;
create policy "owner can update any game" on public.games for update to authenticated
using ((auth.jwt()->'app_metadata'->>'role') = 'owner')
with check ((auth.jwt()->'app_metadata'->>'role') = 'owner');
drop policy if exists "owner can delete any game" on games;
create policy "owner can delete any game" on public.games for delete to authenticated
using ((auth.jwt()->'app_metadata'->>'role') = 'owner');

create table if not exists public.game_name_overrides (
  game_id text primary key,
  name text not null check (char_length(name) between 1 and 80),
  updated_at timestamptz not null default now()
);

alter table public.game_name_overrides enable row level security;
drop policy if exists "game names are readable" on public.game_name_overrides;
drop policy if exists "owner can create game names" on public.game_name_overrides;
drop policy if exists "owner can rename games" on public.game_name_overrides;
drop policy if exists "owner can clear game names" on public.game_name_overrides;
create policy "game names are readable" on public.game_name_overrides for select using (true);
create policy "owner can create game names" on public.game_name_overrides for insert to authenticated
with check ((auth.jwt()->'app_metadata'->>'role') = 'owner');
create policy "owner can rename games" on public.game_name_overrides for update to authenticated
using ((auth.jwt()->'app_metadata'->>'role') = 'owner')
with check ((auth.jwt()->'app_metadata'->>'role') = 'owner');
create policy "owner can clear game names" on public.game_name_overrides for delete to authenticated
using ((auth.jwt()->'app_metadata'->>'role') = 'owner');

insert into storage.buckets (id, name, public) values ('game-files', 'game-files', true) on conflict (id) do nothing;

drop policy if exists "game files are publicly readable" on storage.objects;
create policy "game files are publicly readable" on storage.objects for select using (bucket_id = 'game-files');
drop policy if exists "users upload to own folder" on storage.objects;
create policy "users upload to own folder" on storage.objects for insert to authenticated with check (bucket_id = 'game-files' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "owner can update game files" on storage.objects;
create policy "owner can update game files" on storage.objects for update to authenticated using (bucket_id = 'game-files' and (auth.jwt()->'app_metadata'->>'role') = 'owner') with check (bucket_id = 'game-files' and (auth.jwt()->'app_metadata'->>'role') = 'owner');
drop policy if exists "owner can delete game files" on storage.objects;
create policy "owner can delete game files" on storage.objects for delete to authenticated using (bucket_id = 'game-files' and (auth.jwt()->'app_metadata'->>'role') = 'owner');

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();


-- Owner activity logging
create table if not exists public.activity_logs (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  display_name text,
  event_type text not null check (event_type in ('sign_in','upload','play')),
  game_id text,
  game_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_logs_created_at_idx on public.activity_logs(created_at desc);
create index if not exists activity_logs_user_id_idx on public.activity_logs(user_id);
alter table public.activity_logs enable row level security;
drop policy if exists "users can create own activity logs" on public.activity_logs;
drop policy if exists "owner can read activity logs" on public.activity_logs;
create policy "users can create own activity logs" on public.activity_logs for insert to authenticated with check (auth.uid() = user_id);
create policy "owner can read activity logs" on public.activity_logs for select to authenticated using ((auth.jwt()->'app_metadata'->>'role') = 'owner');
create or replace function public.activity_log_identity()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  new.user_id := auth.uid();
  new.user_email := coalesce(new.user_email,(select email from auth.users where id=auth.uid()));
  new.display_name := coalesce(new.display_name,(select display_name from public.profiles where id=auth.uid()));
  return new;
end; $$;
drop trigger if exists activity_log_identity_trigger on public.activity_logs;
create trigger activity_log_identity_trigger before insert on public.activity_logs for each row execute procedure public.activity_log_identity();
alter table public.activity_logs replica identity full;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='activity_logs') then
    alter publication supabase_realtime add table public.activity_logs;
  end if;
end $$;
