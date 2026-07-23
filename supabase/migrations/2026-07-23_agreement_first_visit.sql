-- Optional one-off first-visit date for recurring service agreements.
-- Use case: first clean lands on a different weekday (e.g. a Tuesday) while the
-- ongoing schedule follows its own cadence (e.g. every second Thursday).
-- Additive: this date generates one extra job; the anchor_date cadence is unaffected.

ALTER TABLE service_agreements
  ADD COLUMN IF NOT EXISTS first_visit_date date;
