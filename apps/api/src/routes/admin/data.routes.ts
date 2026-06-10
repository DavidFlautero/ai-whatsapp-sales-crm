import { Router } from "express";
import { getAdminOverview, saveAdminPrompt } from "../../controllers/admin/data.controller.js";

export const adminDataRoutes = Router();

adminDataRoutes.get("/overview", getAdminOverview);
adminDataRoutes.post("/prompts", saveAdminPrompt);
