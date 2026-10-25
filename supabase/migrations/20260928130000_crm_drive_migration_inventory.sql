CREATE TABLE IF NOT EXISTS public.crm_drive_migration_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  company_id text NOT NULL,

  source_id text NOT NULL,
  source_parent_id text,
  source_path text,
  source_name text NOT NULL,
  source_mime_type text,

  source_created_at timestamptz,
  source_modified_at timestamptz,

  item_kind text NOT NULL DEFAULT 'file'
    CHECK (item_kind IN ('file','folder')),

  migration_scope text NOT NULL DEFAULT 'operational'
    CHECK (migration_scope IN (
      'operational',
      'media',
      'personal_excluded',
      'unknown'
    )),

  entity_type text
    CHECK (
      entity_type IS NULL
      OR entity_type IN (
        'company',
        'general',
        'provider',
        'venue',
        'event',
        'client'
      )
    ),

  provider_id uuid,
  venue_id uuid,
  event_id uuid,

  crm_file_id uuid,

  migration_status text NOT NULL DEFAULT 'pending'
    CHECK (migration_status IN (
      'pending',
      'imported',
      'partially_imported',
      'skipped',
      'error'
    )),

  structured_data_imported boolean NOT NULL DEFAULT false,
  physical_file_imported boolean NOT NULL DEFAULT false,

  skip_reason text,
  error_message text,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(company_id, source_id)
);

CREATE INDEX IF NOT EXISTS
  crm_drive_migration_inventory_company_idx
ON public.crm_drive_migration_inventory(company_id);

CREATE INDEX IF NOT EXISTS
  crm_drive_migration_inventory_status_idx
ON public.crm_drive_migration_inventory(
  company_id,
  migration_status
);

CREATE INDEX IF NOT EXISTS
  crm_drive_migration_inventory_scope_idx
ON public.crm_drive_migration_inventory(
  company_id,
  migration_scope
);

CREATE INDEX IF NOT EXISTS
  crm_drive_migration_inventory_venue_idx
ON public.crm_drive_migration_inventory(venue_id);

CREATE INDEX IF NOT EXISTS
  crm_drive_migration_inventory_provider_idx
ON public.crm_drive_migration_inventory(provider_id);
