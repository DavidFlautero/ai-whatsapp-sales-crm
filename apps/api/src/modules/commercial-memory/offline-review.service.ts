import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

const BASE = "/var/backups/eventos-commercial-memory";
const STATE = "/root/.eventos-offline-contacts-stage";

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error("INVALID_OFFLINE_DATA");
  }
  return value as JsonObject;
}

function array(value: unknown): JsonObject[] {
  if (!Array.isArray(value)) {
    throw new Error("INVALID_OFFLINE_ARRAY");
  }
  return value.map(object);
}

function text(value: unknown, length = 240): string {
  return typeof value === "string"
    ? value.slice(0, length)
    : "";
}

function integer(value: unknown): number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : 0;
}

async function privateStage(): Promise<string> {
  const pointer = (
    await readFile(STATE, "utf8")
  ).trim();

  const stage = await realpath(pointer);

  if (
    path.dirname(stage) !== BASE ||
    !path.basename(stage).startsWith("offline-contacts-")
  ) {
    throw new Error("INVALID_OFFLINE_STAGE");
  }

  const info = await stat(stage);

  if (
    !info.isDirectory() ||
    (info.mode & 0o077) !== 0
  ) {
    throw new Error("UNSAFE_OFFLINE_STAGE");
  }

  return stage;
}

async function readPrivateJson(
  stage: string,
  filename: string,
): Promise<JsonObject> {
  const filenamePath = path.join(stage, filename);
  const resolved = await realpath(filenamePath);

  if (path.dirname(resolved) !== stage) {
    throw new Error("UNSAFE_OFFLINE_FILE");
  }

  const info = await stat(resolved);

  if (
    !info.isFile() ||
    (info.mode & 0o077) !== 0 ||
    info.size > 10_000_000
  ) {
    throw new Error("INVALID_OFFLINE_FILE");
  }

  return object(
    JSON.parse(await readFile(resolved, "utf8")),
  );
}

export async function readOfflineReview(
  companyId: string,
) {
  if (!companyId) {
    throw new Error("COMPANY_REQUIRED");
  }

  const stage = await privateStage();

  const [data, queueData, missingData] =
    await Promise.all([
      readPrivateJson(stage, "contact-dossiers-v3.json"),
      readPrivateJson(stage, "contact-review-queue.json"),
      readPrivateJson(stage, "unmatched-history-audit.json"),
    ]);

  for (const source of [data, queueData, missingData]) {
    if (source.company_id !== companyId) {
      throw new Error("OFFLINE_TENANT_MISMATCH");
    }
  }

  const dossiers = array(data.dossiers);
  const reviewItems = array(queueData.queue);

  if (
    dossiers.length === 0 ||
    dossiers.length > 500 ||
    reviewItems.length > 500
  ) {
    throw new Error("OFFLINE_COLLECTION_OUT_OF_BOUNDS");
  }

  const reviewSet = new Set(
    reviewItems.map(item =>
      text(item.contact_fingerprint, 20),
    ),
  );

  const contacts = dossiers.map(dossier => {
    const fingerprint = text(
      dossier.contact_fingerprint,
      20,
    );

    if (!/^[a-f0-9]{20}$/.test(fingerprint)) {
      throw new Error("INVALID_CONTACT_FINGERPRINT");
    }

    return {
      fingerprint,
      initial_role: text(dossier.initial_role, 50),
      second_pass_role: text(dossier.second_pass_role, 50),
      message_count: integer(
        dossier.source_message_count,
      ),
      evidence_count: Array.isArray(dossier.evidence)
        ? dossier.evidence.length
        : 0,
      last_activity: text(dossier.last_activity, 40),
      last_direction: text(dossier.last_direction, 20),
      review_candidate: reviewSet.has(fingerprint),
      requires_human_review: true,
    };
  });

  if (
    new Set(contacts.map(item => item.fingerprint)).size
      !== contacts.length
  ) {
    throw new Error("DUPLICATED_CONTACT_FINGERPRINT");
  }

  function detail(fingerprint: string) {
    const dossier = dossiers.find(
      item => item.contact_fingerprint === fingerprint,
    );

    if (!dossier) return null;

    const evidence = array(dossier.evidence)
      .slice(0, 150)
      .map(item => ({
        kind: text(item.kind, 60),
        value: text(item.value, 160),
        message_id: text(item.message_id, 120),
        occurred_at: text(item.occurred_at, 40),
        excerpt: text(item.excerpt, 240),
        status: "candidate_not_verified",
      }));

    const context = array(dossier.recent_context)
      .slice(-16)
      .map(item => ({
        message_id: text(item.message_id, 120),
        direction: text(item.direction, 20),
        occurred_at: text(item.occurred_at, 40),
        excerpt: text(item.excerpt, 240),
      }));

    return {
      ...contacts.find(
        item => item.fingerprint === fingerprint,
      ),
      evidence,
      recent_context: context,
      automatically_applied: false,
    };
  }

  return {
    company: companyId,
    source: "historical_offline_v3",
    status: "human_review_only",
    totals: {
      contacts: contacts.length,
      messages: integer(data.source_message_count),
      review_candidates: reviewSet.size,
      historical_unmatched: integer(
        missingData.unmatched_unique_ids,
      ),
    },
    contacts,
    detail,
  };
}
