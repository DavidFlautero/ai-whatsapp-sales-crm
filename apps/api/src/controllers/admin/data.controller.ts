import type {
  Request,
  Response,
} from "express";

import {
  listContacts,
} from "../../services/crm/crm.repository.js";

import {
  listConversations,
  listMessages,
} from "../../services/conversations/conversation.repository.js";

import {
  listPrompts,
  upsertPrompt,
} from "../../services/prompts/prompt.repository.js";

import {
  getAnalyticsOverview,
} from "../../services/analytics/analytics.service.js";

import {
  getSystemStatus,
} from "../../services/system/system-status.service.js";

import {
  listEventLogs,
} from "../../services/events/event-log.service.js";

import {
  listCustomerMemories,
} from "../../services/memory/customer-memory.repository.js";

import {
  listCustomerInterestEvents,
} from "../../services/interests/customer-interest.repository.js";

import {
  listLeadScores,
} from "../../services/scoring/lead-scoring.service.js";

import {
  listRecoveryCandidates,
  listRecoveryEvents,
  listRecoveryTemplates,
} from "../../services/recovery/recovery.repository.js";

import {
  listKnowledgeItems,
} from "../../services/knowledge/knowledge.repository.js";

import {
  listOperatorAssignments,
} from "../../services/operator/operator.service.js";

import {
  listGovernanceEvents,
} from "../../services/governance/agent-governance.service.js";

import {
  listQualityScores,
} from "../../services/quality/conversation-quality.service.js";

import {
  listProducts,
} from "../../services/catalog/catalog.repository.js";

type DegradedModuleCode =
  | "SUPABASE_DEPENDENCY_UNAVAILABLE"
  | "MODULE_LOAD_FAILED";

type DegradedModule = {
  name: string;
  code: DegradedModuleCode;
  message: string;
};

function errorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error
    && error.message.trim()
  ) {
    return error.message.trim();
  }

  return "UNKNOWN_MODULE_ERROR";
}

function classifyError(
  message: string,
): DegradedModuleCode {
  const normalized =
    message.toLowerCase();

  if (
    normalized.includes("supabase")
    || normalized.includes("pgrst")
  ) {
    return "SUPABASE_DEPENDENCY_UNAVAILABLE";
  }

  return "MODULE_LOAD_FAILED";
}

async function safeLoad<T>(
  input: {
    name: string;
    loader: () => Promise<T> | T;
    fallback: T;
    requestId: string | null;
    degradedModules: DegradedModule[];
  },
): Promise<T> {
  try {
    return await input.loader();
  } catch (error) {
    const message =
      errorMessage(error);

    const code =
      classifyError(message);

    input.degradedModules.push({
      name:
        input.name,

      code,

      message,
    });

    console.warn(
      "[admin-overview-degraded]",
      JSON.stringify({
        occurredAt:
          new Date().toISOString(),

        requestId:
          input.requestId,

        module:
          input.name,

        code,

        message,
      }),
    );

    return input.fallback;
  }
}

export async function getAdminOverview(
  req: Request,
  res: Response,
) {
  const requestId =
    req.requestContext?.requestId
    ?? req.get("x-request-id")
    ?? null;

  const degradedModules:
    DegradedModule[] = [];

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
    catalogProducts,
    events,
  ] = await Promise.all([
    safeLoad({
      name: "contacts",
      loader: listContacts,
      fallback: [],
      requestId,
      degradedModules,
    }),

    safeLoad({
      name: "conversations",
      loader: listConversations,
      fallback: [],
      requestId,
      degradedModules,
    }),

    safeLoad({
      name: "messages",
      loader: listMessages,
      fallback: [],
      requestId,
      degradedModules,
    }),

    safeLoad({
      name: "prompts",
      loader: listPrompts,
      fallback: [],
      requestId,
      degradedModules,
    }),

    safeLoad({
      name: "analytics",
      loader: getAnalyticsOverview,

      fallback: {
        contacts: 0,
        conversations: 0,
        messages: 0,
        inbound: 0,
        outbound: 0,
        conversion: 0,
        activeLeads: 0,
        estimatedPipelineUsd: 0,
      },

      requestId,
      degradedModules,
    }),

    safeLoad({
      name: "system-status",
      loader: getSystemStatus,
      fallback: null,
      requestId,
      degradedModules,
    }),

    safeLoad({
      name: "customer-memories",
      loader: listCustomerMemories,
      fallback: [],
      requestId,
      degradedModules,
    }),

    safeLoad({
      name: "lead-scores",
      loader: async () => [],
      fallback: [],
      requestId,
      degradedModules,
    }),

    safeLoad({
      name: "recovery-candidates",
      loader: listRecoveryCandidates,
      fallback: [],
      requestId,
      degradedModules,
    }),

    safeLoad({
      name: "recovery-templates",
      loader: async () => [],
      fallback: [],
      requestId,
      degradedModules,
    }),

    safeLoad({
      name: "recovery-events",
      loader: async () => [],
      fallback: [],
      requestId,
      degradedModules,
    }),

    safeLoad({
      name: "knowledge-items",
      loader: listKnowledgeItems,
      fallback: [],
      requestId,
      degradedModules,
    }),

    safeLoad({
      name: "operator-assignments",
      loader: listOperatorAssignments,
      fallback: [],
      requestId,
      degradedModules,
    }),

    safeLoad({
      name: "governance-events",
      loader: async () => [],
      fallback: [],
      requestId,
      degradedModules,
    }),

    safeLoad({
      name: "quality-scores",
      loader: async () => [],
      fallback: [],
      requestId,
      degradedModules,
    }),

    safeLoad({
      name: "catalog-products",
      loader: listProducts,
      fallback: [],
      requestId,
      degradedModules,
    }),

    safeLoad({
      name: "event-logs",
      loader: listEventLogs,
      fallback: [],
      requestId,
      degradedModules,
    }),
  ]);

  const degraded =
    degradedModules.length > 0;

  res.setHeader(
    "x-data-mode",
    degraded
      ? "degraded"
      : "complete",
  );

  res.setHeader(
    "x-degraded-modules",
    String(
      degradedModules.length,
    ),
  );

  return res.json({
    ok: true,

    degraded,

    generatedAt:
      new Date().toISOString(),

    requestId,

    degradedModules,

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
    events,
  });
}

export async function saveAdminPrompt(
  req: Request,
  res: Response,
) {
  const type =
    String(
      req.body?.type
      ?? "",
    ).trim();

  const title =
    String(
      req.body?.title
      ?? "",
    ).trim();

  const prompt =
    String(
      req.body?.prompt
      ?? "",
    ).trim();

  if (
    !type
    || !title
    || !prompt
  ) {
    return res
      .status(400)
      .json({
        ok: false,
        error:
          "type, title and prompt are required",
      });
  }

  const saved =
    await upsertPrompt({
      type,
      title,
      prompt,
      active: true,
    });

  return res.json({
    ok: true,
    prompt: saved,
  });
}
