import { Router } from "express";
import { getOperatorDashboard, updateOperatorMode } from "../../controllers/admin/operator.controller.js";

export const adminOperatorRoutes = Router();

adminOperatorRoutes.get("/operator", getOperatorDashboard);
adminOperatorRoutes.post("/operator/mode", updateOperatorMode);
