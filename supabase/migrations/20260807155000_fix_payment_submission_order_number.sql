begin;

-- Corrige el nombre real de la columna de commerce_orders.
-- commerce_orders usa "number", no "order_number".

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
          v_order.number,

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

insert into public.commerce_schema_migrations (
  version,
  description
)
values (
  '20260807155000',
  'Corrige orderNumber en recepción de comprobantes WhatsApp'
)
on conflict(version)
do nothing;

commit;
