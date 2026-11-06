import type { Request, Response } from "express";

import { listContacts } from "../../services/crm/crm.repository.js";
import {
  listConversations,
  listMessages,
} from "../../services/conversations/conversation.repository.js";
import {
  listOperatorAssignments,
} from "../../services/operator/operator.service.js";

export async function getTenantConversations(
  req: Request,
  res: Response,
) {
  const companyId = req.tenantContext?.effectiveCompanyId;

  if (!companyId) {
    return res.status(403).json({
      ok: false,
      error: "COMPANY_CONTEXT_REQUIRED",
    });
  }

  const [
    contacts,
    conversations,
    messages,
    assignments,
  ] = await Promise.all([
    listContacts(companyId),
    listConversations(companyId),
    listMessages(undefined, companyId),
    listOperatorAssignments(companyId),
  ]);

  res.setHeader("Cache-Control", "no-store");

  return res.json({
    ok: true,
    contacts,
    conversations,
    messages,
    assignments,
  });
}
