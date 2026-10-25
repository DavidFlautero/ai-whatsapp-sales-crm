import { readFile, realpath, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const BASE = "/var/backups/eventos-commercial-memory";
const POINTER = "/root/.eventos-offline-contacts-stage";

type Fact = {
  kind: string;
  certainty_class: string;
  status: string;
  message_ids: string[];
  review_reasons: string[];
  possible_conflict: boolean;
  human_review_required: boolean;
};

type PilotCase = {
  contact_fingerprint: string;
  source_message_count: number;
  fact_count: number;
  role_status: string;
  possible_conflicting_kinds: string[];
  facts: Fact[];
  human_review_required: boolean;
  automatically_applied: boolean;
};

type PilotTask = {
  task_id: string;
  contact_fingerprint: string;
  task_type: string;
  priority: string;
  status: string;
  evidence_message_ids: string[];
  can_send_message: boolean;
  can_modify_contact: boolean;
  human_review_required: boolean;
};

type FullMessage = {
  message_id: string;
};

type FullCase = {
  contact_fingerprint: string;
  messages: FullMessage[];
};

function sha(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function validFingerprint(value: string): boolean {
  return /^[a-f0-9]{20}$/.test(value);
}

async function privateStage(): Promise<string> {
  const pointer = (await readFile(POINTER, "utf8")).trim();
  const stage = await realpath(pointer);

  if (
    path.dirname(stage) !== BASE ||
    !path.basename(stage).startsWith("offline-contacts-")
  ) {
    throw new Error("INVALID_SUPERVISOR_STAGE");
  }

  const info = await stat(stage);

  if (!info.isDirectory() || (info.mode & 0o077) !== 0) {
    throw new Error("UNSAFE_SUPERVISOR_STAGE");
  }

  return stage;
}

async function readPrivate(
  stage: string,
  relative: string,
): Promise<Buffer> {
  if (
    !/^(?:v5|v7|v8|v9)\/[a-zA-Z0-9_.-]+\.json$/.test(relative)
  ) {
    throw new Error("INVALID_PRIVATE_SOURCE_NAME");
  }

  const expected = path.join(stage, relative);
  const actual = await realpath(expected);

  if (actual !== expected) {
    throw new Error("PRIVATE_SOURCE_SYMLINK");
  }

  const info = await stat(actual);

  if (
    !info.isFile() ||
    (info.mode & 0o077) !== 0 ||
    info.size > 10000000
  ) {
    throw new Error("UNSAFE_SUPERVISOR_SOURCE");
  }

  return readFile(actual);
}

export async function readOfflineSupervisorPilot(
  company: string,
  requestedFingerprint?: string,
) {
  if (
    requestedFingerprint !== undefined &&
    !validFingerprint(requestedFingerprint)
  ) {
    throw new Error("INVALID_SUPERVISOR_FINGERPRINT");
  }

  const stage = await privateStage();

  const manifest = JSON.parse(
    (await readPrivate(stage, "v9/manifest.json")).toString("utf8"),
  ) as {
    company_id: string;
    source_hashes: Record<string, string>;
    expected_cases: number;
    expected_tasks: number;
  };

  if (!company || manifest.company_id !== company) {
    throw new Error("SUPERVISOR_COMPANY_MISMATCH");
  }

  const originals: Record<string, Buffer> = {};

  for (const [name, expectedHash] of Object.entries(
    manifest.source_hashes,
  )) {
    const bytes = await readPrivate(stage, name);

    if (sha(bytes) !== expectedHash) {
      throw new Error("SUPERVISOR_SOURCE_INTEGRITY_FAILURE");
    }

    originals[name] = bytes;
  }

  const parse = <T>(name: string): T => {
    const bytes = originals[name];

    if (!bytes) throw new Error("SUPERVISOR_SOURCE_MISSING");

    return JSON.parse(bytes.toString("utf8")) as T;
  };

  const consolidated = parse<{
    company_id: string;
    case_count: number;
    message_count: number;
    fact_count: number;
    text_anchored_facts: number;
    facts_requiring_review: number;
    cases_with_possible_conflicts: number;
    external_ai_calls: number;
    database_writes: number;
    automatically_applied: boolean;
    cases: PilotCase[];
  }>("v8/semantic-consolidated-v8.json");

  const proposalData = parse<{
    company_id: string;
    task_count: number;
    crm_writes: number;
    whatsapp_sends: number;
    automatically_applied: boolean;
    tasks: PilotTask[];
  }>("v8/commercial-supervisor-proposals.json");

  const full = parse<{
    company_id: string;
    cases: FullCase[];
  }>("v5/semantic-pilot-full.json");

  const audit = parse<{
    company_id: string;
    items: Array<{
      fingerprint: string;
      status: string;
    }>;
  }>("v7/identity-global-audit.json");

  if (
    consolidated.company_id !== company ||
    proposalData.company_id !== company ||
    full.company_id !== company ||
    audit.company_id !== company
  ) {
    throw new Error("SUPERVISOR_SOURCE_COMPANY_MISMATCH");
  }

  if (
    consolidated.case_count !== 5 ||
    consolidated.message_count !== 492 ||
    consolidated.fact_count !== 21 ||
    proposalData.task_count !== 12 ||
    consolidated.cases.length !== manifest.expected_cases ||
    proposalData.tasks.length !== manifest.expected_tasks
  ) {
    throw new Error("SUPERVISOR_BASELINE_CHANGED");
  }

  if (
    consolidated.external_ai_calls !== 0 ||
    consolidated.database_writes !== 0 ||
    consolidated.automatically_applied !== false ||
    proposalData.crm_writes !== 0 ||
    proposalData.whatsapp_sends !== 0 ||
    proposalData.automatically_applied !== false
  ) {
    throw new Error("SUPERVISOR_UNSAFE_STATE");
  }

  const approvedForPreview = new Set(
    audit.items
      .filter(item => item.status === "corroborated_candidate")
      .map(item => item.fingerprint),
  );

  const fullMap = new Map(
    full.cases.map(item => [
      item.contact_fingerprint,
      new Set(item.messages.map(message => message.message_id)),
    ]),
  );

  const tasksByContact = new Map<string, PilotTask[]>();

  for (const task of proposalData.tasks) {
    if (
      !validFingerprint(task.contact_fingerprint) ||
      task.can_send_message !== false ||
      task.can_modify_contact !== false ||
      task.human_review_required !== true ||
      task.status !== "proposed_for_human_review"
    ) {
      throw new Error("SUPERVISOR_UNSAFE_TASK");
    }

    const messageIds = fullMap.get(task.contact_fingerprint);

    if (!messageIds) {
      throw new Error("TASK_CONTACT_NOT_IN_PILOT");
    }

    if (
      task.evidence_message_ids.some(id => !messageIds.has(id))
    ) {
      throw new Error("TASK_EVIDENCE_NOT_IN_PILOT");
    }

    const previous = tasksByContact.get(task.contact_fingerprint) ?? [];
    previous.push(task);
    tasksByContact.set(task.contact_fingerprint, previous);
  }

  const seen = new Set<string>();

  const cases = consolidated.cases.map(item => {
    if (
      !validFingerprint(item.contact_fingerprint) ||
      seen.has(item.contact_fingerprint) ||
      !approvedForPreview.has(item.contact_fingerprint) ||
      !fullMap.has(item.contact_fingerprint) ||
      item.human_review_required !== true ||
      item.automatically_applied !== false ||
      item.fact_count !== item.facts.length
    ) {
      throw new Error("SUPERVISOR_INVALID_CASE");
    }

    seen.add(item.contact_fingerprint);

    const knownMessages = fullMap.get(item.contact_fingerprint)!;

    if (knownMessages.size !== item.source_message_count) {
      throw new Error("SUPERVISOR_MESSAGE_COUNT_MISMATCH");
    }

    const facts = item.facts.map(fact => {
      if (
        fact.human_review_required !== true ||
        fact.message_ids.some(id => !knownMessages.has(id))
      ) {
        throw new Error("SUPERVISOR_UNSAFE_FACT");
      }

      return {
        kind: fact.kind,
        certainty_class: fact.certainty_class,
        status: fact.status,
        possible_conflict: fact.possible_conflict,
        evidence_message_ids: fact.message_ids,
        review_reasons: fact.review_reasons,
        human_review_required: true,
      };
    });

    const tasks = tasksByContact.get(item.contact_fingerprint) ?? [];

    return {
      contact_fingerprint: item.contact_fingerprint,
      source_message_count: item.source_message_count,
      role_status: item.role_status,
      possible_conflicting_kinds: item.possible_conflicting_kinds,
      fact_count: facts.length,
      facts,
      tasks: tasks.map(task => ({
        task_id: task.task_id,
        task_type: task.task_type,
        priority: task.priority,
        status: task.status,
        evidence_message_ids: task.evidence_message_ids,
        human_review_required: true,
      })),
      automatically_applied: false,
    };
  });

  if (seen.size !== 5) {
    throw new Error("SUPERVISOR_CONTACT_TOTAL_INVALID");
  }

  if (
    cases.reduce((count, item) => count + item.tasks.length, 0) !== 12 ||
    cases.reduce((count, item) => count + item.facts.length, 0) !== 21
  ) {
    throw new Error("SUPERVISOR_TOTALS_INVALID");
  }

  const selected = requestedFingerprint
    ? cases.filter(item => item.contact_fingerprint === requestedFingerprint)
    : cases;

  return {
    summary: {
      case_count: 5,
      message_count: 492,
      fact_count: 21,
      text_anchored_facts: consolidated.text_anchored_facts,
      facts_requiring_review: consolidated.facts_requiring_review,
      cases_with_possible_conflicts:
        consolidated.cases_with_possible_conflicts,
      task_count: 12,
      status: "human_review_only",
      automatically_applied: false,
    },
    cases: selected,
  };
}
