import {
  hydrateIntegrationSecrets,
} from "../services/integrations/integration-secrets.repository.js";

import {
  getCompanyCatalog,
} from "../services/agent/company-catalog.service.js";

import {
  loadCompanyAgentProfile,
} from "../services/agent/company-agent-profile.repository.js";

import {
  previewCompanyAgent,
} from "../services/agent/company-agent-runtime.service.js";

async function main() {
  const companyId = "delibocados";

  await hydrateIntegrationSecrets();

  const profile = await loadCompanyAgentProfile(companyId);

  const raw = await getCompanyCatalog(companyId);
  const catalog = typeof raw === "string"
    ? JSON.parse(raw)
    : raw;

  if (catalog.companyId !== companyId) {
    throw new Error("CATALOG_TENANT_MISMATCH");
  }

  const products = (
    Array.isArray(catalog.products) ? catalog.products : []
  ).filter((product: any) =>
    typeof product.name === "string" &&
    product.name.trim() &&
    Number.isFinite(Number(product.priceCOP)) &&
    Number(product.priceCOP) > 0
  );

  if (!products.length) {
    throw new Error("CATALOG_NO_VALID_PRODUCTS");
  }

  const sorted = [...products].sort((a: any, b: any) => {
    const relevant = (p: any) =>
      /arepa|rellena/i.test(
        `${p.name} ${p.category ?? ""}`
      ) ? 1 : 0;

    return relevant(b) - relevant(a);
  });

  const catalogText = sorted
    .slice(0, 100)
    .map((p: any) =>
      `${p.category ?? "General"} | ${p.name} | ${p.priceCOP} COP`
    )
    .join("\n")
    .slice(0, 12000);

  console.log("=== CATALOGO REAL ===");
  console.log("EMPRESA:", companyId);
  console.log("PRODUCTOS VALIDOS:", products.length);
  console.log("CONTEXTO DISPONIBLE:", catalogText.length > 0);

  const result = await previewCompanyAgent({
    companyId,
    profile: {
      ...profile,
      verifiedContext: [
        profile.verifiedContext,
        "CATALOGO REAL DEL RESTAURANTE:",
        catalogText,
        "No inventes productos, precios ni disponibilidad.",
        "No confirmes pedidos sin registrar."
      ].join("\n"),
    },
    message: "Hola, quisiera dos arepas rellenas por favor.",
    history: [],
  });

  console.log("\n=== RESPUESTA CON CATALOGO ===");
  console.log(result.reply);
  console.log("\nMODO:", result.mode);
  console.log("=== FIN ===");
}

main().catch((error: unknown) => {
  console.error(
    "ERROR:",
    error instanceof Error ? error.message : "UNKNOWN"
  );
  process.exitCode = 1;
});
