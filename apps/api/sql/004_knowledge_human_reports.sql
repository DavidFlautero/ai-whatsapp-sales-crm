create table if not exists knowledge_items (
  id uuid primary key default gen_random_uuid(),
  type text default 'catalog',
  title text not null,
  content text not null,
  tags text[] default '{}',
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists operator_assignments (
  id uuid primary key default gen_random_uuid(),
  contact_phone text not null,
  status text default 'ai',
  assigned_to text,
  reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(contact_phone)
);

create table if not exists report_exports (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  status text default 'generated',
  file_name text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_knowledge_type on knowledge_items(type);
create index if not exists idx_operator_phone on operator_assignments(contact_phone);
