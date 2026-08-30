import {
  ensureRuntimeAccess,
} from "../runtime/core-state.service.js";

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
  searchNinoxCatalog,
} from "../ninox/ninox-catalog-search.service.js";

import {
  buildOrderInterpreterContext,
} from "../orders/order-interpreter-context.service.js";

import {
  interpretOrderCommand,
} from "../orders/order-command-interpreter.service.js";

import {
  listMessages,
} from "../conversations/conversation.repository.js";

import {
  buildStoreLinkReply,
} from "../catalog/store-link.service.js";

import {
  handleWhatsappOrder,
} from "../orders/whatsapp-order.service.js";

import {
  handleWhatsappOrderMutation,
} from "../orders/whatsapp-order-mutation.service.js";

import {
  buildCustomerOrderHistoryContext,
} from "../orders/order.service.js";

import {
  buildWhatsappBusinessRuntimeContext,
} from "../whatsapp/whatsapp-business-settings.service.js";

import {
  searchProductFromMessageImage,
} from "../vision/product-vision.service.js";


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

  /* RUNTIME_CHECK_A2 */
  ensureRuntimeAccess("sales-agent");

  const companyId =
    input.companyId
    ?? env.DEFAULT_COMPANY_ID;

  /*
   * Búsqueda visual:
   * solo intenta procesar media si tenemos
   * currentMessageId y la integración Vision
   * está configurada.
   */
  if (
    input.currentMessageId
  ) {
    try {
      const visual =
        await searchProductFromMessageImage({
          messageId:
            input.currentMessageId,

          companyId,

          caption:
            input.message,
        });

      if (
        visual.handled
      ) {
        const matches =
          visual.matches
          ?? [];

        if (
          matches.length
          > 0
        ) {
          const best =
            matches[0];

          const candidates =
            matches
              .slice(
                0,
                3,
              )
              .map(
                (item) =>
                  `${item.code} - ${item.name}`
                  + `${item.color ? ` (${item.color})` : ""}`,
              );

          /* VISION_PRODUCT_PRESENTATION_V1 */
          let productStoreUrl:
            string | null =
              null;

          try {
            const storeReply =
              buildStoreLinkReply({
                message:
                  "catálogo mayorista",

                conversationHistory:
                  "",
              });

            if (
              storeReply.handled
              && storeReply.url
            ) {
              const productUrl =
                new URL(
                  storeReply.url,
                );

              productUrl
                .searchParams
                .set(
                  "buscar",
                  best.code,
                );

              productStoreUrl =
                productUrl
                  .toString();
            }

          } catch (error) {
            console.error(
              "[VISION PRODUCT STORE LINK ERROR]",
              {
                companyId,

                code:
                  best.code,

                error:
                  error instanceof Error
                    ? error.message
                    : String(
                        error,
                      ),
              },
            );
          }

          const catalogImageUrl =
            best.catalogImageUrl
              ?.trim()
            || null;

          const responseText =
            [
              "Encontré este producto en el catálogo:",
              "",
              `*${best.code} - ${best.name}*`,
              best.color
                ? `Color: ${best.color}`
                : null,
              best.size
                ? `Talle: ${best.size}`
                : null,
              "",
              productStoreUrl
                ? "Verlo y comprarlo en la tienda:"
                : null,
              productStoreUrl,
              "",
              matches.length > 1
                ? `También encontré alternativas: ${candidates.slice(1).join(", ")}`
                : "Podés abrir el enlace para ver sus variantes y agregarlo al pedido.",
            ]
              .filter(
                (
                  line,
                ): line is string =>
                  typeof line
                  === "string",
              )
              .join(
                "\n",
              )
              .trim();

          console.log(
            "[VISION PRODUCT PRESENTATION]",
            {
              companyId,

              code:
                best.code,

              hasImage:
                Boolean(
                  catalogImageUrl,
                ),

              hasStoreLink:
                Boolean(
                  productStoreUrl,
                ),
            },
          );

          return {
            text:
              responseText,

            image:
              catalogImageUrl,

            media:
              catalogImageUrl
                ? [
                    {
                      type:
                        "image" as const,

                      url:
                        catalogImageUrl,

                      role:
                        "cover",

                      productId:
                        best.code,

                      variantId:
                        null,

                      sku:
                        best.code,
                    },
                  ]
                : [],

            product:
              best,

            source:
              "vision",
          };
        }

        return {
          text:
            "Vi la imagen, pero no encontré una coincidencia suficientemente clara en el catálogo. Si querés, decime qué tipo de prenda es o algún detalle y la busco mejor.",

          image:
            null,

          product:
            null,

          source:
            "vision",
        };
      }
    } catch (
      error
    ) {
      const message =
        error instanceof Error
          ? error.message
          : String(
              error,
            );

      /*
       * Si el mensaje no era imagen,
       * seguimos con el flujo normal.
       */
      if (
        message
        !== "MESSAGE_HAS_NO_DOWNLOADABLE_MEDIA"
        && message
        !== "MESSAGE_MEDIA_SOURCE_MISSING"
        && message
        !== "VISION_MEDIA_NOT_IMAGE"
      ) {
        console.error(
          "[PRODUCT VISION SEARCH ERROR]",
          {
    companyId
},
        );
      }
    }
  }

  const whatsappBusinessContext =
    await safeResolve(
      "whatsapp-business",

      () =>
        buildWhatsappBusinessRuntimeContext(
          companyId,
        ),

      "Sin configuración especial de horario comercial.",
    );

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

  const storeLinkReply =
    buildStoreLinkReply({
      message:
        input.message,

      conversationHistory,
    });

  if (
    storeLinkReply.handled
    && storeLinkReply.text
  ) {
    console.log(
      "[SALES AGENT STORE LINK]",
      {
    companyId,
    mode: storeLinkReply.mode,
    category: storeLinkReply.category,
    url: storeLinkReply.url
},
    );

    return {
      text:
        storeLinkReply.text,

      media:
        [],
    };
  }

  const mutationWorkflow =
    await handleWhatsappOrderMutation({
      phone:
        input.phone,

      message:
        input.message,

      companyId,

      currentMessageId:
        input.currentMessageId,

      conversationHistory,
    });

  if (
    mutationWorkflow.handled
    && mutationWorkflow.text
  ) {
    console.log(
      "[SALES AGENT ORDER MUTATION]",
      {
    companyId,
    currentMessageId: input.currentMessageId
        ?? null,
    responseLength: mutationWorkflow.text.length
},
    );

    return {
      text:
        mutationWorkflow.text,

      media:
        [],
    };
  }

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
    responseLength: orderWorkflow.text.length
},
    );

    return {
      text:
        orderWorkflow.text,

      media:
        [],
    };
  }

  function cleanSemanticCatalogReference(
  value:
    string,
) {
  return value
    .toLowerCase()
    .normalize(
      "NFD",
    )
    .replace(
      /\p{Diacritic}/gu,
      "",
    )
    .replace(
      /\b(mencionad[oa]s?|previamente|anteriormente|antes|mencionado|mencionada|producto|modelo)\b/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}


let catalogLookupMessage =
    input.message;

  /*
   * VISION MULTIMODAL CONTEXT
   *
   * currentMessageId apunta al mismo mensaje
   * que ya fue persistido en CRM/conversación.
   *
   * Si no es una imagen, el servicio sale
   * inmediatamente sin costo visual.
   */
  const visionResolved =
    await safeResolve(
      "product-vision",

      async () =>
        input.currentMessageId
          ? searchProductFromMessageImage({
              messageId:
                input.currentMessageId,

              companyId,
            })
          : {
              handled:
                false as const,

              reason:
                "message-id-missing",
            },

      {
        handled:
          false as const,

        reason:
          "vision-degraded",
      },
    );


  const visionValue =
    visionResolved.value as {
      handled?:
        boolean;

      mode?:
        string;

      analysis?: {
        productType?:
          string;

        primaryColor?:
          string | null;

        pattern?:
          string | null;

        confidence?:
          number;
      };

      matches?:
        Array<{
          code:
            string;

          name:
            string;

          color?:
            string | null;

          size?:
            string | null;

          available?:
            number;

          visualScore?:
            number | null;

          visualReason?:
            string | null;
        }>;
    };


  let visionTopCode:
    string | null =
      null;


  let visionContext =
    "";


  if (
    visionValue.handled
  ) {
    const topMatches =
      visionValue.matches
      ?? [];

    visionTopCode =
      topMatches[0]?.code
      ?? null;


    if (visionTopCode) {
      catalogLookupMessage =
        visionTopCode;
    }


    visionContext =
      [
        "ANÁLISIS DE LA FOTO ENVIADA POR EL CLIENTE:",

        `Tipo visual: ${
          visionValue.analysis
            ?.productType
          ?? "no determinado"
        }`,

        `Color visual: ${
          visionValue.analysis
            ?.primaryColor
          ?? "no determinado"
        }`,

        `Modo de búsqueda: ${
          visionValue.mode
          ?? "vision"
        }`,

        "Candidatos reales encontrados en Ninox:",

        ...topMatches
          .slice(
            0,
            5,
          )
          .map(
            (
              match,
              index,
            ) =>
              [
                `${index + 1}.`,
                match.code,
                `— ${match.name}`,
                match.color
                  ? `· color ${match.color}`
                  : "",
                match.visualScore
                  !== null
                  && match.visualScore
                    !== undefined
                    ? `· similitud visual ${match.visualScore}/100`
                    : "",
                match.visualReason
                  ? `· ${match.visualReason}`
                  : "",
              ]
                .filter(Boolean)
                .join(" "),
          ),

        "",
        "REGLAS DE VISION:",
        "- Los SKU/precios/stock válidos son únicamente los provenientes de Ninox.",
        "- Vision sólo sirve para localizar candidatos visuales.",
        "- No digas que una prenda es exactamente la misma si la evidencia visual no es suficiente.",
        "- Si hay varias candidatas razonables, presentalas como opciones.",
        "- No inventes una prenda que no aparezca en el catálogo.",
        "- Cuando Vision encuentre un producto con foto catalogada, presentá su imagen y el link firmado de tienda.",
      ]
        .join("\n");
  }


  const directNinoxMatches =
    await searchNinoxCatalog({
      query:
        input.message,

      limit:
        1,
    })
      .catch(
        (error: unknown) => {
          console.error(
            "[CATALOG DIRECT SEARCH ERROR]",
            {
    companyId
},
          );

          return [];
        },
      );

  const mayNeedCatalogReference =
    directNinoxMatches.length === 0
    && conversationHistory
      !== "Sin mensajes anteriores."
    && /\b(precio|sale|costaba|cuesta|talle|talles|color|colores|ese|esa|eso|esta|este|tenia|mismo|misma|modelo)\b/i
      .test(
        input.message,
      );

  if (
    mayNeedCatalogReference
  ) {
    try {
      const semanticContext =
        await buildOrderInterpreterContext({
          companyId,

          phone:
            input.phone,

          message:
            input.message,

          conversationHistory,
        });

      const semanticCommand =
        await interpretOrderCommand(
          semanticContext,
        );

      if (
        semanticCommand.domain
          === "catalog"
      ) {
        const resolvedCatalogReference =
          cleanSemanticCatalogReference(
            [
              semanticCommand.currentProduct
                ?.sku,

              semanticCommand.currentProduct
                ?.name,

              semanticCommand.currentProduct
                ?.contextualReference,

              semanticCommand.currentProduct
                ?.color,

              semanticCommand.currentProduct
                ?.size,
            ]
              .filter(Boolean)
              .join(" "),
          );

        if (
          resolvedCatalogReference
        ) {
          const resolvedMatches =
            await searchNinoxCatalog({
              query:
                resolvedCatalogReference,

              limit:
                5,
            });

          if (
            resolvedMatches.length
              > 0
          ) {
            catalogLookupMessage =
              resolvedCatalogReference;

            console.log(
              "[CATALOG SEMANTIC REFERENCE RESOLVED]",
              {
    companyId,
    matches: resolvedMatches.length,
    firstCode: resolvedMatches[0]?.code
        ?? null
},
            );
          }
        }
      }
    } catch (
      error
    ) {
      console.error(
        "[CATALOG SEMANTIC REFERENCE ERROR]",
        {
    companyId
},
      );
    }
  }

  /*
   * Una referencia textual posterior no debe
   * pisar el candidato visual principal.
   */
  if (visionTopCode) {
    catalogLookupMessage =
      visionTopCode;
  }


  const [
    salesPromptResult,
    memoryResult,
    knowledgeResult,
    catalogResult,
    orderHistoryResult,
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
            catalogLookupMessage,
            companyId,
          ),

        "Catálogo temporalmente no disponible. No confirmar precio ni stock.",
      ),

      safeResolve(
        "order-history",

        () =>
          buildCustomerOrderHistoryContext(
            companyId,
            input.phone,
            input.message,
          ),

        "Historial de pedidos temporalmente no disponible.",
      ),
    ]);

  const prompt =
    buildSalesAgentPrompt({
      customerMessage:
        [
          input.message,
          visionContext,
        ]
          .filter(Boolean)
          .join("\n\n"),

      customerPhone:
        input.phone,

      basePrompt:
        [
          salesPromptResult
            .value
            .prompt,

          whatsappBusinessContext
            .value,
        ]
          .filter(Boolean)
          .join("\n\n"),

      memoryContext:
        memoryResult.value,

      knowledgeContext:
        knowledgeResult.value,

      catalogContext:
        catalogResult.value,

      orderHistoryContext:
        orderHistoryResult.value,

      conversationHistory,
    });

  const generatedResponse =
    await generateAgentResponse(
      prompt,
    );

  const response =
    generatedResponse
      .replace(
        /\s*¿?quer[eé]s que te avis[ea](?:mos)? cuando (?:entre|haya|vuelva|ingrese)[^?.!]*[?.!]?/gi,
        "",
      )
      .replace(
        /\s*te avis[oa](?:mos)? cuando (?:entre|haya|vuelva|ingrese)[^?.!]*[?.!]?/gi,
        "",
      )
      .replace(
        /\s+/g,
        " ",
      )
      .trim();

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

    orderHistoryResult.degraded
      ? "order-history"
      : null,

    requestedImage.degraded
      ? "catalog-image"
      : null,
  ].filter(Boolean);

  console.log(
    "[SALES AGENT RESPONSE]",
    {
    companyId,
    degradedSources,
    responseLength: response.length
},
  );

  return {
    text:
      response,

    media:
      !visionValue.handled
      && requestedImage.value
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
