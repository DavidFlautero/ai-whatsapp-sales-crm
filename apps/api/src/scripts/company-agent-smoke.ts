import { hydrateIntegrationSecrets } from "../services/integrations/integration-secrets.repository.js";
import {
  loadCompanyAgentProfile,
  previewConfiguredCompanyAgent,
} from "../services/agent/company-agent-profile.repository.js";

import {
  buildCompanyAgentPrompt,
} from "../services/agent/company-agent-runtime.service.js";

const companyId = "delibocados";

const message =
  "Hola, quisiera dos arepas rellenas por favor.";

async function main() {
  console.log("=== PRUEBA MOTOR MULTIEMPRESA ===");

  const profile = await loadCompanyAgentProfile(companyId);

  console.log("EMPRESA:", profile.companyId);
  console.log("NOMBRE:", profile.businessName);
  console.log(
    "INSTRUCCIONES CARGADAS:",
    profile.instructions.length > 0 ? "SI" : "NO"
  );

  const prompt = buildCompanyAgentPrompt({
    companyId,
    profile,
    message,
    history: [],
  });

  console.log(
    "PROMPT GENERADO:",
    prompt.length > 0 ? "SI" : "NO"
  );

  let isolated = false;

  try {
    buildCompanyAgentPrompt({
      companyId,
      profile,
      message,
      history: [
        {
          companyId: "eventos_mediterraneo",
          role: "customer",
          content: "Mensaje de otra empresa",
        },
      ],
    });
  } catch {
    isolated = true;
  }

  console.log(
    "HISTORIAL DE OTRA EMPRESA RECHAZADO:",
    isolated ? "SI" : "NO"
  );

  if (process.argv.includes("--generate")) {
    await hydrateIntegrationSecrets();
    console.log("\n=== RESPUESTA IA SIMULADA ===");

    const result = await previewConfiguredCompanyAgent({
      companyId,
      message,
      history: [],
    });

    console.log("MODO:", result.mode);
    console.log("RESPUESTA:", result.reply);
  } else {
    console.log("GENERACION IA: NO EJECUTADA");
  }

  console.log("=== FIN ===");
}

main().catch((error: unknown) => {
  console.error(
    "ERROR:",
    error instanceof Error ? error.message : "UNKNOWN"
  );
  process.exitCode = 1;
});
