import { Router } from "express";
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

export const router = Router();

router.use("/health", healthRoutes);
router.use("/webhook/whatsapp", whatsappRoutes);
router.use("/customers", customersRoutes);
router.use("/orders", ordersRoutes);
router.use("/stock", stockRoutes);

router.use("/admin", adminStatusRoutes);
router.use("/admin", adminDataRoutes);
router.use("/admin", adminRecoveryRoutes);
router.use("/admin", adminAdvancedRoutes);
router.use("/admin", adminOperatorRoutes);
router.use("/admin", adminReportsRoutes);
router.use("/admin", adminFutureRoutes);
router.use("/admin", adminIntelligenceRoutes);
