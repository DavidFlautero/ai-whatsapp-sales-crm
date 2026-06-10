import type { Request, Response } from "express";
import { listContacts } from "../../services/crm/crm.repository.js";
import { listConversations, listMessages } from "../../services/conversations/conversation.repository.js";
import { listPrompts, upsertPrompt } from "../../services/prompts/prompt.repository.js";
import { getAnalyticsOverview } from "../../services/analytics/analytics.service.js";
import { getSystemStatus } from "../../services/system/system-status.service.js";
import { listEventLogs } from "../../services/events/event-log.service.js";
import { listCustomerMemories } from "../../services/memory/customer-memory.repository.js";
import { listLeadScores } from "../../services/scoring/lead-scoring.service.js";
import { listRecoveryCandidates, listRecoveryEvents, listRecoveryTemplates } from "../../services/recovery/recovery.repository.js";
import { listKnowledgeItems } from "../../services/knowledge/knowledge.repository.js";
import { listOperatorAssignments } from "../../services/operator/operator.service.js";
import { listGovernanceEvents } from "../../services/governance/agent-governance.service.js";
import { listQualityScores } from "../../services/quality/conversation-quality.service.js";
import { listProducts } from "../../services/catalog/catalog.repository.js";

export async function getAdminOverview(_req: Request, res: Response) {
  const [
    contacts,
    conversations,
    messages,
    prompts,
    analytics,
    status,
    memories,
    leadScores,
    recoveryCandidates,
    recoveryTemplates,
    recoveryEvents,
    knowledgeItems,
    operatorAssignments,
    governanceEvents,
    qualityScores,
    catalogProducts
  ] = await Promise.all([
    listContacts(),
    listConversations(),
    listMessages(),
    listPrompts(),
    getAnalyticsOverview(),
    getSystemStatus(),
    listCustomerMemories(),
    listLeadScores(),
    listRecoveryCandidates(),
    listRecoveryTemplates(),
    listRecoveryEvents(),
    listKnowledgeItems(),
    listOperatorAssignments(),
    listGovernanceEvents(),
    listQualityScores(),
    listProducts()
  ]);

  res.json({
    ok: true,
    status,
    analytics,
    contacts,
    conversations,
    messages,
    prompts,
    memories,
    leadScores,
    recoveryCandidates,
    recoveryTemplates,
    recoveryEvents,
    knowledgeItems,
    operatorAssignments,
    governanceEvents,
    qualityScores,
    catalogProducts,
    events: listEventLogs()
  });
}

export async function saveAdminPrompt(req: Request, res: Response) {
  const type = String(req.body?.type ?? "").trim();
  const title = String(req.body?.title ?? "").trim();
  const prompt = String(req.body?.prompt ?? "").trim();

  if (!type || !title || !prompt) {
    return res.status(400).json({
      ok: false,
      error: "type, title and prompt are required"
    });
  }

  const saved = await upsertPrompt({
    type,
    title,
    prompt,
    active: true
  });

  return res.json({
    ok: true,
    prompt: saved
  });
}
