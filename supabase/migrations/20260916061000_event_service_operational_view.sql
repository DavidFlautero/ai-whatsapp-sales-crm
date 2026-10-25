create or replace view public.crm_event_service_operations
as
select
  r.*,

  (
    coalesce(r.client_price, 0)
    - coalesce(r.provider_cost, 0)
  ) as expected_margin,

  greatest(
    coalesce(r.deposit_required, 0)
    - coalesce(r.deposit_paid, 0),
    0
  ) as provider_deposit_pending,

  case
    when r.is_critical = true
      and r.service_status not in (
        'confirmed',
        'completed'
      )
      then true

    when r.assigned_provider_id is null
      and r.service_status in (
        'approved',
        'confirmed'
      )
      then true

    when r.contract_status in (
      'pending',
      'generated',
      'sent'
    )
      and r.service_status = 'confirmed'
      then true

    when coalesce(r.deposit_required, 0)
       > coalesce(r.deposit_paid, 0)
      and r.service_status = 'confirmed'
      then true

    else false
  end as has_operational_risk

from public.crm_event_requirements r;


create or replace view public.crm_event_readiness
as
select
  e.company_id,
  e.id as event_id,

  count(r.id) as total_services,

  count(r.id)
    filter (
      where r.service_status in (
        'confirmed',
        'completed'
      )
    ) as closed_services,

  count(r.id)
    filter (
      where r.service_status in (
        'pending',
        'searching',
        'quoted',
        'approved'
      )
    ) as open_services,

  count(r.id)
    filter (
      where r.is_critical = true
      and r.service_status not in (
        'confirmed',
        'completed',
        'cancelled'
      )
    ) as critical_pending,

  count(r.id)
    filter (
      where r.assigned_provider_id is null
      and r.service_status <> 'cancelled'
    ) as without_provider,

  count(r.id)
    filter (
      where coalesce(r.deposit_required, 0)
          > coalesce(r.deposit_paid, 0)
      and r.service_status <> 'cancelled'
    ) as payments_pending,

  case
    when count(r.id) = 0
      then 0

    else round(
      (
        count(r.id)
          filter (
            where r.service_status in (
              'confirmed',
              'completed'
            )
          )::numeric
        /
        count(r.id)::numeric
      ) * 100
    )
  end as readiness_percent,

  (
    count(r.id)
      filter (
        where r.is_critical = true
        and r.service_status not in (
          'confirmed',
          'completed',
          'cancelled'
        )
      )
    = 0
  ) as critical_ready

from public.crm_events e

left join public.crm_event_requirements r
  on r.company_id = e.company_id
 and r.event_id = e.id

group by
  e.company_id,
  e.id;
