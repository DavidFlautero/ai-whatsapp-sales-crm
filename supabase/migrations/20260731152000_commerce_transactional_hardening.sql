begin;

create or replace function public.commerce_add_constraint_if_missing(
  p_table regclass,
  p_constraint_name text,
  p_definition text
)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = p_table
      and conname = p_constraint_name
  ) then
    execute format(
      'alter table %s add constraint %I %s',
      p_table,
      p_constraint_name,
      p_definition
    );
  end if;
end;
$$;

/*
 * Moneda operativa:
 * Fulanitas trabaja exclusivamente en pesos argentinos.
 */

select public.commerce_add_constraint_if_missing(
  'public.commerce_business_settings'::regclass,
  'commerce_business_settings_currency_ars',
  $definition$
    check (currency = 'ARS')
  $definition$
);

select public.commerce_add_constraint_if_missing(
  'public.commerce_products'::regclass,
  'commerce_products_currency_ars',
  $definition$
    check (currency = 'ARS')
  $definition$
);

select public.commerce_add_constraint_if_missing(
  'public.commerce_price_lists'::regclass,
  'commerce_price_lists_currency_ars',
  $definition$
    check (currency = 'ARS')
  $definition$
);

select public.commerce_add_constraint_if_missing(
  'public.commerce_orders'::regclass,
  'commerce_orders_currency_ars',
  $definition$
    check (currency = 'ARS')
  $definition$
);

/*
 * Una prenda activa debe tener precio.
 * Los borradores inactivos pueden permanecer temporalmente en cero.
 */

select public.commerce_add_constraint_if_missing(
  'public.commerce_products'::regclass,
  'commerce_products_active_price_positive',
  $definition$
    check (
      active = false
      or default_price > 0
    )
  $definition$
);

select public.commerce_add_constraint_if_missing(
  'public.commerce_product_prices'::regclass,
  'commerce_product_prices_amount_positive',
  $definition$
    check (amount > 0)
  $definition$
);

select public.commerce_add_constraint_if_missing(
  'public.commerce_order_items'::regclass,
  'commerce_order_items_sale_prices_positive',
  $definition$
    check (
      unit_price > 0
      and final_unit_price > 0
    )
  $definition$
);

/*
 * Claves candidatas compuestas.
 * Permiten que las relaciones validen company_id además del UUID.
 */

select public.commerce_add_constraint_if_missing(
  'public.commerce_customers'::regclass,
  'commerce_customers_company_id_id_unique',
  'unique (company_id, id)'
);

select public.commerce_add_constraint_if_missing(
  'public.commerce_warehouses'::regclass,
  'commerce_warehouses_company_id_id_unique',
  'unique (company_id, id)'
);

select public.commerce_add_constraint_if_missing(
  'public.commerce_products'::regclass,
  'commerce_products_company_id_id_unique',
  'unique (company_id, id)'
);

select public.commerce_add_constraint_if_missing(
  'public.commerce_product_variants'::regclass,
  'commerce_product_variants_company_id_id_unique',
  'unique (company_id, id)'
);

select public.commerce_add_constraint_if_missing(
  'public.commerce_price_lists'::regclass,
  'commerce_price_lists_company_id_id_unique',
  'unique (company_id, id)'
);

select public.commerce_add_constraint_if_missing(
  'public.commerce_stock_balances'::regclass,
  'commerce_stock_balances_company_id_id_unique',
  'unique (company_id, id)'
);

select public.commerce_add_constraint_if_missing(
  'public.commerce_orders'::regclass,
  'commerce_orders_company_id_id_unique',
  'unique (company_id, id)'
);

select public.commerce_add_constraint_if_missing(
  'public.commerce_order_items'::regclass,
  'commerce_order_items_company_id_id_unique',
  'unique (company_id, id)'
);

select public.commerce_add_constraint_if_missing(
  'public.commerce_reservations'::regclass,
  'commerce_reservations_company_id_id_unique',
  'unique (company_id, id)'
);

/*
 * Integridad empresarial de catálogo y precios.
 */

select public.commerce_add_constraint_if_missing(
  'public.commerce_product_variants'::regclass,
  'commerce_product_variants_company_product_fkey',
  $definition$
    foreign key (company_id, product_id)
    references public.commerce_products(company_id, id)
    on delete cascade
  $definition$
);

select public.commerce_add_constraint_if_missing(
  'public.commerce_product_prices'::regclass,
  'commerce_product_prices_company_product_fkey',
  $definition$
    foreign key (company_id, product_id)
    references public.commerce_products(company_id, id)
    on delete cascade
  $definition$
);

select public.commerce_add_constraint_if_missing(
  'public.commerce_product_prices'::regclass,
  'commerce_product_prices_company_variant_fkey',
  $definition$
    foreign key (company_id, variant_id)
    references public.commerce_product_variants(company_id, id)
    on delete cascade
  $definition$
);

select public.commerce_add_constraint_if_missing(
  'public.commerce_product_prices'::regclass,
  'commerce_product_prices_company_price_list_fkey',
  $definition$
    foreign key (company_id, price_list_id)
    references public.commerce_price_lists(company_id, id)
    on delete cascade
  $definition$
);

/*
 * Integridad empresarial del inventario.
 */

select public.commerce_add_constraint_if_missing(
  'public.commerce_stock_balances'::regclass,
  'commerce_stock_balances_company_warehouse_fkey',
  $definition$
    foreign key (company_id, warehouse_id)
    references public.commerce_warehouses(company_id, id)
    on delete cascade
  $definition$
);

select public.commerce_add_constraint_if_missing(
  'public.commerce_stock_balances'::regclass,
  'commerce_stock_balances_company_variant_fkey',
  $definition$
    foreign key (company_id, variant_id)
    references public.commerce_product_variants(company_id, id)
    on delete cascade
  $definition$
);

select public.commerce_add_constraint_if_missing(
  'public.commerce_stock_movements'::regclass,
  'commerce_stock_movements_company_warehouse_fkey',
  $definition$
    foreign key (company_id, warehouse_id)
    references public.commerce_warehouses(company_id, id)
  $definition$
);

select public.commerce_add_constraint_if_missing(
  'public.commerce_stock_movements'::regclass,
  'commerce_stock_movements_company_variant_fkey',
  $definition$
    foreign key (company_id, variant_id)
    references public.commerce_product_variants(company_id, id)
  $definition$
);

select public.commerce_add_constraint_if_missing(
  'public.commerce_stock_movements'::regclass,
  'commerce_stock_movements_company_order_fkey',
  $definition$
    foreign key (company_id, order_id)
    references public.commerce_orders(company_id, id)
  $definition$
);

/*
 * Integridad empresarial de pedidos.
 */

select public.commerce_add_constraint_if_missing(
  'public.commerce_orders'::regclass,
  'commerce_orders_company_customer_fkey',
  $definition$
    foreign key (company_id, customer_id)
    references public.commerce_customers(company_id, id)
  $definition$
);

select public.commerce_add_constraint_if_missing(
  'public.commerce_order_items'::regclass,
  'commerce_order_items_company_order_fkey',
  $definition$
    foreign key (company_id, order_id)
    references public.commerce_orders(company_id, id)
    on delete cascade
  $definition$
);

select public.commerce_add_constraint_if_missing(
  'public.commerce_order_items'::regclass,
  'commerce_order_items_company_product_fkey',
  $definition$
    foreign key (company_id, product_id)
    references public.commerce_products(company_id, id)
  $definition$
);

select public.commerce_add_constraint_if_missing(
  'public.commerce_order_items'::regclass,
  'commerce_order_items_company_variant_fkey',
  $definition$
    foreign key (company_id, variant_id)
    references public.commerce_product_variants(company_id, id)
  $definition$
);

select public.commerce_add_constraint_if_missing(
  'public.commerce_reservations'::regclass,
  'commerce_reservations_company_order_fkey',
  $definition$
    foreign key (company_id, order_id)
    references public.commerce_orders(company_id, id)
    on delete cascade
  $definition$
);

/*
 * reservation_items no tenía company_id.
 * Se agrega y se deriva de su reserva.
 */

alter table public.commerce_reservation_items
  add column if not exists company_id text;

update public.commerce_reservation_items as item
set company_id = reservation.company_id
from public.commerce_reservations as reservation
where reservation.id = item.reservation_id
  and item.company_id is null;

alter table public.commerce_reservation_items
  alter column company_id set not null;

create index if not exists
  commerce_reservation_items_company_idx
on public.commerce_reservation_items(company_id);

select public.commerce_add_constraint_if_missing(
  'public.commerce_reservation_items'::regclass,
  'commerce_reservation_items_company_fkey',
  $definition$
    foreign key (company_id)
    references public.commerce_companies(id)
    on delete cascade
  $definition$
);

select public.commerce_add_constraint_if_missing(
  'public.commerce_reservation_items'::regclass,
  'commerce_reservation_items_company_reservation_fkey',
  $definition$
    foreign key (company_id, reservation_id)
    references public.commerce_reservations(company_id, id)
    on delete cascade
  $definition$
);

select public.commerce_add_constraint_if_missing(
  'public.commerce_reservation_items'::regclass,
  'commerce_reservation_items_company_order_item_fkey',
  $definition$
    foreign key (company_id, order_item_id)
    references public.commerce_order_items(company_id, id)
    on delete cascade
  $definition$
);

select public.commerce_add_constraint_if_missing(
  'public.commerce_reservation_items'::regclass,
  'commerce_reservation_items_company_stock_fkey',
  $definition$
    foreign key (company_id, stock_balance_id)
    references public.commerce_stock_balances(company_id, id)
  $definition$
);

drop function public.commerce_add_constraint_if_missing(
  regclass,
  text,
  text
);

insert into public.commerce_schema_migrations (
  version,
  description
)
values (
  '20260731152000',
  'Hardening ARS, precios positivos e integridad empresarial del commerce core'
)
on conflict(version)
do nothing;

commit;
