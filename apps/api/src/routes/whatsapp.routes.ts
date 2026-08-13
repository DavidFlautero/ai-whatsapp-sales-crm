import {
  ensureRuntimeAccess,
} from "../services/runtime/core-state.service.js";

import { Router } from "express";
import {
  verifyWhatsappWebhook,
  receiveWhatsappWebhook
} from "../controllers/whatsapp.controller.js";

export const whatsappRoutes = Router();

whatsappRoutes.get("/", verifyWhatsappWebhook);
whatsappRoutes.post(
  "/",
  (req, res, next) => {
    /* RUNTIME_CHECK_A1 */
    try {
      ensureRuntimeAccess("whatsapp");
      next();
    } catch (error) {
      next(error);
    }
  },
  receiveWhatsappWebhook,
);
