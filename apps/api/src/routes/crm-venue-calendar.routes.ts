import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { supabaseRequest } from "../services/db/supabase-rest.client.js";

export const crmVenueCalendarRoutes = Router();

const roles = new Set(["superadmin", "owner", "admin", "supervisor"]);
const iso = z.string().datetime({ offset: true });
const enc = encodeURIComponent;

function access(req: Request, res: Response): string | null {
  if (!req.authUser || !roles.has(req.authUser.role)) {
    res.status(403).json({ ok: false, error: "ADMIN_REQUIRED" });
    return null;
  }
  const tenant = req.tenantContext?.effectiveCompanyId;
  if (!tenant) {
    res.status(403).json({ ok: false, error: "TENANT_REQUIRED" });
    return null;
  }
  return tenant;
}

function failure(error: unknown, res: Response) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ ok: false, error: "INVALID_CALENDAR_INPUT" });
  }
  console.error("[VENUE CALENDAR ERROR]", error instanceof Error ? error.message : "unknown");
  return res.status(500).json({ ok: false, error: "CALENDAR_OPERATION_FAILED" });
}

async function venueExists(tenant: string, venueId: string) {
  const rows = await supabaseRequest<Array<{ id: string }>>({
    table: "crm_venues",
    query: `?company_id=eq.${enc(tenant)}&id=eq.${enc(venueId)}&select=id&limit=1`,
  });
  return rows.length > 0;
}

async function eventExists(tenant: string, eventId: string) {
  const rows = await supabaseRequest<Array<{ id: string }>>({
    table: "crm_events",
    query: `?company_id=eq.${enc(tenant)}&id=eq.${enc(eventId)}&select=id&limit=1`,
  });
  return rows.length > 0;
}

async function conflicts(tenant: string, venueId: string, from: string, to: string) {
  return supabaseRequest<Array<{ id: string }>>({
    table: "crm_venue_calendar_blocks",
    query:
      `?company_id=eq.${enc(tenant)}`
      + `&venue_id=eq.${enc(venueId)}`
      + "&status=in.(blocked,held,reserved)"
      + `&starts_at=lt.${enc(to)}`
      + `&ends_at=gt.${enc(from)}`
      + "&select=id&limit=1",
  });
}

crmVenueCalendarRoutes.get("/venues/:venueId/calendar", async (req, res) => {
  const tenant = access(req, res);
  if (!tenant) return;

  try {
    const venueId = z.string().uuid().parse(req.params.venueId);
    const { from, to } = z.object({ from: iso, to: iso }).parse(req.query);

    const duration = Date.parse(to) - Date.parse(from);
    if (duration <= 0 || duration > 370 * 86400000) {
      return res.status(400).json({ ok: false, error: "INVALID_DATE_RANGE" });
    }

    if (!(await venueExists(tenant, venueId))) {
      return res.status(404).json({ ok: false, error: "VENUE_NOT_FOUND" });
    }

    const blocks = await supabaseRequest<Record<string, unknown>[]>({
      table: "crm_venue_calendar_blocks",
      query:
        `?company_id=eq.${enc(tenant)}`
        + `&venue_id=eq.${enc(venueId)}`
        + `&starts_at=lt.${enc(to)}`
        + `&ends_at=gt.${enc(from)}`
        + "&order=starts_at.asc",
    });

    return res.json({ ok: true, venueId, blocks });
  } catch (error) {
    return failure(error, res);
  }
});

crmVenueCalendarRoutes.post("/venues/:venueId/calendar/blocks", async (req, res) => {
  const tenant = access(req, res);
  if (!tenant) return;

  try {
    const venueId = z.string().uuid().parse(req.params.venueId);
    const body = z.object({
      startsAt: iso,
      endsAt: iso,
      status: z.enum(["blocked", "held"]).default("blocked"),
      eventId: z.string().uuid().optional(),
      holdExpiresAt: iso.optional(),
      notes: z.string().max(1000).optional(),
    }).strict().parse(req.body);

    if (Date.parse(body.endsAt) <= Date.parse(body.startsAt)) {
      return res.status(400).json({ ok: false, error: "INVALID_DATE_RANGE" });
    }

    if (!(await venueExists(tenant, venueId))) {
      return res.status(404).json({ ok: false, error: "VENUE_NOT_FOUND" });
    }

    if (body.eventId && !(await eventExists(tenant, body.eventId))) {
      return res.status(404).json({ ok: false, error: "EVENT_NOT_FOUND" });
    }

    if (body.status === "held" && (
      !body.eventId ||
      !body.holdExpiresAt ||
      Date.parse(body.holdExpiresAt) <= Date.now()
    )) {
      return res.status(400).json({ ok: false, error: "INVALID_HOLD" });
    }

    if ((await conflicts(tenant, venueId, body.startsAt, body.endsAt)).length) {
      return res.status(409).json({ ok: false, error: "VENUE_DATE_CONFLICT" });
    }

    let rows: Record<string, unknown>[];

    try {
      rows = await supabaseRequest<Record<string, unknown>[]>({
        table: "crm_venue_calendar_blocks",
        method: "POST",
        prefer: "return=representation",
        body: [{
          company_id: tenant,
          venue_id: venueId,
          event_id: body.eventId ?? null,
          starts_at: body.startsAt,
          ends_at: body.endsAt,
          status: body.status,
          hold_expires_at: body.status === "held" ? body.holdExpiresAt : null,
          notes: body.notes ?? null,
        }],
      });
    } catch (error) {
      if ((await conflicts(tenant, venueId, body.startsAt, body.endsAt)).length) {
        return res.status(409).json({ ok: false, error: "VENUE_DATE_CONFLICT" });
      }
      throw error;
    }

    return res.status(201).json({ ok: true, block: rows[0] });
  } catch (error) {
    return failure(error, res);
  }
});

crmVenueCalendarRoutes.patch("/venues/:venueId/calendar/blocks/:blockId/cancel", async (req, res) => {
  const tenant = access(req, res);
  if (!tenant) return;

  try {
    const venueId = z.string().uuid().parse(req.params.venueId);
    const blockId = z.string().uuid().parse(req.params.blockId);

    if (!(await venueExists(tenant, venueId))) {
      return res.status(404).json({ ok: false, error: "VENUE_NOT_FOUND" });
    }

    const rows = await supabaseRequest<Record<string, unknown>[]>({
      table: "crm_venue_calendar_blocks",
      method: "PATCH",
      query:
        `?company_id=eq.${enc(tenant)}`
        + `&venue_id=eq.${enc(venueId)}`
        + `&id=eq.${enc(blockId)}`
        + "&status=in.(blocked,held)",
      prefer: "return=representation",
      body: { status: "cancelled", updated_at: new Date().toISOString() },
    });

    if (!rows.length) {
      return res.status(404).json({ ok: false, error: "ACTIVE_BLOCK_NOT_FOUND" });
    }

    return res.json({ ok: true, block: rows[0] });
  } catch (error) {
    return failure(error, res);
  }
});
