import type { Request, Response } from "express";
import { listRecoveryCandidates, listRecoveryTemplates, createRecoveryEvent, listRecoveryEvents } from "../../services/recovery/recovery.repository.js";
import { generateRecoveryMessage } from "../../services/recovery/recovery-message.service.js";
import { sendWhatsappText } from "../../services/whatsapp/whatsapp.service.js";

export async function getRecoveryDashboard(_req: Request, res: Response) {
  const [candidates, templates, events] = await Promise.all([
    listRecoveryCandidates(),
    listRecoveryTemplates(),
    listRecoveryEvents()
  ]);

  res.json({
    ok: true,
    candidates,
    templates,
    events
  });
}

export async function draftRecoveryMessage(req: Request, res: Response) {
  const phone = String(req.body?.phone ?? "");
  const name = req.body?.name ? String(req.body.name) : undefined;
  const reason = req.body?.reason ? String(req.body.reason) : undefined;

  if (!phone) {
    return res.status(400).json({ ok: false, error: "phone is required" });
  }

  const message = await generateRecoveryMessage({ phone, name, reason });

  const event = await createRecoveryEvent({
    contact_phone: phone,
    message,
    status: "draft",
    result: "pending"
  });

  res.json({
    ok: true,
    message,
    event
  });
}

export async function sendRecoveryMessage(req: Request, res: Response) {
  const phone = String(req.body?.phone ?? "");
  const message = String(req.body?.message ?? "");

  if (!phone || !message) {
    return res.status(400).json({
      ok: false,
      error: "phone and message are required"
    });
  }

  await sendWhatsappText({
    to: phone,
    text: message
  });

  const event = await createRecoveryEvent({
    contact_phone: phone,
    message,
    status: "sent",
    result: "pending",
    sent_at: new Date().toISOString()
  });

  res.json({
    ok: true,
    event
  });
}
