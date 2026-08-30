import {
  readFileSync,
} from "node:fs";

const files = {
  migration:
    "supabase/migrations/"
    + "20260828090000_privacy_compliance_core.sql",

  store:
    "apps/api/src/modules/privacy/"
    + "privacy-application.store.ts",

  repository:
    "apps/api/src/modules/privacy/"
    + "privacy.repository.ts",

  atomicRepository:
    "apps/api/src/modules/privacy/"
    + "privacy-atomic.repository.ts",

  routes:
    "apps/api/src/modules/privacy/"
    + "privacy.routes.ts",

  privacyHttp:
    "apps/api/src/modules/privacy/"
    + "privacy-http.ts",

  createApp:
    "apps/api/src/server/createApp.ts",

  permissions:
    "apps/api/src/core/authorization/"
    + "permission.catalog.ts",

  roles:
    "apps/api/src/core/authorization/"
    + "role-policy.ts",

  supabase:
    "apps/api/src/services/db/"
    + "supabase-rest.client.ts",

  transcription:
    "apps/api/src/services/audio/"
    + "audio-transcription.service.ts",
};

const source =
  Object.fromEntries(
    Object.entries(files)
      .map(
        ([key, path]) => [
          key,
          readFileSync(
            path,
            "utf8",
          ),
        ],
      ),
  );

function countMatches(
  text,
  expression,
) {
  return (
    text.match(expression)
    ?? []
  ).length;
}

function removeComments(
  text,
) {
  return text
    .replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    )
    .replace(
      /(^|[^:])\/\/.*$/gm,
      "$1",
    );
}

const privacyExecutableSource =
  removeComments(
    source.store
    + "\n"
    + source.repository,
  );

const privacyPermissions =
  new Set(
    source.permissions.match(
      /"privacy\.[a-z._]+"/g,
    ) ?? [],
  );

const privacyRouteCount =
  countMatches(
    source.routes,
    /\.(?:get|post|put|patch|delete)\s*\(/g,
  );

const namedDirectDelete =
  /(?:export\s+)?(?:async\s+)?function\s+deletePrivacyRows\b/
    .test(
      privacyExecutableSource,
    )
  || /(?:const|let|var)\s+deletePrivacyRows\s*=/
    .test(
      privacyExecutableSource,
    )
  || /\bdeletePrivacyRows\s*\(/
    .test(
      privacyExecutableSource,
    );

const directDeleteRequest =
  /method\s*:\s*["']DELETE["']/
    .test(
      privacyExecutableSource,
    );

const checks = [
  {
    name:
      "nine_privacy_tables",

    passed:
      countMatches(
        source.migration,
        /^create table public\.privacy_/gm,
      ) === 9,
  },

  {
    name:
      "rls_enabled_nine",

    passed:
      countMatches(
        source.migration,
        /enable row level security;/g,
      ) === 9,
  },

  {
    name:
      "rls_forced_nine",

    passed:
      countMatches(
        source.migration,
        /force row level security;/g,
      ) === 9,
  },

  {
    name:
      "atomic_transition_rpc",

    passed:
      source.migration.includes(
        "privacy_transition_request_atomic",
      ),
  },

  {
    name:
      "atomic_policy_rpc",

    passed:
      source.migration.includes(
        "privacy_activate_policy_atomic",
      ),
  },

  {
    name:
      "dual_control_db",

    passed:
      source.migration.includes(
        "PRIVACY_DUAL_CONTROL_REQUIRED",
      )
      && source.migration.includes(
        "PRIVACY_ERASURE_APPROVAL_REQUIRED",
      )
      && source.migration.includes(
        "PRIVACY_ERASURE_APPROVER_CANNOT_EXECUTE",
      )
      && (
        /v_request\.approved_by_actor_id\s*=\s*p_actor_id/s
      ).test(
        source.migration,
      )
      && (
        /v_request\.request_type\s*=\s*'erasure'/s
      ).test(
        source.migration,
      ),
  },

  {
    name:
      "legal_hold_db",

    passed:
      source.migration.includes(
        "privacy_legal_holds",
      )
      && source.migration.includes(
        "legal_hold_detected",
      )
      && source.migration.includes(
        "privacy_transition_request_atomic",
      ),
  },

  {
    name:
      "optimistic_version_db",

    passed:
      countMatches(
        source.migration,
        /\bp_expected_version\b/g,
      ) >= 2
      && (
        /v_request\.version\s*(?:<>|!=|=)\s*p_expected_version/
          .test(
            source.migration,
          )
        || /p_expected_version\s*(?:<>|!=|=)\s*v_request\.version/
          .test(
            source.migration,
          )
      )
      && /version\s*=\s*[^,\n;]+\+\s*1/
        .test(
          source.migration,
        ),
  },

  {
    name:
      "atomic_repository",

    passed:
      source.atomicRepository.includes(
        "transitionPrivacyRequestAtomic",
      )
      && source.atomicRepository.includes(
        "activatePrivacyPolicyAtomic",
      )
      && source.atomicRepository.includes(
        "supabaseRpc",
      ),
  },

  {
    name:
      "eleven_permissions",

    passed:
      privacyPermissions.size === 11,
  },

  {
    name:
      "admin_cannot_approve",

    passed:
      /permission\s*!==\s*"privacy\.requests\.approve"/
        .test(
          source.roles,
        ),
  },

  {
    name:
      "admin_cannot_erase",

    passed:
      /permission\s*!==\s*"privacy\.erasure\.execute"/
        .test(
          source.roles,
        ),
  },

  {
    name:
      "eleven_routes",

    passed:
      privacyRouteCount === 11,
  },

  {
    name:
      "tenant_filter_required",

    passed:
      source.repository.includes(
        "company_id",
      )
      && source.repository.includes(
        "companyId",
      )
      && /x-company-id/i.test(
        source.routes
        + "\n"
        + source.privacyHttp
        + "\n"
        + source.createApp,
      ),
  },

  {
    name:
      "direct_delete_absent",

    passed:
      !namedDirectDelete
      && !directDeleteRequest,
  },

  {
    name:
      "supabase_payload_not_logged",

    passed:
      !/console\.error\(\s*["']\[SUPABASE ERROR\]["']\s*,\s*data\s*\)/
        .test(
          source.supabase,
        ),
  },

  {
    name:
      "transcript_not_logged",

    passed:
      !/console\.log\(\s*["']\[AUDIO TRANSCRIPTION\]["']\s*,\s*transcription\s*\)/
        .test(
          source.transcription,
        ),
  },
];

let failed = 0;

for (const check of checks) {
  if (check.passed) {
    console.log(
      `PASS ${check.name}`,
    );
  } else {
    console.log(
      `FAIL ${check.name}`,
    );

    failed += 1;
  }
}

console.log(
  `CHECKS_TOTAL=${checks.length}`,
);

console.log(
  `CHECKS_FAILED=${failed}`,
);

if (failed > 0) {
  process.exitCode = 1;
}
