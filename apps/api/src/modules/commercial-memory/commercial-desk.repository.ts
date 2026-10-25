import { Supabase } from "./supabase.js";

import {
  extractCommercialText,
} from "./commercial-text.js";

import {
  splitTrustedTasks,
  type EvidenceTask,
} from "./trusted-results.js";

export type DeskCase = {
  id: string;
  state: string;
  customer_identity_id: string | null;
  event_date: string | null;
  venue_label: string | null;
  created_at: string;
};

export type DeskLink = {
  id: string;
  identity_id: string;
  case_id: string | null;
  target_table: string;
  target_id: string;
  match_basis: string;
  confidence: number;
  status: string;
  evidence: Record<string, unknown>;
};

export type DeskTask = EvidenceTask & {
  title: string;
  task_type: string;
  priority: string;
  status: string;
  case_id: string | null;
  identity_id: string | null;
  created_at: string;
};

type CaseMessage = {
  message_id: string;
};

type MessageRow = {
  id: string;
  body: string | null;
  message_type: string | null;
  direction: string | null;
  created_at: string;
};

type IdentityRow = {
  id: string;
  display_name: string | null;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validCommercialId(
  id: string,
): boolean {
  return UUID.test(id);
}

export async function listDeskCases(
  db: Supabase,
  company: string,
): Promise<DeskCase[]> {
  return db.get<DeskCase[]>(
    "crm_memory_cases",
    [
      [
        "select",
        "id,state,customer_identity_id,event_date,venue_label,created_at",
      ],
      ["company_id", `eq.${company}`],
      ["order", "created_at.desc"],
      ["limit", "200"],
    ],
  );
}

export async function listDeskTasks(
  db: Supabase,
  company: string,
) {
  const tasks = await db.get<DeskTask[]>(
    "cm_intel_tasks",
    [
      [
        "select",
        "id,case_id,identity_id,source_message_id,title,task_type,priority,status,evidence,created_at",
      ],
      ["company_id", `eq.${company}`],
      ["status", "eq.proposed"],
      ["order", "created_at.desc"],
      ["limit", "200"],
    ],
  );

  const quality = await splitTrustedTasks(
    db,
    company,
    tasks,
  );

  const trustedIds = new Set(
    quality.trusted.map(t => t.id),
  );

  return {
    tasks: tasks.filter(
      task => trustedIds.has(task.id),
    ),
    quarantined: quality.quarantined.length,
  };
}

export async function listDeskLinks(
  db: Supabase,
  company: string,
): Promise<DeskLink[]> {
  return db.get<DeskLink[]>(
    "cm_bridge_candidates",
    [
      [
        "select",
        "id,identity_id,case_id,target_table,target_id,match_basis,confidence,status,evidence",
      ],
      ["company_id", `eq.${company}`],
      ["status", "eq.proposed"],
      ["order", "created_at.desc"],
      ["limit", "200"],
    ],
  );
}

export async function readDeskCase(
  db: Supabase,
  company: string,
  caseId: string,
) {
  if (!validCommercialId(caseId)) {
    throw new Error("INVALID_CASE_ID");
  }

  const cases = await db.get<DeskCase[]>(
    "crm_memory_cases",
    [
      ["select", "*"],
      ["company_id", `eq.${company}`],
      ["id", `eq.${caseId}`],
      ["limit", "1"],
    ],
  );

  const commercialCase = cases[0];

  if (!commercialCase) return null;

  const [caseMessages, links, tasks] =
    await Promise.all([
      db.get<CaseMessage[]>(
        "crm_memory_case_messages",
        [
          ["select", "message_id"],
          ["company_id", `eq.${company}`],
          ["case_id", `eq.${caseId}`],
          ["limit", "100"],
        ],
      ),

      db.get<DeskLink[]>(
        "cm_bridge_candidates",
        [
          ["select", "*"],
          ["company_id", `eq.${company}`],
          ["case_id", `eq.${caseId}`],
          ["limit", "100"],
        ],
      ),

      db.get<DeskTask[]>(
        "cm_intel_tasks",
        [
          ["select", "*"],
          ["company_id", `eq.${company}`],
          ["case_id", `eq.${caseId}`],
          ["limit", "100"],
        ],
      ),
    ]);

  const ids = [
    ...new Set(
      caseMessages
        .map(item => item.message_id)
        .filter(validCommercialId),
    ),
  ];

  let messages: MessageRow[] = [];

  if (ids.length) {
    messages = await db.get<MessageRow[]>(
      "messages",
      [
        [
          "select",
          "id,body,message_type,direction,created_at",
        ],
        ["company_id", `eq.${company}`],
        ["id", `in.(${ids.join(",")})`],
        ["order", "created_at.asc"],
        ["limit", "100"],
      ],
    );
  }

  let customerName: string | null = null;

  if (commercialCase.customer_identity_id) {
    const people = await db.get<IdentityRow[]>(
      "crm_memory_identities",
      [
        ["select", "id,display_name"],
        ["company_id", `eq.${company}`],
        [
          "id",
          `eq.${commercialCase.customer_identity_id}`,
        ],
        ["limit", "1"],
      ],
    );

    customerName =
      people[0]?.display_name || null;
  }

  const taskQuality =
    await splitTrustedTasks(
      db,
      company,
      tasks,
    );

  const trustedTaskIds = new Set(
    taskQuality.trusted.map(
      item => item.id,
    ),
  );

  return {
    commercialCase,
    customerName,
    links,

    tasks: tasks.filter(
      item => trustedTaskIds.has(item.id),
    ),

    quarantinedTasks:
      taskQuality.quarantined.length,

    messageCount:
      caseMessages.length,

    messages: messages.map(message => ({
      id: message.id,
      direction: message.direction,
      createdAt: message.created_at,
      type: message.message_type,

      text:
        extractCommercialText(message)
          ?.slice(0, 900) || null,
    })),
  };
}
