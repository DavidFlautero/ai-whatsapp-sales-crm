-- ============================================================
-- FIX crm_event_requirements.contract_status
--
-- La columna podía existir antes de la migración operativa.
-- ADD COLUMN IF NOT EXISTS no modifica el DEFAULT de una
-- columna preexistente.
-- ============================================================

alter table public.crm_event_requirements
  alter column contract_status
  set default 'not_required';


update public.crm_event_requirements
set contract_status = 'not_required'
where contract_status is null
   or contract_status not in (
     'not_required',
     'pending',
     'generated',
     'sent',
     'signed',
     'cancelled'
   );
