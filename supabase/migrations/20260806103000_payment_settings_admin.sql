begin;


-- ============================================================
-- AUDITORÍA DE CONFIGURACIÓN DE COBROS
-- ============================================================

create table if not exists
public.commerce_payment_settings_audit (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  action text not null
    check (
      action in (
        'payment_account.created',
        'payment_account.updated',
        'payment_account.set_default',
        'payment_account.deactivated',
        'payment_owner.initialized'
      )
    ),

  entity_type text not null
    check (
      entity_type in (
        'payment_account',
        'payment_owner'
      )
    ),

  entity_id uuid,

  actor_id text,
  actor_name text,
  actor_email text,
  actor_role text,

  request_id text,
  source text,
  ip_address text,
  user_agent text,

  previous_data jsonb,
  new_data jsonb,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);


create index if not exists
commerce_payment_settings_audit_company_idx
on public.commerce_payment_settings_audit (
  company_id,
  created_at desc
);


alter table
public.commerce_payment_settings_audit
enable row level security;


revoke all
on table public.commerce_payment_settings_audit
from public, anon, authenticated;


grant
  select,
  insert
on table public.commerce_payment_settings_audit
to service_role;



-- ============================================================
-- FUNCIÓN AUXILIAR DE AUDITORÍA
-- ============================================================

create or replace function
public.commerce_payment_settings_write_audit (
  p_company_id text,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_actor jsonb,
  p_request jsonb,
  p_previous_data jsonb default null,
  p_new_data jsonb default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.commerce_payment_settings_audit (
    company_id,
    action,
    entity_type,
    entity_id,

    actor_id,
    actor_name,
    actor_email,
    actor_role,

    request_id,
    source,
    ip_address,
    user_agent,

    previous_data,
    new_data,
    metadata
  )
  values (
    p_company_id,
    p_action,
    p_entity_type,
    p_entity_id,

    nullif(p_actor ->> 'id', ''),
    nullif(p_actor ->> 'name', ''),
    nullif(p_actor ->> 'email', ''),
    nullif(p_actor ->> 'role', ''),

    nullif(p_request ->> 'requestId', ''),
    nullif(p_request ->> 'source', ''),
    nullif(p_request ->> 'ipAddress', ''),
    nullif(p_request ->> 'userAgent', ''),

    p_previous_data,
    p_new_data,
    coalesce(
      p_metadata,
      '{}'::jsonb
    )
  );
end;
$$;


revoke all
on function public.commerce_payment_settings_write_audit(
  text,
  text,
  text,
  uuid,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb
)
from public, anon, authenticated;



-- ============================================================
-- CREAR O EDITAR CUENTA
--
-- is_default no se modifica desde este RPC.
-- El cambio de predeterminada usa una operación separada
-- y transaccional.
-- ============================================================

create or replace function
public.commerce_save_payment_account (
  p_company_id text,
  p_account_id uuid,
  p_data jsonb,
  p_actor jsonb default '{}'::jsonb,
  p_request jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing
    public.commerce_payment_accounts%rowtype;

  v_result
    public.commerce_payment_accounts%rowtype;

  v_display_name text;
  v_institution_name text;
  v_account_type text;
  v_holder_name text;
  v_tax_id text;
  v_alias text;
  v_account_number text;
  v_currency text;
  v_instructions text;
  v_sort_order integer;
  v_active boolean;

  v_action text;
begin
  if nullif(
    btrim(p_company_id),
    ''
  ) is null then
    raise exception
      'PAYMENT_ACCOUNT_COMPANY_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_company_id
      || ':payment-account-save',
      0
    )
  );

  if p_account_id is not null then
    select
      account.*
    into
      v_existing
    from public.commerce_payment_accounts
      as account
    where
      account.company_id =
        p_company_id

      and account.id =
        p_account_id

    for update;

    if not found then
      raise exception
        'PAYMENT_ACCOUNT_NOT_FOUND';
    end if;
  end if;

  v_display_name =
    nullif(
      btrim(
        coalesce(
          p_data ->> 'displayName',
          v_existing.display_name,
          ''
        )
      ),
      ''
    );

  v_institution_name =
    nullif(
      btrim(
        coalesce(
          p_data ->> 'institutionName',
          v_existing.institution_name,
          ''
        )
      ),
      ''
    );

  v_account_type =
    lower(
      nullif(
        btrim(
          coalesce(
            p_data ->> 'accountType',
            v_existing.account_type,
            ''
          )
        ),
        ''
      )
    );

  v_holder_name =
    nullif(
      btrim(
        coalesce(
          p_data ->> 'holderName',
          v_existing.holder_name,
          ''
        )
      ),
      ''
    );

  v_tax_id =
    case
      when p_data ? 'taxId'
        then nullif(
          btrim(
            p_data ->> 'taxId'
          ),
          ''
        )
      else v_existing.tax_id
    end;

  v_alias =
    case
      when p_data ? 'alias'
        then nullif(
          lower(
            btrim(
              p_data ->> 'alias'
            )
          ),
          ''
        )
      else v_existing.alias
    end;

  v_account_number =
    case
      when p_data ? 'accountNumber'
        then nullif(
          regexp_replace(
            coalesce(
              p_data ->> 'accountNumber',
              ''
            ),
            '[^0-9]',
            '',
            'g'
          ),
          ''
        )
      else v_existing.account_number
    end;

  v_currency =
    upper(
      nullif(
        btrim(
          coalesce(
            p_data ->> 'currency',
            v_existing.currency,
            'ARS'
          )
        ),
        ''
      )
    );

  v_instructions =
    case
      when p_data ? 'instructions'
        then nullif(
          btrim(
            p_data ->> 'instructions'
          ),
          ''
        )
      else v_existing.instructions
    end;

  v_sort_order =
    case
      when p_data ? 'sortOrder'
        then greatest(
          coalesce(
            (p_data ->> 'sortOrder')::integer,
            0
          ),
          0
        )
      else coalesce(
        v_existing.sort_order,
        0
      )
    end;

  v_active =
    case
      when p_account_id is null
        then true
      else v_existing.active
    end;

  if v_display_name is null then
    raise exception
      'PAYMENT_ACCOUNT_DISPLAY_NAME_REQUIRED';
  end if;

  if v_institution_name is null then
    raise exception
      'PAYMENT_ACCOUNT_INSTITUTION_REQUIRED';
  end if;

  if v_holder_name is null then
    raise exception
      'PAYMENT_ACCOUNT_HOLDER_REQUIRED';
  end if;

  if v_account_type not in (
    'bank_account',
    'virtual_wallet',
    'cash',
    'other'
  ) then
    raise exception
      'PAYMENT_ACCOUNT_TYPE_INVALID';
  end if;

  if v_currency not in (
    'ARS',
    'USD',
    'EUR'
  ) then
    raise exception
      'PAYMENT_ACCOUNT_CURRENCY_INVALID';
  end if;

  if
    v_account_type in (
      'bank_account',
      'virtual_wallet'
    )
    and v_alias is null
    and v_account_number is null
  then
    raise exception
      'PAYMENT_ACCOUNT_DESTINATION_REQUIRED';
  end if;

  if
    v_account_number is not null
    and length(v_account_number)
      > 64
  then
    raise exception
      'PAYMENT_ACCOUNT_NUMBER_TOO_LONG';
  end if;

  if p_account_id is null then
    insert into public.commerce_payment_accounts (
      company_id,

      display_name,
      institution_name,
      account_type,

      holder_name,
      tax_id,

      alias,
      account_number,

      currency,
      instructions,

      active,
      is_default,
      sort_order,

      created_by,
      updated_by
    )
    values (
      p_company_id,

      v_display_name,
      v_institution_name,
      v_account_type,

      v_holder_name,
      v_tax_id,

      v_alias,
      v_account_number,

      v_currency,
      v_instructions,

      true,
      false,
      v_sort_order,

      nullif(
        p_actor ->> 'id',
        ''
      ),

      nullif(
        p_actor ->> 'id',
        ''
      )
    )
    returning *
    into v_result;

    v_action :=
      'payment_account.created';
  else
    update public.commerce_payment_accounts
    set
      display_name =
        v_display_name,

      institution_name =
        v_institution_name,

      account_type =
        v_account_type,

      holder_name =
        v_holder_name,

      tax_id =
        v_tax_id,

      alias =
        v_alias,

      account_number =
        v_account_number,

      currency =
        v_currency,

      instructions =
        v_instructions,

      sort_order =
        v_sort_order,

      updated_by =
        nullif(
          p_actor ->> 'id',
          ''
        ),

      updated_at =
        now()
    where
      company_id =
        p_company_id

      and id =
        p_account_id

    returning *
    into v_result;

    v_action :=
      'payment_account.updated';
  end if;

  perform
    public.commerce_payment_settings_write_audit(
      p_company_id,
      v_action,
      'payment_account',
      v_result.id,
      p_actor,
      p_request,

      case
        when p_account_id is null
          then null
        else jsonb_build_object(
          'displayName',
          v_existing.display_name,

          'institutionName',
          v_existing.institution_name,

          'accountType',
          v_existing.account_type,

          'holderName',
          v_existing.holder_name,

          'alias',
          v_existing.alias,

          'accountNumberLast4',
          case
            when v_existing.account_number
              is null
              then null
            else right(
              v_existing.account_number,
              4
            )
          end,

          'currency',
          v_existing.currency,

          'active',
          v_existing.active,

          'isDefault',
          v_existing.is_default
        )
      end,

      jsonb_build_object(
        'displayName',
        v_result.display_name,

        'institutionName',
        v_result.institution_name,

        'accountType',
        v_result.account_type,

        'holderName',
        v_result.holder_name,

        'alias',
        v_result.alias,

        'accountNumberLast4',
        case
          when v_result.account_number
            is null
            then null
          else right(
            v_result.account_number,
            4
          )
        end,

        'currency',
        v_result.currency,

        'active',
        v_result.active,

        'isDefault',
        v_result.is_default
      ),

      '{}'::jsonb
    );

  return to_jsonb(v_result);
end;
$$;


revoke all
on function public.commerce_save_payment_account(
  text,
  uuid,
  jsonb,
  jsonb,
  jsonb
)
from public, anon, authenticated;


grant execute
on function public.commerce_save_payment_account(
  text,
  uuid,
  jsonb,
  jsonb,
  jsonb
)
to service_role;



-- ============================================================
-- CAMBIAR CUENTA PREDETERMINADA
-- ============================================================

create or replace function
public.commerce_set_default_payment_account (
  p_company_id text,
  p_account_id uuid,
  p_actor jsonb default '{}'::jsonb,
  p_request jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target
    public.commerce_payment_accounts%rowtype;

  v_previous
    public.commerce_payment_accounts%rowtype;
begin
  if p_account_id is null then
    raise exception
      'PAYMENT_ACCOUNT_ID_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_company_id
      || ':payment-account-default',
      0
    )
  );

  select
    account.*
  into
    v_target
  from public.commerce_payment_accounts
    as account
  where
    account.company_id =
      p_company_id

    and account.id =
      p_account_id

  for update;

  if not found then
    raise exception
      'PAYMENT_ACCOUNT_NOT_FOUND';
  end if;

  if not v_target.active then
    raise exception
      'PAYMENT_ACCOUNT_INACTIVE';
  end if;

  select
    account.*
  into
    v_previous
  from public.commerce_payment_accounts
    as account
  where
    account.company_id =
      p_company_id

    and account.currency =
      v_target.currency

    and account.active =
      true

    and account.is_default =
      true

  for update;

  update public.commerce_payment_accounts
  set
    is_default =
      false,

    updated_at =
      now()
  where
    company_id =
      p_company_id

    and currency =
      v_target.currency

    and is_default =
      true;

  update public.commerce_payment_accounts
  set
    is_default =
      true,

    updated_by =
      nullif(
        p_actor ->> 'id',
        ''
      ),

    updated_at =
      now()
  where
    company_id =
      p_company_id

    and id =
      p_account_id

  returning *
  into v_target;

  perform
    public.commerce_payment_settings_write_audit(
      p_company_id,
      'payment_account.set_default',
      'payment_account',
      v_target.id,
      p_actor,
      p_request,

      case
        when v_previous.id is null
          then null
        else jsonb_build_object(
          'accountId',
          v_previous.id,

          'displayName',
          v_previous.display_name,

          'currency',
          v_previous.currency
        )
      end,

      jsonb_build_object(
        'accountId',
        v_target.id,

        'displayName',
        v_target.display_name,

        'currency',
        v_target.currency
      ),

      '{}'::jsonb
    );

  return to_jsonb(v_target);
end;
$$;


revoke all
on function public.commerce_set_default_payment_account(
  text,
  uuid,
  jsonb,
  jsonb
)
from public, anon, authenticated;


grant execute
on function public.commerce_set_default_payment_account(
  text,
  uuid,
  jsonb,
  jsonb
)
to service_role;



-- ============================================================
-- DESACTIVAR CUENTA
-- ============================================================

create or replace function
public.commerce_deactivate_payment_account (
  p_company_id text,
  p_account_id uuid,
  p_actor jsonb default '{}'::jsonb,
  p_request jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account
    public.commerce_payment_accounts%rowtype;
begin
  select
    account.*
  into
    v_account
  from public.commerce_payment_accounts
    as account
  where
    account.company_id =
      p_company_id

    and account.id =
      p_account_id

  for update;

  if not found then
    raise exception
      'PAYMENT_ACCOUNT_NOT_FOUND';
  end if;

  if v_account.is_default then
    raise exception
      'PAYMENT_ACCOUNT_DEFAULT_CANNOT_DEACTIVATE';
  end if;

  if not v_account.active then
    return to_jsonb(v_account);
  end if;

  update public.commerce_payment_accounts
  set
    active =
      false,

    updated_by =
      nullif(
        p_actor ->> 'id',
        ''
      ),

    updated_at =
      now()
  where
    company_id =
      p_company_id

    and id =
      p_account_id

  returning *
  into v_account;

  perform
    public.commerce_payment_settings_write_audit(
      p_company_id,
      'payment_account.deactivated',
      'payment_account',
      v_account.id,
      p_actor,
      p_request,

      jsonb_build_object(
        'active',
        true
      ),

      jsonb_build_object(
        'active',
        false
      ),

      jsonb_build_object(
        'displayName',
        v_account.display_name,

        'currency',
        v_account.currency
      )
    );

  return to_jsonb(v_account);
end;
$$;


revoke all
on function public.commerce_deactivate_payment_account(
  text,
  uuid,
  jsonb,
  jsonb
)
from public, anon, authenticated;


grant execute
on function public.commerce_deactivate_payment_account(
  text,
  uuid,
  jsonb,
  jsonb
)
to service_role;



-- ============================================================
-- CONFIGURAR NÚMERO DUEÑO UNA SOLA VEZ
-- ============================================================

create or replace function
public.commerce_initialize_payment_owner (
  p_company_id text,
  p_phone_hash text,
  p_phone_last2 text,
  p_actor jsonb default '{}'::jsonb,
  p_request jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing
    public.commerce_payment_owner_settings%rowtype;

  v_result
    public.commerce_payment_owner_settings%rowtype;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(
      p_company_id
      || ':payment-owner-initialize',
      0
    )
  );

  select
    owner_settings.*
  into
    v_existing
  from public.commerce_payment_owner_settings
    as owner_settings
  where
    owner_settings.company_id =
      p_company_id

  for update;

  if found then
    raise exception
      'PAYMENT_OWNER_ALREADY_CONFIGURED';
  end if;

  if
    p_phone_hash is null
    or p_phone_hash
      !~ '^[a-f0-9]{64}$'
  then
    raise exception
      'PAYMENT_OWNER_HASH_INVALID';
  end if;

  if
    p_phone_last2 is null
    or p_phone_last2
      !~ '^[0-9]{2}$'
  then
    raise exception
      'PAYMENT_OWNER_LAST2_INVALID';
  end if;

  insert into public.commerce_payment_owner_settings (
    company_id,
    owner_phone_hash,
    owner_phone_last2,

    locked,

    configured_by,
    configured_at,

    metadata
  )
  values (
    p_company_id,
    p_phone_hash,
    p_phone_last2,

    true,

    nullif(
      p_actor ->> 'id',
      ''
    ),

    now(),

    jsonb_build_object(
      'source',
      coalesce(
        nullif(
          p_request ->> 'source',
          ''
        ),
        'dashboard'
      )
    )
  )
  returning *
  into v_result;

  perform
    public.commerce_payment_settings_write_audit(
      p_company_id,
      'payment_owner.initialized',
      'payment_owner',
      null,
      p_actor,
      p_request,

      null,

      jsonb_build_object(
        'configured',
        true,

        'maskedPhone',
        '••••'
        || v_result.owner_phone_last2,

        'locked',
        true
      ),

      '{}'::jsonb
    );

  return jsonb_build_object(
    'companyId',
    v_result.company_id,

    'configured',
    true,

    'maskedPhone',
    '••••'
    || v_result.owner_phone_last2,

    'last2',
    v_result.owner_phone_last2,

    'locked',
    v_result.locked,

    'configuredAt',
    v_result.configured_at
  );
end;
$$;


revoke all
on function public.commerce_initialize_payment_owner(
  text,
  text,
  text,
  jsonb,
  jsonb
)
from public, anon, authenticated;


grant execute
on function public.commerce_initialize_payment_owner(
  text,
  text,
  text,
  jsonb,
  jsonb
)
to service_role;



insert into public.commerce_schema_migrations (
  version,
  description
)
values (
  '20260806103000',
  'Administración transaccional y auditada de cuentas de cobro'
)
on conflict(version)
do nothing;


commit;
