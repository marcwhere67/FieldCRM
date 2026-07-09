-- Security hardening — run in the Supabase Dashboard SQL Editor (plain SQL tab)

-- 1. Gmail OAuth tokens must never be readable from browser clients.
--    RLS stays enabled with NO policies: anon/authenticated get nothing,
--    only the server-side service role can touch this table.
drop policy if exists "org members manage gmail_sync_state" on gmail_sync_state;

-- 2. Job photos: make the bucket private. The app now serves photos through
--    the authenticated signed-URL gateway at /api/storage/job-photos/*.
update storage.buckets set public = false where id = 'job-photos';
