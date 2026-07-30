import { Router } from "express";
import {
  companies,
  companyById,
  platformOverview,
  publicBranding,
  saveCompany,
  saveCompanyBranding,
  saveCompanyRobot,
  saveCompanySubscription,
  savePlatformBranding,
} from "./platform.controller.js";
import {
  requireAuth,
  requireRoles,
} from "../middlewares/auth.middleware.js";

export const platformPublicRoutes = Router();
export const platformAdminRoutes = Router();

platformPublicRoutes.get(
  "/public-branding",
  publicBranding,
);

platformAdminRoutes.use(
  requireAuth,
  requireRoles("superadmin"),
);

platformAdminRoutes.get(
  "/",
  platformOverview,
);

platformAdminRoutes.get(
  "/companies",
  companies,
);

platformAdminRoutes.get(
  "/companies/:companyId",
  companyById,
);

platformAdminRoutes.put(
  "/settings",
  savePlatformBranding,
);

platformAdminRoutes.put(
  "/companies/:companyId",
  saveCompany,
);

platformAdminRoutes.put(
  "/companies/:companyId/branding",
  saveCompanyBranding,
);

platformAdminRoutes.put(
  "/companies/:companyId/robot",
  saveCompanyRobot,
);

platformAdminRoutes.put(
  "/companies/:companyId/subscription",
  saveCompanySubscription,
);
