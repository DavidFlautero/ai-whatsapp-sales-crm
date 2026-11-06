import {
  hydrateIntegrationSecrets,
} from "../services/integrations/integration-secrets.repository.js";

import {
  listMessages,
} from "../services/conversations/conversation.repository.js";

import {
  loadCompanyCapabilities,
} from "../services/agent/company-agent-capabilities.service.js";

import {
  executeCompanyAgent,
} from "../services/agent/company-agent-execution.service.js";

async function main() {
  const companyId = "delibocados";

  await hydrateIntegrationSecrets();

  const capabilities =
    await loadCompanyCapabilities(companyId);

  console.log("=== CAPACIDADES REALES ===");
  console.log(JSON.stringify(capabilities, null, 2));

  const messages = await listMessages(undefined, companyId);

  const inbound = messages.find(m =>
    m.company_id === companyId &&
    m.direction === "inbound" &&
    m.channel === "whatsapp" &&
    m.message_type === "text" &&
    Boolean(m.body?.trim()) &&
    Boolean(m.id) &&
    Boolean(m.contact_phone)
  );

  if (!inbound?.id) {
    throw new Error("NO_INBOUND_MESSAGE_AVAILABLE");
  }

  console.log("\n=== MOTOR AVANZADO ===");
  console.log("EMPRESA:", companyId);
  console.log("MENSAJE REAL ENCONTRADO: SI");
  console.log("MODO: SIMULACION SIN ENVIO");

  const result = await executeCompanyAgent({
    companyId,
    phone: inbound.contact_phone,
    message: String(inbound.body).trim(),
    currentMessageId: inbound.id,
  });

  console.log("\n=== RESPUESTA GENERADA ===");
  console.log(result.text);
  console.log("ENVIADO A WHATSAPP: NO");
  console.log("=== FIN ===");
}

main().catch((error: unknown) => {
  console.error(
    "ERROR:",
    error instanceof Error ? error.message : "UNKNOWN"
  );
  process.exitCode = 1;
});
