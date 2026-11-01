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

const tenantBaseDomain = process.env.TENANT_BASE_DOMAIN?.trim().toLowerCase();

function isTenantOrigin(origin: string): boolean {
  if (!tenantBaseDomain) return false;
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" || url.port) return false;
    const suffix = "." + tenantBaseDomain;
    if (!url.hostname.endsWith(suffix)) return false;
    const slug = url.hostname.slice(0, -suffix.length);
    return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug);
  } catch {
    return false;
  }
}

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin) || isTenantOrigin(origin)) {
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
        "X-Company-Id",
        "X-Request-Id",
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
