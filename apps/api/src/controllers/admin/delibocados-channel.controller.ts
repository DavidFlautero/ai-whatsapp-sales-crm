import type { Request, Response } from "express";

import {
  configureDelibocadosChannel,
  delibocadosChannelStatus,
} from "../../services/whapi/delibocados-channel.service.js";

function authorized(req: Request): boolean {
  return req.tenantContext?.effectiveCompanyId === "delibocados" &&
    req.authUser?.companyId === "delibocados";
}

export async function getDelibocadosChannelStatus(
  req: Request,
  res: Response,
) {
  if (!authorized(req)) {
    return res.status(403).json({ ok: false, error: "COMPANY_ACCESS_DENIED" });
  }

  try {
    const data = await delibocadosChannelStatus();
    res.setHeader("Cache-Control", "no-store");
    return res.json({ ok: true, data });
  } catch {
    return res.status(503).json({
      ok: false,
      error: "WHAPI_CHANNEL_STATUS_UNAVAILABLE",
    });
  }
}

export async function saveDelibocadosChannel(
  req: Request,
  res: Response,
) {
  if (!authorized(req)) {
    return res.status(403).json({ ok: false, error: "COMPANY_ACCESS_DENIED" });
  }

  try {
    await configureDelibocadosChannel({
      token: String(req.body?.token ?? ""),
      phone: String(req.body?.phone ?? ""),
      testPhone: String(req.body?.testPhone ?? ""),
    });

    return res.status(200).json({
      ok: true,
      data: await delibocadosChannelStatus(),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN";
    const known = [
      "DELIBOCADOS_CHANNEL_INPUT_INVALID",
      "DELIBOCADOS_WHAPI_WRONG_SENDER",
      "DELIBOCADOS_WHAPI_NO_AUTHENTICATED_SENDER",
    ];
    if (known.includes(reason) || reason.startsWith("DELIBOCADOS_WHAPI_AUTH_HTTP_")) {
      return res.status(422).json({ ok: false, error: reason });
    }

    console.error("[DELIBOCADOS WHAPI SETUP]", {
      type: error instanceof Error ? error.name : "UNKNOWN",
      code: "WHAPI_CHANNEL_SAVE_FAILED",
    });

    return res.status(503).json({
      ok: false,
      error: "WHAPI_CHANNEL_SAVE_FAILED",
    });
  }
}
