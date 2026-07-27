import { Router } from "express";
import { getIntelligenceDashboard, saveCatalogProduct } from "../../controllers/admin/intelligence.controller.js";

export const adminIntelligenceRoutes = Router();

adminIntelligenceRoutes.get("/intelligence", getIntelligenceDashboard);
adminIntelligenceRoutes.post("/catalog/products", saveCatalogProduct);
