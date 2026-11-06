import {
  loadCompanyAgentProfile,
} from "../services/agent/company-agent-profile.repository.js";

import {
  buildConfiguredCompanyPrompt,
} from "../services/agent/company-agent-prompt.service.js";

async function main() {
  const companyId = "delibocados";

  const profile = await loadCompanyAgentProfile(companyId);

  const prompt = await buildConfiguredCompanyPrompt({
    companyId,
    customerMessage:
      "Hola, quiero saber qué hamburguesas tienen",
    conversationHistory: "",
    memoryContext: "",
    knowledgeContext: "",
  });

  const terms = [
    "fulanitas",
    "ropa urbana",
    "mayorista",
    "talles",
    "hamburguesa",
    "restaurante",
    "delibocados",
  ];

  console.log("=== PERFIL DEL ROBOT ===");
  console.log("EMPRESA:", profile.companyId);
  console.log("NOMBRE:", profile.businessName);
  console.log("DESCRIPCION:", profile.businessDescription);

  console.log("=== INSTRUCCIONES CONFIGURADAS ===");
  console.log(profile.instructions);

  console.log("=== TERMINOS DETECTADOS ===");

  for (const term of terms) {
    console.log(
      term,
      prompt.toLowerCase().includes(term)
        ? "PRESENTE"
        : "AUSENTE"
    );
  }

  console.log("=== FIN ===");
}

main().catch(error => {
  console.error(
    error instanceof Error
      ? error.message
      : String(error)
  );
  process.exitCode = 1;
});
