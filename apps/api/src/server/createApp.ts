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

// The restaurant's customer-facing QR endpoint is the ONLY API path
// exposed to the Delibocados web origin. Other tenant APIs retain their
// existing CORS policy and credential handling.
const restaurantQrOrigin = "https://panel.delibocados.online";
const restaurantQrPaths = new Set([
  "/delibocados-qr/context",
  "/delibocados-qr/order",
  "/delibocados-qr/tables",
]);

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(
    cors((request, callback) => {
      const origin = request.headers.origin;
      const isQrRequest = restaurantQrPaths.has(request.path);
      const restaurantQr =
        origin === restaurantQrOrigin && isQrRequest;
      if (origin && !allowedOrigins.has(origin) && !restaurantQr) {
        callback(new Error("Origin not allowed by CORS"));
        return;
      }
      callback(null, {
        origin: origin ? true : false,
        // QR checkout never needs browser cookies or authorization headers.
        credentials: !restaurantQr,
        methods: restaurantQr ? ["POST", "OPTIONS"] :
          ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: restaurantQr ? ["Content-Type"] : [
          "Content-Type",
          "Authorization",
          "X-Requested-With",
          "X-Company-Id",
          "X-Request-Id",
        ],
      });
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
