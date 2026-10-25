import { createOfflineHistoricalRoutes } from "./offline-review.routes.js";
import {
  createCommercialDeskRoutes,
} from "./commercial-desk.routes.js";

import {
  createCommercialReviewRoutes,
} from "./commercial-desk-review.routes.js";
import { commercialCompanyGuard } from "./commercial-memory-access.js";
import {
  splitTrustedObservations,
  splitTrustedTasks,
  type EvidenceObservation,
  type EvidenceTask,
} from "./trusted-results.js";
import { calculateMemoryCoverage } from "./coverage.service.js";
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";

import {
  loadConfig,
} from "./config.js";

import {
  Supabase,
} from "./supabase.js";

export const commercialMemoryDashboardRoutes =
  Router();

let mountedRoutes: ReturnType<typeof Router> | null =
  null;

commercialMemoryDashboardRoutes.use(
  (req, res, next) => {
    try {
      if (!mountedRoutes) {
        mountedRoutes = createScopedMemoryRoutes();
      }

      mountedRoutes(req, res, next);
    } catch {
      res.status(503).json({
        error: "COMMERCIAL_MEMORY_CONFIG_UNAVAILABLE",
      });
    }
  },
);

function createScopedMemoryRoutes() {
  const routes = Router();

  const cfg = loadConfig();

  const db = new Supabase({
    ...cfg,
    writeEnabled: false,
  });

const tenantGuard = commercialCompanyGuard(cfg.companyId);

routes.use(
  tenantGuard,
);

async function countRows(
  table: string,
  column: string,
): Promise<number> {
  let total = 0;

  const pageSize = 500;

  for (
    let offset = 0;
    offset < 100000;
    offset += pageSize
  ) {
    const rows = await db.get<
      Array<Record<string, unknown>>
    >(
      table,
      [
        ["select", column],
        [
          "company_id",
          `eq.${cfg.companyId}`,
        ],
        ["limit", String(pageSize)],
        ["offset", String(offset)],
      ],
    );

    total += rows.length;

    if (rows.length < pageSize) {
      return total;
    }
  }

  throw new Error(
    `CM_COUNT_LIMIT:${table}`,
  );
}

routes.get(
  "/coverage",
  async (_req, res) => {
    try {
      const report = await calculateMemoryCoverage(
        db,
        cfg.companyId,
      );

      res.json(report);
    } catch {
      res.status(503).json({
        error: "COMMERCIAL_MEMORY_COVERAGE_UNAVAILABLE",
      });
    }
  },
);

routes.get(
  "/integrity",
  async (_req, res) => {
    try {
      const [observations, tasks] =
        await Promise.all([
          db.get<EvidenceObservation[]>(
            "cm_intel_observations",
            [
              [
                "select",
                "id,message_id,evidence_quote,observation",
              ],
              [
                "company_id",
                `eq.${cfg.companyId}`,
              ],
              ["order", "created_at.desc"],
              ["limit", "200"],
            ],
          ),

          db.get<EvidenceTask[]>(
            "cm_intel_tasks",
            [
              [
                "select",
                "id,source_message_id,evidence",
              ],
              [
                "company_id",
                `eq.${cfg.companyId}`,
              ],
              ["order", "created_at.desc"],
              ["limit", "200"],
            ],
          ),
        ]);

      const [observationQuality, taskQuality] =
        await Promise.all([
          splitTrustedObservations(
            db,
            cfg.companyId,
            observations,
          ),

          splitTrustedTasks(
            db,
            cfg.companyId,
            tasks,
          ),
        ]);

      res.json({
        company: cfg.companyId,

        observationSample: {
          checked: observations.length,
          trusted:
            observationQuality.trusted.length,
          quarantined:
            observationQuality.quarantined.length,
        },

        taskSample: {
          checked: tasks.length,
          trusted:
            taskQuality.trusted.length,
          quarantined:
            taskQuality.quarantined.length,
        },

        note:
          "Auditoria sobre los registros mas recientes; los elementos en cuarentena requieren revision.",
      });
    } catch {
      res.status(503).json({
        error: "CM_INTEGRITY_UNAVAILABLE",
      });
    }
  },
);

routes.get(
  "/overview",
  async (_req, res) => {
    try {
      const [
        identities,
        cases,
        receipts,
        observations,
        links,
        tasks,
        partners,
      ] = await Promise.all([
        countRows(
          "crm_memory_identities",
          "id",
        ),

        countRows(
          "crm_memory_cases",
          "id",
        ),

        countRows(
          "crm_memory_receipts",
          "message_id",
        ),

        countRows(
          "cm_intel_observations",
          "id",
        ),

        countRows(
          "cm_bridge_candidates",
          "id",
        ),

        countRows(
          "cm_intel_tasks",
          "id",
        ),

        countRows(
          "cm_operation_partners",
          "id",
        ),
      ]);

      res.json({
        company: cfg.companyId,
        generatedAt:
          new Date().toISOString(),

        identities,
        cases,
        receipts,
        observations,
        links,
        tasks,
        partners,
      });

    } catch {
      res.status(503).json({
        error:
          "COMMERCIAL_MEMORY_OVERVIEW_UNAVAILABLE",
      });
    }
  },
);

routes.get(
  "/cases",
  async (_req, res) => {
    try {
      const rows = await db.get(
        "crm_memory_cases",
        [
          ["select", "*"],
          [
            "company_id",
            `eq.${cfg.companyId}`,
          ],
          ["order", "created_at.desc"],
          ["limit", "100"],
        ],
      );

      res.json(rows);

    } catch {
      res.status(503).json({
        error: "CASES_UNAVAILABLE",
      });
    }
  },
);

routes.get(
  "/tasks",
  async (_req, res) => {
    try {
      const rows = await db.get(
        "cm_intel_tasks",
        [
          ["select", "*"],
          [
            "company_id",
            `eq.${cfg.companyId}`,
          ],
          ["status", "eq.proposed"],
          ["order", "created_at.desc"],
          ["limit", "200"],
        ],
      );

      const checked =
        await splitTrustedTasks(
          db,
          cfg.companyId,
          rows as EvidenceTask[],
        );

      res.json(checked.trusted);

    } catch {
      res.status(503).json({
        error: "TASKS_UNAVAILABLE",
      });
    }
  },
);

routes.get(
  "/links",
  async (_req, res) => {
    try {
      const rows = await db.get(
        "cm_bridge_candidates",
        [
          ["select", "*"],
          [
            "company_id",
            `eq.${cfg.companyId}`,
          ],
          ["status", "eq.proposed"],
          ["order", "created_at.desc"],
          ["limit", "200"],
        ],
      );

      res.json(rows);

    } catch {
      res.status(503).json({
        error: "LINKS_UNAVAILABLE",
      });
    }
  },
);

routes.get(
  "/observations",
  async (_req, res) => {
    try {
      const rows = await db.get(
        "cm_intel_observations",
        [
          [
            "select",
            "id,message_id,identity_id,observation,evidence_quote,confidence,created_at",
          ],
          [
            "company_id",
            `eq.${cfg.companyId}`,
          ],
          ["order", "created_at.desc"],
          ["limit", "100"],
        ],
      );

      const checked =
        await splitTrustedObservations(
          db,
          cfg.companyId,
          rows as EvidenceObservation[],
        );

      res.json(checked.trusted);

    } catch {
      res.status(503).json({
        error:
          "OBSERVATIONS_UNAVAILABLE",
      });
    }
  },
);

  routes.use(
    "/desk",
    createCommercialDeskRoutes(cfg),
  );

  routes.use(
    "/desk",
    createCommercialReviewRoutes(cfg),
  );

  routes.use(
    "/offline-review",
    createOfflineHistoricalRoutes(cfg),
  );

  return routes;
}
