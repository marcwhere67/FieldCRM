-- Add deposit fields to quotes
alter table quotes
  add column if not exists deposit_type text not null default 'none' check (deposit_type in ('none', 'percentage', 'fixed')),
  add column if not exists deposit_value numeric(10,2) not null default 0,
  add column if not exists deposit_amount numeric(10,2) not null default 0;

-- Add invoice type + deposit credit to invoices
alter table invoices
  add column if not exists invoice_type text not null default 'standard' check (invoice_type in ('standard', 'deposit', 'final')),
  add column if not exists deposit_credit numeric(10,2) not null default 0,
  add column if not exists quote_id uuid references quotes(id) on delete set null,
  add column if not exists stripe_payment_link text,
  add column if not exists notes text;
