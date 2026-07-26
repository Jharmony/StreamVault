-- Grants for StreamVault index API access through Supabase/PostgREST.
-- Public SDK clients can read public profile/music index tables.
-- Backend/indexer code uses the service role for writes and internal run logs.

grant usage on schema public to anon, authenticated, service_role;

grant select on public.profiles to anon, authenticated;
grant select on public.tracks to anon, authenticated;
grant select on public.profile_assets to anon, authenticated;

grant all on public.profiles to service_role;
grant all on public.tracks to service_role;
grant all on public.profile_assets to service_role;
grant all on public.indexer_runs to service_role;

grant usage, select on all sequences in schema public to service_role;

