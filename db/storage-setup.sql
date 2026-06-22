-- db/storage-setup.sql — Phase 5 storage bootstrap.
--
-- Creates the PRIVATE 'outputs' bucket used for user-saved results. The
-- per-folder access policies (a user only touches {user_id}/…) already live in
-- db/policies.sql (section 7) — apply that too. Run in the Supabase SQL editor.

insert into storage.buckets (id, name, public)
values ('outputs', 'outputs', false)
on conflict (id) do nothing;

-- Reminder: public share links are signed server-side with the service-role key
-- (SUPABASE_SERVICE_ROLE_KEY), which bypasses RLS for that one signed URL only.
