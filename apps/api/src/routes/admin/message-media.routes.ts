import {
  Router,
} from "express";

import {
  downloadAdminMessageMedia,
} from "../../controllers/admin/message-media.controller.js";

export const adminMessageMediaRoutes =
  Router();

adminMessageMediaRoutes.get(
  "/messages/:messageId/media",
  downloadAdminMessageMedia,
);
