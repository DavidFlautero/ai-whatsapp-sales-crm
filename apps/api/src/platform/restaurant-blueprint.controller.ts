/**
 * Super Admin restaurant blueprint API.
 * This is a read-only readiness view plus an idempotent, disabled-by-default
 * preparation endpoint. It must never enable POS, QR, WhatsApp or fiscal sends.
 */
import type { Request, Response } from "express";
import { supabaseRequest, supabaseRpc } from "../services/db/supabase-rest.client.js";

type Row = Record<string, unknown>;
type Onboarding = { company_id: string; sector: string; status: string };
type Blueprint = {
  company_id: string;
  template_version: number;
  status: string;
  qr_enabled: boolean;
  pos_bridge_enabled: boolean;
  fiscal_enabled: boolean;
  kitchen_verified: boolean;
};
type StepRow = { step_key: string; status: string };
type ModuleRow = { module_key: string; enabled: boolean };
type IntegrationRow = { provider: string; status: string; enabled: boolean };
type MenuRow = { revision: number; payload: { products?: Array<{id?: string}> } | null };
type TableRow = { enabled: boolean };
type MappingRow = { product_id: string; active: boolean; reviewed_at: string | null };

const SETUP_STEPS = [
  { key: "identity", label: "Empresa y propietario" },
  { key: "modules", label: "Módulos contratados" },
  { key: "catalog", label: "Catálogo y precios" },
  { key: "tables_qr", label: "Mesas y códigos QR" },
  { key: "whatsapp", label: "WhatsApp y agente IA" },
  { key: "pos360", label: "POS360 / SmartPOS" },
  { key: "kitchen", label: "Cocina e impresión" },
  { key: "fiscal", label: "Facturación fiscal / DIAN" },
  { key: "acceptance", label: "Piloto y aceptación" },
] as const;

function parseId(req: Request): string | null {
  const id = req.params.companyId;
  return typeof id === "string" &&
    /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(id) ? id : null;
}
function fail(res: Response, code: number, error: string) {
  return res.status(code).setHeader("Cache-Control", "no-store")
    .json({ok: false, error});
}
function isReady(integrations: IntegrationRow[], provider: string) {
  return integrations.some(i =>
    i.provider === provider && i.status === "connected" && i.enabled === true
  );
}

export async function getRestaurantBlueprint(req: Request, res: Response) {
  const companyId = parseId(req);
  if (!companyId) return fail(res, 400, "INVALID_COMPANY_ID");

  try {
    const onboarding = await supabaseRequest<Onboarding[]>({
      table: "platform_company_onboarding",
      query: "?company_id=eq." + encodeURIComponent(companyId) +
        "&select=company_id,sector,status&limit=1",
    });
    if (!onboarding.length) return fail(res, 404, "COMPANY_NOT_PROVISIONED");
    if (onboarding[0].sector !== "restaurant")
      return fail(res, 409, "COMPANY_NOT_RESTAURANT");

    const [blueprints, steps, modules, integrations, menus, tables, mappings] =
      await Promise.all([
        supabaseRequest<Blueprint[]>({
          table: "platform_restaurant_blueprints",
          query: "?company_id=eq." + encodeURIComponent(companyId) +
            "&select=company_id,template_version,status,qr_enabled,pos_bridge_enabled,fiscal_enabled,kitchen_verified&limit=1",
        }),
        supabaseRequest<StepRow[]>({
          table: "platform_restaurant_setup_steps",
          query: "?company_id=eq." + encodeURIComponent(companyId) +
            "&select=step_key,status&limit=20",
        }),
        supabaseRequest<ModuleRow[]>({
          table: "platform_company_modules",
          query: "?company_id=eq." + encodeURIComponent(companyId) +
            "&select=module_key,enabled&limit=40",
        }),
        supabaseRequest<IntegrationRow[]>({
          table: "company_integrations",
          query: "?company_id=eq." + encodeURIComponent(companyId) +
            "&select=provider,status,enabled&limit=30",
        }),
        supabaseRequest<MenuRow[]>({
          table: "restaurant_menu_documents",
          query: "?company_id=eq." + encodeURIComponent(companyId) +
            "&select=revision,payload&limit=1",
        }),
        supabaseRequest<TableRow[]>({
          table: "restaurant_ops_qr_tables",
          query: "?company_id=eq." + encodeURIComponent(companyId) +
            "&select=enabled&limit=500",
        }),
        supabaseRequest<MappingRow[]>({
          table: "restaurant_ops_pos_product_map",
          query: "?company_id=eq." + encodeURIComponent(companyId) +
            "&provider=eq.pos360&select=product_id,active,reviewed_at&limit=2000",
        }),
      ]);

    const blueprint = blueprints[0] ?? null;
    const rawProducts = menus[0]?.payload?.products;
    const products = Array.isArray(rawProducts) ? rawProducts : [];
    const productIds = new Set(products.filter(p => typeof p?.id === "string").map(p => String(p.id)));
    const reviewed = new Set(
      mappings.filter(m => m.active && m.reviewed_at && productIds.has(m.product_id))
        .map(m => m.product_id),
    );
    const moduleMap = Object.fromEntries(modules.map(m => [m.module_key, m.enabled === true]));
    const providerMap = Object.fromEntries(integrations.map(i => [
      i.provider, { registered: true, enabled: i.enabled, status: i.status },
    ]));
    const prepared = Boolean(blueprint);
    const liveQr = blueprint?.qr_enabled === true;
    const livePos = blueprint?.pos_bridge_enabled === true;
    const liveFiscal = blueprint?.fiscal_enabled === true;
    const kitchenVerified = blueprint?.kitchen_verified === true;

    const checks: Record<string, boolean> = {
      identity: onboarding[0].status === "active",
      modules: modules.some(m => m.enabled),
      catalog: productIds.size > 0,
      tables_qr: tables.some(t => t.enabled) && moduleMap.qr === true && liveQr,
      whatsapp: isReady(integrations, "whapi") && moduleMap.whatsapp === true,
      pos360: isReady(integrations, "pos360") &&
        productIds.size > 0 && reviewed.size === productIds.size && livePos,
      kitchen: kitchenVerified && moduleMap.kitchen === true,
      fiscal: isReady(integrations, "dian") && liveFiscal && moduleMap.fiscal === true,
      acceptance: false, // Requires a separate verified end-to-end release workflow.
    };

    const storedStatus = new Map(steps.map(s => [s.step_key, s.status]));
    const outputSteps = SETUP_STEPS.map(s => ({
      ...s,
      configured: checks[s.key],
      recordedStatus: storedStatus.get(s.key) ?? "pending",
      productionVerified: s.key === "acceptance" ? false : checks[s.key],
    }));
    const blockers = outputSteps.filter(s => !s.configured).map(s => s.key);

    return res.setHeader("Cache-Control", "no-store").json({
      ok: true,
      data: {
        companyId,
        sector: "restaurant",
        prepared,
        templateVersion: blueprint?.template_version ?? null,
        status: blueprint?.status ?? "not_prepared",
        activation: {
          qr: liveQr,
          posBridge: livePos,
          fiscal: liveFiscal,
          kitchenVerified,
        },
        steps: outputSteps,
        modules: moduleMap,
        integrations: providerMap,
        menu: { products: productIds.size, revision: menus[0]?.revision ?? null },
        tables: { configured: tables.length, enabled: tables.filter(t => t.enabled).length },
        pos360Mappings: { reviewed: reviewed.size, required: productIds.size },
        blockers,
        productionReady: false,
        productionNotice: "No se ha validado la recepción nativa SmartPOS, cocina, ni la emisión fiscal. El alta no activa estos sistemas.",
      },
    });
  } catch {
    console.error("[RESTAURANT BLUEPRINT] readiness query failed");
    return fail(res, 503, "RESTAURANT_BLUEPRINT_UNAVAILABLE");
  }
}

export async function prepareRestaurantBlueprint(req: Request, res: Response) {
  const companyId = parseId(req);
  if (!companyId) return fail(res, 400, "INVALID_COMPANY_ID");
  // No configuration flags or secrets may be submitted through this endpoint.
  if (!req.is("application/json") || !req.body ||
      Object.keys(req.body as Row).length !== 0)
    return fail(res, 400, "EMPTY_JSON_REQUIRED");

  try {
    const result = await supabaseRpc<Record<string, unknown>>(
      "platform_prepare_restaurant_blueprint",
      { p_company_id: companyId },
    );
    return res.setHeader("Cache-Control", "no-store")
      .status(200).json({ok: true, data: result});
  } catch {
    console.error("[RESTAURANT BLUEPRINT] preparation failed");
    return fail(res, 409, "RESTAURANT_BLUEPRINT_PREPARE_FAILED");
  }
}
