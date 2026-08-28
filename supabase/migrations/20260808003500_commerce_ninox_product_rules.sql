begin;

create table if not exists public.commerce_ninox_product_rules (
  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  external_code text not null,

  retail_enabled boolean not null
    default true,

  wholesale_enabled boolean not null
    default true,

  retail_price_list smallint,
  wholesale_price_list smallint,

  curve_sizes jsonb not null
    default '[]'::jsonb,

  units_per_size integer not null
    default 1,

  size_price_rules jsonb not null
    default '[]'::jsonb,

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  primary key (
    company_id,
    external_code
  ),

  constraint commerce_ninox_rules_retail_price_list_check
    check (
      retail_price_list is null
      or retail_price_list between 1 and 5
    ),

  constraint commerce_ninox_rules_wholesale_price_list_check
    check (
      wholesale_price_list is null
      or wholesale_price_list between 1 and 5
    ),

  constraint commerce_ninox_rules_units_per_size_check
    check (
      units_per_size > 0
    ),

  constraint commerce_ninox_rules_curve_sizes_check
    check (
      jsonb_typeof(curve_sizes) = 'array'
    ),

  constraint commerce_ninox_rules_size_price_rules_check
    check (
      jsonb_typeof(size_price_rules) = 'array'
    )
);

create index if not exists
commerce_ninox_product_rules_company_idx
on public.commerce_ninox_product_rules (
  company_id
);

revoke all on table
public.commerce_ninox_product_rules
from public, anon, authenticated;

grant all on table
public.commerce_ninox_product_rules
to service_role;

commit;
