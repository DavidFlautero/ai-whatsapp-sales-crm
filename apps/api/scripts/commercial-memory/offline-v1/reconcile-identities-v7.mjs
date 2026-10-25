import fs from "node:fs";
import path from "node:path";

import {
  proposeIdentityLinks,
} from "./identity-match-core-v7.mjs";

const stage = fs.realpathSync(
  process.argv[2] ?? "",
);

const base =
  "/var/backups/eventos-commercial-memory";

if (
  path.dirname(stage) !== base ||
  !path.basename(stage).startsWith("offline-contacts-")
) {
  throw new Error("INVALID_PRIVATE_STAGE");
}

const v7 = path.join(stage, "v7");

function load(name) {
  return JSON.parse(
    fs.readFileSync(
      path.join(v7, name),
      "utf8",
    ),
  );
}

const manifest = load("manifest.json");
const anchorsData = load("contact-anchors.json");
const registryData = load(
  "official-contact-registry.json",
);

const company = manifest.company_id;

if (
  !company ||
  anchorsData.company_id !== company ||
  registryData.company_id !== company
) {
  throw new Error("TENANT_SCOPE_MISMATCH");
}

if (
  anchorsData.contact_groups !== 95 ||
  anchorsData.source_messages !== 2115 ||
  anchorsData.anchors.length !== 95
) {
  throw new Error("SOURCE_BASELINE_MISMATCH");
}

const contacts = registryData.records.filter(
  item => item.table === "crm_contacts",
);

const identities = registryData.records.filter(
  item => item.table === "crm_memory_identities",
);

if (
  contacts.length + identities.length !==
  registryData.total_records
) {
  throw new Error("UNEXPECTED_REGISTRY_TABLE");
}

const results = [];

for (const anchor of anchorsData.anchors) {
  const crmResult = proposeIdentityLinks(
    anchor,
    contacts,
  );

  // Una identidad histórica no comparte necesariamente
  // el espacio de IDs de crm_contacts.
  // Para esta tabla solo aceptamos coincidencia de teléfono.

  const identityAnchor = {
    ...anchor,
    contact_id: null,
  };

  const identityResult = proposeIdentityLinks(
    identityAnchor,
    identities,
  );

  const proposals = [
    ...crmResult.proposals,
    ...identityResult.proposals,
  ];

  let conflict = proposals.some(
    item =>
      item.status === "ambiguous_requires_review",
  );

  // Un ID del CRM coincidente con otro teléfono
  // requiere revisión, no aceptación automática.

  if (anchor.contact_id) {
    const sameId = contacts.find(
      item =>
        item.id === String(anchor.contact_id),
    );

    if (
      sameId &&
      anchor.phone_tokens.length > 0 &&
      sameId.phone_tokens.length > 0
    ) {
      const sourcePhones = new Set(
        anchor.phone_tokens,
      );

      const phoneCompatible =
        sameId.phone_tokens.some(
          token => sourcePhones.has(token),
        );

      if (!phoneCompatible) {
        conflict = true;
      }
    }
  }

  const status = conflict
    ? "ambiguous_requires_review"
    : proposals.length > 0
      ? "candidate_requires_review"
      : "unmatched_requires_review";

  results.push({
    fingerprint: anchor.fingerprint,
    source_message_count:
      anchor.source_message_count,
    source_has_contact_id:
      Boolean(anchor.contact_id),
    source_has_phone:
      anchor.phone_tokens.length > 0,
    proposed_tables: proposals.length,
    has_ambiguity: conflict,
    status,
    proposals,
    automatically_linked: false,
  });
}

const fingerprints = new Set(
  results.map(item => item.fingerprint),
);

if (
  results.length !== 95 ||
  fingerprints.size !== 95
) {
  throw new Error("IDENTITY_RESULT_COUNT_INVALID");
}

const counts = {
  proposed: 0,
  ambiguous: 0,
  unmatched: 0,
};

const matchesByTable = {};

for (const result of results) {
  if (result.status === "ambiguous_requires_review") {
    counts.ambiguous++;

  } else if (
    result.status === "candidate_requires_review"
  ) {
    counts.proposed++;

  } else {
    counts.unmatched++;
  }

  for (const proposal of result.proposals) {
    matchesByTable[proposal.table] =
      (matchesByTable[proposal.table] ?? 0) + 1;
  }
}

if (
  counts.proposed +
  counts.ambiguous +
  counts.unmatched !== 95
) {
  throw new Error("MATCH_TOTAL_INVALID");
}

const output = {
  schema_version: 7,
  company_id: company,
  generated_at: new Date().toISOString(),
  mode: "identity_proposals_only",
  contact_groups: 95,
  counts,
  matches_by_table: matchesByTable,
  results,
  automatically_applied: false,
  crm_writes: 0,
};

fs.writeFileSync(
  path.join(
    v7,
    "identity-link-proposals.json",
  ),
  JSON.stringify(output, null, 2),
  {
    flag: "wx",
    mode: 0o600,
  },
);

console.log("");
console.log("========================================");
console.log("IDENTITY RECONCILIATION RESULTS");
console.log("========================================");

console.log("CONTACTS:", 95);
console.log("PROPOSED:", counts.proposed);
console.log("AMBIGUOUS:", counts.ambiguous);
console.log("UNMATCHED:", counts.unmatched);

for (const [table, count] of Object.entries(
  matchesByTable,
)) {
  console.log("MATCH_TABLE:", table, count);
}

console.log("");
console.log("IDENTITY_PROPOSALS_CREATED");
console.log("NO_AUTOMATIC_LINKS");
console.log("NO_CRM_WRITES");
