import type {
  Request,
  Response,
} from "express";

import {
  getOperatorMode,
  listOperatorAssignments,
  setOperatorMode,
} from "../../services/operator/operator.service.js";

import {
  saveMessage,
} from "../../services/conversations/conversation.repository.js";

import {
  sendWhatsappText,
} from "../../services/whatsapp/whatsapp.service.js";

function effectiveCompanyId(
  req: Request,
): string {
  const companyId =
    req.tenantContext
      ?.effectiveCompanyId;

  if (!companyId) {
    throw new Error(
      "COMPANY_CONTEXT_REQUIRED",
    );
  }

  return companyId;
}

export async function getOperatorDashboard(
  req: Request,
  res: Response,
) {
  const companyId =
    effectiveCompanyId(req);

  const assignments =
    await listOperatorAssignments(
      companyId,
    );

  return res.json({
    ok:
      true,

    assignments,
  });
}

export async function updateOperatorMode(
  req: Request,
  res: Response,
) {
  const companyId =
    effectiveCompanyId(req);

  const contactPhone =
    String(
      req.body?.contact_phone
      ?? "",
    ).trim();

  const status =
    String(
      req.body?.status
      ?? "",
    );

  if (!contactPhone) {
    return res.status(400).json({
      ok:
        false,

      error:
        "CONTACT_PHONE_REQUIRED",
    });
  }

  if (
    status !== "ai"
    && status !== "human"
    && status !== "paused"
  ) {
    return res.status(400).json({
      ok:
        false,

      error:
        "INVALID_OPERATOR_STATUS",
    });
  }

  console.log(
    "[OPERATOR MODE REQUEST]",
    {
      companyId,
      contactPhone,
      status,
      actorId:
        req.accessActor?.id
        ?? null,
    },
  );

  const assignment =
    await setOperatorMode({
      companyId,

      contactPhone,

      status,

      assignedTo:
        req.accessActor?.id
        ?? undefined,

      reason:
        req.body?.reason
          ? String(req.body.reason)
          : undefined,
    });

  console.log(
    "[OPERATOR MODE SAVED]",
    {
      companyId,
      contactPhone,
      status:
        assignment.status,
    },
  );

  return res.json({
    ok:
      true,

    assignment,
  });
}

export async function sendOperatorMessage(
  req: Request,
  res: Response,
) {
  const companyId =
    effectiveCompanyId(req);

  const contactPhone =
    String(
      req.body?.contact_phone
      ?? "",
    ).trim();

  const text =
    String(
      req.body?.text
      ?? "",
    ).trim();

  if (!contactPhone || !text) {
    return res.status(400).json({
      ok:
        false,

      error:
        "CONTACT_PHONE_AND_TEXT_REQUIRED",
    });
  }

  if (text.length > 4096) {
    return res.status(400).json({
      ok:
        false,

      error:
        "MESSAGE_TOO_LONG",
    });
  }

  const mode =
    await getOperatorMode(
      contactPhone,
      companyId,
    );

  if (mode.status !== "human") {
    return res.status(409).json({
      ok:
        false,

      error:
        "CONVERSATION_NOT_IN_HUMAN_MODE",
    });
  }

  const sent =
    await sendWhatsappText({
      to:
        contactPhone,

      text,
    });

  const stored =
    await saveMessage(
      {
        contact_phone:
          contactPhone,

        external_message_id:
          sent.externalMessageId,

        direction:
          "outbound",

        channel:
          "whatsapp",

        message_type:
          "text",

        body:
          text,

        raw_payload:
          sent.raw,

        delivery_status:
          sent.status === "accepted"
            ? "queued"
            : "sent",

        occurred_at:
          new Date()
            .toISOString(),

        media: {
          source:
            "human_operator",

          actorId:
            req.accessActor?.id
            ?? null,
        },
      },
      companyId,
    );

  return res.status(201).json({
    ok:
      true,

    message:
      stored.message,
  });
}
