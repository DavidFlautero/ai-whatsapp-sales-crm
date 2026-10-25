alter table public.crm_events
  add column if not exists event_end_date date;

comment on column public.crm_events.event_end_date is
  'Fecha final cuando el evento ocupa más de un día. Si es null se considera igual a event_date.';

update public.crm_events
set event_end_date = event_date
where event_end_date is null
  and event_date is not null;
