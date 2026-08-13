import {
  ensureRuntimeAccess,
} from "../runtime/core-state.service.js";

import {
  readIntegrationSecrets,
} from "../integrations/integration-secrets.repository.js";

import {
  resolveMessageMedia,
} from "../messages/message-media.service.js";

import {
  searchNinoxCatalog,
} from "../ninox/ninox-catalog-search.service.js";

import {
  buildCatalogMediaIndex,
  selectArticleImages,
} from "../catalog/catalog-media-index.service.js";


type JsonObject =
  Record<string, unknown>;


type VisionDescription = {
  productType:
    string;

  audience:
    string | null;

  primaryColor:
    string | null;

  secondaryColors:
    string[];

  pattern:
    string | null;

  details:
    string[];

  searchQuery:
    string;

  confidence:
    number;
};


type CandidateMatch =
  Awaited<
    ReturnType<
      typeof searchNinoxCatalog
    >
  >[number] & {
    visualScore?:
      number | null;

    visualReason?:
      string | null;

    catalogImageUrl?:
      string | null;
  };


type VisionConfig = {
  apiKey: string;

  model: string;
};


const ANTHROPIC_URL =
  "https://api.anthropic.com/v1/messages";


function record(
  value:
    unknown,
): JsonObject {
  return (
    value
    && typeof value === "object"
    && !Array.isArray(
      value,
    )
  )
    ? value as JsonObject
    : {};
}


function stringValue(
  value:
    unknown,
) {
  return typeof value
    === "string"
      ? value.trim()
      : "";
}


function clamp(
  value:
    unknown,

  min:
    number,

  max:
    number,
) {
  const number =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return min;
  }

  return Math.max(
    min,
    Math.min(
      max,
      number,
    ),
  );
}


function strings(
  value:
    unknown,
) {
  return Array.isArray(
    value,
  )
    ? value
        .filter(
          (item):
          item is string =>
            typeof item
              === "string"
            && Boolean(
              item.trim(),
            ),
        )
        .map(
          (item) =>
            item.trim(),
        )
        .slice(
          0,
          12,
        )
    : [];
}


function extractJson(
  raw:
    string,
) {
  const withoutFence =
    raw
      .replace(
        /^```(?:json)?/i,
        "",
      )
      .replace(
        /```$/i,
        "",
      )
      .trim();

  const objectStart =
    withoutFence.indexOf(
      "{",
    );

  const objectEnd =
    withoutFence.lastIndexOf(
      "}",
    );

  if (
    objectStart >= 0
    && objectEnd
      > objectStart
  ) {
    return withoutFence.slice(
      objectStart,
      objectEnd
      + 1,
    );
  }

  throw new Error(
    "VISION_INVALID_JSON",
  );
}


function anthropicText(
  body:
    unknown,
) {
  const value =
    record(
      body,
    );

  const content =
    Array.isArray(
      value.content,
    )
      ? value.content
      : [];

  return content
    .map(
      (item) =>
        stringValue(
          record(
            item,
          ).text,
        ),
    )
    .filter(Boolean)
    .join(
      "\n",
    );
}


async function visionConfig():
Promise<VisionConfig | null> {
  const integrations =
    await readIntegrationSecrets()
      .catch(
        () => null,
      ) as unknown as
      | Record<
          string,
          Record<
            string,
            unknown
          >
        >
      | null;


  const vision =
    integrations
      ?.vision
    ?? {};


  const anthropic =
    integrations
      ?.anthropic
    ?? {};


  /*
   * Prioridad:
   * 1. Integración Vision del panel.
   * 2. ENV Vision.
   * 3. Anthropic configurado en panel.
   * 4. ENV Anthropic.
   *
   * Así el panel funciona en caliente
   * y seguimos teniendo fallback
   * operativo.
   */
  const apiKey =
    stringValue(
      vision.apiKey,
    )
    || stringValue(
      process.env
        .VISION_API_KEY,
    )
    || stringValue(
      anthropic.apiKey,
    )
    || stringValue(
      process.env
        .ANTHROPIC_API_KEY,
    );


  const model =
    stringValue(
      vision.model,
    )
    || stringValue(
      process.env
        .VISION_MODEL,
    )
    || stringValue(
      anthropic.model,
    )
    || stringValue(
      process.env
        .ANTHROPIC_MODEL,
    );


  if (
    !apiKey
    || !model
  ) {
    return null;
  }

  return {
    apiKey,

    model,
  };
}


function supportedMime(
  value:
    string,
) {
  switch (
    value
      .split(
        ";",
      )[0]
      .trim()
      .toLowerCase()
  ) {
    case "image/jpeg":
      return "image/jpeg";

    case "image/png":
      return "image/png";

    case "image/webp":
      return "image/webp";

    case "image/gif":
      return "image/gif";

    default:
      return null;
  }
}


async function callAnthropic(
  config:
    VisionConfig,

  content:
    Array<
      Record<
        string,
        unknown
      >
    >,

  maxTokens =
    900,
) {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () =>
        controller.abort(),
      25_000,
    );

  try {
    const response =
      await fetch(
        ANTHROPIC_URL,
        {
          method:
            "POST",

          signal:
            controller.signal,

          headers: {
            "content-type":
              "application/json",

            "x-api-key":
              config.apiKey,

            "anthropic-version":
              "2023-06-01",
          },

          body:
            JSON.stringify({
              model:
                config.model,

              max_tokens:
                maxTokens,

              messages: [
                {
                  role:
                    "user",

                  content,
                },
              ],
            }),
        },
      );


    const raw =
      await response.text();


    let body:
      unknown;

    try {
      body =
        JSON.parse(
          raw,
        );
    } catch {
      throw new Error(
        `VISION_HTTP_${response.status}_INVALID_JSON`,
      );
    }


    if (!response.ok) {
      console.error(
        "[PRODUCT VISION API ERROR]",
        {
          status:
            response.status,

          error:
            record(
              body,
            ).error
            ?? null,
        },
      );

      throw new Error(
        `VISION_API_${response.status}`,
      );
    }


    const text =
      anthropicText(
        body,
      );


    if (!text) {
      throw new Error(
        "VISION_EMPTY_RESPONSE",
      );
    }

    return text;

  } finally {
    clearTimeout(
      timer,
    );
  }
}


async function describeProduct(
  config:
    VisionConfig,

  buffer:
    Buffer,

  mimeType:
    string,
): Promise<VisionDescription> {
  const mediaType =
    supportedMime(
      mimeType,
    );

  if (!mediaType) {
    throw new Error(
      "VISION_UNSUPPORTED_IMAGE_TYPE",
    );
  }


  const raw =
    await callAnthropic(
      config,
      [
        {
          type:
            "image",

          source: {
            type:
              "base64",

            media_type:
              mediaType,

            data:
              buffer.toString(
                "base64",
              ),
          },
        },

        {
          type:
            "text",

          text: `
Analizá el producto comercial visible. Puede ser ropa, lencería, accesorio, cinturón, faja, calzado, bolso, etiqueta, packaging, estampa o logo.

Si la imagen es principalmente gráfica, describí el logo, texto, formas y colores visibles. No respondas simplemente que no es una prenda.

No identifiques personas.
No inventes marca, SKU, precio, stock ni disponibilidad.

Respondé SOLAMENTE JSON válido:

{
  "productType": "tipo concreto de prenda",
  "audience": "mujer | hombre | niña | niño | unisex | null",
  "primaryColor": "color principal o null",
  "secondaryColors": [],
  "pattern": "estampado/patrón o null",
  "details": [
    "rasgos visibles discriminantes"
  ],
  "searchQuery": "consulta corta útil para buscar esta prenda en un catálogo",
  "confidence": 0.0
}

Reglas:
- confidence entre 0 y 1.
- searchQuery corta, no una descripción literaria enorme.
- details máximo 8.
- Si algo no es visible, null.
`.trim(),
        },
      ],
      700,
    );


  const parsed =
    record(
      JSON.parse(
        extractJson(
          raw,
        ),
      ),
    );


  const productType =
    stringValue(
      parsed.productType,
    );


  if (!productType) {
    throw new Error(
      "VISION_PRODUCT_TYPE_MISSING",
    );
  }


  return {
    productType,

    audience:
      stringValue(
        parsed.audience,
      )
      || null,

    primaryColor:
      stringValue(
        parsed.primaryColor,
      )
      || null,

    secondaryColors:
      strings(
        parsed.secondaryColors,
      ),

    pattern:
      stringValue(
        parsed.pattern,
      )
      || null,

    details:
      strings(
        parsed.details,
      )
        .slice(
          0,
          8,
        ),

    searchQuery:
      stringValue(
        parsed.searchQuery,
      )
      || productType,

    confidence:
      clamp(
        parsed.confidence,
        0,
        1,
      ),
  };
}


function candidateKey(
  candidate:
    CandidateMatch,
) {
  return [
    candidate.code,
    candidate.color
    ?? "",
    candidate.size
    ?? "",
  ]
    .join(
      "|",
    )
    .toUpperCase();
}


async function findTextCandidates(
  analysis:
    VisionDescription,
) {
  const queries =
    Array.from(
      new Set(
        [
          analysis.searchQuery,

          analysis.productType,

          [
            analysis.productType,
            analysis.primaryColor,
          ]
            .filter(Boolean)
            .join(
              " ",
            ),

          [
            analysis.productType,
            analysis.pattern,
          ]
            .filter(Boolean)
            .join(
              " ",
            ),
        ]
          .map(
            (value) =>
              value.trim(),
          )
          .filter(Boolean),
      ),
    );


  const results =
    await Promise.all(
      queries.map(
        async (
          query,
        ) =>
          searchNinoxCatalog({
            query,

            onlyWithStock:
              false,

            limit:
              10,
          })
            .catch(
              () => [],
            ),
      ),
    );


  const unique =
    new Map<
      string,
      CandidateMatch
    >();


  for (
    const group
    of results
  ) {
    for (
      const candidate
      of group
    ) {
      const key =
        candidateKey(
          candidate,
        );

      if (
        !unique.has(
          key,
        )
      ) {
        unique.set(
          key,
          candidate,
        );
      }
    }
  }


  return Array.from(
    unique.values(),
  )
    .slice(
      0,
      15,
    );
}


function supabaseHost() {
  const value =
    process.env
      .SUPABASE_URL
      ?.trim();

  if (!value) {
    return null;
  }

  try {
    return new URL(
      value,
    ).hostname
      .toLowerCase();

  } catch {
    return null;
  }
}


async function safeDownloadCandidate(
  rawUrl:
    string,
) {
  const allowedHost =
    supabaseHost();

  if (!allowedHost) {
    return null;
  }


  let url:
    URL;

  try {
    url =
      new URL(
        rawUrl,
      );
  } catch {
    return null;
  }


  /*
   * Protección SSRF:
   * las imágenes que Vision descarga
   * tienen que ser HTTPS y pertenecer
   * al mismo host de nuestro Supabase.
   */
  if (
    url.protocol
      !== "https:"
    || url.hostname
      .toLowerCase()
      !== allowedHost
  ) {
    return null;
  }


  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () =>
        controller.abort(),
      8_000,
    );


  try {
    const response =
      await fetch(
        url,
        {
          signal:
            controller.signal,

          redirect:
            "error",
        },
      );


    if (!response.ok) {
      return null;
    }


    const mediaType =
      supportedMime(
        response.headers
          .get(
            "content-type",
          )
        ?? "",
      );


    if (!mediaType) {
      return null;
    }


    const advertised =
      Number(
        response.headers
          .get(
            "content-length",
          ),
      );


    if (
      Number.isFinite(
        advertised,
      )
      && advertised
        > 3
          * 1024
          * 1024
    ) {
      return null;
    }


    const buffer =
      Buffer.from(
        await response
          .arrayBuffer(),
      );


    if (
      buffer.length
      > 3
        * 1024
        * 1024
    ) {
      return null;
    }


    return {
      buffer,

      mediaType,
    };

  } catch {
    return null;

  } finally {
    clearTimeout(
      timer,
    );
  }
}


async function visualRerank(
  input: {
    config:
      VisionConfig;

    incomingBuffer:
      Buffer;

    incomingMime:
      string;

    candidates:
      CandidateMatch[];

    companyId:
      string;
  },
) {
  const incomingMime =
    supportedMime(
      input.incomingMime,
    );

  if (!incomingMime) {
    return null;
  }


  const index =
    await buildCatalogMediaIndex(
      input.companyId,
    );


  const candidatesWithImages:
    Array<{
      id: string;
      candidate: CandidateMatch;
      url: string;
      buffer: Buffer;
      mimeType: string;
    }> =
      [];


  const uniqueProductColor =
    new Set<string>();


  for (
    const candidate
    of input.candidates
  ) {
    const groupKey =
      [
        candidate.code,
        candidate.color
        ?? "",
      ]
        .join(
          "|",
        )
        .toUpperCase();


    if (
      uniqueProductColor.has(
        groupKey,
      )
    ) {
      continue;
    }


    const image =
      selectArticleImages(
        index,
        candidate.code,
        candidate.color,
        1,
      )[0];


    if (!image) {
      continue;
    }


    const downloaded =
      await safeDownloadCandidate(
        image.url,
      );


    if (!downloaded) {
      continue;
    }


    uniqueProductColor.add(
      groupKey,
    );


    candidatesWithImages.push({
      id:
        `C${
          candidatesWithImages.length
          + 1
        }`,

      candidate,

      url:
        image.url,

      buffer:
        downloaded.buffer,

      mimeType:
        downloaded.mediaType,
    });


    if (
      candidatesWithImages.length
      >= 5
    ) {
      break;
    }
  }


  if (
    candidatesWithImages.length
    === 0
  ) {
    return null;
  }


  const content:
  Array<
    Record<
      string,
      unknown
    >
  > = [
    {
      type:
        "text",

      text:
        `IMAGEN CONSULTA. Comparala visualmente contra los candidatos que siguen.`,
    },

    {
      type:
        "image",

      source: {
        type:
          "base64",

        media_type:
          incomingMime,

        data:
          input.incomingBuffer
            .toString(
              "base64",
            ),
      },
    },
  ];


  for (
    const candidate
    of candidatesWithImages
  ) {
    content.push(
      {
        type:
          "text",

        text:
          [
            `CANDIDATO ${candidate.id}`,
            `Código: ${candidate.candidate.code}`,
            `Color: ${candidate.candidate.color ?? "-"}`,
            `Descripción: ${candidate.candidate.description ?? "-"}`,
          ]
            .join(
              "\n",
            ),
      },

      {
        type:
          "image",

        source: {
          type:
            "base64",

          media_type:
            candidate.mimeType,

          data:
            candidate.buffer
              .toString(
                "base64",
              ),
        },
      },
    );
  }


  content.push({
    type:
      "text",

    text: `
Compará la IMAGEN CONSULTA contra cada CANDIDATO.

Prestá atención a cualquier evidencia visual útil:
- identidad global del producto o imagen
- tipo, corte, silueta, color, patrón y textura
- tiras, mangas, escote, cierres, hebillas y detalles estructurales
- logos, texto visible, tipografía, formas, composición gráfica y packaging

Si la consulta y un candidato muestran el mismo logo o la misma imagen gráfica, asigná una puntuación entre 96 y 100 aunque no aparezca una prenda.
No descartes accesorios, etiquetas, packaging ni logos.
No uses precio, SKU o stock para decidir similitud.

Respondé SOLAMENTE JSON válido:

{
  "ranking": [
    {
      "candidateId": "C1",
      "score": 0,
      "reason": "motivo visual corto"
    }
  ]
}

score 0-100.
No afirmes identidad exacta si no es visualmente demostrable.
`.trim(),
  });


  const raw =
    await callAnthropic(
      input.config,
      content,
      850,
    );


  const parsed =
    record(
      JSON.parse(
        extractJson(
          raw,
        ),
      ),
    );


  const ranking =
    Array.isArray(
      parsed.ranking,
    )
      ? parsed.ranking
      : [];


  const scores =
    new Map<
      string,
      {
        score: number;
        reason: string;
      }
    >();


  for (
    const rawItem
    of ranking
  ) {
    const item =
      record(
        rawItem,
      );

    const id =
      stringValue(
        item.candidateId,
      );

    if (!id) {
      continue;
    }

    scores.set(
      id,
      {
        score:
          clamp(
            item.score,
            0,
            100,
          ),

        reason:
          stringValue(
            item.reason,
          )
            .slice(
              0,
              300,
            ),
      },
    );
  }


  const ranked =
    candidatesWithImages
      .map(
        (entry) => {
          const result =
            scores.get(
              entry.id,
            );

          return {
            ...entry.candidate,

            visualScore:
              result
                ?.score
              ?? null,

            visualReason:
              result
                ?.reason
              ?? null,

            catalogImageUrl:
              entry.url,
          };
        },
      )
      .sort(
        (
          left,
          right,
        ) =>
          (
            right.visualScore
            ?? -1
          )
          - (
            left.visualScore
            ?? -1
          ),
      );


  const rankedKeys =
    new Set(
      ranked.map(
        candidateKey,
      ),
    );


  const remainder =
    input.candidates
      .filter(
        (candidate) =>
          !rankedKeys.has(
            candidateKey(
              candidate,
            ),
          ),
      )
      .map(
        (candidate) => ({
          ...candidate,

          visualScore:
            null,

          visualReason:
            null,

          catalogImageUrl:
            null,
        }),
      );


  return [
    ...ranked,
    ...remainder,
  ]
    .slice(
      0,
      8,
    );
}




/* VISION_CATALOG_IMAGE_FALLBACK_V1 */
function compactCatalogCode(
  value:
    unknown,
) {
  return stringValue(
    value,
  )
    .replace(
      /[^a-zA-Z0-9]/g,
      "",
    )
    .toUpperCase();
}


async function catalogCandidatesWithImages(
  companyId:
    string,
) {
  const index =
    await buildCatalogMediaIndex(
      companyId,
    );

  const articleCodes =
    Array.from(
      index.byCode.entries(),
    )
      .filter(
        ([, images]) =>
          images.length > 0,
      )
      .map(
        ([articleCode]) =>
          articleCode,
      );

  const configuredLimit =
    Number(
      process.env
        .VISION_CATALOG_FALLBACK_MAX_IMAGES,
    );

  const maxImages =
    Number.isFinite(
      configuredLimit,
    )
      ? Math.max(
          5,
          Math.min(
            50,
            Math.floor(
              configuredLimit,
            ),
          ),
        )
      : 20;

  const selectedCodes =
    articleCodes.slice(
      0,
      maxImages,
    );

  const resolved =
    await Promise.all(
      selectedCodes.map(
        async (
          articleCode,
        ) => {
          const products =
            await searchNinoxCatalog({
              query:
                articleCode,

              onlyWithStock:
                false,

              limit:
                12,
            })
              .catch(
                () => [],
              );

          const expected =
            compactCatalogCode(
              articleCode,
            );

          return products.find(
            (candidate) =>
              compactCatalogCode(
                candidate.code,
              ) === expected,
          )
            ?? null;
        },
      ),
    );

  const candidates:
    CandidateMatch[] =
      [];

  const seen =
    new Set<string>();

  for (
    const candidate
    of resolved
  ) {
    if (!candidate) {
      continue;
    }

    const code =
      compactCatalogCode(
        candidate.code,
      );

    if (
      !code
      || seen.has(
        code,
      )
    ) {
      continue;
    }

    seen.add(
      code,
    );

    candidates.push(
      candidate,
    );
  }

  return {
    candidates,

    available:
      articleCodes.length,

    limited:
      selectedCodes.length,
  };
}


async function visualCatalogFallback(
  input: {
    config:
      VisionConfig;

    incomingBuffer:
      Buffer;

    incomingMime:
      string;

    companyId:
      string;
  },
) {
  const source =
    await catalogCandidatesWithImages(
      input.companyId,
    );

  const visuallyRanked:
    CandidateMatch[] =
      [];

  let scanned =
    0;

  for (
    let offset = 0;
    offset < source.candidates.length;
    offset += 5
  ) {
    const batch =
      source.candidates.slice(
        offset,
        offset + 5,
      );

    const ranked =
      await visualRerank({
        config:
          input.config,

        incomingBuffer:
          input.incomingBuffer,

        incomingMime:
          input.incomingMime,

        candidates:
          batch,

        companyId:
          input.companyId,
      });

    scanned +=
      batch.length;

    for (
      const candidate
      of ranked
      ?? []
    ) {
      if (
        candidate.visualScore
        === null
        || candidate.visualScore
        === undefined
      ) {
        continue;
      }

      visuallyRanked.push(
        candidate,
      );
    }

    visuallyRanked.sort(
      (
        left,
        right,
      ) =>
        (
          right.visualScore
          ?? -1
        )
        - (
          left.visualScore
          ?? -1
        ),
    );

    if (
      (
        visuallyRanked[0]
          ?.visualScore
        ?? 0
      ) >= 96
    ) {
      break;
    }
  }

  const unique =
    new Map<
      string,
      CandidateMatch
    >();

  for (
    const candidate
    of visuallyRanked
  ) {
    const key =
      compactCatalogCode(
        candidate.code,
      );

    if (
      !key
      || unique.has(
        key,
      )
    ) {
      continue;
    }

    if (
      (
        candidate.visualScore
        ?? 0
      ) < 82
    ) {
      continue;
    }

    unique.set(
      key,
      candidate,
    );
  }

  return {
    matches:
      Array.from(
        unique.values(),
      )
        .slice(
          0,
          3,
        ),

    scanned,

    available:
      source.available,

    limited:
      source.limited,
  };
}


export async function searchProductFromMessageImage(
  input: {
    messageId: string;

    companyId: string;

    /*
     * Compatibilidad con callers anteriores.
     * El caption puede acompañar la imagen,
     * pero NO se usa como verdad visual.
     */
    caption?:
      string;
  },
) {

  /* RUNTIME_CHECK_A3 */
  ensureRuntimeAccess("vision");

  const media =
    await resolveMessageMedia({
      messageId:
        input.messageId,

      companyId:
        input.companyId,
    });


  if (
    !media
    || media.messageType
      !== "image"
  ) {
    return {
      handled:
        false as const,

      reason:
        "not-image",
    };
  }


  const config =
    await visionConfig();


  if (!config) {
    return {
      handled:
        false as const,

      reason:
        "vision-not-configured",
    };
  }


  const analysis =
    await describeProduct(
      config,
      media.buffer,
      media.mimeType,
    );


  const textCandidates =
    await findTextCandidates(
      analysis,
    );


  if (
    textCandidates.length
    === 0
  ) {
    try {
      const fallback =
        await visualCatalogFallback({
          config,

          incomingBuffer:
            media.buffer,

          incomingMime:
            media.mimeType,

          companyId:
            input.companyId,
        });

      if (
        fallback.matches.length
        > 0
      ) {
        console.log(
          "[PRODUCT VISION CATALOG FALLBACK]",
          {
            companyId:
              input.companyId,

            mode:
              "visual-catalog-fallback",

            scanned:
              fallback.scanned,

            available:
              fallback.available,

            limited:
              fallback.limited,

            firstCode:
              fallback.matches[0]
                ?.code
              ?? null,

            firstVisualScore:
              fallback.matches[0]
                ?.visualScore
              ?? null,
          },
        );

        return {
          handled:
            true as const,

          mode:
            "visual-rerank",

          analysis,

          matches:
            fallback.matches,
        };
      }

      console.log(
        "[PRODUCT VISION CATALOG FALLBACK]",
        {
          companyId:
            input.companyId,

          mode:
            "no-visual-match",

          scanned:
            fallback.scanned,

          available:
            fallback.available,

          limited:
            fallback.limited,
        },
      );

    } catch (error) {
      console.error(
        "[PRODUCT VISION CATALOG FALLBACK DEGRADED]",
        {
          companyId:
            input.companyId,

          error:
            error instanceof Error
              ? error.message
              : String(
                  error,
                ),
        },
      );
    }

    console.log(
      "[PRODUCT VISION SEARCH]",
      {
        companyId:
          input.companyId,

        mode:
          "no-candidates",

        productType:
          analysis.productType,
      },
    );

    return {
      handled:
        true as const,

      mode:
        "no-candidates",

      analysis,

      matches:
        [],
    };
  }


  let matches:
    CandidateMatch[];


  try {
    matches =
      (
        await visualRerank({
          config,

          incomingBuffer:
            media.buffer,

          incomingMime:
            media.mimeType,

          candidates:
            textCandidates,

          companyId:
            input.companyId,
        })
      )
      ?? textCandidates;

  } catch (error) {
    /*
     * Fallo del reranker visual:
     * NO rompe ventas.
     * Conservamos recuperación textual
     * sobre la verdad local de Ninox.
     */
    console.error(
      "[PRODUCT VISION RERANK DEGRADED]",
      {
        companyId:
          input.companyId,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
    );

    matches =
      textCandidates;
  }


  console.log(
    "[PRODUCT VISION SEARCH]",
    {
      companyId:
        input.companyId,

      productType:
        analysis.productType,

      primaryColor:
        analysis.primaryColor,

      candidates:
        textCandidates.length,

      returned:
        matches.length,

      firstCode:
        matches[0]?.code
        ?? null,

      firstVisualScore:
        (
          matches[0] as
          CandidateMatch
        )
          ?.visualScore
        ?? null,
    },
  );


  return {
    handled:
      true as const,

    mode:
      matches.some(
        (match) =>
          match.visualScore
            !== undefined
          && match.visualScore
            !== null,
      )
        ? "visual-rerank"
        : "vision-text-fallback",

    analysis,

    matches:
      matches.slice(
        0,
        8,
      ),
  };
}
