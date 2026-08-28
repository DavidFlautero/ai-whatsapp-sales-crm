begin;


-- ============================================================
-- CUENTAS DE COBRO PRECARGADAS
-- ============================================================

create table if not exists
public.commerce_payment_accounts (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  display_name text not null,
  institution_name text not null,

  account_type text not null
    check (
      account_type in (
        'bank_account',
        'virtual_wallet',
        'cash',
        'other'
      )
    ),

  holder_name text not null,
  tax_id text,

  alias text,
  account_number text,

  currency text not null default 'ARS'
    check (
      currency in (
        'ARS',
        'USD',
        'EUR'
      )
    ),

  instructions text,

  active boolean not null default true,
  is_default boolean not null default false,

  sort_order integer not null default 0
    check (sort_order >= 0),

  created_by text,
  updated_by text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    nullif(btrim(alias), '') is not null
    or nullif(btrim(account_number), '') is not null
    or account_type in (
      'cash',
      'other'
    )
  )
);


create index if not exists
commerce_payment_accounts_company_idx
on public.commerce_payment_accounts (
  company_id,
  active,
  sort_order,
  created_at
);


create unique index if not exists
commerce_payment_accounts_alias_unique
on public.commerce_payment_accounts (
  company_id,
  lower(alias)
)
where
  alias is not null
  and btrim(alias) <> '';


create unique index if not exists
commerce_payment_accounts_default_unique
on public.commerce_payment_accounts (
  company_id,
  currency
)
where
  active = true
  and is_default = true;


alter table
public.commerce_payment_accounts
enable row level security;


revoke all
on table public.commerce_payment_accounts
from public, anon, authenticated;


grant
  select,
  insert,
  update
on table public.commerce_payment_accounts
to service_role;



-- ============================================================
-- NÚMERO ÚNICO DEL DUEÑO
--
-- No se almacena el teléfono completo.
-- Se almacena SHA-256 del teléfono normalizado para comparar
-- el remitente de WhatsApp, y sólo los últimos dos dígitos
-- para mostrarlo en el panel.
-- ============================================================

create table if not exists
public.commerce_payment_owner_settings (
  company_id text primary key
    references public.commerce_companies(id)
    on delete cascade,

  owner_phone_hash text not null,
  owner_phone_last2 text not null,

  locked boolean not null default true,

  configured_by text,
  configured_at timestamptz not null default now(),

  metadata jsonb not null default '{}'::jsonb,

  updated_at timestamptz not null default now(),

  check (
    owner_phone_hash
    ~ '^[a-f0-9]{64}$'
  ),

  check (
    owner_phone_last2
    ~ '^[0-9]{2}$'
  ),

  check (
    locked = true
  )
);


alter table
public.commerce_payment_owner_settings
enable row level security;


revoke all
on table public.commerce_payment_owner_settings
from public, anon, authenticated;


grant
  select,
  insert
on table public.commerce_payment_owner_settings
to service_role;



-- ============================================================
-- ACCIONES ADMINISTRATIVAS POR WHATSAPP
--
-- Ejemplo:
-- cambiar cuenta predeterminada -> seleccionar -> confirmar
-- ============================================================

create table if not exists
public.commerce_payment_admin_actions (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  owner_phone_hash text not null,

  action_type text not null
    check (
      action_type in (
        'set_default_payment_account',
        'activate_payment_account',
        'deactivate_payment_account'
      )
    ),

  target_account_id uuid
    references public.commerce_payment_accounts(id),

  previous_account_id uuid
    references public.commerce_payment_accounts(id),

  status text not null default 'pending_confirmation'
    check (
      status in (
        'pending_selection',
        'pending_confirmation',
        'completed',
        'cancelled',
        'expired',
        'failed'
      )
    ),

  initiating_message_id text not null,
  confirmation_message_id text,

  idempotency_key text not null,

  payload jsonb not null default '{}'::jsonb,
  result_data jsonb,

  expires_at timestamptz not null,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(company_id, idempotency_key),
  unique(company_id, initiating_message_id)
);


create index if not exists
commerce_payment_admin_actions_pending_idx
on public.commerce_payment_admin_actions (
  company_id,
  owner_phone_hash,
  status,
  expires_at
);


create unique index if not exists
commerce_payment_admin_actions_one_pending
on public.commerce_payment_admin_actions (
  company_id,
  owner_phone_hash
)
where
  status in (
    'pending_selection',
    'pending_confirmation'
  );


alter table
public.commerce_payment_admin_actions
enable row level security;


revoke all
on table public.commerce_payment_admin_actions
from public, anon, authenticated;


grant
  select,
  insert,
  update
on table public.commerce_payment_admin_actions
to service_role;



-- ============================================================
-- COMPROBANTES RECIBIDOS POR WHATSAPP
--
-- Un comprobante recibido NO confirma automáticamente un pago.
-- Primero queda pending_review.
-- ============================================================

create table if not exists
public.commerce_payment_submissions (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  customer_id uuid
    references public.commerce_customers(id)
    on delete set null,

  order_id uuid
    references public.commerce_orders(id)
    on delete set null,

  payment_account_id uuid
    references public.commerce_payment_accounts(id)
    on delete set null,

  payment_id uuid
    references public.commerce_payments(id)
    on delete set null,

  source text not null default 'whatsapp'
    check (
      source in (
        'whatsapp',
        'panel',
        'api',
        'import'
      )
    ),

  message_id uuid
    references public.messages(id)
    on delete set null,

  whatsapp_message_id text,
  customer_phone text,

  media_type text
    check (
      media_type is null
      or media_type in (
        'image',
        'document',
        'pdf'
      )
    ),

  media_mime_type text,
  media_sha256 text,

  declared_amount numeric(16, 2)
    check (
      declared_amount is null
      or declared_amount > 0
    ),

  detected_amount numeric(16, 2)
    check (
      detected_amount is null
      or detected_amount > 0
    ),

  detected_date date,
  detected_institution text,
  detected_reference text,
  detected_holder text,

  extraction_confidence numeric(5, 4)
    check (
      extraction_confidence is null
      or (
        extraction_confidence >= 0
        and extraction_confidence <= 1
      )
    ),

  extraction_data jsonb not null default '{}'::jsonb,

  status text not null default 'pending_review'
    check (
      status in (
        'received',
        'processing',
        'pending_review',
        'confirmed',
        'rejected',
        'cancelled',
        'duplicate'
      )
    ),

  duplicate_of_id uuid
    references public.commerce_payment_submissions(id)
    on delete set null,

  reviewed_by text,
  reviewed_at timestamptz,
  rejection_reason text,

  idempotency_key text not null,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(company_id, idempotency_key),

  check (
    media_sha256 is null
    or media_sha256
      ~ '^[a-f0-9]{64}$'
  ),

  check (
    status <> 'confirmed'
    or payment_id is not null
  ),

  check (
    status <> 'rejected'
    or nullif(
      btrim(rejection_reason),
      ''
    ) is not null
  ),

  check (
    status <> 'duplicate'
    or duplicate_of_id is not null
  )
);


create unique index if not exists
commerce_payment_submissions_message_unique
on public.commerce_payment_submissions (
  company_id,
  whatsapp_message_id
)
where
  whatsapp_message_id is not null
  and btrim(whatsapp_message_id) <> '';


create unique index if not exists
commerce_payment_submissions_internal_message_unique
on public.commerce_payment_submissions (
  company_id,
  message_id
)
where
  message_id is not null;


create index if not exists
commerce_payment_submissions_pending_idx
on public.commerce_payment_submissions (
  company_id,
  status,
  created_at
);


create index if not exists
commerce_payment_submissions_customer_idx
on public.commerce_payment_submissions (
  company_id,
  customer_id,
  created_at desc
);


create index if not exists
commerce_payment_submissions_order_idx
on public.commerce_payment_submissions (
  company_id,
  order_id,
  created_at desc
);


create index if not exists
commerce_payment_submissions_hash_idx
on public.commerce_payment_submissions (
  company_id,
  media_sha256
)
where
  media_sha256 is not null;


alter table
public.commerce_payment_submissions
enable row level security;


revoke all
on table public.commerce_payment_submissions
from public, anon, authenticated;


grant
  select,
  insert,
  update
on table public.commerce_payment_submissions
to service_role;



-- ============================================================
-- HISTORIAL DE REVISIÓN HUMANA
-- ============================================================

create table if not exists
public.commerce_payment_review_events (
  id uuid primary key default gen_random_uuid(),

  company_id text not null
    references public.commerce_companies(id)
    on delete cascade,

  submission_id uuid not null
    references public.commerce_payment_submissions(id)
    on delete cascade,

  event_type text not null
    check (
      event_type in (
        'received',
        'extraction_completed',
        'linked_to_order',
        'amount_corrected',
        'approved',
        'rejected',
        'marked_duplicate',
        'cancelled'
      )
    ),

  actor_id text,
  actor_name text,
  actor_role text,

  description text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);


create index if not exists
commerce_payment_review_events_submission_idx
on public.commerce_payment_review_events (
  submission_id,
  created_at
);


alter table
public.commerce_payment_review_events
enable row level security;


revoke all
on table public.commerce_payment_review_events
from public, anon, authenticated;


grant
  select,
  insert
on table public.commerce_payment_review_events
to service_role;



-- ============================================================
-- ASIGNACIÓN DE CUENTA DE COBRO A PEDIDOS
--
-- Permite congelar la cuenta indicada al cliente para que
-- un cambio futuro de cuenta predeterminada no altere pedidos
-- anteriores.
-- ============================================================

alter table public.commerce_orders
  add column if not exists
  payment_account_id uuid
    references public.commerce_payment_accounts(id)
    on delete set null;


alter table public.commerce_orders
  add column if not exists
  payment_account_snapshot jsonb;


create index if not exists
commerce_orders_payment_account_idx
on public.commerce_orders (
  company_id,
  payment_account_id
);




-- ============================================================
-- RECIBIR COMPROBANTE DESDE UN MENSAJE DE WHATSAPP
--
-- Garantías:
-- - valida company_id y mensaje;
-- - sólo acepta mensajes entrantes image/document;
-- - evita duplicados de forma transaccional;
-- - resuelve cliente por company_id + WhatsApp;
-- - vincula el pedido impago más reciente cuando existe;
-- - nunca confirma el pago automáticamente.
-- ============================================================

create or replace function
public.commerce_receive_payment_submission (
  p_company_id text,
  p_message_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message public.messages%rowtype;
  v_existing public.commerce_payment_submissions%rowtype;

  v_customer public.commerce_customers%rowtype;
  v_order public.commerce_orders%rowtype;

  v_media_id text;
  v_mime_type text;
  v_filename text;
  v_caption text;

  v_media_type text;
  v_idempotency_key text;

  v_submission public.commerce_payment_submissions%rowtype;
begin
  if nullif(
    btrim(p_company_id),
    ''
  ) is null then
    raise exception
      'PAYMENT_SUBMISSION_COMPANY_REQUIRED';
  end if;

  if p_message_id is null then
    raise exception
      'PAYMENT_SUBMISSION_MESSAGE_REQUIRED';
  end if;

  /*
   * Evita dos inserciones simultáneas para el mismo mensaje,
   * incluso antes de consultar el registro existente.
   */
  perform pg_advisory_xact_lock(
    hashtextextended(
      p_company_id
      || ':payment-submission:'
      || p_message_id::text,
      0
    )
  );

  select
    message.*
  into
    v_message
  from public.messages
    as message
  where
    message.company_id = p_company_id
    and message.id = p_message_id
  limit 1;

  if not found then
    raise exception
      'PAYMENT_SUBMISSION_MESSAGE_NOT_FOUND';
  end if;

  if v_message.direction <> 'inbound' then
    raise exception
      'PAYMENT_SUBMISSION_MESSAGE_NOT_INBOUND';
  end if;

  if v_message.channel <> 'whatsapp' then
    raise exception
      'PAYMENT_SUBMISSION_CHANNEL_NOT_ALLOWED';
  end if;

  if v_message.message_type not in (
    'image',
    'document'
  ) then
    raise exception
      'PAYMENT_SUBMISSION_MEDIA_TYPE_NOT_ALLOWED';
  end if;

  /*
   * Idempotencia: si este mensaje ya generó un comprobante,
   * devolvemos exactamente el registro existente.
   */
  select
    submission.*
  into
    v_existing
  from public.commerce_payment_submissions
    as submission
  where
    submission.company_id = p_company_id
    and submission.message_id = p_message_id
  limit 1;

  if found then
    return jsonb_build_object(
      'submission',
      to_jsonb(v_existing),

      'created',
      false,

      'duplicate',
      true,

      'customerResolved',
      v_existing.customer_id is not null,

      'orderResolved',
      v_existing.order_id is not null
    );
  end if;

  v_media_id =
    nullif(
      btrim(
        coalesce(
          v_message.media ->> 'id',
          ''
        )
      ),
      ''
    );

  v_mime_type =
    nullif(
      btrim(
        lower(
          coalesce(
            v_message.media ->> 'mime_type',
            ''
          )
        )
      ),
      ''
    );

  v_filename =
    nullif(
      btrim(
        coalesce(
          v_message.media ->> 'filename',
          ''
        )
      ),
      ''
    );

  v_caption =
    nullif(
      btrim(
        coalesce(
          v_message.media ->> 'caption',
          ''
        )
      ),
      ''
    );

  if v_media_id is null then
    raise exception
      'PAYMENT_SUBMISSION_MEDIA_ID_REQUIRED';
  end if;

  if
    v_message.message_type = 'image'
  then
    if
      v_mime_type is not null
      and v_mime_type not like 'image/%'
    then
      raise exception
        'PAYMENT_SUBMISSION_IMAGE_MIME_INVALID';
    end if;

    v_media_type := 'image';
  else
    if
      v_mime_type is distinct from 'application/pdf'
      and coalesce(
        lower(v_filename),
        ''
      ) not like '%.pdf'
    then
      raise exception
        'PAYMENT_SUBMISSION_DOCUMENT_NOT_PDF';
    end if;

    v_media_type := 'pdf';
  end if;

  /*
   * El número procede del webhook guardado, no de un valor
   * declarado por el cliente dentro del mensaje.
   */
  select
    customer.*
  into
    v_customer
  from public.commerce_customers
    as customer
  where
    customer.company_id = p_company_id
    and customer.whatsapp =
      v_message.contact_phone
  order by
    customer.created_at asc
  limit 1;

  /*
   * Primera versión segura:
   * vincula únicamente el pedido impago/parcial más reciente.
   * El operador podrá corregir la asignación desde el panel.
   */
  if v_customer.id is not null then
    select
      current_order.*
    into
      v_order
    from public.commerce_orders
      as current_order
    where
      current_order.company_id =
        p_company_id

      and current_order.customer_id =
        v_customer.id

      and current_order.payment_status in (
        'unpaid',
        'partial'
      )

      and current_order.commercial_status
        <> 'cancelled'

    order by
      current_order.created_at desc

    limit 1;
  end if;

  v_idempotency_key =
    'whatsapp-payment-submission:'
    || p_company_id
    || ':'
    || p_message_id::text;

  insert into public.commerce_payment_submissions (
    company_id,

    customer_id,
    order_id,

    payment_account_id,

    source,

    message_id,
    whatsapp_message_id,
    customer_phone,

    media_type,
    media_mime_type,

    status,

    idempotency_key,

    metadata
  )
  values (
    p_company_id,

    v_customer.id,
    v_order.id,

    v_order.payment_account_id,

    'whatsapp',

    v_message.id,
    v_message.external_message_id,
    v_message.contact_phone,

    v_media_type,
    v_mime_type,

    'pending_review',

    v_idempotency_key,

    jsonb_strip_nulls(
      jsonb_build_object(
        'whatsapp_media_id',
        v_media_id,

        'filename',
        v_filename,

        'caption',
        v_caption,

        'conversation_id',
        v_message.conversation_id,

        'crm_contact_id',
        v_message.contact_id,

        'message_occurred_at',
        v_message.occurred_at,

        'automatic_order_match',
        v_order.id is not null,

        'automatic_customer_match',
        v_customer.id is not null
      )
    )
  )
  returning *
  into v_submission;

  insert into public.commerce_payment_review_events (
    company_id,
    submission_id,

    event_type,

    actor_id,
    actor_name,
    actor_role,

    description,

    metadata
  )
  values (
    p_company_id,
    v_submission.id,

    'received',

    'whatsapp:' || v_message.contact_phone,
    'Cliente de WhatsApp',
    'customer',

    case
      when v_order.id is not null then
        'Comprobante recibido y vinculado automáticamente a un pedido pendiente.'
      when v_customer.id is not null then
        'Comprobante recibido; cliente identificado pero sin pedido pendiente vinculable.'
      else
        'Comprobante recibido; requiere identificación manual de cliente y pedido.'
    end,

    jsonb_strip_nulls(
      jsonb_build_object(
        'message_id',
        v_message.id,

        'whatsapp_message_id',
        v_message.external_message_id,

        'media_type',
        v_media_type,

        'mime_type',
        v_mime_type,

        'customer_id',
        v_customer.id,

        'order_id',
        v_order.id
      )
    )
  );

  return jsonb_build_object(
    'submission',
    to_jsonb(v_submission),

    'created',
    true,

    'duplicate',
    false,

    'customerResolved',
    v_customer.id is not null,

    'orderResolved',
    v_order.id is not null,

    'customer',
    case
      when v_customer.id is not null
        then jsonb_build_object(
          'id',
          v_customer.id,

          'name',
          coalesce(
            v_customer.business_name,
            v_customer.name
          )
        )
      else null
    end,

    'order',
    case
      when v_order.id is not null
        then jsonb_build_object(
          'id',
          v_order.id,

          'orderNumber',
          v_order.order_number,

          'total',
          v_order.total,

          'paidAmount',
          v_order.paid_amount,

          'remaining',
          greatest(
            v_order.total
            - v_order.paid_amount,
            0
          )
        )
      else null
    end
  );
end;
$$;


revoke all
on function public.commerce_receive_payment_submission(
  text,
  uuid
)
from public, anon, authenticated;


grant execute
on function public.commerce_receive_payment_submission(
  text,
  uuid
)
to service_role;



-- ============================================================
-- REGISTRO DE MIGRACIÓN
-- ============================================================

insert into public.commerce_schema_migrations (
  version,
  description
)
values (
  '20260806042000',
  'Cuentas de cobro, dueño autorizado y comprobantes pendientes de revisión'
)
on conflict(version)
do nothing;


commit;
