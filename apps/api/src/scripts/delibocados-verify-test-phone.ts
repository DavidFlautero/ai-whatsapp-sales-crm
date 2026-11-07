/**
 * Preflight for one-phone Delibocados WhatsApp testing.
 * Never prints the Whapi token or full customer phone.
 */
import { config } from "dotenv";

config({ path: "../../.env", quiet: true });

async function main() {
  const expected = String(process.env.DELIBOCADOS_EXPECT_TEST_LAST4 ?? "");
  if (!/^[0-9]{4}$/.test(expected)) {
    throw new Error("TEST_PHONE_LAST4_CONFIRMATION_REQUIRED");
  }
  const [
    { getDelibocadosChannel },
    { supabaseRequest },
    { getOperatorMode, setOperatorMode },
  ] = await Promise.all([
    import("../services/whapi/delibocados-channel.service.js"),
    import("../services/db/supabase-rest.client.js"),
    import("../services/operator/operator.service.js"),
  ]);
  const channel = await getDelibocadosChannel();
  if (!channel.enabled || !/^[0-9]{8,15}$/.test(channel.phone) ||
      !/^[0-9]{8,15}$/.test(channel.testPhone) ||
      channel.phone === channel.testPhone ||
      channel.testPhone.slice(-4) !== expected) {
    throw new Error("TEST_PHONE_DOES_NOT_MATCH_WHAPI_CONFIG");
  }
  const health = await fetch("https://gate.whapi.cloud/health?wakeup=false", {
    headers: { Authorization: "Bearer " + channel.token },
    signal: AbortSignal.timeout(12000),
  });
  if (!health.ok) throw new Error("WHAPI_HEALTH_NOT_READY");
  const data = await health.json() as { user?: { id?: string } };
  const from = String(data.user?.id ?? "").split("@")[0].replace(/\D/g, "");
  if (from !== channel.phone) throw new Error("WHAPI_SENDER_MISMATCH");

  const migrations = await supabaseRequest<{ version: string }[]>({
    table: "commerce_schema_migrations",
    query: "?version=in.(20261106170000,20261106200000,20261107103000,20261107124500)&select=version",
  });
  const installed = new Set(migrations.map(x => x.version));
  if (["20261106170000","20261106200000","20261107103000","20261107124500"]
      .some(version=>!installed.has(version))) {
    throw new Error("RESTAURANT_OPERATIONS_MIGRATIONS_NOT_INSTALLED");
  }
  const menu = await supabaseRequest<Array<{ payload?: {
    products?: Array<{ id?: string; available?: boolean; priceCOP?: number;
      priceNeedsReview?: boolean }>;
  } }>>({
    table: "restaurant_menu_documents",
    query: "?company_id=eq.delibocados&select=payload&limit=1",
  });
  const validProducts = (menu[0]?.payload?.products ?? []).filter(product =>
    product.id && product.available !== false && product.priceNeedsReview !== true &&
    Number.isSafeInteger(Number(product.priceCOP)) && Number(product.priceCOP) >= 0
  );
  if (!validProducts.length) throw new Error("NO_PUBLISHED_MENU_PRODUCTS_FOR_TEST");
  const current = await getOperatorMode(channel.testPhone, "delibocados");
  if (current.status !== "ai") {
    await setOperatorMode({
      companyId: "delibocados", contactPhone: channel.testPhone,
      status: "ai", reason: "Controlled single-phone restaurant checkout test",
    });
  }
  console.log("WHAPI: canal conectado y emisor validado");
  console.log("NUMERO AUTORIZADO: ****" + channel.testPhone.slice(-4));
  console.log("MENU: " + validProducts.length + " productos con precio válido");
  console.log("OPERADOR DE PRUEBA: modo IA");
  console.log("PRECHECK: OK; no se enviaron mensajes");
}
await main();
