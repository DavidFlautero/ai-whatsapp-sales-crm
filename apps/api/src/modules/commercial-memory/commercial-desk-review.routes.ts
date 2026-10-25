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
  authenticatedActor,
} from "./commercial-memory-access.js";

import {
  validCommercialId,
} from "./commercial-desk.repository.js";

type ReviewDecision =
  | "accepted"
  | "rejected";

export function createCommercialReviewRoutes(
  cfg: Config,
) {
  const router = Router();

  const db = new Supabase({
    ...cfg,
    writeEnabled: true,
  });

  router.post(
    "/links/:id/review",
    async (req, res) => {
      if (
        process.env
          .CM_MEMORY_REVIEW_WRITES_ENABLED !==
        "true"
      ) {
        return res.status(503).json({
          error: "REVIEWS_NOT_ENABLED",
        });
      }

      const intent = req.get(
        "x-cm-review-intent",
      );

      if (intent !== "human-confirmed") {
        return res.status(400).json({
          error: "MANUAL_CONFIRMATION_REQUIRED",
        });
      }

      if (!req.is("application/json")) {
        return res.status(415).json({
          error: "JSON_BODY_REQUIRED",
        });
      }

      const id = req.params.id;

      if (
        typeof id !== "string" ||
        !validCommercialId(id)
      ) {
        return res.status(400).json({
          error: "INVALID_LINK_ID",
        });
      }

      const body = req.body as
        Record<string, unknown> | undefined;

      const decision = body?.decision;

      if (
        decision !== "accepted" &&
        decision !== "rejected"
      ) {
        return res.status(400).json({
          error: "INVALID_REVIEW_DECISION",
        });
      }

      const actor = authenticatedActor(req);

      if (!actor) {
        return res.status(403).json({
          error: "REVIEW_ACTOR_NOT_IDENTIFIED",
        });
      }

      try {
        const candidates = await db.get<
          Array<{
            id: string;
            status: string;
            target_table: string;
          }>
        >(
          "cm_bridge_candidates",
          [
            [
              "select",
              "id,status,target_table",
            ],
            [
              "company_id",
              `eq.${cfg.companyId}`,
            ],
            ["id", `eq.${id}`],
            ["limit", "1"],
          ],
        );

        const candidate = candidates[0];

        if (!candidate) {
          return res.status(404).json({
            error: "LINK_NOT_FOUND",
          });
        }

        if (candidate.status !== "proposed") {
          return res.status(409).json({
            error: "LINK_ALREADY_REVIEWED",
          });
        }

        if (
          ![
            "crm_contacts",
            "crm_providers",
          ].includes(candidate.target_table)
        ) {
          return res.status(422).json({
            error: "TARGET_REQUIRES_MANUAL_AUDIT",
          });
        }

        const reviewed =
          await db.rpc<boolean>(
            "cm_review_link",
            {
              p_company: cfg.companyId,
              p_kind: "bridge",
              p_id: id,
              p_decision:
                decision as ReviewDecision,
              p_actor: actor,
            },
          );

        if (!reviewed) {
          return res.status(409).json({
            error: "LINK_REVIEW_CONFLICT",
          });
        }

        return res.json({
          ok: true,
          id,
          decision,
          auditRecorded: true,

          canonicalRecordModified: false,
        });

      } catch {
        return res.status(503).json({
          error: "LINK_REVIEW_UNAVAILABLE",
        });
      }
    },
  );

  return router;
}
