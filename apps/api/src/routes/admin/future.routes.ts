import { Router } from "express";
import { getFutureDashboard } from "../../controllers/admin/future.controller.js";

export const adminFutureRoutes = Router();

adminFutureRoutes.get("/future", getFutureDashboard);
