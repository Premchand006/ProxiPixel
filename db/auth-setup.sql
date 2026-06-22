-- db/auth-setup.sql — Phase 3 auth bootstrap.
--
-- Run this in the Supabase SQL editor for a fresh project so sign-in works
-- before the full Phase 4 Drizzle migration. It creates ONLY the profiles
-- table; the signup trigger and RLS already live in db/policies.sql (apply
-- that too). Idempotent and consistent with db/schema.ts — superseded by the
-- Phase 4 migration, which manages all tables.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

-- Next steps (see db/policies.sql):
--   1. handle_new_user() + on_auth_user_created trigger  -> inserts a profile row on signup
--   2. alter table public.profiles enable row level security;
--   3. "own profile read" / "own profile update" policies
