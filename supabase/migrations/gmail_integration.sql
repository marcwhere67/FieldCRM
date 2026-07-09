-- Gmail integration: sync state (OAuth tokens) + synced emails + contact links
-- Run in the Supabase Dashboard SQL Editor (plain SQL tab)

create table if not exists gmail_sync_state (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  sync_status text default 'idle', -- idle | syncing | error
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id, user_id)
);

create table if not exists emails (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  gmail_id text not null,
  thread_id text,
  from_email text not null,
  from_name text,
  to_email text not null,
  subject text,
  body text,
  html_body text,
  received_at timestamptz,
  is_read boolean default false,
  labels text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id, gmail_id)
);

create table if not exists email_contacts (
  id uuid primary key default gen_random_uuid(),
  email_id uuid not null references emails(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  created_at timestamptz default now(),
  unique(email_id, contact_id)
);

create index if not exists idx_emails_org_id on emails(org_id);
create index if not exists idx_emails_from_email on emails(from_email);
create index if not exists idx_emails_received_at on emails(received_at desc);
create index if not exists idx_gmail_sync_state_org on gmail_sync_state(org_id);

-- updated_at triggers (reuses existing helper)
drop trigger if exists gmail_sync_state_updated_at on gmail_sync_state;
create trigger gmail_sync_state_updated_at before update on gmail_sync_state
  for each row execute function update_updated_at();

drop trigger if exists emails_updated_at on emails;
create trigger emails_updated_at before update on emails
  for each row execute function update_updated_at();

-- RLS (org-scoped, reuses existing helper)
alter table gmail_sync_state enable row level security;
alter table emails enable row level security;
alter table email_contacts enable row level security;

-- gmail_sync_state deliberately has NO client-facing policies: it stores OAuth
-- tokens, so with RLS enabled only the service role (server-side) can access it.
drop policy if exists "org members manage gmail_sync_state" on gmail_sync_state;

drop policy if exists "org members manage emails" on emails;
create policy "org members manage emails" on emails
  for all using (org_id = auth_user_org_id()) with check (org_id = auth_user_org_id());

drop policy if exists "org members manage email_contacts" on email_contacts;
create policy "org members manage email_contacts" on email_contacts
  for all using (
    exists (select 1 from emails e where e.id = email_id and e.org_id = auth_user_org_id())
  ) with check (
    exists (select 1 from emails e where e.id = email_id and e.org_id = auth_user_org_id())
  );
