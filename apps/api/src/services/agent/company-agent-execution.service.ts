import {
  getCompanyCatalog,
} from "./company-catalog.service.js";

import {
  readIntegrationSecrets,
} from "../integrations/integration-secrets.repository.js";

import {
  buildConfiguredCompanyPrompt,
} from "./company-agent-prompt.service.js";

import {
  listMessages,
} from "../conversations/conversation.repository.js";

import {
  buildCustomerMemoryContext,
} from "../memory/customer-memory.repository.js";

import {
  buildKnowledgeContext,
} from "../knowledge/knowledge.repository.js";

import {
  loadCompanyCapabilities,
} from "./company-agent-capabilities.service.js";

export type CompanyAgentExecutionInput = {
  companyId: string;
  phone: string;
  message: string;
  currentMessageId?: string;
};

export async function executeCompanyAgent(
  input: CompanyAgentExecutionInput
): Promise<{ text: string; media: [] }> {
  if (!input.companyId?.trim()) {
    throw new Error("COMPANY_ID_REQUIRED");
  }

  if (!input.phone?.trim()) {
    throw new Error("CUSTOMER_PHONE_REQUIRED");
  }

  if (!input.message?.trim()) {
    throw new Error("CUSTOMER_MESSAGE_REQUIRED");
  }

  const capabilities =
    await loadCompanyCapabilities(input.companyId);

  const history = await listMessages(
    input.phone,
    input.companyId
  );

  const conversationHistory = history
    .filter(
      item => item.id !== input.currentMessageId
    )
    .filter(
      item => Boolean(item.body?.trim())
    )
    .slice(-15)
    .map(
      item =>
        `${item.direction === "inbound" ? "Cliente" : "Asistente"}: ${item.body}`
    )
    .join("\n");

  const memoryContext = capabilities.memory
    ? await buildCustomerMemoryContext(
        input.phone,
        input.companyId
      )
    : "";

  const knowledgeContext = capabilities.knowledge
    ? await buildKnowledgeContext(
        input.message,
        input.companyId
      )
    : "";

  let catalogContext = "";

  if (
    capabilities.catalog ||
    input.companyId === "delibocados"
  ) {
    const catalog = await getCompanyCatalog(
      input.companyId
    );

    catalogContext =
      "CATÁLOGO OFICIAL DE LA EMPRESA:\n" +
      catalog +
      "\nUsá únicamente productos y precios verificados. " +
      "No inventes ingredientes, variantes ni disponibilidad.";
  }

  const prompt =
    await buildConfiguredCompanyPrompt({
      companyId: input.companyId,
      customerMessage: input.message,
      conversationHistory,
      memoryContext,
      knowledgeContext: [
        knowledgeContext,
        catalogContext,
      ].filter(Boolean).join("\n\n"),
    });

  const secrets = await readIntegrationSecrets();
  const apiKey = secrets.openai?.apiKey?.trim();
  const model = secrets.openai?.model?.trim()
    || "gpt-4.1-mini";

  if (!apiKey) {
    throw new Error("COMPANY_OPENAI_KEY_MISSING");
  }

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: prompt,
        max_output_tokens: 800,
        store: false,
      }),
      signal: AbortSignal.timeout(35000),
    }
  );

  if (!response.ok) {
    throw new Error(
      `COMPANY_OPENAI_HTTP_${response.status}`
    );
  }

  const result = await response.json() as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };

  const text = (
    result.output_text ||
    result.output
      ?.flatMap(item => item.content ?? [])
      .filter(item => item.type === "output_text")
      .map(item => item.text ?? "")
      .join("\n") ||
    ""
  ).trim();

  if (!text) {
    throw new Error("COMPANY_AGENT_EMPTY_RESPONSE");
  }

  return {
    text,
    media: [],
  };
}
