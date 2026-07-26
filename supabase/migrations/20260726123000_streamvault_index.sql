-- StreamVault public index schema.
-- AO and Arweave remain the source of truth. These tables are a searchable mirror
-- for SDK/profile/track lookup.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id text unique not null,
  wallet_address text,
  handle text,
  handle_normalized text,
  display_name text,
  bio text,
  avatar_url text,
  banner_url text,
  source text not null default 'streamvault',
  raw jsonb,
  indexed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_handle_normalized_idx
  on public.profiles (handle_normalized)
  where handle_normalized is not null;

create index if not exists profiles_wallet_address_idx
  on public.profiles (wallet_address);

create index if not exists profiles_display_name_search_idx
  on public.profiles
  using gin (to_tsvector('simple', coalesce(display_name, '')));

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  audio_tx_id text unique not null,
  asset_id text,
  profile_id text,
  owner_wallet text,
  title text,
  artist text,
  artwork_url text,
  stream_url text,
  stream_urls jsonb,
  is_atomic boolean not null default false,
  is_permanent boolean not null default true,
  source text not null default 'streamvault',
  raw jsonb,
  created_at timestamptz,
  indexed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tracks_profile_id_idx
  on public.tracks (profile_id);

create index if not exists tracks_owner_wallet_idx
  on public.tracks (owner_wallet);

create index if not exists tracks_asset_id_idx
  on public.tracks (asset_id);

create index if not exists tracks_title_artist_search_idx
  on public.tracks
  using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(artist, '')));

create table if not exists public.profile_assets (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null,
  asset_id text not null,
  audio_tx_id text,
  type text,
  raw jsonb,
  indexed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, asset_id)
);

create index if not exists profile_assets_profile_id_idx
  on public.profile_assets (profile_id);

create index if not exists profile_assets_asset_id_idx
  on public.profile_assets (asset_id);

create table if not exists public.indexer_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null,
  cursor_value text,
  profiles_upserted integer not null default 0,
  tracks_upserted integer not null default 0,
  error text
);

alter table public.profiles enable row level security;
alter table public.tracks enable row level security;
alter table public.profile_assets enable row level security;
alter table public.indexer_runs enable row level security;

drop policy if exists "profiles are publicly readable" on public.profiles;
create policy "profiles are publicly readable"
on public.profiles for select
using (true);

drop policy if exists "tracks are publicly readable" on public.tracks;
create policy "tracks are publicly readable"
on public.tracks for select
using (true);

drop policy if exists "profile assets are publicly readable" on public.profile_assets;
create policy "profile assets are publicly readable"
on public.profile_assets for select
using (true);

drop trigger if exists profiles_set_updated_at on public.profiles;
drop trigger if exists tracks_set_updated_at on public.tracks;
drop trigger if exists profile_assets_set_updated_at on public.profile_assets;

create or replace function public.set_current_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_current_updated_at();

create trigger tracks_set_updated_at
before update on public.tracks
for each row execute function public.set_current_updated_at();

create trigger profile_assets_set_updated_at
before update on public.profile_assets
for each row execute function public.set_current_updated_at();

