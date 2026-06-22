-- db/policies.sql — Row Level Security. Apply AFTER tables exist.
-- Run in the Supabase SQL editor (or as a migration). Without these, the anon key
-- can read/write everything. RLS is the security boundary — do not skip it.

-- 1) Auto-create a profile when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) Enable RLS.
alter table public.profiles enable row level security;
alter table public.jobs     enable row level security;
alter table public.presets  enable row level security;
alter table public.shares   enable row level security;

-- 3) Profiles: a user sees and edits only their own.
create policy "own profile read"   on public.profiles for select using (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- 4) Jobs: full CRUD scoped to the owner.
create policy "jobs read"   on public.jobs for select using (auth.uid() = user_id);
create policy "jobs insert" on public.jobs for insert with check (auth.uid() = user_id);
create policy "jobs update" on public.jobs for update using (auth.uid() = user_id);
create policy "jobs delete" on public.jobs for delete using (auth.uid() = user_id);

-- 5) Presets: same pattern.
create policy "presets read"   on public.presets for select using (auth.uid() = user_id);
create policy "presets insert" on public.presets for insert with check (auth.uid() = user_id);
create policy "presets update" on public.presets for update using (auth.uid() = user_id);
create policy "presets delete" on public.presets for delete using (auth.uid() = user_id);

-- 6) Shares: owner manages; anyone may read an unexpired share by slug.
create policy "shares owner all" on public.shares for all
  using (exists (select 1 from public.jobs j where j.id = shares.job_id and j.user_id = auth.uid()))
  with check (exists (select 1 from public.jobs j where j.id = shares.job_id and j.user_id = auth.uid()));
create policy "shares public read" on public.shares for select
  using (expires_at is null or expires_at > now());

-- 7) Storage: create a PRIVATE bucket 'outputs' in the dashboard, then restrict access
--    so users only touch their own folder (path convention: {user_id}/{job_id}.{ext}).
create policy "outputs read own" on storage.objects for select
  using (bucket_id = 'outputs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "outputs write own" on storage.objects for insert
  with check (bucket_id = 'outputs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "outputs delete own" on storage.objects for delete
  using (bucket_id = 'outputs' and (storage.foldername(name))[1] = auth.uid()::text);
