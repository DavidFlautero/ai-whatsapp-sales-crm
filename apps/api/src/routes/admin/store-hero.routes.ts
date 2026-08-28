import {
  Router,
  type Request,
  type Response,
} from "express";

import multer from "multer";

import {
  requirePermission,
} from "../../core/http/permission.middleware.js";

import {
  uploadCatalogImage,
} from "../../services/catalog/catalog-image.service.js";

import {
  getStoreHeroImage,
  saveStoreHeroImage,
} from "../../services/catalog/store-hero.service.js";

export const adminStoreHeroRoutes =
  Router();

const upload =
  multer({
    storage:
      multer.memoryStorage(),

    limits: {
      fileSize:
        5 * 1024 * 1024,
    },
  });

adminStoreHeroRoutes.get(
  "/store-hero",

  requirePermission(
    "catalog.manage",
  ),

  async (
    _req:
      Request,

    res:
      Response,
  ) => {
    const result =
      await getStoreHeroImage();

    res.json({
      ok:
        true,

      ...result,
    });
  },
);

adminStoreHeroRoutes.post(
  "/store-hero",

  requirePermission(
    "catalog.manage",
  ),

  upload.single(
    "file",
  ),

  async (
    req:
      Request,

    res:
      Response,
  ) => {
    if (!req.file) {
      return res.status(
        400,
      ).json({
        ok:
          false,

        error:
          "FILE_REQUIRED",
      });
    }

    const uploaded =
      await uploadCatalogImage({
        companyId:
          "fulanitas",

        baseSku:
          "STORE-HERO",

        colorCode:
          "DEFAULT",

        role:
          "cover",

        file: {
          buffer:
            req.file.buffer,

          mimetype:
            req.file.mimetype,

          size:
            req.file.size,
        },
      });

    const saved =
      await saveStoreHeroImage(
        uploaded.url,
      );

    return res.json({
      ok:
        true,

      url:
        saved.url,
    });
  },
);
