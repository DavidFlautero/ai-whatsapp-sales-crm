import { Router } from "express";
import { createHash } from "node:crypto";

import type { Config } from "./config.js";

import { Supabase } from "./supabase.js";

import {
  commercialCompanyGuard,
  authenticatedActor,
} from "./commercial-memory-access.js";

import {
  readOfflineSupervisorPilot,
} from "./offline-supervisor-pilot.service.js";

type ReviewDecision =
  | "reviewed"
  | "dismissed";

type StoredDecision = {
  proposal_id: string;
  decision: string;
  decided_at: string;
};

function proposalUuid(value: string): string | null {
  if (!/^[a-f0-9]{32}$/.test(value)) {
    return null;
  }

  return [
    value.slice(0, 8),
    value.slice(8, 12),
    value.slice(12, 16),
    value.slice(16, 20),
    value.slice(20),
  ].join("-");
}

export function createSupervisorReviewRoutes(
  cfg: Config,
) {
  const router = Router();

  router.use(
    commercialCompanyGuard(cfg.companyId),
  );

  const reader = new Supabase({
    ...cfg,
    writeEnabled: false,
  });

  const writer = new Supabase({
    ...cfg,
    writeEnabled: true,
  });

  router.get("/decisions", async (_req, res) => {
    res.set("Cache-Control", "no-store");

    try {
      const pilot = await readOfflineSupervisorPilot(
        cfg.companyId,
      );

      const allowed = new Set(
        pilot.cases.flatMap(item =>
          item.tasks
            .map(task => proposalUuid(task.task_id))
            .filter((id): id is string => id !== null),
        ),
      );

      const stored = await reader.get<StoredDecision[]>(
        "cm_supervisor_review_decisions",
        [
          [
            "select",
            "proposal_id,decision,decided_at",
          ],
          [
            "company_id",
            `eq.${cfg.companyId}`,
          ],
          ["limit", "200"],
        ],
      );

      const decisions = stored
        .filter(item =>
          allowed.has(item.proposal_id.toLowerCase()),
        )
        .map(item => ({
          proposal_id: item.proposal_id,
          decision: item.decision,
          decided_at: item.decided_at,
        }));

      res.json({
        ok: true,
        reviewWritesEnabled:
          process.env
            .CM_SUPERVISOR_REVIEW_WRITES_ENABLED ===
          "true",
        decisions,
      });

    } catch {
      res.status(503).json({
        error: "SUPERVISOR_REVIEW_UNAVAILABLE",
      });
    }
  });

  router.post(
    "/decisions/:taskId",
    async (req, res) => {
      res.set("Cache-Control", "no-store");

      if (
        process.env
          .CM_SUPERVISOR_REVIEW_WRITES_ENABLED !==
        "true"
      ) {
        res.status(503).json({
          error: "SUPERVISOR_REVIEW_WRITES_DISABLED",
        });
        return;
      }

      if (
        req.get("x-cm-review-intent") !==
        "human-confirmed"
      ) {
        res.status(400).json({
          error: "MANUAL_CONFIRMATION_REQUIRED",
        });
        return;
      }

      if (!req.is("application/json")) {
        res.status(415).json({
          error: "JSON_REQUIRED",
        });
        return;
      }

      const actor = authenticatedActor(req);

      if (!actor) {
        res.status(403).json({
          error: "REVIEW_ACTOR_NOT_IDENTIFIED",
        });
        return;
      }

      const body = req.body as
        | Record<string, unknown>
        | undefined;

      const decision = body?.decision;

      if (
        decision !== "reviewed" &&
        decision !== "dismissed"
      ) {
        res.status(400).json({
          error: "INVALID_SUPERVISOR_DECISION",
        });
        return;
      }

      const taskId = String(
        req.params.taskId ?? "",
      );

      const id = proposalUuid(taskId);

      if (!id) {
        res.status(400).json({
          error: "INVALID_SUPERVISOR_TASK_ID",
        });
        return;
      }

      try {
        const pilot = await readOfflineSupervisorPilot(
          cfg.companyId,
        );

        const selected = pilot.cases
          .flatMap(item =>
            item.tasks.map(task => ({
              task,
              fingerprint: item.contact_fingerprint,
            })),
          )
          .find(item =>
            item.task.task_id === taskId,
          );

        if (!selected) {
          res.status(404).json({
            error: "SUPERVISOR_TASK_NOT_FOUND",
          });
          return;
        }

        const evidenceIds =
          selected.task.evidence_message_ids;

        if (
          evidenceIds.length > 200 ||
          evidenceIds.some(
            value =>
              !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
                .test(value),
          )
        ) {
          res.status(422).json({
            error: "INVALID_EVIDENCE_REFERENCES",
          });
          return;
        }

        const snapshot = createHash("sha256")
          .update(
            JSON.stringify({
              company: cfg.companyId,
              fingerprint: selected.fingerprint,
              task: selected.task,
            }),
          )
          .digest("hex");

        const accepted = await writer.rpc<boolean>(
          "cm_decide_supervisor_review",
          {
            p_company: cfg.companyId,
            p_proposal_id: id,
            p_fingerprint: selected.fingerprint,
            p_decision: decision as ReviewDecision,
            p_actor: actor,
            p_source_sha256: snapshot,
            p_evidence_ids: evidenceIds,
          },
        );

        if (!accepted) {
          res.status(409).json({
            error: "SUPERVISOR_ALREADY_REVIEWED",
          });
          return;
        }

        res.json({
          ok: true,
          proposal_id: id,
          decision,
          auditRecorded: true,
          commercialFactVerified: false,
          crmModified: false,
          messageSent: false,
        });

      } catch {
        res.status(503).json({
          error: "SUPERVISOR_DECISION_UNAVAILABLE",
        });
      }
    },
  );

  return router;
}
