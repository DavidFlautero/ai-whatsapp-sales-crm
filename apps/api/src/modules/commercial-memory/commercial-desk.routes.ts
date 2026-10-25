import {
  Router,
} from "express";

import type {
  Config,
} from "./config.js";

import {
  Supabase,
} from "./supabase.js";

import {
  listDeskCases,
  listDeskTasks,
  listDeskLinks,
  readDeskCase,
  validCommercialId,
} from "./commercial-desk.repository.js";

export function createCommercialDeskRoutes(
  cfg: Config,
) {
  const router = Router();

  const db = new Supabase({
    ...cfg,
    writeEnabled: false,
  });

  router.get(
    "/status",
    async (_req, res) => {
      res.json({
        company: cfg.companyId,
        operational: true,

        reviewWritesEnabled:
          process.env
            .CM_MEMORY_REVIEW_WRITES_ENABLED ===
          "true",

        automaticMessages: false,
        automaticBookings: false,
      });
    },
  );

  router.get(
    "/cases",
    async (_req, res) => {
      try {
        res.json(
          await listDeskCases(
            db,
            cfg.companyId,
          ),
        );
      } catch {
        res.status(503).json({
          error: "CM_DESK_CASES_UNAVAILABLE",
        });
      }
    },
  );

  router.get(
    "/tasks",
    async (_req, res) => {
      try {
        res.json(
          await listDeskTasks(
            db,
            cfg.companyId,
          ),
        );
      } catch {
        res.status(503).json({
          error: "CM_DESK_TASKS_UNAVAILABLE",
        });
      }
    },
  );

  router.get(
    "/links",
    async (_req, res) => {
      try {
        res.json(
          await listDeskLinks(
            db,
            cfg.companyId,
          ),
        );
      } catch {
        res.status(503).json({
          error: "CM_DESK_LINKS_UNAVAILABLE",
        });
      }
    },
  );

  router.get(
    "/cases/:caseId",
    async (req, res) => {
      const caseId = req.params.caseId;

      if (
        typeof caseId !== "string" ||
        !validCommercialId(caseId)
      ) {
        return res.status(400).json({
          error: "INVALID_CASE_ID",
        });
      }

      try {
        const dossier = await readDeskCase(
          db,
          cfg.companyId,
          caseId,
        );

        if (!dossier) {
          return res.status(404).json({
            error: "CASE_NOT_FOUND",
          });
        }

        return res.json(dossier);
      } catch {
        return res.status(503).json({
          error: "CM_DESK_DOSSIER_UNAVAILABLE",
        });
      }
    },
  );

  return router;
}
