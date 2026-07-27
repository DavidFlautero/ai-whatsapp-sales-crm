create table if not exists customer_memories (
  id uuid primary key default gen_random_uuid(),
  contact_phone text not null references crm_contacts(phone) on delete cascade,
  key text not null,
  value text not null,
  confidence int default 70,
  source text default 'ai',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(contact_phone, key)
);

create table if not exists lead_scores (
  id uuid primary key default gen_random_uuid(),
  contact_phone text not null references crm_contacts(phone) on delete cascade,
  score int default 50,
  temperature text default 'warm',
  buying_intent text default 'unknown',
  urgency text default 'normal',
  reason text,
  updated_at timestamptz default now(),
  unique(contact_phone)
);

create table if not exists recovery_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'recovery',
  body text not null,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists recovery_events (
  id uuid primary key default gen_random_uuid(),
  contact_phone text not null,
  template_id uuid,
  message text not null,
  status text default 'draft',
  result text default 'pending',
  sent_at timestamptz,
  created_at timestamptz default now()
);

insert into recovery_templates(name,type,body)
values
('Cliente dormido 30 días','inactive_30','Hola {nombre} 👋 ¿cómo estás? Entraron novedades mayoristas esta semana. ¿Querés que te pase catálogo actualizado?'),
('Cliente antiguo VIP','vip_recovery','Hola {nombre}, te escribo porque llegaron modelos nuevos que se están moviendo muchísimo. ¿Querés que te mande opciones antes de que se agoten?'),
('Lead que preguntó y no cerró','cold_lead','Hola {nombre} 👋 Quedó pendiente pasarte opciones. ¿Seguís buscando {producto}? Te puedo mandar modelos y precios mayoristas.')
on conflict do nothing;

create index if not exists idx_customer_memories_phone on customer_memories(contact_phone);
create index if not exists idx_lead_scores_phone on lead_scores(contact_phone);
create index if not exists idx_recovery_events_phone on recovery_events(contact_phone);
