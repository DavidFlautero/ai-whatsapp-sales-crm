import {
  Router,
  type Request,
  type Response,
} from "express";

import {
  getStoreHeroImage,
} from "../../services/catalog/store-hero.service.js";

export const publicStoreSettingsRoutes =
  Router();

publicStoreSettingsRoutes.get(
  "/",
  async (
    _req:
      Request,

    res:
      Response,
  ) => {
    try {
      const hero =
        await getStoreHeroImage();

      res.json({
        ok:
          true,

        heroImageUrl:
          hero.url,
      });
    } catch (
      error
    ) {
      console.error(
        "[PUBLIC STORE SETTINGS]",
        error,
      );

      res.json({
        ok:
          true,

        heroImageUrl:
          null,
      });
    }
  },
);
