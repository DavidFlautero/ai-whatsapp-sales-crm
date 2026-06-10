create table if not exists agent_governance_events (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  action text not null,
  decision text not null,
  risk_level text default 'low',
  reason text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists conversation_quality_scores (
  id uuid primary key default gen_random_uuid(),
  contact_phone text not null,
  score int default 50,
  clarity int default 50,
  persuasion int default 50,
  empathy int default 50,
  commercial_progress int default 50,
  issue_detected text,
  recommendation text,
  created_at timestamptz default now()
);

create table if not exists product_catalog_items (
  id uuid primary key default gen_random_uuid(),
  sku text,
  name text not null,
  category text,
  color text,
  size text,
  price numeric,
  stock int default 0,
  tags text[] default '{}',
  description text,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_governance_agent on agent_governance_events(agent_name);
create index if not exists idx_quality_phone on conversation_quality_scores(contact_phone);
create index if not exists idx_catalog_name on product_catalog_items(name);
create index if not exists idx_catalog_category on product_catalog_items(category);
