import {
  getOperatorMode,
} from "../operator/operator.service.js";

import {
  findMessageByExternalId,
} from "../conversations/conversation.repository.js";

import {
  executeCompanyAgent,
} from "../agent/company-agent-execution.service.js";

type Incoming = {
  companyId: string;
  phone: string;
  sourceMessageId: string;
  text: string;
};

const pending = new Map<string, Promise<void>>();

function previewAllowed(input: Incoming): boolean {
  const testPhone = String(
    process.env.COMPANY_AI_PREVIEW_TEST_PHONE ?? ""
  ).replace(/\D/g, "");

  return (
    process.env.COMPANY_AI_PREVIEW_ENABLED === "true" &&
    process.env.COMPANY_AI_PREVIEW_COMPANY === input.companyId &&
    testPhone.length >= 8 &&
    testPhone === input.phone.replace(/\D/g, "")
  );
}

async function processIncoming(input: Incoming): Promise<void> {
  const mode = await getOperatorMode(
    input.phone,
    input.companyId
  );

  if (mode.status !== "ai") {
    console.log("[COMPANY AGENT OPERATOR CONTROL]", {
      companyId: input.companyId,
      mode: mode.status,
    });
    return;
  }

  const stored = await findMessageByExternalId(
    input.sourceMessageId,
    input.companyId
  );

  if (!stored?.id) {
    throw new Error("COMPANY_AGENT_MESSAGE_NOT_PERSISTED");
  }

  const result = await executeCompanyAgent({
    companyId: input.companyId,
    phone: input.phone,
    message: input.text,
    currentMessageId: stored.id,
  });

  console.log("[COMPANY AGENT ADVANCED PREVIEW]", {
    companyId: input.companyId,
    responseLength: result.text.length,
    mediaCount: result.media.length,
    sent: false,
  });

}

export function queueCompanyWhapiPreview(
  input: Incoming
): void {
  if (!previewAllowed(input)) return;

  const key = `${input.companyId}:${input.phone}`;

  if (!pending.has(key) && pending.size >= 100) {
    console.error("[COMPANY AGENT QUEUE FULL]");
    return;
  }

  const previous = pending.get(key) ?? Promise.resolve();

  const current = previous
    .catch(() => undefined)
    .then(() => processIncoming(input));

  pending.set(key, current);

  void current
    .catch(error => {
      console.error("[COMPANY AGENT PREVIEW ERROR]", {
        companyId: input.companyId,
        reason: error instanceof Error
          ? error.message
          : "UNKNOWN",
      });
    })
    .finally(() => {
      if (pending.get(key) === current) {
        pending.delete(key);
      }
    });
}
