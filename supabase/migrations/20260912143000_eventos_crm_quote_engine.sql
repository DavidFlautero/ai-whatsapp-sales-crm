begin;

-- ============================================================
-- EVENTOS MEDITERRÁNEO
-- MOTOR TRANSACCIONAL DE PRESUPUESTOS Y COMISIONES
-- ============================================================


-- ============================================================
-- RECALCULAR TOTALES DE UN PRESUPUESTO
-- ============================================================

create or replace function public.crm_refresh_quote_totals(
  p_quote_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.crm_quotes q
  set
    subtotal_price =
      coalesce(
        (
          select sum(i.line_price)
          from public.crm_quote_items i
          where i.quote_id = p_quote_id
        ),
        0
      ),

    provider_cost_total =
      coalesce(
        (
          select sum(i.line_cost)
          from public.crm_quote_items i
          where i.quote_id = p_quote_id
        ),
        0
      )

  where q.id = p_quote_id;
end;
$$;


-- ============================================================
-- TRIGGER AUTOMÁTICO SOBRE LÍNEAS
-- ============================================================

create or replace function public.crm_quote_items_refresh_totals_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.crm_refresh_quote_totals(
      old.quote_id
    );

    return old;
  end if;

  perform public.crm_refresh_quote_totals(
    new.quote_id
  );

  if
    tg_op = 'UPDATE'
    and old.quote_id is distinct from new.quote_id
  then
    perform public.crm_refresh_quote_totals(
      old.quote_id
    );
  end if;

  return new;
end;
$$;


drop trigger if exists
  trg_crm_quote_items_refresh_totals
on public.crm_quote_items;

create trigger
  trg_crm_quote_items_refresh_totals
after insert or update or delete
on public.crm_quote_items
for each row
execute function
  public.crm_quote_items_refresh_totals_trigger();


-- ============================================================
-- CREAR PRESUPUESTO COMPLETO
--
-- Todo se ejecuta dentro de una única transacción RPC.
--
-- p_items:
-- [
--   {
--     "categoryId": "...",
--     "providerId": "...",
--     "providerServiceId": "...",
--     "description": "Catering 80 personas",
--     "quantity": 80,
--     "unitCost": 35,
--     "unitPrice": 45
--   }
-- ]
-- ============================================================

create or replace function public.crm_create_quote(
  p_company_id text,
  p_event_id uuid,
  p_created_by_team_member_id uuid,
  p_items jsonb,
  p_discount_amount numeric default 0,
  p_direct_expenses numeric default 0,
  p_valid_until date default null,
  p_public_notes text default null,
  p_internal_notes text default null,
  p_terms text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_quote_id uuid;
  v_version integer;
  v_item jsonb;
  v_result jsonb;
begin

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
  then
    raise exception
      'QUOTE_REQUIRES_ITEMS';
  end if;


  if coalesce(p_discount_amount, 0) < 0 then
    raise exception
      'INVALID_DISCOUNT_AMOUNT';
  end if;


  if coalesce(p_direct_expenses, 0) < 0 then
    raise exception
      'INVALID_DIRECT_EXPENSES';
  end if;


  -- Bloqueamos el evento durante la operación.
  select e.customer_id
  into v_customer_id
  from public.crm_events e
  where
    e.id = p_event_id
    and e.company_id = p_company_id
  for update;


  if v_customer_id is null then
    raise exception
      'CRM_EVENT_NOT_FOUND';
  end if;


  -- Verificar que el miembro pertenece a la empresa.
  if not exists (
    select 1
    from public.crm_team_members tm
    where
      tm.id = p_created_by_team_member_id
      and tm.company_id = p_company_id
      and tm.active = true
  ) then
    raise exception
      'CRM_TEAM_MEMBER_NOT_FOUND';
  end if;


  -- Próxima versión del presupuesto.
  select
    coalesce(max(q.version), 0) + 1
  into v_version
  from public.crm_quotes q
  where
    q.company_id = p_company_id
    and q.event_id = p_event_id;


  insert into public.crm_quotes (
    company_id,
    event_id,
    customer_id,
    version,
    status,
    currency,
    valid_until,
    subtotal_price,
    provider_cost_total,
    discount_amount,
    direct_expenses,
    public_notes,
    internal_notes,
    terms,
    created_by_team_member_id
  )
  values (
    p_company_id,
    p_event_id,
    v_customer_id,
    v_version,
    'draft',
    'EUR',
    p_valid_until,
    0,
    0,
    coalesce(p_discount_amount, 0),
    coalesce(p_direct_expenses, 0),
    p_public_notes,
    p_internal_notes,
    p_terms,
    p_created_by_team_member_id
  )
  returning id
  into v_quote_id;


  -- Insertar líneas.
  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop

    if
      coalesce(
        btrim(
          v_item ->> 'description'
        ),
        ''
      ) = ''
    then
      raise exception
        'QUOTE_ITEM_DESCRIPTION_REQUIRED';
    end if;


    if
      coalesce(
        (v_item ->> 'quantity')::numeric,
        1
      ) <= 0
    then
      raise exception
        'INVALID_QUOTE_ITEM_QUANTITY';
    end if;


    if
      coalesce(
        (v_item ->> 'unitCost')::numeric,
        0
      ) < 0
    then
      raise exception
        'INVALID_QUOTE_ITEM_COST';
    end if;


    if
      coalesce(
        (v_item ->> 'unitPrice')::numeric,
        0
      ) < 0
    then
      raise exception
        'INVALID_QUOTE_ITEM_PRICE';
    end if;


    insert into public.crm_quote_items (
      company_id,
      quote_id,
      category_id,
      provider_id,
      provider_service_id,
      description,
      quantity,
      unit_cost,
      unit_price,
      sort_order
    )
    values (
      p_company_id,
      v_quote_id,

      nullif(
        v_item ->> 'categoryId',
        ''
      )::uuid,

      nullif(
        v_item ->> 'providerId',
        ''
      )::uuid,

      nullif(
        v_item ->> 'providerServiceId',
        ''
      )::uuid,

      v_item ->> 'description',

      coalesce(
        (v_item ->> 'quantity')::numeric,
        1
      ),

      coalesce(
        (v_item ->> 'unitCost')::numeric,
        0
      ),

      coalesce(
        (v_item ->> 'unitPrice')::numeric,
        0
      ),

      coalesce(
        (v_item ->> 'sortOrder')::integer,
        0
      )
    );

  end loop;


  perform public.crm_refresh_quote_totals(
    v_quote_id
  );


  -- Pasar evento a presupuesto en preparación,
  -- salvo que ya esté en una etapa posterior.
  update public.crm_events
  set status = 'quote_draft'
  where
    id = p_event_id
    and company_id = p_company_id
    and status in (
      'lead',
      'qualifying',
      'sourcing',
      'quote_draft'
    );


  select
    jsonb_build_object(
      'quote',
      to_jsonb(q),

      'items',
      coalesce(
        (
          select jsonb_agg(
            to_jsonb(i)
            order by
              i.sort_order,
              i.created_at
          )
          from public.crm_quote_items i
          where i.quote_id = q.id
        ),
        '[]'::jsonb
      )
    )
  into v_result
  from public.crm_quotes q
  where q.id = v_quote_id;


  return v_result;
end;
$$;


-- ============================================================
-- ACEPTAR PRESUPUESTO
--
-- 1. Bloquea presupuesto/evento.
-- 2. Confirma importes reales.
-- 3. Marca evento confirmado.
-- 4. Calcula comisiones.
-- 5. Verifica límite máximo de reparto.
--
-- Si algo falla, TODO hace rollback.
-- ============================================================

create or replace function public.crm_accept_quote(
  p_company_id text,
  p_quote_id uuid,
  p_approved_by_team_member_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.crm_quotes%rowtype;
  v_event public.crm_events%rowtype;

  v_margin numeric(14,2);
  v_pool_percent numeric(5,2);
  v_max_commissions numeric(14,2);
  v_total_commissions numeric(14,2) := 0;

  v_amount numeric(14,2);

  v_record record;

  v_result jsonb;
begin

  select *
  into v_quote
  from public.crm_quotes
  where
    id = p_quote_id
    and company_id = p_company_id
  for update;


  if v_quote.id is null then
    raise exception
      'CRM_QUOTE_NOT_FOUND';
  end if;


  if v_quote.status in (
    'rejected',
    'expired',
    'cancelled'
  ) then
    raise exception
      'CRM_QUOTE_CANNOT_BE_ACCEPTED';
  end if;


  select *
  into v_event
  from public.crm_events
  where
    id = v_quote.event_id
    and company_id = p_company_id
  for update;


  if v_event.id is null then
    raise exception
      'CRM_EVENT_NOT_FOUND';
  end if;


  if not exists (
    select 1
    from public.crm_team_members tm
    where
      tm.id =
        p_approved_by_team_member_id
      and tm.company_id =
        p_company_id
      and tm.active = true
      and tm.access_role = 'admin'
  ) then
    raise exception
      'CRM_ADMIN_APPROVAL_REQUIRED';
  end if;


  -- Si ya existen comisiones pagables/pagadas,
  -- no permitimos reescribir la liquidación.
  if exists (
    select 1
    from public.crm_event_commissions ec
    where
      ec.event_id = v_event.id
      and ec.company_id = p_company_id
      and ec.status in (
        'payable',
        'paid'
      )
  ) then
    raise exception
      'EVENT_COMMISSIONS_ALREADY_SETTLED';
  end if;


  perform public.crm_refresh_quote_totals(
    v_quote.id
  );


  -- Refrescar registro después de recalcular.
  select *
  into v_quote
  from public.crm_quotes
  where id = v_quote.id;


  v_margin :=
    greatest(
      coalesce(
        v_quote.commissionable_margin,
        0
      ),
      0
    );


  select
    coalesce(
      s.commission_pool_limit_percent,
      35
    )
  into v_pool_percent
  from public.crm_company_settings s
  where s.company_id = p_company_id;


  if v_pool_percent is null then
    v_pool_percent := 35;
  end if;


  v_max_commissions :=
    round(
      v_margin
      * v_pool_percent
      / 100,
      2
    );


  -- Solo puede existir un presupuesto aceptado.
  update public.crm_quotes
  set status = 'cancelled'
  where
    company_id = p_company_id
    and event_id = v_event.id
    and id <> v_quote.id
    and status = 'accepted';


  update public.crm_quotes
  set
    status = 'accepted',
    approved_by_team_member_id =
      p_approved_by_team_member_id,
    accepted_at = now()
  where id = v_quote.id;


  update public.crm_events
  set
    status = 'confirmed',

    final_client_price =
      v_quote.final_price,

    final_provider_cost =
      v_quote.provider_cost_total,

    direct_expenses =
      v_quote.direct_expenses,

    next_action =
      'Iniciar coordinación del evento',

    next_action_at = now()
  where
    id = v_event.id
    and company_id = p_company_id;


  -- Rehacer comisiones que todavía no estén liquidadas.
  delete from public.crm_event_commissions
  where
    company_id = p_company_id
    and event_id = v_event.id
    and status in (
      'estimated',
      'locked',
      'cancelled'
    );


  -- Para cada responsabilidad usamos una sola regla:
  -- la activa de mayor prioridad.
  for v_record in

    select
      a.id as assignment_id,
      a.team_member_id,
      a.participation_type,

      r.id as rule_id,
      r.calculation_type,
      r.percent_value,
      r.fixed_amount,
      r.max_amount

    from public.crm_event_assignments a

    join lateral (
      select r2.*
      from public.crm_commission_rules r2
      where
        r2.company_id = p_company_id
        and r2.active = true

        and r2.participation_type =
          a.participation_type

        and (
          r2.effective_from is null
          or r2.effective_from <= current_date
        )

        and (
          r2.effective_until is null
          or r2.effective_until >= current_date
        )

      order by
        r2.priority asc,
        r2.created_at desc

      limit 1
    ) r on true

    where
      a.company_id = p_company_id
      and a.event_id = v_event.id
      and a.status <> 'cancelled'

  loop

    if
      v_record.calculation_type =
        'percent_margin'
    then

      v_amount :=
        round(
          v_margin
          * coalesce(
              v_record.percent_value,
              0
            )
          / 100,
          2
        );

    else

      v_amount :=
        coalesce(
          v_record.fixed_amount,
          0
        );

    end if;


    if
      v_record.max_amount is not null
    then
      v_amount :=
        least(
          v_amount,
          v_record.max_amount
        );
    end if;


    v_amount :=
      greatest(
        coalesce(
          v_amount,
          0
        ),
        0
      );


    insert into public.crm_event_commissions (
      company_id,
      event_id,
      quote_id,
      team_member_id,
      assignment_id,
      rule_id,
      participation_type,
      margin_base,
      percent_value,
      fixed_amount,
      commission_amount,
      status
    )
    values (
      p_company_id,
      v_event.id,
      v_quote.id,
      v_record.team_member_id,
      v_record.assignment_id,
      v_record.rule_id,
      v_record.participation_type,
      v_margin,
      v_record.percent_value,
      v_record.fixed_amount,
      v_amount,
      'locked'
    );


    v_total_commissions :=
      v_total_commissions
      + v_amount;

  end loop;


  -- Protección empresarial:
  -- jamás superar el pool permitido.
  if
    v_total_commissions >
      v_max_commissions
  then
    raise exception
      'COMMISSION_POOL_LIMIT_EXCEEDED: commissions %, maximum %',
      v_total_commissions,
      v_max_commissions;
  end if;


  select
    jsonb_build_object(
      'event',
      (
        select to_jsonb(e)
        from public.crm_events e
        where e.id = v_event.id
      ),

      'quote',
      (
        select to_jsonb(q)
        from public.crm_quotes q
        where q.id = v_quote.id
      ),

      'commissions',
      coalesce(
        (
          select jsonb_agg(
            to_jsonb(ec)
            order by ec.created_at
          )
          from public.crm_event_commissions ec
          where
            ec.company_id = p_company_id
            and ec.event_id = v_event.id
        ),
        '[]'::jsonb
      ),

      'commissionSummary',
      jsonb_build_object(
        'marginBase',
        v_margin,

        'poolLimitPercent',
        v_pool_percent,

        'poolLimitAmount',
        v_max_commissions,

        'totalCommissions',
        v_total_commissions,

        'companyMarginAfterCommissions',
        v_margin
          - v_total_commissions
      )
    )
  into v_result;


  return v_result;
end;
$$;


-- ============================================================
-- FINALIZAR EVENTO
--
-- Convierte las comisiones bloqueadas en pagables.
-- ============================================================

create or replace function public.crm_complete_event(
  p_company_id text,
  p_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin

  if not exists (
    select 1
    from public.crm_events e
    where
      e.id = p_event_id
      and e.company_id = p_company_id
  ) then
    raise exception
      'CRM_EVENT_NOT_FOUND';
  end if;


  update public.crm_events
  set
    status = 'completed',
    next_action = null,
    next_action_at = null
  where
    id = p_event_id
    and company_id = p_company_id;


  update public.crm_event_commissions
  set
    status = 'payable',
    payable_at = now()
  where
    company_id = p_company_id
    and event_id = p_event_id
    and status = 'locked';


  select
    jsonb_build_object(
      'event',
      (
        select to_jsonb(e)
        from public.crm_events e
        where
          e.id = p_event_id
          and e.company_id =
            p_company_id
      ),

      'commissions',
      coalesce(
        (
          select jsonb_agg(
            to_jsonb(ec)
          )
          from public.crm_event_commissions ec
          where
            ec.company_id =
              p_company_id
            and ec.event_id =
              p_event_id
        ),
        '[]'::jsonb
      )
    )
  into v_result;


  return v_result;
end;
$$;


-- ============================================================
-- SEGURIDAD RPC
-- Solo backend service_role.
-- ============================================================

revoke all on function
  public.crm_refresh_quote_totals(uuid)
from public, anon, authenticated;

grant execute on function
  public.crm_refresh_quote_totals(uuid)
to service_role;


revoke all on function
  public.crm_create_quote(
    text,
    uuid,
    uuid,
    jsonb,
    numeric,
    numeric,
    date,
    text,
    text,
    text
  )
from public, anon, authenticated;

grant execute on function
  public.crm_create_quote(
    text,
    uuid,
    uuid,
    jsonb,
    numeric,
    numeric,
    date,
    text,
    text,
    text
  )
to service_role;


revoke all on function
  public.crm_accept_quote(
    text,
    uuid,
    uuid
  )
from public, anon, authenticated;

grant execute on function
  public.crm_accept_quote(
    text,
    uuid,
    uuid
  )
to service_role;


revoke all on function
  public.crm_complete_event(
    text,
    uuid
  )
from public, anon, authenticated;

grant execute on function
  public.crm_complete_event(
    text,
    uuid
  )
to service_role;


commit;
