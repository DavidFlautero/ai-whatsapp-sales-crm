begin;

insert into public.commerce_companies (
  id,
  name,
  active
)
values (
  'eventos-mediterraneo',
  'Eventos Mediterráneo',
  true
)
on conflict (id)
do update
set
  name = excluded.name,
  active = true,
  updated_at = now();

commit;
