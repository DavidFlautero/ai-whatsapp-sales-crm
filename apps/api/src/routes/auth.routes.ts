import { Router } from "express";
import {
  getSession,
  login,
  logout,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

export const authRoutes = Router();

authRoutes.post("/login", login);
authRoutes.post("/logout", logout);
authRoutes.get("/session", requireAuth, getSession);
