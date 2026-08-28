import { Router } from "express";
import {
  confirmPasswordReset,
  getSession,
  login,
  logout,
  requestPasswordReset,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

export const authRoutes = Router();

authRoutes.post("/login", login);

authRoutes.post(
  "/password-reset/request",
  requestPasswordReset,
);

authRoutes.post(
  "/password-reset/confirm",
  confirmPasswordReset,
);
authRoutes.post("/logout", logout);
authRoutes.get("/session", requireAuth, getSession);
