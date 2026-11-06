import { resolveAccessContext } from "../core/http/access-context.middleware.js";
import { requirePermission } from "../core/http/permission.middleware.js";
import { observeAccessDecision } from "../core/http/access-observation.middleware.js";
import { getCompanyModules, saveCompanyModules } from "./company-modules.controller.js";
import { Router } from "express";
import {
  companies,
  companyById,
  platformOverview,
  provisionCompany,
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

  requireRoles(
    "superadmin",
  ),

  resolveAccessContext({
    mode: "platform",
    source: "dashboard",
  }),

  requirePermission(
    "platform.read",
    {
      mode: "shadow",
    },
  ),

  observeAccessDecision({
    label:
      "platform-admin-pilot",
  }),
);

platformAdminRoutes.get(
  "/",
  platformOverview,
);

platformAdminRoutes.get(
  "/companies",
  companies,
);

platformAdminRoutes.post(
  "/companies",
  provisionCompany,
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

platformAdminRoutes.get("/companies/:companyId/modules", getCompanyModules);
platformAdminRoutes.put("/companies/:companyId/modules", saveCompanyModules);
