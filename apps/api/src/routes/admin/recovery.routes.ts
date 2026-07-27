import { Router } from "express";
import { draftRecoveryMessage, getRecoveryDashboard, sendRecoveryMessage } from "../../controllers/admin/recovery.controller.js";

export const adminRecoveryRoutes = Router();

adminRecoveryRoutes.get("/recovery", getRecoveryDashboard);
adminRecoveryRoutes.post("/recovery/draft", draftRecoveryMessage);
adminRecoveryRoutes.post("/recovery/send", sendRecoveryMessage);
