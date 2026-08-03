begin;

-- Funciones transaccionales: sólo backend con service_role.

revoke all on function public.commerce_create_order(
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) from public, anon, authenticated;

grant execute on function public.commerce_create_order(
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) to service_role;


revoke all on function public.commerce_next_order_number(
  text
) from public, anon, authenticated;

grant execute on function public.commerce_next_order_number(
  text
) to service_role;


revoke all on function public.commerce_record_payment(
  uuid,
  numeric,
  text,
  text,
  jsonb
) from public, anon, authenticated;

grant execute on function public.commerce_record_payment(
  uuid,
  numeric,
  text,
  text,
  jsonb
) to service_role;


revoke all on function public.commerce_release_expired_reservations(
  integer
) from public, anon, authenticated;

grant execute on function public.commerce_release_expired_reservations(
  integer
) to service_role;


revoke all on function public.commerce_transition_fulfillment(
  uuid,
  text,
  jsonb,
  jsonb
) from public, anon, authenticated;

grant execute on function public.commerce_transition_fulfillment(
  uuid,
  text,
  jsonb,
  jsonb
) to service_role;


-- Función interna de triggers. No debe exponerse como RPC pública.

revoke all on function public.commerce_touch_updated_at()
from public, anon, authenticated;


-- Evita que las funciones creadas en el futuro vuelvan a concederse
-- automáticamente a anon y authenticated.

alter default privileges
for role postgres
in schema public
revoke all on functions from public;

alter default privileges
for role postgres
in schema public
revoke all on functions from anon;

alter default privileges
for role postgres
in schema public
revoke all on functions from authenticated;

alter default privileges
for role postgres
in schema public
grant execute on functions to service_role;

commit;
