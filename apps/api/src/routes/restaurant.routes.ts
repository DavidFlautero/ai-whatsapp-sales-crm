import { Router } from "express";
import type { Request, Response } from "express";
import { z, ZodError } from "zod";
import { requirePermission } from "../core/http/permission.middleware.js";
import { supabaseRequest, supabaseRpc } from "../services/db/supabase-rest.client.js";

export const restaurantRoutes = Router();

const uuid = z.string().uuid();
const menuInput = z.object({
  sku: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(180),
  category: z.string().trim().min(1).max(100).default("General"),
  description: z.string().trim().max(1000).nullable().optional(),
  price: z.number().finite().min(0),
}).strict();

const orderInput = z.object({
  // Hasta habilitar webhooks firmados y QR seguros solo admite pedidos del panel.
  order_type: z.enum(["table", "delivery", "pickup"]),
  table_label: z.string().trim().max(50).optional(),
  customer_name: z.string().trim().max(160).optional(),
  customer_phone: z.string().trim().max(40).optional(),
  delivery_address: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1500).optional(),
  idempotency_key: z.string().trim().min(8).max(120),
  lines: z.array(z.object({
    menu_item_id: uuid,
    quantity: z.number().int().min(1).max(100),
    notes: z.string().trim().max(500).optional(),
  }).strict()).min(1).max(100),
}).strict().superRefine((value, ctx) => {
  if (value.order_type === "table" && !value.table_label) {
    ctx.addIssue({ code: "custom", message: "TABLE_REQUIRED", path: ["table_label"] });
  }
  if (value.order_type === "delivery" && !value.delivery_address) {
    ctx.addIssue({ code: "custom", message: "DELIVERY_ADDRESS_REQUIRED", path: ["delivery_address"] });
  }
});

function companyId(req: Request): string {
  const id = req.tenantContext?.effectiveCompanyId;
  if (!id) throw new Error("COMPANY_CONTEXT_NOT_RESOLVED");
  return id;
}

function errorResponse(err: unknown, res: Response) {
  if (err instanceof ZodError) {
    return res.status(400).json({ ok: false, error: "VALIDATION_ERROR", issues: err.issues });
  }
  console.error("[RESTAURANT] operation failed", err);
  return res.status(500).json({ ok: false, error: "RESTAURANT_OPERATION_FAILED" });
}

restaurantRoutes.get("/menu", requirePermission("orders.read"), async (req, res) => {
  try {
    const menu = await supabaseRequest<Record<string, unknown>[]>({
      table: "restaurant_menu_items",
      query: "?company_id=eq." + encodeURIComponent(companyId(req)) + "&active=eq.true&select=*&order=category.asc,name.asc&limit=500",
    });
    return res.json({ ok: true, menu });
  } catch (err) { return errorResponse(err, res); }
});

restaurantRoutes.post("/menu", requirePermission("orders.update"), async (req, res) => {
  try {
    const data = menuInput.parse(req.body);
    const rows = await supabaseRequest<Record<string, unknown>[]>({
      table: "restaurant_menu_items",
      method: "POST",
      body: { ...data, company_id: companyId(req) },
    });
    return res.status(201).json({ ok: true, item: rows[0] });
  } catch (err) { return errorResponse(err, res); }
});

restaurantRoutes.get("/orders", requirePermission("orders.read"), async (req, res) => {
  try {
    const company = encodeURIComponent(companyId(req));
    const status = req.query.status
      ? z.enum(["received","accepted","preparing","ready","completed","cancelled"]).parse(req.query.status)
      : null;
    const orders = await supabaseRequest<Record<string, unknown>[]>({
      table: "restaurant_orders",
      query: "?company_id=eq." + company
        + (status ? "&status=eq." + status : "")
        + "&select=*,restaurant_order_lines(*)&order=created_at.desc&limit=100",
    });
    return res.json({ ok: true, orders });
  } catch (err) { return errorResponse(err, res); }
});

restaurantRoutes.post("/orders", requirePermission("orders.create"), async (req, res) => {
  try {
    const input = orderInput.parse(req.body);
    const orderId = await supabaseRpc<string>("restaurant_create_order", {
      p_company_id: companyId(req),
      p_source: "panel",
      p_order_type: input.order_type,
      p_lines: input.lines,
      p_table_label: input.table_label ?? null,
      p_customer_name: input.customer_name ?? null,
      p_customer_phone: input.customer_phone ?? null,
      p_delivery_address: input.delivery_address ?? null,
      p_notes: input.notes ?? null,
      p_idempotency_key: input.idempotency_key,
    });
    return res.status(201).json({ ok: true, order_id: orderId });
  } catch (err) { return errorResponse(err, res); }
});

restaurantRoutes.patch("/orders/:id/status", requirePermission("orders.update"), async (req, res) => {
  try {
    const orderId = uuid.parse(req.params.id);
    const { status } = z.object({
      status: z.enum(["accepted", "preparing", "ready", "completed", "cancelled"]),
    }).strict().parse(req.body);
    const found = await supabaseRpc<boolean>("restaurant_change_status", {
      p_company_id: companyId(req), p_order_id: orderId, p_status: status,
    });
    if (!found) return res.status(404).json({ ok: false, error: "ORDER_NOT_FOUND" });
    return res.json({ ok: true, status });
  } catch (err) { return errorResponse(err, res); }
});

restaurantRoutes.get("/print-jobs", requirePermission("orders.read"), async (req, res) => {
  try {
    const station = z.enum(["kitchen","cashier"]).parse(req.query.station);
    const company = encodeURIComponent(companyId(req));
    const jobs = await supabaseRequest<Record<string, unknown>[]>({
      table: "restaurant_print_jobs",
      query: "?company_id=eq." + company
        + "&station=eq." + station
        + "&status=eq.pending&select=*&order=created_at.asc&limit=25",
    });
    if (jobs.length === 0) return res.json({ ok: true, jobs: [] });
    const ids = jobs.map(j => String(j.order_id));
    const orders = await supabaseRequest<Record<string, unknown>[]>({
      table: "restaurant_orders",
      query: "?company_id=eq." + company
        + "&id=in.(" + ids.map(encodeURIComponent).join(",") + ")"
        + "&select=*,restaurant_order_lines(*)&limit=25",
    });
    const byId = new Map(orders.map(order => [String(order.id), order]));
    return res.json({ ok: true, jobs: jobs.map(job => ({
      ...job, order: byId.get(String(job.order_id)) ?? null,
    })) });
  } catch (err) { return errorResponse(err, res); }
});

restaurantRoutes.post("/print-jobs/:id/printed", requirePermission("orders.update"), async (req, res) => {
  try {
    const jobId = uuid.parse(req.params.id);
    const updated = await supabaseRequest<Record<string, unknown>[]>({
      table: "restaurant_print_jobs",
      method: "PATCH",
      query: "?id=eq." + encodeURIComponent(jobId)
        + "&company_id=eq." + encodeURIComponent(companyId(req))
        + "&status=eq.pending&select=id",
      body: { status: "printed", printed_at: new Date().toISOString(), attempts: 1 },
    });
    if (!updated.length) return res.status(404).json({
      ok: false, error: "PENDING_PRINT_JOB_NOT_FOUND",
    });
    return res.json({ ok: true });
  } catch (err) { return errorResponse(err, res); }
});
