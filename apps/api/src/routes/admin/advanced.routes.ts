import { Router } from "express";
import { getAdvancedDashboard } from "../../controllers/admin/advanced.controller.js";

export const adminAdvancedRoutes = Router();

adminAdvancedRoutes.get("/advanced", getAdvancedDashboard);
