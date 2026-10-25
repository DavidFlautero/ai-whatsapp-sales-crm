import sharp from "sharp";

import {
  readIntegrationSecrets,
} from "../integrations/integration-secrets.repository.js";

type ImageRow = {
  id: string;
  url?: string | null;
  public_url?: string | null;
};

type RankedImage = {
  id: string;
  score: number;
  category: string;
  reason: string;
  isVisible: boolean;
};

function extractJson(
  text: string,
) {
  const clean =
    text
      .replace(
        /```json/gi,
        "",
      )
      .replace(
        /```/g,
        "",
      )
      .trim();

  const start =
    clean.indexOf("[");

  const end =
    clean.lastIndexOf("]");

  if (
    start < 0
    || end < start
  ) {
    throw new Error(
      "VENUE_AI_INVALID_RESPONSE",
    );
  }

  return JSON.parse(
    clean.slice(
      start,
      end + 1,
    ),
  );
}

async function imageBase64(
  url: string,
) {
  const response =
    await fetch(
      url,
    );

  if (!response.ok) {
    throw new Error(
      "VENUE_AI_IMAGE_FETCH_FAILED",
    );
  }

  const arrayBuffer =
    await response.arrayBuffer();

  const original =
    Buffer.from(
      arrayBuffer,
    );

  /*
   * La IA no necesita la resolución original.
   *
   * Generamos únicamente en memoria una versión optimizada
   * para visión. La fotografía almacenada no se modifica.
   */
  const optimized =
    await sharp(
      original,
      {
        failOn: "none",
      },
    )
      .rotate()
      .resize({
        width: 1400,
        height: 1400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({
        background: "#ffffff",
      })
      .jpeg({
        quality: 76,
        mozjpeg: true,
      })
      .toBuffer();

  console.log(
    "[VENUE AI IMAGE PREPARED]",
    {
      originalBytes:
        original.length,

      optimizedBytes:
        optimized.length,
    },
  );

  return {
    mediaType:
      "image/jpeg",

    data:
      optimized.toString(
        "base64",
      ),
  };
}

export async function rankVenueImages(
  input: {
    venueName: string;
    description?: string | null;
    images: ImageRow[];
  },
): Promise<RankedImage[]> {
  const integrations =
    await readIntegrationSecrets();

  const openaiApiKey =
    integrations
      .openai
      ?.apiKey
      ?.trim();

  const anthropicApiKey =
    integrations
      .vision
      ?.apiKey
      ?.trim()
    || integrations
      .anthropic
      ?.apiKey
      ?.trim();

  const provider =
    openaiApiKey
      ? "openai"
      : "anthropic";

  const apiKey =
    openaiApiKey
    || anthropicApiKey;

  const model =
    provider === "openai"
      ? (
          integrations
            .openai
            ?.model
            ?.trim()
          || "gpt-5.6-luna"
        )
      : (
          integrations
            .vision
            ?.model
            ?.trim()
          || "claude-sonnet-4-5"
        );

  if (!apiKey) {
    throw new Error(
      "VISION_NOT_CONFIGURED",
    );
  }

  const candidates =
    input.images
      .slice(
        0,
        60,
      );

  const ranked:
    RankedImage[] = [];

    const batchSize =
      2;

  /*
   * Analizamos por bloques para no mandar 60 imágenes
   * gigantes en una única petición.
   */
  for (
    let offset = 0;
    offset < candidates.length;
    offset += batchSize
  ) {
    const batch =
      candidates.slice(
        offset,
        offset + batchSize,
      );

    const content:
      any[] = [
        {
          type:
            "text",

          text:
            `Estás ordenando fotografías comerciales de un espacio para eventos.

Espacio: ${input.venueName}
Descripción: ${input.description ?? ""}

Analiza únicamente las imágenes adjuntas.

Da mayor puntuación a:
- vista general clara del inmueble;
- exterior/piscina/jardín bien presentado;
- espacios amplios;
- buena luz y encuadre;
- imágenes útiles para vender el espacio;
- variedad visual.

Penaliza:
- duplicados;
- fotos borrosas;
- primeros planos sin contexto;
- documentos/capturas;
- fotos oscuras;
- objetos irrelevantes;
- imágenes repetitivas.

Además decide si cada imagen debe mostrarse públicamente.

Marca "isVisible": false cuando:
- esté borrosa o demasiado oscura;
- sea prácticamente duplicada de una fotografía mejor;
- sea una captura, documento o cartel sin utilidad comercial;
- muestre objetos irrelevantes;
- tenga un encuadre claramente malo;
- no ayude a entender o vender el espacio.

Marca "isVisible": true cuando:
- aporte información útil sobre el espacio;
- complemente otras vistas;
- muestre exterior, piscina, jardín, interiores, salón o detalles relevantes;
- aunque no sea portada, tenga valor para la galería.

No ocultes una fotografía únicamente por tener un score menor.
Score y visibilidad son decisiones relacionadas, pero diferentes.

La mejor candidata a portada debe acercarse a 100.

Devuelve SOLO JSON:
[
 {
   "id":"ID",
   "score":0-100,
   "category":"exterior|piscina|interior|salon|jardin|detalle|otro",
   "reason":"frase breve",
    "isVisible":true
 }
]`,
        },
      ];

    for (
      const image of batch
    ) {
      const url =
        image.url
        || image.public_url;

      if (!url) {
        continue;
      }

      try {
        const encoded =
          await imageBase64(
            url,
          );

        content.push({
          type:
            "text",

          text:
            `ID: ${image.id}`,
        });

        content.push({
          type:
            "image",

          source: {
            type:
              "base64",

            media_type:
              encoded.mediaType,

            data:
              encoded.data,
          },
        });
      } catch (
        error
      ) {
        console.error(
          "[VENUE AI IMAGE]",
          image.id,
          error,
        );
      }
    }

    let response:
      Response;

    if (
      provider ===
        "openai"
    ) {
      const openaiContent =
        content.map(
          (
            item: any,
          ) => {
            if (
              item.type ===
                "text"
            ) {
              return {
                type:
                  "input_text",

                text:
                  item.text,
              };
            }

            if (
              item.type ===
                "image"
            ) {
              return {
                type:
                  "input_image",

                image_url:
                  `data:${item.source.media_type};base64,${item.source.data}`,
              };
            }

            return item;
          },
        );

      response =
        await fetch(
          "https://api.openai.com/v1/responses",
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${apiKey}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                model,

                input: [
                  {
                    role:
                      "user",

                    content:
                      openaiContent,
                  },
                ],

                max_output_tokens:
                  1800,
              }),
          },
        );
    } else {
      response =
        await fetch(
          "https://api.anthropic.com/v1/messages",
          {
            method:
              "POST",

            headers: {
              "x-api-key":
                apiKey,

              "anthropic-version":
                "2023-06-01",

              "content-type":
                "application/json",
            },

            body:
              JSON.stringify({
                model,

                max_tokens:
                  1800,

                temperature:
                  0,

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
    }

    const raw =
      await response.text();

    if (!response.ok) {
      console.error(
        "[VENUE IMAGE AI]",
        {
          provider,
          model,
          status:
            response.status,
          body:
            raw,
        },
      );

      throw new Error(
        "VENUE_IMAGE_AI_FAILED",
      );
    }

    const body =
      JSON.parse(
        raw,
      );

    const responseText =
      provider ===
        "openai"
        ? (
            typeof body
              .output_text ===
              "string"
              ? body
                  .output_text
              : (
                  body.output
                  ?? []
                )
                  .flatMap(
                    (
                      output: any,
                    ) =>
                      output
                        ?.content
                      ?? [],
                  )
                  .filter(
                    (
                      item: any,
                    ) =>
                      item
                        ?.type ===
                      "output_text",
                  )
                  .map(
                    (
                      item: any,
                    ) =>
                      item.text
                      ?? "",
                  )
                  .join(
                    "\\n",
                  )
          )
        : (
            body.content
            ?? []
          )
            .filter(
              (
                item: any,
              ) =>
                item.type ===
                  "text",
            )
            .map(
              (
                item: any,
              ) =>
                item.text,
            )
            .join(
              "\\n",
            );

    const parsed =
      extractJson(
        responseText,
      );

    for (
      const item of parsed
    ) {
      if (
        !item
        || typeof item.id !==
          "string"
      ) {
        continue;
      }

      ranked.push({
        id:
          item.id,

        score:
          Math.max(
            0,
            Math.min(
              100,
              Number(
                item.score,
              )
              || 0,
            ),
          ),

        category:
          String(
            item.category
            ?? "otro",
          )
            .slice(
              0,
              80,
            ),

        reason:
          String(
            item.reason
            ?? "",
          )
            .slice(
              0,
              500,
            ),

          isVisible:
            item.isVisible !== false,
      });
    }
  }

  /*
   * Separamos las imágenes visibles de las descartadas.
   * Las ocultas no participan en la diversidad de la galería.
   */
  const visible =
    ranked.filter(
      (item) =>
        item.isVisible,
    );

  const hidden =
    ranked
      .filter(
        (item) =>
          !item.isVisible,
      )
      .sort(
        (
          a,
          b,
        ) =>
          b.score
          - a.score,
      );

  /*
   * Protección:
   * intentamos conservar al menos seis imágenes públicas.
   * Si existen menos de seis imágenes, conservamos todas.
   */
  const minimumVisible =
    Math.min(
      6,
      ranked.length,
    );

  if (
    visible.length
    < minimumVisible
  ) {
    const needed =
      minimumVisible
      - visible.length;

    const rescued =
      hidden.splice(
        0,
        needed,
      );

    for (
      const item of rescued
    ) {
      item.isVisible =
        true;

      visible.push(
        item,
      );
    }
  }

  const sorted =
    [...visible]
      .sort(
        (
          a,
          b,
        ) =>
          b.score
          - a.score,
      );

  const result:
    RankedImage[] = [];

  const categoryCount =
    new Map<
      string,
      number
    >();

  while (
    sorted.length
  ) {
    sorted.sort(
      (
        a,
        b,
      ) => {
        const penaltyA =
          (
            categoryCount.get(
              a.category,
            )
            ?? 0
          )
          * 7;

        const penaltyB =
          (
            categoryCount.get(
              b.category,
            )
            ?? 0
          )
          * 7;

        return (
          b.score
          - penaltyB
        )
        - (
          a.score
          - penaltyA
        );
      },
    );

    const next =
      sorted.shift();

    if (!next) {
      break;
    }

    result.push(
      next,
    );

    categoryCount.set(
      next.category,
      (
        categoryCount.get(
          next.category,
        )
        ?? 0
      )
      + 1,
    );
  }

  /*
   * Las ocultas siguen almacenadas y analizadas,
   * pero quedan al final del ranking.
   */
  result.push(
    ...hidden,
  );

  return result;
}
