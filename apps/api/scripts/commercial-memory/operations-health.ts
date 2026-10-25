import {
  loadConfig,
} from "../../src/modules/commercial-memory/config.js";

import {
  Supabase,
} from "../../src/modules/commercial-memory/supabase.js";

type CaseRow = {
  id: string;
  state: string | null;
};

type TaskRow = {
  case_id: string | null;
  task_type: string;
  priority: string;
  status: string;
};

type PartnerRow = {
  case_id: string;
  partner_role: string;
  status: string;
};

type LinkRow = {
  target_table: string;
  status: string;
};

async function main() {
  const cfg = loadConfig();

  const db = new Supabase({
    ...cfg,
    writeEnabled: false,
  });

  const filter = [
    ["company_id", `eq.${cfg.companyId}`],
  ];

  const [
    cases,
    tasks,
    partners,
    links,
  ] = await Promise.all([
    db.get<CaseRow[]>(
      "crm_memory_cases",
      [
        ["select", "id,state"],
        ...filter,
        ["limit", "1000"],
      ],
    ),

    db.get<TaskRow[]>(
      "cm_intel_tasks",
      [
        [
          "select",
          "case_id,task_type,priority,status",
        ],
        ...filter,
        ["limit", "5000"],
      ],
    ),

    db.get<PartnerRow[]>(
      "cm_operation_partners",
      [
        [
          "select",
          "case_id,partner_role,status",
        ],
        ...filter,
        ["limit", "5000"],
      ],
    ),

    db.get<LinkRow[]>(
      "cm_bridge_candidates",
      [
        ["select", "target_table,status"],
        ...filter,
        ["limit", "5000"],
      ],
    ),
  ]);

  const tasksByCase = new Map<string, number>();

  for (const task of tasks) {
    if (!task.case_id) continue;

    tasksByCase.set(
      task.case_id,
      (tasksByCase.get(task.case_id) || 0) + 1,
    );
  }

  const acceptedPartners = new Set(
    partners
      .filter(item => item.status === "accepted")
      .map(item => item.case_id),
  );

  const taskTypes: Record<string, number> = {};
  const priorities: Record<string, number> = {};
  const linkTables: Record<string, number> = {};

  for (const task of tasks) {
    if (task.status !== "proposed") continue;

    taskTypes[task.task_type] =
      (taskTypes[task.task_type] || 0) + 1;

    priorities[task.priority] =
      (priorities[task.priority] || 0) + 1;
  }

  for (const link of links) {
    if (link.status !== "proposed") continue;

    linkTables[link.target_table] =
      (linkTables[link.target_table] || 0) + 1;
  }

  const openCases = cases.filter(
    item =>
      item.state !== "completed" &&
      item.state !== "cancelled",
  );

  const withoutMemoryTasks = openCases.filter(
    item => !tasksByCase.has(item.id),
  );

  const withoutAcceptedPartners =
    openCases.filter(
      item => !acceptedPartners.has(item.id),
    );

  console.log(
    "CM_OPERATIONS_HEALTH",
    JSON.stringify({
      company: cfg.companyId,

      cases: {
        total: cases.length,
        open: openCases.length,
        withoutMemoryTasks:
          withoutMemoryTasks.length,
        withoutAcceptedPartners:
          withoutAcceptedPartners.length,
      },

      tasks: {
        total: tasks.length,
        proposed: tasks.filter(
          item => item.status === "proposed",
        ).length,
        byType: taskTypes,
        byPriority: priorities,
      },

      partnerLinks: {
        total: partners.length,
        accepted: partners.filter(
          item => item.status === "accepted",
        ).length,
        proposed: partners.filter(
          item => item.status === "proposed",
        ).length,
      },

      canonicalLinks: {
        total: links.length,
        proposedByTable: linkTables,
      },

      warning:
        "La ausencia de relaciones aceptadas en memoria no demuestra que no existan asignaciones en el CRM principal.",
    }, null, 2),
  );
}

main().catch(error => {
  console.error(
    "CM_OPERATIONS_HEALTH_FAILED",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
