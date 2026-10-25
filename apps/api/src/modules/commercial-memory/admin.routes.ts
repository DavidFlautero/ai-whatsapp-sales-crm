import { registerStage34Routes } from "./stage34.routes.js";
import { loadConfig } from "./config.js";
import { Supabase } from "./supabase.js";

import {
  readDossier,
} from "./dossier.repository.js";

import {
  readIdentityHistory,
} from "./identity-history.repository.js";

type RequestLike = {
  params: Record<string, string>;
};

type ResponseLike = {
  json: (data: unknown) => void;
  status: (code: number) => ResponseLike;
};

type Handler = (
  req: RequestLike,
  res: ResponseLike,
) => void | Promise<void>;

export type AdminRouteRegistry = {
  get(
    path: string,
    ...handlers: Handler[]
  ): unknown;
};

export function registerCommercialMemoryAdminRoutes(
  app: AdminRouteRegistry,
  requireAdmin: Handler,
): void {
  if (typeof requireAdmin !== "function") {
    throw new Error(
      "ADMIN_AUTH_MIDDLEWARE_REQUIRED",
    );
  }

  const cfg = loadConfig();

  const db = new Supabase({
    ...cfg,
    writeEnabled: false,
  });

  app.get(
    "/crm/commercial-memory/identities",
    requireAdmin,
    async (_req, res) => {
      try {
        const rows = await db.get(
          "crm_memory_identities",
          [
            [
              "select",
              "id,primary_phone,display_name,identity_status,updated_at",
            ],
            [
              "company_id",
              `eq.${cfg.companyId}`,
            ],
            ["order", "updated_at.desc"],
            ["limit", "100"],
          ],
        );

        res.json(rows);
      } catch {
        res.status(503).json({
          error: "MEMORY_READ_UNAVAILABLE",
        });
      }
    },
  );

  app.get(
    "/crm/commercial-memory/identities/:identityId/history",
    requireAdmin,
    async (req, res) => {
      try {
        const result = await readIdentityHistory(
          db,
          cfg.companyId,
          req.params.identityId,
        );

        res.json(result);
      } catch {
        res.status(400).json({
          error: "INVALID_OR_UNAVAILABLE_IDENTITY",
        });
      }
    },
  );

  app.get(
    "/crm/commercial-memory/cases",
    requireAdmin,
    async (_req, res) => {
      try {
        res.json(
          await db.get(
            "crm_memory_cases",
            [
              [
                "select",
                "id,customer_identity_id,event_date,event_type,venue_label,state,crm_lead_id,crm_event_id,last_activity_at",
              ],
              [
                "company_id",
                `eq.${cfg.companyId}`,
              ],
              ["order", "last_activity_at.desc"],
              ["limit", "100"],
            ],
          ),
        );
      } catch {
        res.status(503).json({
          error: "MEMORY_READ_UNAVAILABLE",
        });
      }
    },
  );

  app.get(
    "/crm/commercial-memory/cases/:caseId/dossier",
    requireAdmin,
    async (req, res) => {
      try {
        const result = await readDossier(
          db,
          cfg.companyId,
          req.params.caseId,
        );

        res.json(result);
      } catch {
        res.status(400).json({
          error: "INVALID_OR_UNAVAILABLE_CASE",
        });
      }
    },
  );

  app.get(
    "/crm/commercial-memory/reviews",
    requireAdmin,
    async (_req, res) => {
      try {
        res.json(
          await db.get(
            "crm_memory_reviews",
            [
              [
                "select",
                "id,case_id,identity_id,review_type,priority,status,metadata,created_at",
              ],
              [
                "company_id",
                `eq.${cfg.companyId}`,
              ],
              ["status", "eq.open"],
              ["order", "created_at.desc"],
              ["limit", "100"],
            ],
          ),
        );
      } catch {
        res.status(503).json({
          error: "MEMORY_READ_UNAVAILABLE",
        });
      }
    },
  );
  registerStage34Routes(app, requireAdmin);
}
