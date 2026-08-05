import {
  Router,
} from "express";

import {
  updateAdminContact,
} from "../../controllers/admin/contact.controller.js";

export const adminContactRoutes =
  Router();

adminContactRoutes.patch(
  "/contacts/:phone",
  updateAdminContact,
);
