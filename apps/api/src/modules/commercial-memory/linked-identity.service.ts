import {
  readFile,
  realpath,
  stat,
} from "node:fs/promises";

import {
  createHash,
  createHmac,
} from "node:crypto";

import path from "node:path";

import type {
  Supabase,
} from "./supabase.js";

const BASE =
  "/var/backups/eventos-commercial-memory";

const STATE =
  "/root/.eventos-offline-contacts-stage";

type Row = Record<string, unknown>;

type Anchor = {
  fingerprint: string;
  contact_id: string | null;
  phone_tokens: string[];
};

type AuditItem = {
  fingerprint: string;
  crm_contact_id: string | null;
  memory_identity_id: string | null;
  status: string;
};

function value(
  input: unknown,
  max = 160,
): string {
  return typeof input === "string"
    ? input.slice(0, max)
    : "";
}

function safeId(input: string): boolean {
  return /^[a-zA-Z0-9_-]{1,128}$/.test(input);
}

function token(
  secret: Buffer,
  company: string,
  input: unknown,
): string | null {
  if (
    typeof input !== "string" &&
    typeof input !== "number"
  ) {
    return null;
  }

  const digits = String(input).replace(/\D/g, "");

  if (
    digits.length < 8 ||
    digits.length > 16
  ) {
    return null;
  }

  return createHmac("sha256", secret)
    .update(`${company}\0${digits}`)
    .digest("hex");
}

function phoneSuffix(input: unknown): string | null {
  if (typeof input !== "string") {
    return null;
  }

  const digits = input.replace(/\D/g, "");

  return digits.length >= 8
    ? digits.slice(-4)
    : null;
}

async function loadPrivateData() {
  const pointer = (
    await readFile(STATE, "utf8")
  ).trim();

  const stage = await realpath(pointer);

  if (
    path.dirname(stage) !== BASE ||
    !path.basename(stage).startsWith(
      "offline-contacts-",
    )
  ) {
    throw new Error(
      "INVALID_PRIVATE_STAGE",
    );
  }

  const stageInfo = await stat(stage);

  if (
    !stageInfo.isDirectory() ||
    (stageInfo.mode & 0o077) !== 0
  ) {
    throw new Error(
      "UNSAFE_PRIVATE_STAGE",
    );
  }

  const v7 = await realpath(
    path.join(stage, "v7"),
  );

  if (path.dirname(v7) !== stage) {
    throw new Error(
      "INVALID_PRIVATE_DIRECTORY",
    );
  }

  const dirInfo = await stat(v7);

  if (
    !dirInfo.isDirectory() ||
    (dirInfo.mode & 0o077) !== 0
  ) {
    throw new Error(
      "UNSAFE_PRIVATE_DIRECTORY",
    );
  }

  async function readPrivate(
    name: string,
  ): Promise<Buffer> {
    const file = await realpath(
      path.join(v7, name),
    );

    if (path.dirname(file) !== v7) {
      throw new Error(
        "INVALID_PRIVATE_FILE_PATH",
      );
    }

    const info = await stat(file);

    if (
      !info.isFile() ||
      (info.mode & 0o077) !== 0 ||
      info.size > 10_000_000
    ) {
      throw new Error(
        "UNSAFE_PRIVATE_FILE",
      );
    }

    return readFile(file);
  }

  const [
    auditBytes,
    anchorsBytes,
    registryBytes,
    proposalsBytes,
    secret,
  ] = await Promise.all([
    readPrivate("identity-global-audit.json"),
    readPrivate("contact-anchors.json"),
    readPrivate("official-contact-registry.json"),
    readPrivate("identity-link-proposals.json"),
    readPrivate("identity-hmac.key"),
  ]);

  if (secret.length !== 32) {
    throw new Error(
      "INVALID_IDENTITY_SECRET",
    );
  }

  const audit = JSON.parse(
    auditBytes.toString("utf8"),
  ) as {
    company_id: string;
    source_hashes: Record<string, string>;
    items: AuditItem[];
  };

  const anchors = JSON.parse(
    anchorsBytes.toString("utf8"),
  ) as {
    company_id: string;
    anchors: Anchor[];
  };

  const registry = JSON.parse(
    registryBytes.toString("utf8"),
  ) as {
    company_id: string;
  };

  const proposals = JSON.parse(
    proposalsBytes.toString("utf8"),
  ) as {
    company_id: string;
  };

  if (
    !audit.company_id ||
    anchors.company_id !== audit.company_id ||
    registry.company_id !== audit.company_id ||
    proposals.company_id !== audit.company_id
  ) {
    throw new Error(
      "PRIVATE_COMPANY_MISMATCH",
    );
  }

  const sources: Record<string, Buffer> = {
    "contact-anchors.json": anchorsBytes,
    "official-contact-registry.json": registryBytes,
    "identity-link-proposals.json": proposalsBytes,
  };

  for (const [name, expected] of Object.entries(
    audit.source_hashes,
  )) {
    const bytes = sources[name];

    if (!bytes) {
      throw new Error(
        "UNKNOWN_AUDIT_SOURCE",
      );
    }

    const hash = createHash("sha256")
      .update(bytes)
      .digest("hex");

    if (hash !== expected) {
      throw new Error(
        "PRIVATE_SOURCE_INTEGRITY_FAILED",
      );
    }
  }

  if (
    audit.items.length !== 95 ||
    anchors.anchors.length !== 95
  ) {
    throw new Error(
      "HISTORICAL_CONTACT_COUNT_CHANGED",
    );
  }

  return {
    audit,
    anchors,
    secret,
  };
}

export async function readLinkedIdentity(
  company: string,
  fingerprint: string,
  db: Supabase,
) {
  if (!/^[a-f0-9]{20}$/.test(fingerprint)) {
    throw new Error(
      "INVALID_CONTACT_FINGERPRINT",
    );
  }

  const source = await loadPrivateData();

  if (
    !company ||
    source.audit.company_id !== company
  ) {
    throw new Error(
      "COMPANY_SCOPE_MISMATCH",
    );
  }

  const item = source.audit.items.find(
    candidate =>
      candidate.fingerprint === fingerprint,
  );

  const anchor = source.anchors.anchors.find(
    candidate =>
      candidate.fingerprint === fingerprint,
  );

  if (!item || !anchor) {
    return null;
  }

  const pending = {
    status: "requires_review",
    automatically_applied: false,
    contact: null,
    memory_identity: null,
  };

  if (
    item.status !== "corroborated_candidate"
  ) {
    return pending;
  }

  const contactId = item.crm_contact_id;
  const identityId = item.memory_identity_id;

  if (
    !contactId ||
    !identityId ||
    !safeId(contactId) ||
    !safeId(identityId) ||
    anchor.contact_id !== contactId
  ) {
    return pending;
  }

  const [
    contacts,
    identities,
  ] = await Promise.all([
    db.get<Row[]>(
      "crm_contacts",
      [
        [
          "select",
          "id,company_id,name,business_name,phone,status,archived_at",
        ],
        ["company_id", `eq.${company}`],
        ["id", `eq.${contactId}`],
        ["limit", "1"],
      ],
    ),

    db.get<Row[]>(
      "crm_memory_identities",
      [
        [
          "select",
          "id,company_id,display_name,primary_phone,identity_status",
        ],
        ["company_id", `eq.${company}`],
        ["id", `eq.${identityId}`],
        ["limit", "1"],
      ],
    ),
  ]);

  if (
    contacts.length !== 1 ||
    identities.length !== 1
  ) {
    return pending;
  }

  const contact = contacts[0];
  const identity = identities[0];

  if (
    contact.company_id !== company ||
    identity.company_id !== company ||
    String(contact.id) !== contactId ||
    String(identity.id) !== identityId
  ) {
    throw new Error(
      "LIVE_COMPANY_SCOPE_MISMATCH",
    );
  }

  const expected = new Set(
    anchor.phone_tokens,
  );

  const crmPhone = token(
    source.secret,
    company,
    contact.phone,
  );

  const memoryPhone = token(
    source.secret,
    company,
    identity.primary_phone,
  );

  if (
    !crmPhone ||
    !memoryPhone ||
    !expected.has(crmPhone) ||
    !expected.has(memoryPhone)
  ) {
    return pending;
  }

  return {
    status: "candidate_not_approved",
    automatically_applied: false,

    contact: {
      id: contactId,
      name: value(contact.name),
      business_name: value(
        contact.business_name,
      ),
      phone_last_four: phoneSuffix(
        contact.phone,
      ),
      status: value(
        contact.status,
        60,
      ),
      archived:
        contact.archived_at != null,
    },

    memory_identity: {
      id: identityId,
      display_name: value(
        identity.display_name,
      ),
      phone_last_four: phoneSuffix(
        identity.primary_phone,
      ),
      identity_status: value(
        identity.identity_status,
        60,
      ),
    },

    evidence: {
      exact_internal_id: true,
      source_phone_matches_both: true,
      current_records_checked: true,
    },
  };
}
