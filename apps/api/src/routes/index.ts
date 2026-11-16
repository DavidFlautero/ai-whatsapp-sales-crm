
import {
  whapiRoutes,
} from "./whapi.routes.js";

import {
  adminIntegrationsRoutes,
} from "./admin/integrations.routes.js";

import {
  adminWhatsappBusinessProfileRoutes,
} from "./admin/whatsapp-business-profile.routes.js";

import {
  adminWhatsappEmbeddedSignupRoutes,
} from "./admin/whatsapp-embedded-signup.routes.js";

import {
  adminGoogleCalendarRoutes,
} from "./admin/google-calendar.routes.js";


import {
  commercialMemoryDashboardRoutes,
} from "../modules/commercial-memory/dashboard-read.routes.js";

import { Router } from "express";
import {
  ownerInvitationRoutes,
  ownerPortalRoutes,
} from "./owner-portal.routes.js";

import {
  adminCatalogMediaRoutes,
} from "./admin/catalog-media.routes.js";

import {
  resolveAccessContext,
} from "../core/http/access-context.middleware.js";
import { authRoutes } from "./auth.routes.js";
import { healthRoutes } from "./health.routes.js";
import {
  publicCatalogRoutes,
} from "./public/catalog.routes.js";

import {
  publicStoreSettingsRoutes,
} from "./public/store-settings.routes.js";

import {
  publicVenueRoutes,
} from "./public/venues.routes.js";

import {
  publicLeadRequestRoutes,
} from "./public/lead-requests.routes.js";

import {
  voiceRoutes,
} from "../modules/voice/voice.routes.js";

import { whatsappRoutes } from "./whatsapp.routes.js";
import { customersRoutes } from "./customers.routes.js";
import { crmRoutes } from "./crm.routes.js";
import { ordersRoutes } from "./orders.routes.js";
import { restaurantOpsRoutes } from "./restaurant-ops.routes.js";
import { restaurantQrPublicRoutes } from "./restaurant-qr-public.routes.js";
import { stockRoutes } from "./stock.routes.js";
import { adminStatusRoutes } from "./admin/status.routes.js";
import { adminDataRoutes } from "./admin/data.routes.js";
import { adminRecoveryRoutes } from "./admin/recovery.routes.js";
import { adminAdvancedRoutes } from "./admin/advanced.routes.js";
import { adminOperatorRoutes } from "./admin/operator.routes.js";
import { adminReportsRoutes } from "./admin/reports.routes.js";
import { adminFutureRoutes } from "./admin/future.routes.js";
import { adminIntelligenceRoutes } from "./admin/intelligence.routes.js";
import {
  adminStoreHeroRoutes,
} from "./admin/store-hero.routes.js";

import {
  requireAuth,
  requireRoles,
} from "../middlewares/auth.middleware.js";
import {
  platformAdminRoutes,
  platformPublicRoutes,
} from "../platform/platform.routes.js";
import { adminContactRoutes } from "./admin/contact.routes.js";
import { adminMessageMediaRoutes } from "./admin/message-media.routes.js";
import {
  ninoxWebhookRoutes,
} from "./webhooks/ninox.routes.js";

import {
  adminPaymentSettingsRoutes,
} from "./admin/payment-settings.routes.js";

import {
  adminPaymentSubmissionsRoutes,
} from "./admin/payment-submissions.routes.js";

import {
  privacyRoutes,
} from "../modules/privacy/privacy.routes.js";

export const router = Router();

router.use(
  "/whapi",
  whapiRoutes,
);


router.use(
  "/admin/integrations",
  requireAuth,
  adminIntegrationsRoutes,
);

router.use(
  "/admin/whatsapp-business",
  requireAuth,
  adminWhatsappBusinessProfileRoutes,
);

router.use(
  "/admin/whatsapp-embedded",
  requireAuth,
  adminWhatsappEmbeddedSignupRoutes,
);

router.use(
  "/admin/google-calendar",
  requireAuth,
  adminGoogleCalendarRoutes,
);


router.use("/health", healthRoutes);
// Off by default. Public QR checkout requires server-validated token/table.
router.use("/public/delibocados-qr", restaurantQrPublicRoutes);

// panel.delibocados.online Nginx already forwards /api/ to the API (4000)
// with a trailing-slash proxy_pass, stripping the /api prefix. Expose an
// exact QR alias to avoid forwarding the customer-facing POST through an
// unrelated catch-all API route. Every request still validates its opaque
// token, enabled state, company ID and optional one-table pilot.
router.use("/delibocados-qr", (req,res,next)=>{
  // Marker proves the HTTPS request reached the QR handler, not the catch-all.
  res.setHeader("X-Deli-QR-Handler","api-qr-alias-v1");
  // No credentials or cross-origin browser access to another tenant.
  if(req.headers.origin!=="https://panel.delibocados.online")
    return res.status(403).setHeader("Cache-Control","no-store")
      .json({ok:false,error:"ORIGIN_DENIED"});
  next();
}, restaurantQrPublicRoutes);
router.use(
  "/public/catalog",
  publicCatalogRoutes,
);
router.use(
  "/public/store-settings",
  publicStoreSettingsRoutes,
);


router.use(
  "/public/venues",
  publicVenueRoutes,
);


router.use(
  "/public/lead-requests",
  publicLeadRequestRoutes,
);
router.use("/auth", authRoutes);

router.use("/owner", ownerPortalRoutes);

router.use(
  "/crm/owner-invitations",
  requireAuth,
  resolveAccessContext({
    mode: "company",
    source: "dashboard",
  }),
  ownerInvitationRoutes,
);

router.use("/platform", platformPublicRoutes);
router.use("/webhook/whatsapp", whatsappRoutes);
router.use(
  "/webhooks/ninox",
  ninoxWebhookRoutes,
);

router.use("/customers", requireAuth, customersRoutes);

router.use(
  "/crm/commercial-memory",
  requireAuth,
  resolveAccessContext({
    mode: "company",
    source: "dashboard",
  }),
  requireRoles(
    "superadmin",
    "owner",
    "admin",
    "supervisor",
  ),
  commercialMemoryDashboardRoutes,
);

router.use(
  "/crm",
  requireAuth,
  resolveAccessContext({
    mode: "company",
    source: "dashboard",
  }),
  crmRoutes,
);

router.use(
  "/admin/restaurant-ops",
  requireAuth,
  requireRoles("owner","admin","supervisor"),
  resolveAccessContext({ mode: "company", source: "dashboard" }),
  restaurantOpsRoutes
);

router.use(
  "/orders",

  requireAuth,

  resolveAccessContext({
    mode: "company",
    source: "dashboard",
  }),

  ordersRoutes,
);
router.use(
  "/stock",

  requireAuth,

  resolveAccessContext({
    mode: "company",
    source: "dashboard",
  }),

  stockRoutes,
);

router.use(
  "/voice",

  requireAuth,

  resolveAccessContext({
    mode: "company",
    source: "dashboard",
  }),

  voiceRoutes,
);

router.use(
  "/admin/privacy",

  requireAuth,

  resolveAccessContext({
    mode: "company",
    source: "dashboard",
  }),

  privacyRoutes,
);

router.use("/platform", platformAdminRoutes);

router.use(
  "/admin",
  requireAuth,
  requireRoles(
    "superadmin",
    "owner",
    "admin",
    "supervisor",
  ),
);

router.use(
  "/admin/payment-settings",

  resolveAccessContext({
    mode:
      "company",

    source:
      "dashboard",
  }),

  adminPaymentSettingsRoutes,
);

router.use(
  "/admin",

  resolveAccessContext({
    mode: "company",
    source: "dashboard",
  }),

  adminPaymentSubmissionsRoutes,
);

router.use(
  "/admin",
  adminStoreHeroRoutes,
);
router.use("/admin", adminStatusRoutes);
router.use("/admin", adminDataRoutes);
router.use("/admin", adminRecoveryRoutes);
router.use("/admin", adminContactRoutes);
router.use(
  "/admin",
  resolveAccessContext({ mode: "company", source: "dashboard" }),
  adminMessageMediaRoutes
);

router.use("/admin", adminAdvancedRoutes);
router.use(
  "/admin",

  resolveAccessContext({
    mode: "company",
    source: "dashboard",
  }),

  adminOperatorRoutes,
);
router.use("/admin", adminReportsRoutes);
router.use("/admin", adminFutureRoutes);
router.use(
  "/admin",

  resolveAccessContext({
    mode: "company",
    source: "dashboard",
  }),

  adminIntelligenceRoutes,
);


router.use(
  "/admin/catalog-media",
  adminCatalogMediaRoutes,
);
