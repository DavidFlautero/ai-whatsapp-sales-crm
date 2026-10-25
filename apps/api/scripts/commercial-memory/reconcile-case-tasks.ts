import {
  loadConfig,
} from "../../src/modules/commercial-memory/config.js";

import {
  Supabase,
} from "../../src/modules/commercial-memory/supabase.js";

import {
  digest,
} from "../../src/modules/commercial-memory/keys.js";

type CaseRow = {
  id: string;
  state: string;
  customer_identity_id: string | null;
  event_date: string | null;
};

type CaseMessage = {
  case_id: string;
  message_id: string;
};

type Partner = {
  case_id: string;
  status: string;
};

type Task = {
  company_id: string;
  task_key: string;
  case_id: string;
  identity_id: string | null;
  source_message_id: string;
  task_type:
    | "follow_up"
    | "review_relationship";
  title: string;
  status: "proposed";
  priority: "normal" | "high";
  due_at: null;
  evidence: Record<string, unknown>;
};

async function main() {
  const cfg = loadConfig();

  const apply = process.argv.includes(
    "--apply",
  );

  if (apply && !cfg.writeEnabled) {
    throw new Error(
      "CM_WRITE_ENABLED_REQUIRED",
    );
  }

  const db = new Supabase({
    ...cfg,
    writeEnabled: apply,
  });

  const [
    cases,
    caseMessages,
    partners,
  ] = await Promise.all([
    db.get<CaseRow[]>(
      "crm_memory_cases",
      [
        [
          "select",
          "id,state,customer_identity_id,event_date",
        ],
        ["company_id", `eq.${cfg.companyId}`],
        ["limit", "1000"],
      ],
    ),

    db.get<CaseMessage[]>(
      "crm_memory_case_messages",
      [
        ["select", "case_id,message_id"],
        ["company_id", `eq.${cfg.companyId}`],
        ["limit", "10000"],
      ],
    ),

    db.get<Partner[]>(
      "cm_operation_partners",
      [
        ["select", "case_id,status"],
        ["company_id", `eq.${cfg.companyId}`],
        ["limit", "1000"],
      ],
    ),
  ]);

  const messagesByCase =
    new Map<string, string[]>();

  for (const item of caseMessages) {
    const list =
      messagesByCase.get(item.case_id) || [];

    list.push(item.message_id);

    messagesByCase.set(
      item.case_id,
      list,
    );
  }

  const acceptedPartners =
    new Set(
      partners
        .filter(p => p.status === "accepted")
        .map(p => p.case_id),
    );

  let proposed = 0;
  let withoutEvidence = 0;
  let closed = 0;

  for (const commercialCase of cases) {
    if (
      ["cancelled", "completed"].includes(
        commercialCase.state,
      )
    ) {
      closed++;
      continue;
    }

    const evidence =
      messagesByCase.get(
        commercialCase.id,
      ) || [];

    if (!evidence.length) {
      withoutEvidence++;
      continue;
    }

    const sourceMessageId = evidence[0];

    const tasks: Task[] = [];

    tasks.push({
      company_id: cfg.companyId,

      task_key: digest(
        cfg.companyId,
        commercialCase.id,
        "historical_case_review_v1",
      ),

      case_id: commercialCase.id,

      identity_id:
        commercialCase.customer_identity_id,

      source_message_id:
        sourceMessageId,

      task_type: "follow_up",

      title:
        "Revisar estado y seguimiento del expediente",

      status: "proposed",
      priority: "normal",
      due_at: null,

      evidence: {
        origin:
          "historical_case_reconciliation",

        case_state:
          commercialCase.state,

        event_date:
          commercialCase.event_date,

        requires_human_review: true,

        note:
          "No confirma una reserva ni implica contactar automaticamente al cliente.",
      },
    });

    if (
      !acceptedPartners.has(
        commercialCase.id,
      )
    ) {
      tasks.push({
        company_id: cfg.companyId,

        task_key: digest(
          cfg.companyId,
          commercialCase.id,
          "review_provider_assignment_v1",
        ),

        case_id: commercialCase.id,

        identity_id:
          commercialCase.customer_identity_id,

        source_message_id:
          sourceMessageId,

        task_type:
          "review_relationship",

        title:
          "Comprobar propietario y proveedores asociados",

        status: "proposed",
        priority: "high",
        due_at: null,

        evidence: {
          origin:
            "historical_case_reconciliation",

          reason:
            "no_accepted_partner_link",

          requires_human_review: true,

          note:
            "La ausencia de un enlace aceptado en memoria no demuestra que el CRM principal carezca de proveedor.",
        },
      });
    }

    for (const task of tasks) {
      if (apply) {
        await db.insertIgnore(
          "cm_intel_tasks",
          task,
          "company_id,task_key",
        );
      }

      proposed++;
    }
  }

  console.log(
    "CM_CASE_TASK_RECONCILIATION",
    JSON.stringify(
      {
        mode:
          apply ? "APPLIED" : "PREVIEW",

        cases: cases.length,
        proposed,
        withoutEvidence,
        closed,
      },
      null,
      2,
    ),
  );
}

main().catch(error => {
  console.error(
    "CM_CASE_TASKS_FAILED",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
