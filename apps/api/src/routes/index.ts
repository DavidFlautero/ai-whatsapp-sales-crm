import { Router } from "express";
import { authRoutes } from "./auth.routes.js";
import { healthRoutes } from "./health.routes.js";
import { whatsappRoutes } from "./whatsapp.routes.js";
import { customersRoutes } from "./customers.routes.js";
import { ordersRoutes } from "./orders.routes.js";
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
  requireAuth,
  requireRoles,
} from "../middlewares/auth.middleware.js";

export const router = Router();

/*
 * Rutas públicas.
 * Meta necesita acceder al webhook sin iniciar sesión.
 */
router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/webhook/whatsapp", whatsappRoutes);

/*
 * Rutas comerciales protegidas.
 * Cualquier usuario activo puede acceder.
 */
router.use("/customers", requireAuth, customersRoutes);
router.use("/orders", requireAuth, ordersRoutes);
router.use("/stock", requireAuth, stockRoutes);

/*
 * Administración.
 * Solo administradores y supervisores.
 */
router.use(
  "/admin",
  requireAuth,
  requireRoles("admin", "supervisor"),
);

router.use("/admin", adminStatusRoutes);
router.use("/admin", adminDataRoutes);
router.use("/admin", adminRecoveryRoutes);
router.use("/admin", adminAdvancedRoutes);
router.use("/admin", adminOperatorRoutes);
router.use("/admin", adminReportsRoutes);
router.use("/admin", adminFutureRoutes);
router.use("/admin", adminIntelligenceRoutes);
