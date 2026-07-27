import type { Request, Response } from "express";
import { getSystemStatus } from "../../services/system/system-status.service.js";
import { listEventLogs } from "../../services/events/event-log.service.js";

export async function getAdminStatus(_req: Request, res: Response) {
  const status = await getSystemStatus();

  res.json({
    ...status,
    events: listEventLogs()
  });
}
