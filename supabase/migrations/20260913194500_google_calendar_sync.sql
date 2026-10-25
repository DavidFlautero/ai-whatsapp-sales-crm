begin;

alter table public.crm_events
  add column if not exists google_calendar_event_id text,
  add column if not exists google_calendar_id text,
  add column if not exists google_calendar_html_link text,
  add column if not exists google_calendar_synced_at timestamptz,
  add column if not exists google_calendar_sync_status text
    not null default 'not_synced',
  add column if not exists google_calendar_sync_error text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'crm_events_google_calendar_sync_status_check'
  ) then
    alter table public.crm_events
      add constraint crm_events_google_calendar_sync_status_check
      check (
        google_calendar_sync_status in (
          'not_synced',
          'synced',
          'error'
        )
      );
  end if;
end
$$;

create unique index if not exists
  crm_events_google_calendar_event_uidx
on public.crm_events(
  company_id,
  google_calendar_event_id
)
where google_calendar_event_id is not null;

commit;
