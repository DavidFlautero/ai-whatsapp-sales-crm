import { requireRoles } from "../../middlewares/auth.middleware.js";
import {
  getDelibocadosChannelStatus,
  saveDelibocadosChannel,
} from "../../controllers/admin/delibocados-channel.controller.js";

import { getTenantConversations } from "../../controllers/admin/tenant-conversations.controller.js";
import {
  Router,
} from "express";

import {
  getOperatorDashboard,
  sendOperatorMessage,
  updateOperatorMode,
} from "../../controllers/admin/operator.controller.js";

export const adminOperatorRoutes =
  Router();

adminOperatorRoutes.get(
  "/operator",
  getOperatorDashboard,
);

adminOperatorRoutes.post(
  "/operator/mode",
  updateOperatorMode,
);

adminOperatorRoutes.post(
  "/operator/message",
  sendOperatorMessage,
);

adminOperatorRoutes.get("/tenant/conversations", getTenantConversations);

adminOperatorRoutes.get(
  "/operator/channel",
  requireRoles("owner", "admin"),
  getDelibocadosChannelStatus,
);

adminOperatorRoutes.post(
  "/operator/channel",
  requireRoles("owner", "admin"),
  saveDelibocadosChannel,
);
