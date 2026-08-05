import multer from "multer";
import { Router } from "express";
import {
  requirePermission,
} from "../../core/http/permission.middleware.js";
import { getIntelligenceDashboard, saveCatalogProduct, saveFullCatalogProduct, uploadCatalogProductImage } from "../../controllers/admin/intelligence.controller.js";


const catalogImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowed.includes(file.mimetype)) {
      callback(
        new Error(
          "Sólo se permiten imágenes JPG, PNG o WEBP",
        ),
      );
      return;
    }

    callback(null, true);
  },
});

export const adminIntelligenceRoutes = Router();

adminIntelligenceRoutes.get("/intelligence", getIntelligenceDashboard);
adminIntelligenceRoutes.post("/catalog/products", saveCatalogProduct);

adminIntelligenceRoutes.post(
  "/catalog/products/full",
  requirePermission(
    "catalog.manage",
  ),
  saveFullCatalogProduct,
);

adminIntelligenceRoutes.post(
  "/catalog/images/upload",

  requirePermission(
    "catalog.manage",
  ),

  catalogImageUpload.single("file"),

  uploadCatalogProductImage,
);
