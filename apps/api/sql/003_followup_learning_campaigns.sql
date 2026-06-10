create table if not exists followups (
  id uuid primary key default gen_random_uuid(),
  contact_phone text not null references crm_contacts(phone) on delete cascade,
  status text default 'pending',
  reason text,
  scheduled_for timestamptz,
  generated_message text,
  sent_message text,
  ai_priority int default 50,
  result text default 'waiting',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists learning_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  contact_phone text,
  input text,
  output text,
  score int default 50,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists campaign_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  audience text,
  status text default 'draft',
  total_targets int default 0,
  total_sent int default 0,
  total_replied int default 0,
  created_at timestamptz default now()
);

create index if not exists idx_followups_phone on followups(contact_phone);
create index if not exists idx_learning_phone on learning_events(contact_phone);
