import {
  createApp,
} from "./server/createApp.js";

import {
  env,
} from "./config/env.js";

import {
  hydrateIntegrationSecrets,
} from "./services/integrations/integration-secrets.repository.js";

async function bootstrap() {
  await hydrateIntegrationSecrets();

  const app =
    createApp();

  app.listen(
    env.PORT,
    () => {
      console.log(
        `[api] running on http://localhost:${env.PORT}`,
      );
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
