-- Org slug for public intake form URLs (/intake/[orgSlug])
alter table organisations
  add column if not exists slug text unique;

update organisations set slug = 'salt-air-cleaning'
where id = '00000000-0000-0000-0000-000000000001' and slug is null;

-- Track whether a 48hr no-response nudge has already been sent for a quote
alter table quotes
  add column if not exists followup_sent_at timestamptz;
