import {
  buildConfiguredCompanyPrompt,
} from "../services/agent/company-agent-prompt.service.js";

import {
  generateAgentResponse,
} from "../services/anthropic/anthropic.service.js";

async function main() {
  const prompt = await buildConfiguredCompanyPrompt({
    companyId: "delibocados",
    customerMessage:
      "Hola, quiero saber qué hamburguesas tienen",
    conversationHistory: "",
    memoryContext: "",
    knowledgeContext: "",
  });

  console.log("=== PRUEBA AISLADA ===");

  const response = await generateAgentResponse(prompt);

  console.log("RESPUESTA:");
  console.log(response);

  console.log("=== FIN ===");
}

main().catch(error => {
  console.error(
    error instanceof Error ? error.message : String(error)
  );
  process.exitCode = 1;
});
