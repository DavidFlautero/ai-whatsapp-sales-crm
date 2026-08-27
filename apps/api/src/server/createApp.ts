import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { router } from "../routes/index.js";
import { errorMiddleware } from "../middlewares/error.middleware.js";

const productionOrigin =
  process.env.APP_ORIGIN?.trim() ||
  "https://panel.fulanitasfabrica.site";

const allowedOrigins = new Set([
  productionOrigin,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Origin not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
      ],
    }),
  );

  app.use(cookieParser());
  app.use(
    express.json({
      limit: "5mb",
      verify: (
        request,
        _response,
        buffer,
      ) => {
        (
          request as typeof request & {
            rawBody?: Buffer;
          }
        ).rawBody =
          Buffer.from(buffer);
      },
    }),
  );

  app.use(router);
  app.use(errorMiddleware);

  return app;
}
