import { Router } from "express";
import {
  verifyWhatsappWebhook,
  receiveWhatsappWebhook
} from "../controllers/whatsapp.controller.js";

export const whatsappRoutes = Router();

whatsappRoutes.get("/", verifyWhatsappWebhook);
whatsappRoutes.post("/", receiveWhatsappWebhook);
