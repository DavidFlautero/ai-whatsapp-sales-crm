begin;

-- ============================================================
-- EVENTOS MEDITERRÁNEO · CRM OPERATIVO
--
-- Cliente existente:
--   public.commerce_customers
--
-- Flujo:
-- Cliente -> Evento -> Necesidades -> Proveedores
-- -> Presupuesto -> Venta -> Coordinación -> Liquidación
-- ============================================================


-- ============================================================
-- UTILIDAD updated_at
-- ============================================================

create or replace function public.crm_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- ============================================================
-- CONFIGURACIÓN CRM POR EMPRESA
-- ============================================================

create table if not exists public.crm_company_settings (
  company_id text primary key
    references public.commerce_companies(id)
    on delete cascade,

  currency text not null default 'EUR',

  -- Tope recomendado para todas las comisiones
  -- repartidas sobre el margen de un evento.
  commission_pool_limit_percent numeric(5,2)
    not null default 35.00
    check (
      commission_pool_limit_percent >= 0
      and commission_pool_limit_percent <= 100
    ),

  require_admin_quote_approval boolean
    not null default false,

  allow_seller_view_costs boolean
    not null default false,

  allow_seller_view_margin boolean
    not null default false,

  metadata jsonb
    not null default '{}'::jsonb,

  created_at timestamptz
    not null default now(),

  updated_at timestamptz
    not null default now()
);


-- ============================================================
-- EQUIPO
--
-- access_role define qué puede ver en el sistema.
-- Las funciones en un evento se asignan aparte:
-- captación, cierre, coordinación, presencial.
-- ============================================================

create table if not exists public.crm_team_members (
  id uuid primary key
    default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  -- ID del usuario del sistema actual.
  -- Es TEXT porque AUTH_USERS_JSON usa IDs de aplicación.
  auth_user_id text,

  name text not null,
  email text,
  phone text,

  access_role text not null default 'seller'
    check (
      access_role in (
        'admin',
        'seller'
      )
    ),

  active boolean
    not null default true,

  metadata jsonb
    not null default '{}'::jsonb,

  created_at timestamptz
    not null default now(),

  updated_at timestamptz
    not null default now(),

  unique(company_id, auth_user_id)
);

create index if not exists
  crm_team_members_company_idx
on public.crm_team_members(
  company_id,
  active
);


-- ============================================================
-- CATEGORÍAS DE SERVICIO
--
-- Chalet, catering, DJ, sonido, iluminación, etc.
-- ============================================================

create table if not exists public.crm_service_categories (
  id uuid primary key
    default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  code text not null,
  name text not null,

  description text,
  icon text,

  active boolean
    not null default true,

  sort_order integer
    not null default 0,

  metadata jsonb
    not null default '{}'::jsonb,

  created_at timestamptz
    not null default now(),

  updated_at timestamptz
    not null default now(),

  unique(company_id, code)
);

create index if not exists
  crm_service_categories_company_idx
on public.crm_service_categories(
  company_id,
  active,
  sort_order
);


-- ============================================================
-- PROVEEDORES
-- ============================================================

create table if not exists public.crm_providers (
  id uuid primary key
    default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  name text not null,
  legal_name text,

  contact_name text,
  phone text,
  whatsapp text,
  email text,
  website text,

  tax_id text,

  province text,
  city text,
  address text,

  service_area text,

  status text not null default 'active'
    check (
      status in (
        'active',
        'inactive',
        'blocked'
      )
    ),

  -- Métricas para ranking/recomendaciones IA.
  internal_rating numeric(3,2)
    check (
      internal_rating is null
      or (
        internal_rating >= 0
        and internal_rating <= 5
      )
    ),

  times_used integer
    not null default 0
    check (times_used >= 0),

  incident_count integer
    not null default 0
    check (incident_count >= 0),

  average_response_minutes integer
    check (
      average_response_minutes is null
      or average_response_minutes >= 0
    ),

  notes text,

  metadata jsonb
    not null default '{}'::jsonb,

  created_at timestamptz
    not null default now(),

  updated_at timestamptz
    not null default now()
);

create index if not exists
  crm_providers_company_status_idx
on public.crm_providers(
  company_id,
  status
);

create index if not exists
  crm_providers_company_city_idx
on public.crm_providers(
  company_id,
  city
);


-- ============================================================
-- SERVICIOS OFRECIDOS POR CADA PROVEEDOR
-- ============================================================

create table if not exists public.crm_provider_services (
  id uuid primary key
    default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  provider_id uuid not null
    references public.crm_providers(id)
    on delete cascade,

  category_id uuid not null
    references public.crm_service_categories(id)
    on delete restrict,

  name text not null,
  description text,

  pricing_model text
    not null default 'quote'
    check (
      pricing_model in (
        'fixed',
        'per_person',
        'per_hour',
        'from',
        'quote'
      )
    ),

  currency text
    not null default 'EUR',

  cost_from numeric(14,2)
    check (
      cost_from is null
      or cost_from >= 0
    ),

  cost_to numeric(14,2)
    check (
      cost_to is null
      or cost_to >= 0
    ),

  suggested_client_price numeric(14,2)
    check (
      suggested_client_price is null
      or suggested_client_price >= 0
    ),

  capacity_min integer
    check (
      capacity_min is null
      or capacity_min >= 0
    ),

  capacity_max integer
    check (
      capacity_max is null
      or capacity_max >= 0
    ),

  lead_time_days integer
    check (
      lead_time_days is null
      or lead_time_days >= 0
    ),

  active boolean
    not null default true,

  metadata jsonb
    not null default '{}'::jsonb,

  created_at timestamptz
    not null default now(),

  updated_at timestamptz
    not null default now()
);

create index if not exists
  crm_provider_services_category_idx
on public.crm_provider_services(
  company_id,
  category_id,
  active
);

create index if not exists
  crm_provider_services_provider_idx
on public.crm_provider_services(
  provider_id,
  active
);


-- ============================================================
-- EVENTOS / OPORTUNIDADES
--
-- Esta es la entidad central del CRM.
-- ============================================================

create table if not exists public.crm_events (
  id uuid primary key
    default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  customer_id uuid not null
    references public.commerce_customers(id)
    on delete restrict,

  title text not null,

  event_type text
    not null default 'other',

  status text
    not null default 'lead'
    check (
      status in (
        'lead',
        'qualifying',
        'sourcing',
        'quote_draft',
        'quote_sent',
        'negotiation',
        'confirmed',
        'planning',
        'ready',
        'completed',
        'lost',
        'cancelled'
      )
    ),

  source_channel text,
  source_detail text,

  event_date date,
  start_time time,
  end_time time,

  guest_count integer
    check (
      guest_count is null
      or guest_count > 0
    ),

  province text,
  city text,
  venue_name text,
  venue_address text,

  target_budget numeric(14,2)
    check (
      target_budget is null
      or target_budget >= 0
    ),

  currency text
    not null default 'EUR',

  -- Mensaje inicial pegado desde WhatsApp,
  -- Instagram, teléfono, etc.
  customer_request text,

  -- Resultado estructurado de IA.
  ai_extraction jsonb
    not null default '{}'::jsonb,

  next_action text,
  next_action_at timestamptz,

  lost_reason text,

  drive_folder_url text,

  -- Resumen financiero confirmado.
  final_client_price numeric(14,2)
    not null default 0
    check (final_client_price >= 0),

  final_provider_cost numeric(14,2)
    not null default 0
    check (final_provider_cost >= 0),

  direct_expenses numeric(14,2)
    not null default 0
    check (direct_expenses >= 0),

  gross_margin numeric(14,2)
    generated always as (
      final_client_price
      - final_provider_cost
      - direct_expenses
    ) stored,

  notes text,

  metadata jsonb
    not null default '{}'::jsonb,

  created_by_team_member_id uuid
    references public.crm_team_members(id)
    on delete set null,

  created_at timestamptz
    not null default now(),

  updated_at timestamptz
    not null default now()
);

create index if not exists
  crm_events_company_status_idx
on public.crm_events(
  company_id,
  status,
  event_date
);

create index if not exists
  crm_events_customer_idx
on public.crm_events(
  company_id,
  customer_id,
  created_at desc
);

create index if not exists
  crm_events_next_action_idx
on public.crm_events(
  company_id,
  next_action_at
)
where
  next_action_at is not null;


-- ============================================================
-- NECESIDADES DEL EVENTO
--
-- Chalet, catering, DJ, coche, etc.
-- ============================================================

create table if not exists public.crm_event_requirements (
  id uuid primary key
    default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  event_id uuid not null
    references public.crm_events(id)
    on delete cascade,

  category_id uuid not null
    references public.crm_service_categories(id)
    on delete restrict,

  status text
    not null default 'needed'
    check (
      status in (
        'needed',
        'sourcing',
        'selected',
        'not_needed'
      )
    ),

  priority integer
    not null default 50
    check (
      priority >= 0
      and priority <= 100
    ),

  quantity numeric(12,2)
    not null default 1
    check (quantity > 0),

  budget_cap numeric(14,2)
    check (
      budget_cap is null
      or budget_cap >= 0
    ),

  requirement_text text,

  selected_provider_service_id uuid
    references public.crm_provider_services(id)
    on delete set null,

  metadata jsonb
    not null default '{}'::jsonb,

  created_at timestamptz
    not null default now(),

  updated_at timestamptz
    not null default now(),

  unique(event_id, category_id)
);

create index if not exists
  crm_event_requirements_event_idx
on public.crm_event_requirements(
  event_id,
  status
);


-- ============================================================
-- PRESUPUESTOS
-- ============================================================

create table if not exists public.crm_quotes (
  id uuid primary key
    default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  event_id uuid not null
    references public.crm_events(id)
    on delete cascade,

  customer_id uuid not null
    references public.commerce_customers(id)
    on delete restrict,

  version integer
    not null default 1
    check (version > 0),

  status text
    not null default 'draft'
    check (
      status in (
        'draft',
        'pending_approval',
        'sent',
        'viewed',
        'negotiation',
        'accepted',
        'rejected',
        'expired',
        'cancelled'
      )
    ),

  currency text
    not null default 'EUR',

  valid_until date,

  subtotal_price numeric(14,2)
    not null default 0
    check (subtotal_price >= 0),

  provider_cost_total numeric(14,2)
    not null default 0
    check (provider_cost_total >= 0),

  discount_amount numeric(14,2)
    not null default 0
    check (discount_amount >= 0),

  direct_expenses numeric(14,2)
    not null default 0
    check (direct_expenses >= 0),

  final_price numeric(14,2)
    generated always as (
      greatest(
        subtotal_price - discount_amount,
        0
      )
    ) stored,

  commissionable_margin numeric(14,2)
    generated always as (
      greatest(
        subtotal_price
        - discount_amount
        - provider_cost_total
        - direct_expenses,
        0
      )
    ) stored,

  public_notes text,
  internal_notes text,
  terms text,

  created_by_team_member_id uuid
    references public.crm_team_members(id)
    on delete set null,

  approved_by_team_member_id uuid
    references public.crm_team_members(id)
    on delete set null,

  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,

  metadata jsonb
    not null default '{}'::jsonb,

  created_at timestamptz
    not null default now(),

  updated_at timestamptz
    not null default now(),

  unique(event_id, version)
);

create index if not exists
  crm_quotes_event_status_idx
on public.crm_quotes(
  event_id,
  status,
  version desc
);


-- ============================================================
-- LÍNEAS DEL PRESUPUESTO
-- ============================================================

create table if not exists public.crm_quote_items (
  id uuid primary key
    default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  quote_id uuid not null
    references public.crm_quotes(id)
    on delete cascade,

  category_id uuid
    references public.crm_service_categories(id)
    on delete set null,

  provider_id uuid
    references public.crm_providers(id)
    on delete set null,

  provider_service_id uuid
    references public.crm_provider_services(id)
    on delete set null,

  description text not null,

  quantity numeric(12,2)
    not null default 1
    check (quantity > 0),

  unit_cost numeric(14,2)
    not null default 0
    check (unit_cost >= 0),

  unit_price numeric(14,2)
    not null default 0
    check (unit_price >= 0),

  line_cost numeric(14,2)
    generated always as (
      quantity * unit_cost
    ) stored,

  line_price numeric(14,2)
    generated always as (
      quantity * unit_price
    ) stored,

  sort_order integer
    not null default 0,

  metadata jsonb
    not null default '{}'::jsonb,

  created_at timestamptz
    not null default now(),

  updated_at timestamptz
    not null default now()
);

create index if not exists
  crm_quote_items_quote_idx
on public.crm_quote_items(
  quote_id,
  sort_order
);


-- ============================================================
-- RESPONSABILIDADES DEL EVENTO
--
-- Una persona puede captar, otra cerrar,
-- otra coordinar y otra estar presencialmente.
-- ============================================================

create table if not exists public.crm_event_assignments (
  id uuid primary key
    default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  event_id uuid not null
    references public.crm_events(id)
    on delete cascade,

  team_member_id uuid not null
    references public.crm_team_members(id)
    on delete restrict,

  participation_type text not null
    check (
      participation_type in (
        'capture',
        'closing',
        'coordination',
        'onsite',
        'administration'
      )
    ),

  status text
    not null default 'assigned'
    check (
      status in (
        'assigned',
        'accepted',
        'completed',
        'cancelled'
      )
    ),

  notes text,

  assigned_at timestamptz
    not null default now(),

  completed_at timestamptz,

  metadata jsonb
    not null default '{}'::jsonb,

  unique(
    event_id,
    team_member_id,
    participation_type
  )
);

create index if not exists
  crm_event_assignments_event_idx
on public.crm_event_assignments(
  event_id,
  participation_type
);


-- ============================================================
-- REGLAS DE COMISIÓN
--
-- Ejemplos:
-- Captación      5% margen
-- Cierre        15% margen
-- Coordinación  10% margen
-- Presencial     fijo o porcentaje
-- ============================================================

create table if not exists public.crm_commission_rules (
  id uuid primary key
    default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  name text not null,

  participation_type text not null
    check (
      participation_type in (
        'capture',
        'closing',
        'coordination',
        'onsite',
        'administration'
      )
    ),

  calculation_type text not null
    check (
      calculation_type in (
        'percent_margin',
        'fixed_amount'
      )
    ),

  percent_value numeric(5,2)
    check (
      percent_value is null
      or (
        percent_value >= 0
        and percent_value <= 100
      )
    ),

  fixed_amount numeric(14,2)
    check (
      fixed_amount is null
      or fixed_amount >= 0
    ),

  max_amount numeric(14,2)
    check (
      max_amount is null
      or max_amount >= 0
    ),

  active boolean
    not null default true,

  priority integer
    not null default 100,

  effective_from date,
  effective_until date,

  metadata jsonb
    not null default '{}'::jsonb,

  created_at timestamptz
    not null default now(),

  updated_at timestamptz
    not null default now(),

  constraint crm_commission_rules_value_check
  check (
    (
      calculation_type = 'percent_margin'
      and percent_value is not null
    )
    or
    (
      calculation_type = 'fixed_amount'
      and fixed_amount is not null
    )
  )
);

create index if not exists
  crm_commission_rules_company_idx
on public.crm_commission_rules(
  company_id,
  participation_type,
  active
);


-- ============================================================
-- COMISIONES GENERADAS POR EVENTO
-- ============================================================

create table if not exists public.crm_event_commissions (
  id uuid primary key
    default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  event_id uuid not null
    references public.crm_events(id)
    on delete cascade,

  quote_id uuid
    references public.crm_quotes(id)
    on delete set null,

  team_member_id uuid not null
    references public.crm_team_members(id)
    on delete restrict,

  assignment_id uuid
    references public.crm_event_assignments(id)
    on delete set null,

  rule_id uuid
    references public.crm_commission_rules(id)
    on delete set null,

  participation_type text not null
    check (
      participation_type in (
        'capture',
        'closing',
        'coordination',
        'onsite',
        'administration'
      )
    ),

  margin_base numeric(14,2)
    not null default 0
    check (margin_base >= 0),

  percent_value numeric(5,2)
    check (
      percent_value is null
      or (
        percent_value >= 0
        and percent_value <= 100
      )
    ),

  fixed_amount numeric(14,2)
    check (
      fixed_amount is null
      or fixed_amount >= 0
    ),

  commission_amount numeric(14,2)
    not null default 0
    check (commission_amount >= 0),

  status text
    not null default 'estimated'
    check (
      status in (
        'estimated',
        'locked',
        'payable',
        'paid',
        'cancelled'
      )
    ),

  payable_at timestamptz,
  paid_at timestamptz,

  notes text,

  metadata jsonb
    not null default '{}'::jsonb,

  created_at timestamptz
    not null default now(),

  updated_at timestamptz
    not null default now(),

  unique(
    event_id,
    team_member_id,
    participation_type
  )
);

create index if not exists
  crm_event_commissions_member_idx
on public.crm_event_commissions(
  company_id,
  team_member_id,
  status
);

create index if not exists
  crm_event_commissions_event_idx
on public.crm_event_commissions(
  event_id,
  status
);


-- ============================================================
-- TRIGGERS updated_at
-- ============================================================

drop trigger if exists
  trg_crm_company_settings_updated_at
on public.crm_company_settings;

create trigger
  trg_crm_company_settings_updated_at
before update
on public.crm_company_settings
for each row
execute function
  public.crm_touch_updated_at();


drop trigger if exists
  trg_crm_team_members_updated_at
on public.crm_team_members;

create trigger
  trg_crm_team_members_updated_at
before update
on public.crm_team_members
for each row
execute function
  public.crm_touch_updated_at();


drop trigger if exists
  trg_crm_service_categories_updated_at
on public.crm_service_categories;

create trigger
  trg_crm_service_categories_updated_at
before update
on public.crm_service_categories
for each row
execute function
  public.crm_touch_updated_at();


drop trigger if exists
  trg_crm_providers_updated_at
on public.crm_providers;

create trigger
  trg_crm_providers_updated_at
before update
on public.crm_providers
for each row
execute function
  public.crm_touch_updated_at();


drop trigger if exists
  trg_crm_provider_services_updated_at
on public.crm_provider_services;

create trigger
  trg_crm_provider_services_updated_at
before update
on public.crm_provider_services
for each row
execute function
  public.crm_touch_updated_at();


drop trigger if exists
  trg_crm_events_updated_at
on public.crm_events;

create trigger
  trg_crm_events_updated_at
before update
on public.crm_events
for each row
execute function
  public.crm_touch_updated_at();


drop trigger if exists
  trg_crm_event_requirements_updated_at
on public.crm_event_requirements;

create trigger
  trg_crm_event_requirements_updated_at
before update
on public.crm_event_requirements
for each row
execute function
  public.crm_touch_updated_at();


drop trigger if exists
  trg_crm_quotes_updated_at
on public.crm_quotes;

create trigger
  trg_crm_quotes_updated_at
before update
on public.crm_quotes
for each row
execute function
  public.crm_touch_updated_at();


drop trigger if exists
  trg_crm_quote_items_updated_at
on public.crm_quote_items;

create trigger
  trg_crm_quote_items_updated_at
before update
on public.crm_quote_items
for each row
execute function
  public.crm_touch_updated_at();


drop trigger if exists
  trg_crm_commission_rules_updated_at
on public.crm_commission_rules;

create trigger
  trg_crm_commission_rules_updated_at
before update
on public.crm_commission_rules
for each row
execute function
  public.crm_touch_updated_at();


drop trigger if exists
  trg_crm_event_commissions_updated_at
on public.crm_event_commissions;

create trigger
  trg_crm_event_commissions_updated_at
before update
on public.crm_event_commissions
for each row
execute function
  public.crm_touch_updated_at();


-- ============================================================
-- SEGURIDAD
--
-- El navegador NO accede directamente.
-- Toda operación pasa por nuestra API usando service_role.
-- ============================================================

alter table public.crm_company_settings
  enable row level security;

alter table public.crm_team_members
  enable row level security;

alter table public.crm_service_categories
  enable row level security;

alter table public.crm_providers
  enable row level security;

alter table public.crm_provider_services
  enable row level security;

alter table public.crm_events
  enable row level security;

alter table public.crm_event_requirements
  enable row level security;

alter table public.crm_quotes
  enable row level security;

alter table public.crm_quote_items
  enable row level security;

alter table public.crm_event_assignments
  enable row level security;

alter table public.crm_commission_rules
  enable row level security;

alter table public.crm_event_commissions
  enable row level security;


revoke all on
  public.crm_company_settings,
  public.crm_team_members,
  public.crm_service_categories,
  public.crm_providers,
  public.crm_provider_services,
  public.crm_events,
  public.crm_event_requirements,
  public.crm_quotes,
  public.crm_quote_items,
  public.crm_event_assignments,
  public.crm_commission_rules,
  public.crm_event_commissions
from anon, authenticated;


grant select, insert, update, delete on
  public.crm_company_settings,
  public.crm_team_members,
  public.crm_service_categories,
  public.crm_providers,
  public.crm_provider_services,
  public.crm_events,
  public.crm_event_requirements,
  public.crm_quotes,
  public.crm_quote_items,
  public.crm_event_assignments,
  public.crm_commission_rules,
  public.crm_event_commissions
to service_role;


commit;
