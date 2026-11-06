import type { Request, Response } from "express";
import { z, ZodError } from "zod";
import { supabaseRequest } from "../services/db/supabase-rest.client.js";

export const MODULE_KEYS = [
  "whatsapp", "ai", "orders", "customers",
  "catalog", "qr", "floorplan", "integrations",
] as const;
type ModuleKey = (typeof MODULE_KEYS)[number];
type ModuleMap = Record<ModuleKey, boolean>;
type ModuleRow = { module_key: ModuleKey; enabled: boolean };

const schema = z.object({
  modules: z.object({
    whatsapp: z.boolean(), ai: z.boolean(),
    orders: z.boolean(), customers: z.boolean(),
    catalog: z.boolean(), qr: z.boolean(),
    floorplan: z.boolean(), integrations: z.boolean(),
  }).strict(),
}).strict();

function companyId(req: Request): string | null {
  const value = req.params.companyId;
  if (typeof value !== "string") return null;
  return /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/.test(value)
    ? value : null;
}

function emptyMap(): ModuleMap {
  return Object.fromEntries(MODULE_KEYS.map(key => [key, false])) as ModuleMap;
}

export async function getCompanyModules(req: Request, res: Response) {
  const id = companyId(req);
  if (!id) return res.status(400).json({ ok: false, error: "INVALID_COMPANY_ID" });
  try {
    const rows = await supabaseRequest<ModuleRow[]>({
      table: "platform_company_modules",
      query: `?company_id=eq.${encodeURIComponent(id)}&select=module_key,enabled`,
    });
    const modules = emptyMap();
    for (const row of rows) {
      if (MODULE_KEYS.includes(row.module_key)) modules[row.module_key] = row.enabled === true;
    }
    res.setHeader("Cache-Control", "no-store");
    return res.json({ ok: true, data: { companyId: id, modules } });
  } catch (error) {
    console.error("[COMPANY MODULES READ]", error);
    return res.status(503).json({ ok: false, error: "MODULE_SETTINGS_UNAVAILABLE" });
  }
}

export async function saveCompanyModules(req: Request, res: Response) {
  const id = companyId(req);
  if (!id) return res.status(400).json({ ok: false, error: "INVALID_COMPANY_ID" });
  let modules: ModuleMap;
  try { modules = schema.parse(req.body).modules; }
  catch (error) {
    if (error instanceof ZodError) return res.status(400).json({ ok: false, error: "INVALID_MODULE_SETTINGS" });
    throw error;
  }
  try {
    const updated_at = new Date().toISOString();
    await supabaseRequest<ModuleRow[]>({
      table: "platform_company_modules",
      method: "POST",
      query: "?on_conflict=company_id,module_key",
      prefer: "resolution=merge-duplicates,return=representation",
      body: MODULE_KEYS.map(module_key => ({
        company_id: id, module_key, enabled: modules[module_key], updated_at,
      })),
    });
    res.setHeader("Cache-Control", "no-store");
    return res.json({ ok: true, data: { companyId: id, modules } });
  } catch (error) {
    console.error("[COMPANY MODULES SAVE]", error);
    return res.status(503).json({ ok: false, error: "MODULE_SETTINGS_SAVE_FAILED" });
  }
}
