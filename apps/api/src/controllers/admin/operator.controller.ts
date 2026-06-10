import type { Request, Response } from "express";
import { listOperatorAssignments, setOperatorMode } from "../../services/operator/operator.service.js";

export async function getOperatorDashboard(_req: Request, res: Response) {
  const assignments = await listOperatorAssignments();

  res.json({
    ok: true,
    assignments
  });
}

export async function updateOperatorMode(req: Request, res: Response) {
  const contact_phone = String(req.body?.contact_phone ?? "");
  const status = String(req.body?.status ?? "ai") as "ai" | "human" | "paused";
  const assigned_to = req.body?.assigned_to ? String(req.body.assigned_to) : undefined;
  const reason = req.body?.reason ? String(req.body.reason) : undefined;

  if (!contact_phone) {
    return res.status(400).json({
      ok: false,
      error: "contact_phone is required"
    });
  }

  const assignment = await setOperatorMode({
    contact_phone,
    status,
    assigned_to,
    reason
  });

  res.json({
    ok: true,
    assignment
  });
}
