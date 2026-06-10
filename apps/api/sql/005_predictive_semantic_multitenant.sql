create table if not exists predictive_scores (
  id uuid primary key default gen_random_uuid(),
  contact_phone text not null,
  purchase_probability int default 50,
  estimated_value numeric default 0,
  next_purchase_window text,
  churn_risk text default 'medium',
  semantic_intent text,
  semantic_summary text,
  updated_at timestamptz default now(),
  unique(contact_phone)
);

create table if not exists semantic_events (
  id uuid primary key default gen_random_uuid(),
  contact_phone text not null,
  event_type text,
  semantic_label text,
  semantic_value text,
  confidence int default 70,
  created_at timestamptz default now()
);

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text default 'starter',
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists tenant_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  key text not null,
  value text,
  created_at timestamptz default now(),
  unique(tenant_id,key)
);

create index if not exists idx_predictive_phone on predictive_scores(contact_phone);
create index if not exists idx_semantic_phone on semantic_events(contact_phone);
