import express from "express";
import cors from "cors";
import { router } from "../routes/index.js";
import { errorMiddleware } from "../middlewares/error.middleware.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "5mb" }));

  app.use(router);

  app.use(errorMiddleware);

  return app;
}
