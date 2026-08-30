\set ON_ERROR_STOP on

begin;

set local statement_timeout = '120s';
set local lock_timeout = '10s';

insert into public.commerce_companies (
  id,
  name
)
values
  (
    'privacy_test_tenant_a',
    'Privacy Test Tenant A'
  ),
  (
    'privacy_test_tenant_b',
    'Privacy Test Tenant B'
  );

insert into public.privacy_data_subjects (
  id,
  company_id,
  subject_key,
  identifier_kind,
  identifier_digest,
  status
)
values
  (
    'aaaaaaaa-0000-4000-8000-000000000001',
    'privacy_test_tenant_a',
    'privacy-subject-tenant-a-0001',
    'phone',
    encode(
      extensions.digest(
        'tenant-a-phone',
        'sha256'
      ),
      'hex'
    ),
    'active'
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000002',
    'privacy_test_tenant_a',
    'privacy-subject-tenant-a-hold-0002',
    'phone',
    encode(
      extensions.digest(
        'tenant-a-hold-phone',
        'sha256'
      ),
      'hex'
    ),
    'active'
  ),
  (
    'bbbbbbbb-0000-4000-8000-000000000001',
    'privacy_test_tenant_b',
    'privacy-subject-tenant-b-0001',
    'phone',
    encode(
      extensions.digest(
        'tenant-b-phone',
        'sha256'
      ),
      'hex'
    ),
    'active'
  );

insert into public.privacy_requests (
  id,
  company_id,
  subject_id,
  request_code,
  request_type,
  status,
  source_channel,
  identity_verification_status,
  verified_at,
  verified_by_actor_id,
  priority,
  due_at,
  approved_at,
  approved_by_actor_id,
  idempotency_key,
  created_by_actor_id
)
values
  (
    'aaaaaaaa-1000-4000-8000-000000000001',
    'privacy_test_tenant_a',
    'aaaaaaaa-0000-4000-8000-000000000001',
    'PRIVACY_A_ERASE_001',
    'erasure',
    'approved',
    'panel',
    'verified',
    now(),
    'verifier-a',
    'normal',
    now() + interval '30 days',
    now(),
    'approver-a',
    'privacy-a-erase-001',
    'operator-creator'
  ),
  (
    'aaaaaaaa-1000-4000-8000-000000000002',
    'privacy_test_tenant_a',
    'aaaaaaaa-0000-4000-8000-000000000002',
    'PRIVACY_A_HOLD_001',
    'erasure',
    'approved',
    'panel',
    'verified',
    now(),
    'verifier-a',
    'high',
    now() + interval '30 days',
    now(),
    'approver-hold-a',
    'privacy-a-hold-001',
    'operator-creator'
  ),
  (
    'aaaaaaaa-1000-4000-8000-000000000003',
    'privacy_test_tenant_a',
    'aaaaaaaa-0000-4000-8000-000000000001',
    'PRIVACY_A_PATCH_001',
    'erasure',
    'approved',
    'panel',
    'verified',
    now(),
    'verifier-a',
    'normal',
    now() + interval '30 days',
    now(),
    'approver-patch-a',
    'privacy-a-patch-001',
    'operator-creator'
  ),
  (
    'bbbbbbbb-1000-4000-8000-000000000001',
    'privacy_test_tenant_b',
    'bbbbbbbb-0000-4000-8000-000000000001',
    'PRIVACY_B_ACCESS_001',
    'access',
    'received',
    'api',
    'pending',
    null,
    null,
    'normal',
    now() + interval '30 days',
    null,
    null,
    'privacy-b-access-001',
    'integration-test'
  );

insert into public.privacy_legal_holds (
  id,
  company_id,
  subject_id,
  status,
  reason_code,
  scope,
  starts_at,
  created_by_actor_id
)
values (
  'aaaaaaaa-2000-4000-8000-000000000001',
  'privacy_test_tenant_a',
  'aaaaaaaa-0000-4000-8000-000000000002',
  'active',
  'legal.audit_hold',
  jsonb_build_object(
    'request_id',
    'aaaaaaaa-1000-4000-8000-000000000002'
  ),
  now(),
  'legal-officer-a'
);

insert into public.privacy_tenant_policies (
  id,
  company_id,
  version,
  status,
  controller_name,
  activated_at,
  created_by_actor_id,
  updated_by_actor_id
)
values
  (
    'aaaaaaaa-3000-4000-8000-000000000001',
    'privacy_test_tenant_a',
    1,
    'active',
    'Tenant A Controller',
    now(),
    'owner-a',
    'owner-a'
  ),
  (
    'aaaaaaaa-3000-4000-8000-000000000002',
    'privacy_test_tenant_a',
    2,
    'draft',
    'Tenant A Controller',
    null,
    'owner-a',
    'owner-a'
  );

do $test$
declare
  failure_detected boolean := false;
begin
  begin
    perform
      public.privacy_transition_request_atomic(
        'privacy_test_tenant_b',
        'aaaaaaaa-1000-4000-8000-000000000001',
        1,
        'processing',
        'operator',
        'executor-cross-tenant',
        'corr-cross-tenant',
        'cross tenant must fail',
        '{}'::jsonb,
        '{}'::jsonb
      );
  exception
    when others then
      failure_detected := true;

      raise notice
        'EXPECTED_CROSS_TENANT_FAILURE=%',
        left(sqlerrm, 160);
  end;

  if not failure_detected then
    raise exception
      'cross_tenant_rpc_was_allowed';
  end if;

  if exists (
    select 1
    from public.privacy_requests
    where id =
      'aaaaaaaa-1000-4000-8000-000000000001'
      and (
        status <> 'approved'
        or version <> 1
      )
  ) then
    raise exception
      'cross_tenant_rpc_modified_request';
  end if;
end;
$test$;

select
  'TEST_CROSS_TENANT_RPC=PASS';

do $test$
declare
  failure_detected boolean := false;
begin
  begin
    perform
      public.privacy_transition_request_atomic(
        'privacy_test_tenant_a',
        'aaaaaaaa-1000-4000-8000-000000000001',
        999,
        'processing',
        'operator',
        'executor-version',
        'corr-version',
        'invalid expected version',
        '{}'::jsonb,
        '{}'::jsonb
      );
  exception
    when others then
      failure_detected := true;

      raise notice
        'EXPECTED_VERSION_FAILURE=%',
        left(sqlerrm, 160);
  end;

  if not failure_detected then
    raise exception
      'optimistic_version_was_not_enforced';
  end if;

  if exists (
    select 1
    from public.privacy_requests
    where id =
      'aaaaaaaa-1000-4000-8000-000000000001'
      and version <> 1
  ) then
    raise exception
      'version_failure_modified_request';
  end if;
end;
$test$;

select
  'TEST_OPTIMISTIC_VERSION=PASS';

do $test$
declare
  failure_detected boolean := false;
begin
  begin
    perform
      public.privacy_transition_request_atomic(
        'privacy_test_tenant_a',
        'aaaaaaaa-1000-4000-8000-000000000001',
        1,
        'processing',
        'operator',
        'approver-a',
        'corr-dual-control',
        'same approver cannot execute',
        '{}'::jsonb,
        '{}'::jsonb
      );
  exception
    when others then
      failure_detected := true;

      raise notice
        'EXPECTED_DUAL_CONTROL_FAILURE=%',
        left(sqlerrm, 160);
  end;

  if not failure_detected then
    raise exception
      'dual_control_was_not_enforced';
  end if;

  if exists (
    select 1
    from public.privacy_requests
    where id =
      'aaaaaaaa-1000-4000-8000-000000000001'
      and status <> 'approved'
  ) then
    raise exception
      'dual_control_failure_modified_request';
  end if;
end;
$test$;

select
  'TEST_DUAL_CONTROL=PASS';

set local role service_role;

do $test$
begin
  perform
    public.privacy_transition_request_atomic(
      'privacy_test_tenant_a',
      'aaaaaaaa-1000-4000-8000-000000000001',
      1,
      'processing',
      'operator',
      'executor-a',
      'corr-valid-processing',
      'authorized execution',
      jsonb_build_object(
        'assigned_to_actor_id',
        'executor-a'
      ),
      jsonb_build_object(
        'test',
        true
      )
    );
end;
$test$;

reset role;

do $test$
begin
  if not exists (
    select 1
    from public.privacy_requests
    where id =
      'aaaaaaaa-1000-4000-8000-000000000001'
      and company_id =
        'privacy_test_tenant_a'
      and status =
        'processing'
      and version = 2
      and executed_by_actor_id =
        'executor-a'
      and execution_started_at
        is not null
  ) then
    raise exception
      'valid_transition_not_persisted';
  end if;
end;
$test$;

select
  'TEST_VALID_SERVICE_ROLE_TRANSITION=PASS';

do $test$
declare
  failure_detected boolean := false;
begin
  begin
    perform
      public.privacy_transition_request_atomic(
        'privacy_test_tenant_a',
        'aaaaaaaa-1000-4000-8000-000000000003',
        1,
        'processing',
        'operator',
        'executor-patch-a',
        'corr-protected-patch',
        'protected patch must fail',
        jsonb_build_object(
          'company_id',
          'privacy_test_tenant_b'
        ),
        '{}'::jsonb
      );
  exception
    when others then
      failure_detected := true;

      raise notice
        'EXPECTED_PROTECTED_PATCH_FAILURE=%',
        left(sqlerrm, 160);
  end;

  if not failure_detected then
    raise exception
      'protected_patch_was_allowed';
  end if;

  if exists (
    select 1
    from public.privacy_requests
    where id =
      'aaaaaaaa-1000-4000-8000-000000000003'
      and (
        company_id <>
          'privacy_test_tenant_a'
        or status <> 'approved'
        or version <> 1
      )
  ) then
    raise exception
      'protected_patch_modified_request';
  end if;
end;
$test$;

select
  'TEST_PROTECTED_PATCH=PASS';

do $test$
declare
  failure_detected boolean := false;
begin
  begin
    perform
      public.privacy_transition_request_atomic(
        'privacy_test_tenant_a',
        'aaaaaaaa-1000-4000-8000-000000000002',
        1,
        'processing',
        'operator',
        'executor-hold-a',
        'corr-legal-hold',
        'legal hold must block erasure',
        '{}'::jsonb,
        '{}'::jsonb
      );
  exception
    when others then
      failure_detected := true;

      raise notice
        'EXPECTED_LEGAL_HOLD_FAILURE=%',
        left(sqlerrm, 160);
  end;

  if not failure_detected then
    raise exception
      'legal_hold_did_not_block_erasure';
  end if;

  if exists (
    select 1
    from public.privacy_requests
    where id =
      'aaaaaaaa-1000-4000-8000-000000000002'
      and (
        status <> 'approved'
        or version <> 1
      )
  ) then
    raise exception
      'legal_hold_failure_modified_request';
  end if;
end;
$test$;

select
  'TEST_LEGAL_HOLD=PASS';

set local role service_role;

do $test$
begin
  perform
    public.privacy_transition_request_atomic(
      'privacy_test_tenant_a',
      'aaaaaaaa-1000-4000-8000-000000000001',
      2,
      'partially_fulfilled',
      'operator',
      'executor-a',
      'corr-partial',
      'partial completion for chain test',
      jsonb_build_object(
        'result_summary',
        jsonb_build_object(
          'processed_stores',
          2
        )
      ),
      jsonb_build_object(
        'stage',
        'partial'
      )
    );
end;
$test$;

reset role;

do $test$
declare
  event_count integer;
  valid_digest_count integer;
  linked_count integer;
begin
  select
    count(*),
    count(*) filter (
      where length(event_digest) = 64
    )
  into
    event_count,
    valid_digest_count
  from public.privacy_request_events
  where request_id =
    'aaaaaaaa-1000-4000-8000-000000000001';

  select count(*)
  into linked_count
  from public.privacy_request_events current_event
  join public.privacy_request_events previous_event
    on previous_event.request_id =
      current_event.request_id
    and previous_event.sequence_number =
      current_event.sequence_number - 1
    and previous_event.event_digest =
      current_event.previous_digest
  where current_event.request_id =
    'aaaaaaaa-1000-4000-8000-000000000001'
    and current_event.sequence_number > 1;

  if event_count <> 2 then
    raise exception
      'unexpected_event_count:%',
      event_count;
  end if;

  if valid_digest_count <> 2 then
    raise exception
      'invalid_event_digest_count:%',
      valid_digest_count;
  end if;

  if linked_count <> 1 then
    raise exception
      'event_chain_not_linked:%',
      linked_count;
  end if;

  if not exists (
    select 1
    from public.privacy_requests
    where id =
      'aaaaaaaa-1000-4000-8000-000000000001'
      and status =
        'partially_fulfilled'
      and version = 3
  ) then
    raise exception
      'second_transition_not_persisted';
  end if;
end;
$test$;

select
  'TEST_EVENT_SHA256_CHAIN=PASS';

do $test$
declare
  failure_detected boolean := false;
begin
  begin
    perform
      public.privacy_activate_policy_atomic(
        'privacy_test_tenant_b',
        'aaaaaaaa-3000-4000-8000-000000000002',
        'owner-b'
      );
  exception
    when others then
      failure_detected := true;

      raise notice
        'EXPECTED_POLICY_TENANT_FAILURE=%',
        left(sqlerrm, 160);
  end;

  if not failure_detected then
    raise exception
      'cross_tenant_policy_activation_allowed';
  end if;
end;
$test$;

select
  'TEST_POLICY_CROSS_TENANT=PASS';

set local role service_role;

do $test$
begin
  perform
    public.privacy_activate_policy_atomic(
      'privacy_test_tenant_a',
      'aaaaaaaa-3000-4000-8000-000000000002',
      'owner-a'
    );
end;
$test$;

reset role;

do $test$
declare
  active_count integer;
begin
  select count(*)
  into active_count
  from public.privacy_tenant_policies
  where company_id =
    'privacy_test_tenant_a'
    and status = 'active';

  if active_count <> 1 then
    raise exception
      'invalid_active_policy_count:%',
      active_count;
  end if;

  if not exists (
    select 1
    from public.privacy_tenant_policies
    where id =
      'aaaaaaaa-3000-4000-8000-000000000001'
      and status = 'retired'
      and retired_at is not null
  ) then
    raise exception
      'previous_policy_not_retired';
  end if;

  if not exists (
    select 1
    from public.privacy_tenant_policies
    where id =
      'aaaaaaaa-3000-4000-8000-000000000002'
      and status = 'active'
      and activated_at is not null
      and updated_by_actor_id =
        'owner-a'
  ) then
    raise exception
      'draft_policy_not_activated';
  end if;
end;
$test$;

select
  'TEST_ATOMIC_POLICY_ACTIVATION=PASS';

grant select
on public.privacy_requests
to authenticated;

set local role authenticated;

do $test$
declare
  visible_rows integer;
begin
  select count(*)
  into visible_rows
  from public.privacy_requests;

  if visible_rows <> 0 then
    raise exception
      'authenticated_role_saw_rows:%',
      visible_rows;
  end if;
end;
$test$;

reset role;

select
  'TEST_RLS_DENY_WITHOUT_POLICY=PASS';

set local role service_role;

do $test$
declare
  visible_rows integer;
begin
  select count(*)
  into visible_rows
  from public.privacy_requests;

  if visible_rows <> 4 then
    raise exception
      'service_role_unexpected_rows:%',
      visible_rows;
  end if;
end;
$test$;

reset role;

select
  'TEST_SERVICE_ROLE_BYPASS=PASS';

do $test$
declare
  tenant_a_count integer;
  tenant_b_count integer;
begin
  select count(*)
  into tenant_a_count
  from public.privacy_requests
  where company_id =
    'privacy_test_tenant_a';

  select count(*)
  into tenant_b_count
  from public.privacy_requests
  where company_id =
    'privacy_test_tenant_b';

  if tenant_a_count <> 3 then
    raise exception
      'tenant_a_count_invalid:%',
      tenant_a_count;
  end if;

  if tenant_b_count <> 1 then
    raise exception
      'tenant_b_count_invalid:%',
      tenant_b_count;
  end if;
end;
$test$;

select
  'TEST_EXPLICIT_TENANT_FILTERS=PASS';

rollback;
