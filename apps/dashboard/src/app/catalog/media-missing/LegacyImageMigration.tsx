"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";


type LegacyAsset = {
  articleCode:
    string;

  colorCode:
    string | null;

  colorName:
    string | null;

  role:
    string;

  url:
    string;
};


type MigrationResult = {
  discovered:
    number;

  processed:
    number;

  successful:
    number;

  failed:
    number;
};


function normalizeCode(
  value:
    unknown,
) {
  return String(
    value ?? "",
  )
    .trim()
    .toUpperCase();
}


function imageRole(
  value:
    unknown,
) {
  switch (
    String(
      value
      ?? "",
    )
  ) {
    case "cover":
    case "front":
    case "back":
    case "detail":
    case "model":
      return String(
        value,
      );

    default:
      return "cover";
  }
}


function arraysFromUnknown(
  value:
    unknown,
): unknown[][] {
  if (
    Array.isArray(
      value,
    )
  ) {
    return [
      value,
    ];
  }


  if (
    value
    && typeof value
      === "object"
  ) {
    const record =
      value as
      Record<
        string,
        unknown
      >;


    const candidates =
      [
        record.products,
        record.catalog,
        record.items,
      ];


    return candidates
      .filter(
        (
          candidate,
        ): candidate is unknown[] =>
          Array.isArray(
            candidate,
          ),
      );
  }


  return [];
}


function inspectBrowserCatalog():
LegacyAsset[] {
  const found =
    new Map<
      string,
      LegacyAsset
    >();


  for (
    let index = 0;
    index
      < window.localStorage
        .length;
    index += 1
  ) {
    const key =
      window.localStorage
        .key(
          index,
        );


    if (!key) {
      continue;
    }


    const raw =
      window.localStorage
        .getItem(
          key,
        );


    if (
      !raw
      || raw.length < 5
    ) {
      continue;
    }


    let parsed:
      unknown;


    try {
      parsed =
        JSON.parse(
          raw,
        );

    } catch {
      continue;
    }


    for (
      const collection
      of arraysFromUnknown(
        parsed,
      )
    ) {
      for (
        const rawProduct
        of collection
      ) {
        if (
          !rawProduct
          || typeof rawProduct
            !== "object"
        ) {
          continue;
        }


        const product =
          rawProduct as
          Record<
            string,
            unknown
          >;


        const articleCode =
          normalizeCode(
            product.baseSku
            ?? product.sku,
          );


        if (!articleCode) {
          continue;
        }


        const colors =
          Array.isArray(
            product.colorVariants,
          )
            ? product.colorVariants
            : [];


        for (
          const rawColor
          of colors
        ) {
          if (
            !rawColor
            || typeof rawColor
              !== "object"
          ) {
            continue;
          }


          const color =
            rawColor as
            Record<
              string,
              unknown
            >;


          const images =
            Array.isArray(
              color.images,
            )
              ? color.images
              : [];


          for (
            const rawImage
            of images
          ) {
            if (
              !rawImage
              || typeof rawImage
                !== "object"
            ) {
              continue;
            }


            const image =
              rawImage as
              Record<
                string,
                unknown
              >;


            const url =
              String(
                image.url
                ?? "",
              )
                .trim();


            if (!url) {
              continue;
            }


            if (
              !url.startsWith(
                "data:image/",
              )
              && !url.startsWith(
                "blob:",
              )
              && !url.startsWith(
                "https://",
              )
            ) {
              continue;
            }


            const asset:
            LegacyAsset = {
              articleCode,

              colorCode:
                String(
                  color.code
                  ?? "",
                )
                  .trim()
                || null,

              colorName:
                String(
                  color.name
                  ?? "",
                )
                  .trim()
                || null,

              role:
                imageRole(
                  image.role,
                ),

              url,
            };


            const identity =
              [
                asset.articleCode,
                asset.colorCode
                  ?? "",
                asset.role,
                asset.url,
              ]
                .join(
                  "|",
                );


            found.set(
              identity,
              asset,
            );
          }
        }
      }
    }
  }


  return Array.from(
    found.values(),
  );
}


async function tryAdopt(
  asset:
    LegacyAsset,
) {
  if (
    !asset.url.startsWith(
      "https://",
    )
  ) {
    return false;
  }


  try {
    const response =
      await fetch(
        "/dashboard-api/catalog/media-adopt",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              articleCode:
                asset.articleCode,

              colorCode:
                asset.colorCode,

              colorName:
                asset.colorName,

              role:
                asset.role,

              url:
                asset.url,
            }),
        },
      );


    return response.ok;

  } catch {
    return false;
  }
}


async function uploadLegacyAsset(
  asset:
    LegacyAsset,
) {
  /*
   * Si ya es una URL de nuestro storage,
   * tratamos de adoptarla SIN duplicar
   * el archivo.
   */
  if (
    await tryAdopt(
      asset,
    )
  ) {
    return;
  }


  /*
   * data:, blob: o una URL histórica
   * no adoptable:
   * la convertimos a archivo real.
   */
  const source =
    await fetch(
      asset.url,
    );


  if (!source.ok) {
    throw new Error(
      `SOURCE_HTTP_${source.status}`,
    );
  }


  const blob =
    await source.blob();


  if (
    blob.size === 0
  ) {
    throw new Error(
      "EMPTY_IMAGE",
    );
  }


  if (
    blob.size
    > 5
      * 1024
      * 1024
  ) {
    throw new Error(
      "IMAGE_TOO_LARGE",
    );
  }


  const allowed =
    [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];


  const mime =
    allowed.includes(
      blob.type,
    )
      ? blob.type
      : "image/jpeg";


  const extension =
    mime
      === "image/png"
      ? "png"
      : mime
        === "image/webp"
        ? "webp"
        : "jpg";


  const file =
    new File(
      [
        blob,
      ],

      `${asset.articleCode}-${asset.role}.${extension}`,

      {
        type:
          mime,
      },
    );


  const form =
    new FormData();


  form.set(
    "file",
    file,
  );


  form.set(
    "articleCode",
    asset.articleCode,
  );


  form.set(
    "role",
    asset.role,
  );


  if (
    asset.colorCode
  ) {
    form.set(
      "colorCode",
      asset.colorCode,
    );
  }


  if (
    asset.colorName
  ) {
    form.set(
      "colorName",
      asset.colorName,
    );
  }


  const response =
    await fetch(
      "/dashboard-api/catalog/media-upload",
      {
        method:
          "POST",

        body:
          form,
      },
    );


  if (!response.ok) {
    const body =
      await response
        .text();

    throw new Error(
      `UPLOAD_${response.status}_${body.slice(0, 100)}`,
    );
  }
}


export function LegacyImageMigration() {
  const [
    assets,
    setAssets,
  ] =
    useState<
      LegacyAsset[]
    >(
      [],
    );


  const [
    scanning,
    setScanning,
  ] =
    useState(
      true,
    );


  const [
    migrating,
    setMigrating,
  ] =
    useState(
      false,
    );


  const [
    result,
    setResult,
  ] =
    useState<
      MigrationResult | null
    >(
      null,
    );


  useEffect(
    () => {
      try {
        setAssets(
          inspectBrowserCatalog(),
        );

      } finally {
        setScanning(
          false,
        );
      }
    },
    [],
  );


  const articleCount =
    useMemo(
      () =>
        new Set(
          assets.map(
            (asset) =>
              asset.articleCode,
          ),
        ).size,
      [
        assets,
      ],
    );


  async function migrate() {
    if (
      migrating
      || assets.length === 0
    ) {
      return;
    }


    setMigrating(
      true,
    );


    let cursor =
      0;

    let processed =
      0;

    let successful =
      0;

    let failed =
      0;


    setResult({
      discovered:
        assets.length,

      processed:
        0,

      successful:
        0,

      failed:
        0,
    });


    async function worker() {
      while (true) {
        const index =
          cursor;


        cursor +=
          1;


        if (
          index
          >= assets.length
        ) {
          return;
        }


        try {
          await uploadLegacyAsset(
            assets[index],
          );

          successful +=
            1;

        } catch (error) {
          failed +=
            1;


          console.error(
            "[LEGACY MEDIA MIGRATION ERROR]",
            {
              articleCode:
                assets[index]
                  .articleCode,

              role:
                assets[index]
                  .role,

              error:
                error instanceof Error
                  ? error.message
                  : String(
                      error,
                    ),
            },
          );
        }


        processed +=
          1;


        setResult({
          discovered:
            assets.length,

          processed,

          successful,

          failed,
        });
      }
    }


    /*
     * Tres uploads simultáneos:
     * suficientemente rápido sin
     * castigar API/memoria.
     */
    const workers =
      Math.min(
        3,
        assets.length,
      );


    await Promise.all(
      Array.from(
        {
          length:
            workers,
        },

        () =>
          worker(),
      ),
    );


    const finalResult = {
      discovered:
        assets.length,

      processed,

      successful,

      failed,
    };


    setResult(
      finalResult,
    );


    window.localStorage.setItem(
      "fulanitas_catalog_media_migration_v1",
      JSON.stringify({
        completedAt:
          new Date()
            .toISOString(),

        ...finalResult,
      }),
    );


    setMigrating(
      false,
    );


    if (
      successful > 0
    ) {
      window.setTimeout(
        () =>
          window.location
            .reload(),
        1200,
      );
    }
  }


  if (
    scanning
  ) {
    return (
      <section style={{
        margin:
          "28px 28px 0",

        padding:
          18,

        border:
          "1px solid rgba(148,163,184,.12)",

        borderRadius:
          12,
      }}>
        Buscando imágenes históricas en este navegador…
      </section>
    );
  }


  if (
    assets.length === 0
  ) {
    return null;
  }


  const percentage =
    result
      ? Math.round(
          (
            result.processed
            / Math.max(
                1,
                result.discovered,
              )
          )
          * 100,
        )
      : 0;


  return (
    <section style={{
      margin:
        "28px 28px 0",

      padding:
        20,

      display:
        "flex",

      flexDirection:
        "column",

      gap:
        14,

      border:
        "1px solid rgba(190,143,68,.28)",

      borderRadius:
        14,

      background:
        "rgba(190,143,68,.055)",
    }}>
      <div>
        <strong style={{
          display:
            "block",

          fontSize:
            17,
        }}>
          Recuperar fotografías existentes
        </strong>

        <p style={{
          margin:
            "6px 0 0",

          color:
            "#8994a5",

          lineHeight:
            1.55,
        }}>
          Encontré {assets.length} fotografía(s)
          correspondientes a {articleCount} artículo(s)
          guardadas en este navegador. Esta migración
          las vuelve permanentes para la tienda,
          Vision y el detector automático.
        </p>
      </div>


      {result ? (
        <div style={{
          display:
            "flex",

          gap:
            16,

          flexWrap:
            "wrap",

          fontSize:
            12,
        }}>
          <span>
            Progreso: {percentage}%
          </span>

          <span>
            OK: {result.successful}
          </span>

          <span>
            Fallidas: {result.failed}
          </span>
        </div>
      ) : null}


      <button
        type="button"
        disabled={
          migrating
        }
        onClick={() =>
          void migrate()
        }
        style={{
          width:
            "fit-content",

          minHeight:
            42,

          padding:
            "0 18px",

          border:
            "1px solid rgba(190,143,68,.42)",

          borderRadius:
            9,

          cursor:
            migrating
              ? "wait"
              : "pointer",

          color:
            "#f4f4f5",

          background:
            "rgba(190,143,68,.16)",
        }}
      >
        {migrating
          ? `Migrando ${percentage}%…`
          : `Migrar ${assets.length} imágenes al servidor`}
      </button>
    </section>
  );
}
