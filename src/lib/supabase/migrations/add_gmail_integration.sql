-- Gmail sync state (stores OAuth tokens and sync metadata)
create table if not exists gmail_sync_state (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  sync_status text default 'idle', -- idle, syncing, error
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id, user_id)
);

-- Emails synced from Gmail
create table if not exists emails (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
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
  labels text[], -- Gmail labels as array
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(org_id, gmail_id)
);

-- Link emails to contacts
create table if not exists email_contacts (
  id uuid primary key default gen_random_uuid(),
  email_id uuid not null references emails(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  created_at timestamptz default now(),
  unique(email_id, contact_id)
);

create index if not exists idx_emails_org_id on emails(org_id);
create index if not exists idx_emails_from_email on emails(from_email);
create index if not exists idx_emails_to_email on emails(to_email);
create index if not exists idx_emails_received_at on emails(received_at desc);
create index if not exists idx_gmail_sync_state_org on gmail_sync_state(org_id);
