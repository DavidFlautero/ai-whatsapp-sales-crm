import {
  createApp,
} from "./server/createApp.js";

import {
  env,
} from "./config/env.js";

import {
  ensureRuntimeAccess,
} from "./services/runtime/core-state.service.js";

import {
  hydrateIntegrationSecrets,
} from "./services/integrations/integration-secrets.repository.js";

import { startRestaurantNotificationsWorker } from "./services/restaurant-ops/restaurant-notifications.service.js";

async function bootstrap() {

  /*
   * Licencia Neuromind:
   * se valida ANTES de inicializar integraciones
   * o abrir el puerto HTTP.
   *
   * No existe bypass por variable de entorno.
   */
  const license =
    ensureRuntimeAccess("api");

  console.log("[RUNTIME] READY");

  await hydrateIntegrationSecrets();

  const app =
    createApp();

  app.listen(
    env.PORT,
    "127.0.0.1",
    () => {
      console.log(
        `[api] running on http://localhost:${env.PORT}`,
      );
      startRestaurantNotificationsWorker();
    },
  );
}

void bootstrap().catch(
  (error: unknown) => {
    console.error(
      "[api] startup failed",
      error,
    );

    process.exit(1);
  },
);
