import {
  createHash,
} from "node:crypto";

import multer from "multer";

import {
  Router,
} from "express";

import {
  requireAuth,
  requireRoles,
} from "../../middlewares/auth.middleware.js";

import {
  deleteCatalogImage,
  uploadCatalogImage,
} from "../../services/catalog/catalog-image.service.js";

import {
  findCatalogMediaAssetByHash,
  findCatalogMediaAssetById,
  listCatalogMediaAssets,
  normalizeArticleCode,
  readCatalogMediaSettings,
  registerCatalogMediaAsset,
  removeCatalogMediaAsset,
  saveCatalogMediaSettings,
  type CatalogMediaRole,
} from "../../services/catalog/catalog-media.repository.js";

import {
  buildCatalogMediaIndex,
  selectArticleImages,
} from "../../services/catalog/catalog-media-index.service.js";

import {
  reconcileCatalogMedia,
  scheduleCatalogMediaMonitor,
} from "../../services/catalog/catalog-media-monitor.service.js";

import {
  readNinoxCatalogCache,
} from "../../services/ninox/ninox-catalog-cache.repository.js";


export const adminCatalogMediaRoutes =
  Router();


const CATALOG_MEDIA_MAX_IMAGES =
  3;


/* CATALOG_MEDIA_ADMIN_AUTH_V1 */
adminCatalogMediaRoutes.use(
  requireAuth,

  requireRoles(
    "superadmin",
    "owner",
    "admin",
  ),
);


const upload =
  multer({
    storage:
      multer.memoryStorage(),

    limits: {
      fileSize:
        5
        * 1024
        * 1024,

      files:
        1,
    },

    fileFilter:
      (
        _req,
        file,
        callback,
      ) => {
        const allowed =
          new Set([
            "image/jpeg",
            "image/png",
            "image/webp",
          ]);

        if (
          !allowed.has(
            file.mimetype,
          )
        ) {
          callback(
            new Error(
              "CATALOG_MEDIA_UNSUPPORTED_IMAGE",
            ),
          );

          return;
        }

        callback(
          null,
          true,
        );
      },
  });


function companyIdFromRequest(
  req:
    Parameters<
      Parameters<
        typeof adminCatalogMediaRoutes.get
      >[1]
    >[0],
) {
  return (
    req.authUser
      ?.companyId
    || process.env
      .DEFAULT_COMPANY_ID
    || "fulanitas"
  );
}


function validRole(
  value:
    unknown,
): CatalogMediaRole {
  switch (
    String(
      value
      ?? "cover",
    )
  ) {
    case "cover":
    case "front":
    case "back":
    case "detail":
    case "model":
      return String(
        value
        ?? "cover",
      ) as CatalogMediaRole;

    default:
      throw new Error(
        "CATALOG_MEDIA_INVALID_ROLE",
      );
  }
}


adminCatalogMediaRoutes.get(
  "/gaps",

  async (
    req,
    res,
  ) => {
    try {
      const companyId =
        companyIdFromRequest(
          req,
        );

      const [
        reconciliation,
        settings,
      ] =
        await Promise.all([
          reconcileCatalogMedia(
            companyId,
            "panel",
          ),

          readCatalogMediaSettings(
            companyId,
          ),
        ]);

      const assets =
        await listCatalogMediaAssets(
          companyId,
        );


      const imagesByArticle =
        new Map<
          string,
          Array<{
            id:
              string;

            url:
              string;

            role:
              CatalogMediaRole;

            createdAt:
              string;
          }>
        >();


      for (
        const asset
        of assets
      ) {
        const code =
          normalizeArticleCode(
            asset.articleCode,
          );


        const current =
          imagesByArticle.get(
            code,
          )
          ?? [];


        current.push({
          id:
            asset.id,

          url:
            asset.url,

          role:
            asset.role,

          createdAt:
            asset.createdAt,
        });


        imagesByArticle.set(
          code,
          current,
        );
      }


      const gaps =
        (
          reconciliation.gaps
          ?? []
        )
          .map(
            (gap) => ({
              ...gap,

              images:
                (
                  imagesByArticle.get(
                    normalizeArticleCode(
                      gap.articleCode,
                    ),
                  )
                  ?? []
                )
                  .slice(
                    0,
                    CATALOG_MEDIA_MAX_IMAGES,
                  ),
            }),
          );


      return res.json({
        ...reconciliation,

        gaps,

        settings,
      });

    } catch (error) {
      console.error(
        "[CATALOG MEDIA GAPS ERROR]",
        error,
      );

      return res.status(500).json({
        ok:
          false,

        error:
          "CATALOG_MEDIA_GAPS_FAILED",
      });
    }
  },
);


adminCatalogMediaRoutes.get(
  "/article/:code/images",

  async (
    req,
    res,
  ) => {
    try {
      const companyId =
        companyIdFromRequest(
          req,
        );

      const articleCode =
        normalizeArticleCode(
          req.params.code,
        );

      const index =
        await buildCatalogMediaIndex(
          companyId,
        );

      return res.json({
        ok:
          true,

        articleCode,

        images:
          selectArticleImages(
            index,
            articleCode,
            null,
            12,
          ),
      });

    } catch (error) {
      return res.status(500).json({
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : "CATALOG_MEDIA_IMAGES_FAILED",
      });
    }
  },
);


adminCatalogMediaRoutes.put(
  "/settings",

  async (
    req,
    res,
  ) => {
    try {
      const companyId =
        companyIdFromRequest(
          req,
        );

      const settings =
        await saveCatalogMediaSettings(
          companyId,
          {
            ownerWhatsapp:
              req.body
                ?.ownerWhatsapp
              ?? null,

            notificationsEnabled:
              req.body
                ?.notificationsEnabled
              !== false,
          },
        );

      /*
       * Si había alertas pendientes
       * y recién configuraron el número,
       * dejamos que el monitor las tome.
       */
      scheduleCatalogMediaMonitor({
        companyId,

        source:
          "settings-updated",
      });

      return res.json({
        ok:
          true,

        settings,
      });

    } catch (error) {
      return res.status(400).json({
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : "CATALOG_MEDIA_SETTINGS_FAILED",
      });
    }
  },
);


adminCatalogMediaRoutes.post(
  "/images",

  upload.single(
    "file",
  ),

  async (
    req,
    res,
  ) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          ok:
            false,

          error:
            "IMAGE_REQUIRED",
        });
      }


      const companyId =
        companyIdFromRequest(
          req,
        );


      const articleCode =
        normalizeArticleCode(
          String(
            req.body
              ?.articleCode
            ?? "",
          ),
        );


      if (!articleCode) {
        return res.status(400).json({
          ok:
            false,

          error:
            "ARTICLE_CODE_REQUIRED",
        });
      }


      /*
       * La existencia del artículo
       * se verifica contra la caché local
       * de Ninox. NO hacemos una llamada
       * nueva a GetDataCurva.
       */
      const cache =
        await readNinoxCatalogCache();


      const variants =
        cache.filter(
          (item) =>
            normalizeArticleCode(
              item.externalCode,
            )
            === articleCode,
        );


      if (!variants.length) {
        return res.status(404).json({
          ok:
            false,

          error:
            "NINOX_ARTICLE_NOT_FOUND",
        });
      }


      const role =
        validRole(
          req.body?.role,
        );


      const requestedColor =
        String(
          req.body
            ?.colorName
          ?? "",
        )
          .trim();


      const requestedColorCode =
        String(
          req.body
            ?.colorCode
          ?? "",
        )
          .trim();


      const preferredVariant =
        variants.find(
          (item) =>
            requestedColor
            && (
              item.colorName
                ?.toLowerCase()
              === requestedColor
                .toLowerCase()
              || item.colorCode
                ?.toLowerCase()
              === requestedColor
                .toLowerCase()
            ),
        )
        ?? variants[0];


      const colorName =
        requestedColor
        || preferredVariant
          ?.colorName
        || null;


      const colorCode =
        requestedColorCode
        || preferredVariant
          ?.colorCode
        || preferredVariant
          ?.colorName
        || "GENERAL";


      const sha256 =
        createHash(
          "sha256",
        )
          .update(
            req.file.buffer,
          )
          .digest(
            "hex",
          );


      const duplicate =
        await findCatalogMediaAssetByHash(
          companyId,
          articleCode,
          sha256,
        );


      if (duplicate) {
        await reconcileCatalogMedia(
          companyId,
          "duplicate-upload",
        );

        return res.status(200).json({
          ok:
            true,

          duplicate:
            true,

          image:
            duplicate,
        });
      }


      const mediaIndex =
        await buildCatalogMediaIndex(
          companyId,
        );


      const currentImageCount =
        mediaIndex.byCode.get(
          articleCode,
        )
          ?.length
        ?? 0;


      if (
        currentImageCount
        >= CATALOG_MEDIA_MAX_IMAGES
      ) {
        return res.status(409).json({
          ok:
            false,

          error:
            "CATALOG_MEDIA_IMAGE_LIMIT_REACHED",

          imageCount:
            currentImageCount,

          imageLimit:
            CATALOG_MEDIA_MAX_IMAGES,
        });
      }


      const uploaded =
        await uploadCatalogImage({
          companyId,

          baseSku:
            articleCode,

          colorCode,

          role,

          file: {
            buffer:
              req.file.buffer,

            mimetype:
              req.file.mimetype,

            size:
              req.file.size,
          },
        });


      /*
       * Nunca borramos la imagen
       * si el registro posterior falla.
       *
       * Preferimos un archivo huérfano
       * recuperable antes que pérdida
       * destructiva de contenido.
       */
      const registered =
        await registerCatalogMediaAsset({
          companyId,

          articleCode,

          colorCode,

          colorName,

          role,

          url:
            uploaded.url,

          bucket:
            uploaded.bucket
            ?? null,

          storagePath:
            uploaded.path
            ?? null,

          sha256,

          source:
            "panel",
        });


      const reconciliation =
        await reconcileCatalogMedia(
          companyId,
          "image-upload",
        );


      return res.status(201).json({
        ok:
          true,

        duplicate:
          false,

        image:
          registered.asset,

        gaps:
          reconciliation.gaps,
      });

    } catch (error) {
      console.error(
        "[CATALOG MEDIA UPLOAD ERROR]",
        error,
      );

      return res.status(400).json({
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : "CATALOG_MEDIA_UPLOAD_FAILED",
      });
    }
  },
);



adminCatalogMediaRoutes.delete(
  "/images/:imageId",

  async (
    req,
    res,
  ) => {
    try {
      const companyId =
        companyIdFromRequest(
          req,
        );


      const imageId =
        String(
          req.params.imageId
          ?? "",
        )
          .trim();


      if (!imageId) {
        return res.status(400).json({
          ok:
            false,

          error:
            "CATALOG_MEDIA_IMAGE_ID_REQUIRED",
        });
      }


      const asset =
        await findCatalogMediaAssetById(
          companyId,
          imageId,
        );


      if (!asset) {
        return res.status(404).json({
          ok:
            false,

          error:
            "CATALOG_MEDIA_IMAGE_NOT_FOUND",
        });
      }


      if (
        asset.bucket
        && asset.storagePath
      ) {
        await deleteCatalogImage({
          bucket:
            asset.bucket,

          path:
            asset.storagePath,
        });
      }


      const removed =
        await removeCatalogMediaAsset(
          companyId,
          imageId,
        );


      const reconciliation =
        await reconcileCatalogMedia(
          companyId,
          "image-deleted",
        );


      const updatedGap =
        (
          reconciliation.gaps
          ?? []
        )
          .find(
            (gap) =>
              normalizeArticleCode(
                gap.articleCode,
              )
              === normalizeArticleCode(
                asset.articleCode,
              ),
          );


      return res.json({
        ok:
          true,

        deleted:
          Boolean(
            removed,
          ),

        articleCode:
          asset.articleCode,

        imageCount:
          updatedGap
            ?.imageCount
          ?? 0,

        imageLimit:
          CATALOG_MEDIA_MAX_IMAGES,
      });

    } catch (error) {
      console.error(
        "[CATALOG MEDIA DELETE ERROR]",
        error,
      );


      return res.status(400).json({
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : "CATALOG_MEDIA_DELETE_FAILED",
      });
    }
  },
);



/*
 * Adoptar una imagen que YA existe
 * en nuestro bucket Supabase.
 *
 * No vuelve a subirla.
 * No duplica archivos.
 *
 * Sólo permitimos URLs pertenecientes
 * al Supabase configurado y al bucket
 * catalog-images.
 */
adminCatalogMediaRoutes.post(
  "/adopt",

  async (
    req,
    res,
  ) => {
    try {
      const companyId =
        companyIdFromRequest(
          req,
        );


      const articleCode =
        normalizeArticleCode(
          String(
            req.body
              ?.articleCode
            ?? "",
          ),
        );


      const rawUrl =
        String(
          req.body
            ?.url
          ?? "",
        )
          .trim();


      if (
        !articleCode
        || !rawUrl
      ) {
        return res.status(400).json({
          ok:
            false,

          error:
            "ARTICLE_CODE_AND_URL_REQUIRED",
        });
      }


      /*
       * El artículo debe existir en
       * la caché Ninox.
       */
      const cache =
        await readNinoxCatalogCache();


      const articleExists =
        cache.some(
          (item) =>
            normalizeArticleCode(
              item.externalCode,
            )
            === articleCode,
        );


      if (!articleExists) {
        return res.status(404).json({
          ok:
            false,

          error:
            "NINOX_ARTICLE_NOT_FOUND",
        });
      }


      const supabaseBase =
        process.env
          .SUPABASE_URL
          ?.trim();


      if (!supabaseBase) {
        throw new Error(
          "SUPABASE_URL_NOT_CONFIGURED",
        );
      }


      let sourceUrl:
        URL;

      let supabaseUrl:
        URL;


      try {
        sourceUrl =
          new URL(
            rawUrl,
          );

        supabaseUrl =
          new URL(
            supabaseBase,
          );

      } catch {
        return res.status(400).json({
          ok:
            false,

          error:
            "INVALID_IMAGE_URL",
        });
      }


      const prefix =
        "/storage/v1/object/public/catalog-images/";


      if (
        sourceUrl.protocol
          !== "https:"
        || sourceUrl.hostname
          .toLowerCase()
          !== supabaseUrl.hostname
            .toLowerCase()
        || !sourceUrl.pathname
          .startsWith(
            prefix,
          )
      ) {
        return res.status(400).json({
          ok:
            false,

          error:
            "IMAGE_URL_NOT_OWNED_STORAGE",
        });
      }


      const controller =
        new AbortController();


      const timeout =
        setTimeout(
          () =>
            controller.abort(),
          10_000,
        );


      let response:
        globalThis.Response;


      try {
        response =
          await fetch(
            sourceUrl,
            {
              signal:
                controller.signal,

              redirect:
                "error",
            },
          );

      } finally {
        clearTimeout(
          timeout,
        );
      }


      if (!response.ok) {
        return res.status(400).json({
          ok:
            false,

          error:
            `IMAGE_FETCH_HTTP_${response.status}`,
        });
      }


      const mimeType =
        (
          response.headers
            .get(
              "content-type",
            )
          ?? ""
        )
          .split(
            ";",
          )[0]
          .trim()
          .toLowerCase();


      if (
        ![
          "image/jpeg",
          "image/png",
          "image/webp",
        ].includes(
          mimeType,
        )
      ) {
        return res.status(400).json({
          ok:
            false,

          error:
            "UNSUPPORTED_IMAGE_TYPE",
        });
      }


      const advertisedSize =
        Number(
          response.headers
            .get(
              "content-length",
            ),
        );


      if (
        Number.isFinite(
          advertisedSize,
        )
        && advertisedSize
          > 5
            * 1024
            * 1024
      ) {
        return res.status(413).json({
          ok:
            false,

          error:
            "IMAGE_TOO_LARGE",
        });
      }


      const buffer =
        Buffer.from(
          await response
            .arrayBuffer(),
        );


      if (
        buffer.length
        > 5
          * 1024
          * 1024
      ) {
        return res.status(413).json({
          ok:
            false,

          error:
            "IMAGE_TOO_LARGE",
        });
      }


      const sha256 =
        createHash(
          "sha256",
        )
          .update(
            buffer,
          )
          .digest(
            "hex",
          );


      const role =
        validRole(
          req.body?.role,
        );


      const storagePath =
        decodeURIComponent(
          sourceUrl.pathname
            .slice(
              prefix.length,
            ),
        );


      const result =
        await registerCatalogMediaAsset({
          companyId,

          articleCode,

          colorCode:
            String(
              req.body
                ?.colorCode
              ?? "",
            )
              .trim()
            || null,

          colorName:
            String(
              req.body
                ?.colorName
              ?? "",
            )
              .trim()
            || null,

          role,

          url:
            sourceUrl.toString(),

          bucket:
            "catalog-images",

          storagePath,

          sha256,

          source:
            "legacy",
        });


      const reconciliation =
        await reconcileCatalogMedia(
          companyId,
          "legacy-image-adopt",
        );


      return res.status(
        result.created
          ? 201
          : 200,
      ).json({
        ok:
          true,

        created:
          result.created,

        image:
          result.asset,

        missing:
          reconciliation
            .gaps
            .length,
      });

    } catch (error) {
      console.error(
        "[CATALOG MEDIA ADOPT ERROR]",
        error,
      );

      return res.status(400).json({
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : "CATALOG_MEDIA_ADOPT_FAILED",
      });
    }
  },
);


adminCatalogMediaRoutes.get(
  "/registry",

  async (
    req,
    res,
  ) => {
    const companyId =
      companyIdFromRequest(
        req,
      );

    const assets =
      await listCatalogMediaAssets(
        companyId,
      );

    return res.json({
      ok:
        true,

      count:
        assets.length,

      assets,
    });
  },
);
