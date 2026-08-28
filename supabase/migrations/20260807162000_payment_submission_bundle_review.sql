begin;

-- ============================================================
-- APROBAR BUNDLE DE COMPROBANTES
-- ============================================================

create or replace function
public.commerce_approve_payment_submission_bundle(
  p_company_id text,
  p_submission_id uuid,
  p_amount numeric,
  p_actor jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission
    public.commerce_payment_submissions%rowtype;

  v_order
    public.commerce_orders%rowtype;

  v_payment
    public.commerce_payments%rowtype;

  v_reference text;
  v_payment_result jsonb;

  v_confirmed_count integer := 0;
begin
  if
    p_company_id is null
    or btrim(p_company_id) = ''
  then
    raise exception
      'PAYMENT_REVIEW_COMPANY_REQUIRED';
  end if;

  if p_submission_id is null then
    raise exception
      'PAYMENT_REVIEW_SUBMISSION_REQUIRED';
  end if;

  if
    p_amount is null
    or p_amount <= 0
  then
    raise exception
      'PAYMENT_REVIEW_AMOUNT_INVALID';
  end if;

  select *
  into v_submission
  from public.commerce_payment_submissions
  where
    id = p_submission_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception
      'PAYMENT_SUBMISSION_NOT_FOUND';
  end if;

  if v_submission.status = 'confirmed' then
    return jsonb_build_object(
      'ok',
      true,

      'idempotent',
      true,

      'submission',
      to_jsonb(v_submission),

      'paymentId',
      v_submission.payment_id
    );
  end if;

  if v_submission.status <> 'pending_review' then
    raise exception
      'PAYMENT_SUBMISSION_NOT_REVIEWABLE: %',
      v_submission.status;
  end if;

  if v_submission.order_id is null then
    raise exception
      'PAYMENT_SUBMISSION_ORDER_REQUIRED';
  end if;

  /*
   * Bloqueamos todas las submissions pendientes
   * del mismo pedido.
   */
  perform 1
  from public.commerce_payment_submissions
  where
    company_id = p_company_id
    and order_id = v_submission.order_id
    and status = 'pending_review'
  for update;

  select *
  into v_order
  from public.commerce_orders
  where
    id = v_submission.order_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception
      'PAYMENT_SUBMISSION_ORDER_NOT_FOUND';
  end if;

  if v_order.commercial_status = 'cancelled' then
    raise exception
      'PAYMENT_SUBMISSION_ORDER_CANCELLED';
  end if;

  if
    p_amount
    > (
      v_order.total
      - v_order.paid_amount
    )
  then
    raise exception
      'PAYMENT_AMOUNT_EXCEEDS_REMAINING_BALANCE';
  end if;

  /*
   * Una sola referencia / un solo pago
   * para todo el bundle.
   */
  v_reference :=
    'whatsapp-submission-bundle:'
    || v_submission.id::text;

  v_payment_result :=
    public.commerce_record_payment(
      v_order.id,
      p_amount,
      'bank_transfer',
      v_reference,
      p_actor
    );

  select *
  into v_payment
  from public.commerce_payments
  where
    company_id = p_company_id
    and order_id = v_order.id
    and reference = v_reference
  order by created_at desc
  limit 1;

  if not found then
    raise exception
      'PAYMENT_REVIEW_PAYMENT_NOT_FOUND_AFTER_RECORD';
  end if;

  /*
   * Todas las submissions pendientes del mismo pedido
   * quedan confirmadas con el MISMO payment_id.
   */
  update public.commerce_payment_submissions
  set
    payment_id =
      v_payment.id,

    declared_amount =
      case
        when id = v_submission.id
          then p_amount
        else declared_amount
      end,

    status =
      'confirmed',

    reviewed_by =
      nullif(
        p_actor ->> 'id',
        ''
      ),

    reviewed_at =
      now(),

    rejection_reason =
      null,

    updated_at =
      now(),

    metadata =
      coalesce(
        metadata,
        '{}'::jsonb
      )
      || jsonb_strip_nulls(
        jsonb_build_object(
          'bundle_submission_id',
          v_submission.id,

          'bundle_payment_id',
          v_payment.id,

          'payment_reference',
          v_reference,

          'review_actor_name',
          nullif(
            p_actor ->> 'name',
            ''
          ),

          'review_actor_role',
          nullif(
            p_actor ->> 'role',
            ''
          ),

          'approved_amount',
          case
            when id = v_submission.id
              then p_amount
            else null
          end
        )
      )
  where
    company_id = p_company_id
    and order_id = v_order.id
    and status = 'pending_review';

  get diagnostics
    v_confirmed_count =
      row_count;

  /*
   * Auditoría individual por cada archivo.
   */
  insert into
  public.commerce_payment_review_events (
    company_id,
    submission_id,

    event_type,

    actor_id,
    actor_name,
    actor_role,

    description,

    metadata
  )
  select
    p_company_id,
    submission.id,

    'approved',

    nullif(
      p_actor ->> 'id',
      ''
    ),

    nullif(
      p_actor ->> 'name',
      ''
    ),

    nullif(
      p_actor ->> 'role',
      ''
    ),

    'Comprobante aprobado como parte de un bundle y pago registrado.',

    jsonb_build_object(
      'amount',
      p_amount,

      'paymentId',
      v_payment.id,

      'orderId',
      v_order.id,

      'reference',
      v_reference,

      'bundleRootSubmissionId',
      v_submission.id
    )
  from public.commerce_payment_submissions
  as submission
  where
    submission.company_id =
      p_company_id
    and submission.order_id =
      v_order.id
    and submission.payment_id =
      v_payment.id
    and submission.status =
      'confirmed';

  return jsonb_build_object(
    'ok',
    true,

    'idempotent',
    false,

    'confirmedCount',
    v_confirmed_count,

    'rootSubmissionId',
    v_submission.id,

    'payment',
    to_jsonb(v_payment),

    'order',
    v_payment_result
  );
end;
$$;


-- ============================================================
-- RECHAZAR BUNDLE DE COMPROBANTES
-- ============================================================

create or replace function
public.commerce_reject_payment_submission_bundle(
  p_company_id text,
  p_submission_id uuid,
  p_reason text,
  p_actor jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission
    public.commerce_payment_submissions%rowtype;

  v_reason text;

  v_rejected_count integer := 0;
begin
  if
    p_company_id is null
    or btrim(p_company_id) = ''
  then
    raise exception
      'PAYMENT_REVIEW_COMPANY_REQUIRED';
  end if;

  if p_submission_id is null then
    raise exception
      'PAYMENT_REVIEW_SUBMISSION_REQUIRED';
  end if;

  v_reason :=
    nullif(
      btrim(
        coalesce(
          p_reason,
          ''
        )
      ),
      ''
    );

  if v_reason is null then
    raise exception
      'PAYMENT_REJECTION_REASON_REQUIRED';
  end if;

  select *
  into v_submission
  from public.commerce_payment_submissions
  where
    id = p_submission_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception
      'PAYMENT_SUBMISSION_NOT_FOUND';
  end if;

  if v_submission.status = 'rejected' then
    return jsonb_build_object(
      'ok',
      true,

      'idempotent',
      true,

      'submission',
      to_jsonb(v_submission)
    );
  end if;

  if v_submission.status <> 'pending_review' then
    raise exception
      'PAYMENT_SUBMISSION_NOT_REVIEWABLE: %',
      v_submission.status;
  end if;

  if v_submission.order_id is null then
    raise exception
      'PAYMENT_SUBMISSION_ORDER_REQUIRED';
  end if;

  perform 1
  from public.commerce_payment_submissions
  where
    company_id = p_company_id
    and order_id = v_submission.order_id
    and status = 'pending_review'
  for update;

  update public.commerce_payment_submissions
  set
    status =
      'rejected',

    reviewed_by =
      nullif(
        p_actor ->> 'id',
        ''
      ),

    reviewed_at =
      now(),

    rejection_reason =
      v_reason,

    updated_at =
      now(),

    metadata =
      coalesce(
        metadata,
        '{}'::jsonb
      )
      || jsonb_strip_nulls(
        jsonb_build_object(
          'bundle_submission_id',
          v_submission.id,

          'review_actor_name',
          nullif(
            p_actor ->> 'name',
            ''
          ),

          'review_actor_role',
          nullif(
            p_actor ->> 'role',
            ''
          )
        )
      )
  where
    company_id = p_company_id
    and order_id = v_submission.order_id
    and status = 'pending_review';

  get diagnostics
    v_rejected_count =
      row_count;

  insert into
  public.commerce_payment_review_events (
    company_id,
    submission_id,

    event_type,

    actor_id,
    actor_name,
    actor_role,

    description,

    metadata
  )
  select
    p_company_id,
    submission.id,

    'rejected',

    nullif(
      p_actor ->> 'id',
      ''
    ),

    nullif(
      p_actor ->> 'name',
      ''
    ),

    nullif(
      p_actor ->> 'role',
      ''
    ),

    v_reason,

    jsonb_build_object(
      'reason',
      v_reason,

      'orderId',
      v_submission.order_id,

      'bundleRootSubmissionId',
      v_submission.id
    )
  from public.commerce_payment_submissions
  as submission
  where
    submission.company_id =
      p_company_id
    and submission.order_id =
      v_submission.order_id
    and submission.status =
      'rejected'
    and submission.reviewed_at
      >= now() - interval '5 seconds';

  return jsonb_build_object(
    'ok',
    true,

    'idempotent',
    false,

    'rejectedCount',
    v_rejected_count,

    'rootSubmissionId',
    v_submission.id
  );
end;
$$;


-- ============================================================
-- SEGURIDAD
-- ============================================================

revoke all
on function
public.commerce_approve_payment_submission_bundle(
  text,
  uuid,
  numeric,
  jsonb
)
from public, anon, authenticated;

grant execute
on function
public.commerce_approve_payment_submission_bundle(
  text,
  uuid,
  numeric,
  jsonb
)
to service_role;


revoke all
on function
public.commerce_reject_payment_submission_bundle(
  text,
  uuid,
  text,
  jsonb
)
from public, anon, authenticated;

grant execute
on function
public.commerce_reject_payment_submission_bundle(
  text,
  uuid,
  text,
  jsonb
)
to service_role;


insert into public.commerce_schema_migrations (
  version,
  description
)
values (
  '20260807162000',
  'Aprobación y rechazo transaccional de bundles de comprobantes'
)
on conflict(version)
do nothing;

commit;
