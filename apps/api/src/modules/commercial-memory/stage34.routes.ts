import { readCasePrices } from "./intelligence.prices.js";
import { loadConfig } from "./config.js";
import { Supabase } from "./supabase.js";

import {
  readUnifiedDossier,
} from "./unified-dossier.js";

type Req = {
  params: Record<string, string>;
};

type Res = {
  json(data: unknown): void;
  status(code: number): Res;
};

type Handler = (
  req: Req,
  res: Res,
) => void | Promise<void>;

type Registry = {
  get(path: string, ...handlers: Handler[]): unknown;
};

export function registerStage34Routes(
  app: Registry,
  requireAdmin: Handler,
): void {
  if (typeof requireAdmin !== "function") {
    throw new Error("ADMIN_AUTH_REQUIRED");
  }

  const cfg = loadConfig();

  const db = new Supabase({
    ...cfg,
    writeEnabled: false,
  });

  app.get(
    "/crm/commercial-memory/unified/:caseId",
    requireAdmin,
    async (req, res) => {
      try {
        res.json(
          await readUnifiedDossier(
            db,
            cfg.companyId,
            req.params.caseId,
          ),
        );
      } catch {
        res.status(400).json({
          error: "DOSSIER_UNAVAILABLE",
        });
      }
    },
  );

  app.get(
    "/crm/commercial-memory/canonical-links",
    requireAdmin,
    async (_req, res) => {
      try {
        res.json(
          await db.get(
            "cm_bridge_candidates",
            [
              ["select", "*"],
              ["company_id", `eq.${cfg.companyId}`],
              ["order", "created_at.desc"],
              ["limit", "200"],
            ],
          ),
        );
      } catch {
        res.status(503).json({
          error: "BRIDGE_UNAVAILABLE",
        });
      }
    },
  );

  app.get(
    "/crm/commercial-memory/partner-links",
    requireAdmin,
    async (_req, res) => {
      try {
        res.json(
          await db.get(
            "cm_operation_partners",
            [
              ["select", "*"],
              ["company_id", `eq.${cfg.companyId}`],
              ["order", "created_at.desc"],
              ["limit", "200"],
            ],
          ),
        );
      } catch {
        res.status(503).json({
          error: "PARTNERS_UNAVAILABLE",
        });
      }
    },
  );

  app.get(
    "/crm/commercial-memory/prices/:caseId",
    requireAdmin,
    async (req, res) => {
      try {
        res.json(
          await readCasePrices(
            db,
            cfg.companyId,
            req.params.caseId,
          ),
        );
      } catch {
        res.status(400).json({
          error: "PRICES_UNAVAILABLE",
        });
      }
    },
  );

  app.get(
    "/crm/commercial-memory/intelligence-tasks",
    requireAdmin,
    async (_req, res) => {
      try {
        res.json(
          await db.get(
            "cm_intel_tasks",
            [
              ["select", "*"],
              ["company_id", `eq.${cfg.companyId}`],
              ["status", "eq.proposed"],
              ["order", "created_at.desc"],
              ["limit", "200"],
            ],
          ),
        );
      } catch {
        res.status(503).json({
          error: "TASKS_UNAVAILABLE",
        });
      }
    },
  );
}
