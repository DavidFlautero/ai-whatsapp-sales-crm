import { createSupervisorReviewRoutes } from "./supervisor-review.routes.js";
import { Router } from "express";
import { readOfflineSupervisorPilot } from "./offline-supervisor-pilot.service.js";

import { Supabase } from "./supabase.js";
import { readLinkedIdentity } from "./linked-identity.service.js";

import type { Config } from "./config.js";
import { readOfflineReview } from "./offline-review.service.js";

export function createOfflineHistoricalRoutes(
  config: Config,
) {
  const routes = Router();

  routes.use((req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Vary", "Cookie, Authorization");
    res.setHeader("X-Content-Type-Options", "nosniff");

    const allowed = new Set([
      "superadmin",
      "owner",
      "admin",
      "supervisor",
    ]);

    if (
      !req.authUser?.active ||
      !allowed.has(req.authUser.role)
    ) {
      res.status(403).json({
        ok: false,
        error: "INSUFFICIENT_PERMISSIONS",
      });
      return;
    }

    next();
  });

  routes.get("/", async (_req, res) => {
    try {
      const data = await readOfflineReview(
        config.companyId,
      );

      res.json({
        ok: true,
        company: data.company,
        source: data.source,
        status: data.status,
        totals: data.totals,
        contacts: data.contacts,
      });
    } catch {
      res.status(503).json({
        ok: false,
        error: "OFFLINE_REVIEW_UNAVAILABLE",
      });
    }
  });

  routes.get(
    "/contacts/:fingerprint",
    async (req, res) => {
      const fingerprint = String(
        req.params.fingerprint ?? "",
      );

      if (!/^[a-f0-9]{20}$/.test(fingerprint)) {
        res.status(400).json({
          ok: false,
          error: "INVALID_CONTACT_REFERENCE",
        });
        return;
      }

      try {
        const data = await readOfflineReview(
          config.companyId,
        );

        const contact = data.detail(fingerprint);

        if (!contact) {
          res.status(404).json({
            ok: false,
            error: "CONTACT_NOT_FOUND",
          });
          return;
        }

        res.json({
          ok: true,
          contact,
        });
      } catch {
        res.status(503).json({
          ok: false,
          error: "OFFLINE_REVIEW_UNAVAILABLE",
        });
      }
    },
  );


  routes.get(
    "/contacts/:fingerprint/identity",
    async (req, res) => {
      const fingerprint = String(
        req.params.fingerprint ?? "",
      );

      if (!/^[a-f0-9]{20}$/.test(fingerprint)) {
        res.status(400).json({
          ok: false,
          error: "INVALID_CONTACT_REFERENCE",
        });
        return;
      }

      try {
        const db = new Supabase({
          ...config,
          writeEnabled: false,
        });

        const identity = await readLinkedIdentity(
          config.companyId,
          fingerprint,
          db,
        );

        if (!identity) {
          res.status(404).json({
            ok: false,
            error: "CONTACT_NOT_FOUND",
          });
          return;
        }

        res.json({
          ok: true,
          identity,
        });

      } catch {
        res.status(503).json({
          ok: false,
          error: "LINKED_IDENTITY_UNAVAILABLE",
        });
      }
    },
  );


  routes.get("/supervisor-pilot", async (_req, res) => {
    res.set("Cache-Control", "no-store");

    try {
      const result = await readOfflineSupervisorPilot(
        config.companyId,
      );

      res.json({ ok: true, ...result });
    } catch {
      res.status(503).json({
        ok: false,
        error: "SUPERVISOR_PILOT_UNAVAILABLE",
      });
    }
  });

  routes.get(
    "/supervisor-pilot/contacts/:fingerprint",
    async (req, res) => {
      res.set("Cache-Control", "no-store");

      const fingerprint = String(
        req.params.fingerprint ?? "",
      );

      if (!/^[a-f0-9]{20}$/.test(fingerprint)) {
        res.status(400).json({
          ok: false,
          error: "INVALID_CONTACT_REFERENCE",
        });
        return;
      }

      try {
        const result = await readOfflineSupervisorPilot(
          config.companyId,
          fingerprint,
        );

        if (result.cases.length !== 1) {
          res.status(404).json({
            ok: false,
            error: "CONTACT_NOT_FOUND",
          });
          return;
        }

        res.json({ ok: true, ...result });
      } catch {
        res.status(503).json({
          ok: false,
          error: "SUPERVISOR_PILOT_UNAVAILABLE",
        });
      }
    },
  );


  routes.use(
    "/supervisor-pilot",
    createSupervisorReviewRoutes(config),
  );

  return routes;
}
