import {
  executeCompanyAgent,
} from "../services/agent/company-agent-execution.service.js";

async function main() {
  console.log("=== PRUEBA DELIBOCADOS ===");

  const result = await executeCompanyAgent({
    companyId: "delibocados",
    phone: "573000000000",
    message: "Hola, quiero saber qué hamburguesas tienen",
  });

  console.log("EMPRESA: delibocados");
  console.log("RESPUESTA IA:");
  console.log(result.text);
  console.log("=== FIN ===");
}

main().catch(error => {
  console.error(
    "ERROR:",
    error instanceof Error
      ? error.message
      : String(error)
  );
  process.exitCode = 1;
});
