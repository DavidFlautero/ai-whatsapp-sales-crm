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
  findRequestedCatalogImage,
} from "../catalog/catalog.repository.js";

import {
  listMessages,
} from "../conversations/conversation.repository.js";

import {
  handleWhatsappOrder,
} from "../orders/whatsapp-order.service.js";

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
      currentMessageId?: string;
  },
) {
  const companyId =
    input.companyId
    ?? env.DEFAULT_COMPANY_ID;

    const recentMessages =
      await listMessages(
        input.phone,
        companyId,
      );

    const conversationHistory =
      recentMessages
        .filter(
          (message) =>
            message.id
            !== input.currentMessageId,
        )
        .filter(
          (message) =>
            Boolean(
              message.body?.trim(),
            ),
        )
        .slice(0, 15)
        .reverse()
        .map(
          (message) =>
            `${
              message.direction === "inbound"
                ? "Cliente"
                : "Vendedor"
            }: ${message.body}`,
        )
        .join("\n")
      || "Sin mensajes anteriores.";

  const orderWorkflow =
    await handleWhatsappOrder({
      phone:
        input.phone,

      message:
        input.message,

      conversationHistory,

      companyId,
    });

  if (
    orderWorkflow.handled
    && orderWorkflow.text
  ) {
    console.log(
      "[SALES AGENT ORDER WORKFLOW]",
      {
        companyId,
        phone:
          input.phone,

        responseLength:
          orderWorkflow.text.length,
      },
    );

    return {
      text:
        orderWorkflow.text,

      media:
        [],
    };
  }

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
            [
              input.message,
              conversationHistory,
            ].join("\n"),
            companyId,
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

      conversationHistory,
    });

  const response =
    await generateAgentResponse(
      prompt,
    );

  const requestedImage =
    await safeResolve(
      "catalog-image",
      () =>
        findRequestedCatalogImage(
          input.message,
          conversationHistory,
          companyId,
        ),
      null,
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

    requestedImage.degraded
      ? "catalog-image"
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

  return {
    text:
      response,

    media:
      requestedImage.value
        ? requestedImage.value
            .images
            .map(
              (image) => ({
                type:
                  "image" as const,

                url:
                  image.url,

                role:
                  image.role
                  ?? null,

                productId:
                  requestedImage.value!
                    .product
                    .productId,

                variantId:
                  requestedImage.value!
                    .product
                    .variantId
                  ?? null,

                sku:
                  requestedImage.value!
                    .product
                    .sku,
              }),
            )
        : [],
  };
}
