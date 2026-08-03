import {
  listContacts,
} from "../../services/crm/crm.repository.js";

import {
  listConversations,
  listMessages,
} from "../../services/conversations/conversation.repository.js";

import {
  listPrompts,
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

type Probe = {
  name: string;
  run: () => unknown | Promise<unknown>;
};

const probes: Probe[] = [
  {
    name: "contacts",
    run: listContacts,
  },
  {
    name: "conversations",
    run: listConversations,
  },
  {
    name: "messages",
    run: listMessages,
  },
  {
    name: "prompts",
    run: listPrompts,
  },
  {
    name: "analytics",
    run: getAnalyticsOverview,
  },
  {
    name: "system-status",
    run: getSystemStatus,
  },
  {
    name: "event-logs",
    run: listEventLogs,
  },
  {
    name: "customer-memories",
    run: listCustomerMemories,
  },
  {
    name: "lead-scores",
    run: listLeadScores,
  },
  {
    name: "recovery-candidates",
    run: listRecoveryCandidates,
  },
  {
    name: "recovery-templates",
    run: listRecoveryTemplates,
  },
  {
    name: "recovery-events",
    run: listRecoveryEvents,
  },
  {
    name: "knowledge",
    run: listKnowledgeItems,
  },
  {
    name: "operator-assignments",
    run: listOperatorAssignments,
  },
  {
    name: "governance-events",
    run: listGovernanceEvents,
  },
  {
    name: "quality-scores",
    run: listQualityScores,
  },
  {
    name: "catalog-products",
    run: listProducts,
  },
];

function summarize(
  value: unknown,
): string {
  if (Array.isArray(value)) {
    return `array(${value.length})`;
  }

  if (
    value !== null
    && typeof value === "object"
  ) {
    return "object";
  }

  return typeof value;
}

async function runWithTimeout(
  probe: Probe,
): Promise<unknown> {
  return Promise.race([
    Promise.resolve()
      .then(probe.run),

    new Promise<never>(
      (_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                "TIMEOUT_AFTER_15000_MS",
              ),
            ),
          15_000,
        );
      },
    ),
  ]);
}

async function main(): Promise<void> {
  console.log(
    "===== ADMIN OVERVIEW PROBE =====",
  );

  let failures = 0;

  for (const probe of probes) {
    const startedAt =
      Date.now();

    try {
      const result =
        await runWithTimeout(
          probe,
        );

      console.log(
        `✅ ${probe.name}`
        + ` | ${Date.now() - startedAt}ms`
        + ` | ${summarize(result)}`,
      );
    } catch (error) {
      failures += 1;

      console.log(
        `❌ ${probe.name}`
        + ` | ${Date.now() - startedAt}ms`
        + ` | ${
          error instanceof Error
            ? error.message
            : "UNKNOWN_ERROR"
        }`,
      );
    }
  }

  console.log("");
  console.log(
    `Fallos detectados: ${failures}`,
  );

  console.log(
    "===== PROBE TERMINADO =====",
  );
}

void main();
