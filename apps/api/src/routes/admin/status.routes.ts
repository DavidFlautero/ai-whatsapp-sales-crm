import { Router } from "express";
import { getAdminStatus } from "../../controllers/admin/status.controller.js";

export const adminStatusRoutes = Router();

adminStatusRoutes.get("/status", getAdminStatus);
