import {
  env,
} from "../../config/env.js";

import {
  buildSalesAgentPrompt,
} from "../../prompts/sales-agent.prompt.js";

import {
  getPrompt,
} from "../prompts/prompt.repository.js";

import {
  generateAgentResponse,
} from "../anthropic/anthropic.service.js";

import {
  buildCustomerMemoryContext,
} from "../memory/customer-memory.repository.js";

import {
  buildKnowledgeContext,
} from "../knowledge/knowledge.repository.js";

import {
  buildCatalogContext,
} from "../catalog/catalog.repository.js";

type SafeResult<T> = {
  value: T;
  degraded: boolean;
};

async function safeResolve<T>(
  label: string,
  operation: () => Promise<T>,
  fallback: T,
): Promise<SafeResult<T>> {
  try {
    return {
      value:
        await operation(),

      degraded:
        false,
    };
  } catch (error) {
    console.error(
      `[SALES AGENT DEGRADED: ${label}]`,
      error,
    );

    return {
      value:
        fallback,

      degraded:
        true,
    };
  }
}

export async function salesAgentReply(
  input: {
    phone: string;
    message: string;
    companyId?: string;
  },
) {
  const companyId =
    input.companyId
    ?? env.DEFAULT_COMPANY_ID;

  const [
    salesPromptResult,
    memoryResult,
    knowledgeResult,
    catalogResult,
  ] =
    await Promise.all([
      safeResolve(
        "prompt",

        () =>
          getPrompt(
            "sales",
            companyId,
          ),

        {
          type:
            "sales",

          title:
            "Sales Agent",

          prompt:
            "Eres un vendedor humano, cálido y directo. Avanza la conversación sin inventar precio, stock ni disponibilidad.",

          active:
            true,
        },
      ),

      safeResolve(
        "memory",

        () =>
          buildCustomerMemoryContext(
            input.phone,
            companyId,
          ),

        "Cliente sin memoria comercial disponible.",
      ),

      safeResolve(
        "knowledge",

        () =>
          buildKnowledgeContext(
            input.message,
            companyId,
          ),

        "Sin información empresarial adicional disponible.",
      ),

      safeResolve(
        "catalog",

        () =>
          buildCatalogContext(
            input.message,
          ),

        "Catálogo temporalmente no disponible. No confirmar precio ni stock.",
      ),
    ]);

  const prompt =
    buildSalesAgentPrompt({
      customerMessage:
        input.message,

      customerPhone:
        input.phone,

      basePrompt:
        salesPromptResult
          .value
          .prompt,

      memoryContext:
        memoryResult.value,

      knowledgeContext:
        knowledgeResult.value,

      catalogContext:
        catalogResult.value,
    });

  const response =
    await generateAgentResponse(
      prompt,
    );

  const degradedSources = [
    salesPromptResult.degraded
      ? "prompt"
      : null,

    memoryResult.degraded
      ? "memory"
      : null,

    knowledgeResult.degraded
      ? "knowledge"
      : null,

    catalogResult.degraded
      ? "catalog"
      : null,
  ].filter(Boolean);

  console.log(
    "[SALES AGENT RESPONSE]",
    {
      companyId,
      phone:
        input.phone,

      degradedSources,

      responseLength:
        response.length,
    },
  );

  return response;
}
