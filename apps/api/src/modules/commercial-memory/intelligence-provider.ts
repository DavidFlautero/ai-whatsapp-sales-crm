import {
  readIntegrationSecrets,
} from "../../services/integrations/integration-secrets.repository.js";

import type {
  Config,
} from "./config.js";

export async function resolveCommercialAIConfig(
  config: Config,
): Promise<Config> {
  if (!config.aiEnabled) {
    throw new Error("CM_AI_DISABLED");
  }

  const secrets = await readIntegrationSecrets();

  const apiKey = secrets.openai.apiKey?.trim();

  const model = secrets.openai.model?.trim();

  if (!apiKey) {
    throw new Error(
      "OPENAI_NOT_CONFIGURED_IN_INTEGRATIONS_PANEL",
    );
  }

  if (!model) {
    throw new Error(
      "OPENAI_MODEL_NOT_CONFIGURED_IN_PANEL",
    );
  }

  return {
    ...config,
    openaiKey: apiKey,
    openaiModel: model,
    aiEnabled: true,
  };
}
