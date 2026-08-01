-- Quote view/accept/decline audit trail (SPEC.md §3, P2 differentiator: 2nd-open alert).
-- Inserted by the public quote-approval page/route via the service client
-- (anonymous customers have no RLS session), so no INSERT policy is needed —
-- only SELECT is exposed to authenticated org members.
create table if not exists quote_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  quote_id uuid not null references quotes(id) on delete cascade,
  event_type text not null check (event_type in ('viewed', 'accepted', 'declined')),
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists quote_events_quote_id_idx on quote_events (quote_id, created_at desc);
create index if not exists quote_events_org_id_idx on quote_events (org_id, created_at desc);

alter table quote_events enable row level security;

drop policy if exists org_access on quote_events;
create policy org_access on quote_events for select using (org_id = auth_user_org_id());
