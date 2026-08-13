import type {
  NinoxCatalogRow,
} from "./ninox.client.js";

import {
  normalizeNinoxCatalog,
  readNinoxCatalogCache,
  writeNinoxCatalogCache,
} from "./ninox-catalog-cache.repository.js";


type JsonObject =
  Record<string, unknown>;


type NinoxDeletionEvent = {
  articuloId: number;
  eliminado: true;
};


export type NinoxWebhookResult = {
  ok: true;

  action:
    | "updated"
    | "deleted";

  articleIds:
    number[];

  variantsReceived:
    number;

  variantsStored:
    number;

  removed:
    number;

  totalCached:
    number;

  processedAt:
    string;
};


let webhookQueue:
Promise<void> =
  Promise.resolve();


function record(
  value: unknown,
): JsonObject | null {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
  ) {
    return null;
  }

  return value as JsonObject;
}


function positiveArticleId(
  value: unknown,
) {
  const parsed =
    Number(value);

  return Number.isInteger(parsed)
    && parsed > 0
      ? parsed
      : null;
}


function isDeletionEvent(
  payload: unknown,
): payload is NinoxDeletionEvent {
  const candidate =
    record(payload);

  if (!candidate) {
    return false;
  }

  return (
    candidate.eliminado === true
    && positiveArticleId(
      candidate.articuloId,
    ) !== null
  );
}


function asCurvaRows(
  payload: unknown,
): NinoxCatalogRow[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .filter(
      (
        item,
      ): item is JsonObject =>
        Boolean(
          record(item),
        ),
    )
    .filter(
      (item) =>
        positiveArticleId(
          item.articuloId,
        ) !== null,
    )
    .map(
      (item) =>
        item as NinoxCatalogRow,
    );
}


function sortCatalog<
  T extends {
    externalCode: string;
    externalColorId: number | null;
    externalSizeId: number | null;
  },
>(
  catalog: T[],
) {
  return [...catalog]
    .sort(
      (a, b) => {
        const code =
          a.externalCode.localeCompare(
            b.externalCode,
            "es",
            {
              numeric: true,
              sensitivity: "base",
            },
          );

        if (code !== 0) {
          return code;
        }

        const color =
          (a.externalColorId ?? -1)
          - (b.externalColorId ?? -1);

        if (color !== 0) {
          return color;
        }

        return (
          (a.externalSizeId ?? -1)
          - (b.externalSizeId ?? -1)
        );
      },
    );
}


async function processNinoxWebhook(
  payload: unknown,
): Promise<NinoxWebhookResult> {

  const processedAt =
    new Date()
      .toISOString();

  const previous =
    await readNinoxCatalogCache();


  /*
   * BAJA LÓGICA
   *
   * Contrato Ninox:
   * {
   *   articuloId,
   *   eliminado: true
   * }
   *
   * Eliminamos todas las variantes
   * de ese artículo de nuestra caché.
   */
  if (
    isDeletionEvent(
      payload,
    )
  ) {
    const articleId =
      positiveArticleId(
        payload.articuloId,
      );

    if (!articleId) {
      throw new Error(
        "NINOX_WEBHOOK_INVALID_ARTICLE_ID",
      );
    }

    const next =
      previous.filter(
        (item) =>
          item.externalArticleId
          !== articleId,
      );

    const removed =
      previous.length
      - next.length;

    await writeNinoxCatalogCache(
      next,
    );

    console.log(
      "[NINOX WEBHOOK DELETE]",
      {
        articleId,
        removed,
        totalCached:
          next.length,
      },
    );

    return {
      ok:
        true,

      action:
        "deleted",

      articleIds:
        [articleId],

      variantsReceived:
        0,

      variantsStored:
        0,

      removed,

      totalCached:
        next.length,

      processedAt,
    };
  }


  /*
   * FORMATO CURVA
   *
   * Ninox manda ArticuloConCurva[].
   * Reutilizamos EXACTAMENTE el mismo
   * normalizador del sync completo.
   */
  const rows =
    asCurvaRows(
      payload,
    );

  if (!rows.length) {
    throw new Error(
      "NINOX_WEBHOOK_INVALID_PAYLOAD",
    );
  }


  const normalized =
    normalizeNinoxCatalog(
      rows,
      previous,
      processedAt,
    );

  if (!normalized.length) {
    throw new Error(
      "NINOX_WEBHOOK_NO_VALID_VARIANTS",
    );
  }


  const articleIds =
    Array.from(
      new Set(
        normalized.map(
          (item) =>
            item.externalArticleId,
        ),
      ),
    );


  /*
   * MUY IMPORTANTE:
   *
   * Si Ninox manda nuevamente un artículo,
   * quitamos TODAS las variantes antiguas
   * de ese artículo y colocamos el snapshot
   * incremental que acaba de llegar.
   *
   * Así también desaparecen variantes que
   * Ninox haya quitado.
   */
  const articleIdSet =
    new Set(
      articleIds,
    );

  const untouched =
    previous.filter(
      (item) =>
        !articleIdSet.has(
          item.externalArticleId,
        ),
    );

  const removed =
    previous.length
    - untouched.length;


  const next =
    sortCatalog([
      ...untouched,
      ...normalized,
    ]);


  await writeNinoxCatalogCache(
    next,
  );


  console.log(
    "[NINOX WEBHOOK UPDATE]",
    {
      articleIds,

      variantsReceived:
        rows.length,

      variantsStored:
        normalized.length,

      replacedPreviousVariants:
        removed,

      totalCached:
        next.length,
    },
  );


  return {
    ok:
      true,

    action:
      "updated",

    articleIds,

    variantsReceived:
      rows.length,

    variantsStored:
      normalized.length,

    removed,

    totalCached:
      next.length,

    processedAt,
  };
}


export async function handleNinoxWebhook(
  payload: unknown,
): Promise<NinoxWebhookResult> {

  /*
   * Cola serial:
   *
   * cada webhook espera a que termine
   * el anterior antes de leer/escribir
   * la caché.
   *
   * Tanto éxito como error liberan
   * siempre la cola siguiente.
   */
  const task =
    webhookQueue.then(
      () =>
        processNinoxWebhook(
          payload,
        ),
    );

  webhookQueue =
    task.then(
      () => undefined,
      () => undefined,
    );

  return task;
}
