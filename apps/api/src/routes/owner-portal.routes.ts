import { ownerWorkspaceRoutes } from "./owner-workspace.routes.js";
import { createHash, randomBytes } from "node:crypto";
import { Router, type Request } from "express";
import { ownerCredentialsRoutes } from "./owner-credentials.routes.js";
import { supabaseRequest, supabaseRpc } from "../services/db/supabase-rest.client.js";

export const ownerInvitationRoutes = Router();
export const ownerPortalRoutes = Router();
ownerPortalRoutes.use(ownerWorkspaceRoutes);
ownerPortalRoutes.use(ownerCredentialsRoutes);

const COOKIE_NAME = "em_owner_session";
const DAY = 86400000;
const ADMIN_ROLES = new Set([
  "superadmin", "owner", "admin", "supervisor",
]);

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function companyId(req: Request) {
  return String(req.tenantContext?.effectiveCompanyId ?? "");
}

type Provider = {
  id: string;
  company_id: string;
  name: string;
  whatsapp: string | null;
  status: string;
};

type Invitation = {
  id: string;
  company_id: string;
  provider_id: string;
  expires_at: string;
};

type OwnerSession = {
  company_id: string;
  provider_id: string;
};

async function findProvider(company: string, providerId: string) {
  const rows = await supabaseRequest<Provider[]>({
    table: "crm_providers",
    query:
      `?id=eq.${providerId}`
      + `&company_id=eq.${encodeURIComponent(company)}`
      + "&select=id,company_id,name,whatsapp,status"
      + "&limit=1",
  });

  return rows[0] ?? null;
}

// ADMINISTRACIÓN: crear invitación sin enviar WhatsApp.
ownerInvitationRoutes.post("/", async (req, res) => {
  try {
    if (
      !req.authUser ||
      !ADMIN_ROLES.has(req.authUser.role)
    ) {
      return res.status(403).json({
        ok: false,
        error: "ADMIN_REQUIRED",
      });
    }

    const company = companyId(req);
    const providerId = String(req.body?.providerId ?? "");
    const confirmed = req.body?.confirmWhatsapp === true;
    const confirmedOwnership = req.body?.confirmOwnership === true;

    if (!company || !uuidPattern.test(providerId) || !confirmed || !confirmedOwnership) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_INVITATION_REQUEST",
      });
    }

    const provider = await findProvider(company, providerId);

    if (
      !provider ||
      provider.status !== "active" ||
      !provider.whatsapp?.trim()
    ) {
      return res.status(422).json({
        ok: false,
        error: "PROVIDER_NOT_READY",
      });
    }

    const venues = await supabaseRequest<Array<{ id: string }>>({
      table: "crm_venues",
      query:
        `?company_id=eq.${encodeURIComponent(company)}`
        + `&provider_id=eq.${providerId}`
        + "&select=id&limit=1",
    });

    if (!venues.length) {
      return res.status(422).json({
        ok: false,
        error: "PROVIDER_HAS_NO_VENUES",
      });
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + DAY).toISOString();

    await supabaseRequest({
      table: "crm_venue_owner_invitations",
      method: "POST",
      body: {
        company_id: company,
        provider_id: providerId,
        token_hash: hashToken(token),
        expires_at: expiresAt,
      },
    });

    res.setHeader("Cache-Control", "no-store");

    return res.status(201).json({
      ok: true,
      providerId,
      expiresAt,
      inviteToken: token,
    });
  } catch (error) {
    console.error("[OWNER INVITATION]", error);
    return res.status(503).json({
      ok: false,
      error: "INVITATION_FAILED",
    });
  }
});


// OWNER_INVITATION_CANDIDATES_V1
ownerInvitationRoutes.get("/candidates", async (req, res) => {
  try {
    if (!req.authUser || !ADMIN_ROLES.has(req.authUser.role)) {
      return res.status(403).json({
        ok: false, error: "ADMIN_REQUIRED",
      });
    }

    const company = companyId(req);

    if (!company) {
      return res.status(400).json({
        ok: false, error: "COMPANY_REQUIRED",
      });
    }

    const venues = await supabaseRequest<
      Array<{ id: string; provider_id: string | null }>
    >({
      table: "crm_venues",
      query:
        `?company_id=eq.${encodeURIComponent(company)}`
        + "&provider_id=not.is.null"
        + "&select=id,provider_id&limit=1000",
    });

    const ids = [...new Set(
      venues.map(v => v.provider_id).filter(
        (id): id is string => Boolean(id && uuidPattern.test(id))
      )
    )];

    if (!ids.length) {
      return res.json({ ok: true, providers: [] });
    }

    const providers = await supabaseRequest<Provider[]>({
      table: "crm_providers",
      query:
        `?company_id=eq.${encodeURIComponent(company)}`
        + `&id=in.(${ids.join(",")})`
        + "&select=id,company_id,name,whatsapp,status"
        + "&limit=1000",
    });

    const result = providers.map(provider => {
      const digits = String(provider.whatsapp ?? "")
        .replace(/\\D/g, "");

      return {
        id: provider.id,
        name: provider.name,
        status: provider.status,
        whatsappRegistered: digits.length > 0,
        whatsappLast3: digits ? digits.slice(-3) : null,
        venuesCount: venues.filter(
          venue => venue.provider_id === provider.id
        ).length,
      };
    });

    result.sort((a, b) => a.name.localeCompare(b.name));

    res.setHeader("Cache-Control", "no-store");

    return res.json({ ok: true, providers: result });
  } catch (error) {
    console.error(
      "[OWNER CANDIDATES]",
      error instanceof Error ? error.message : "unknown"
    );

    return res.status(503).json({
      ok: false, error: "CANDIDATES_UNAVAILABLE",
    });
  }
});

// OWNER_ATOMIC_REDEEM_V2

// Canjear invitación mediante una única transacción en Supabase.
ownerPortalRoutes.post("/auth/redeem", async (req, res) => {
  try {
    const token = req.body?.inviteToken;

    if (
      typeof token !== "string" ||
      token.length < 32 ||
      token.length > 256
    ) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_INVITATION",
      });
    }

    const sessionToken = randomBytes(32).toString("base64url");

    const redeemed = await supabaseRpc<
      Array<Pick<Invitation, "company_id" | "provider_id">>
    >(
      "crm_owner_redeem_invitation",
      {
        p_invitation_hash: hashToken(token),
        p_session_hash: hashToken(sessionToken),
        p_session_expires_at:
          new Date(Date.now() + 7 * DAY).toISOString(),
      },
    );

    if (!Array.isArray(redeemed) || redeemed.length !== 1) {
      return res.status(401).json({
        ok: false,
        error: "INVITATION_EXPIRED_OR_USED",
      });
    }

    res.cookie(COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * DAY,
    });

    res.setHeader("Cache-Control", "no-store");

    return res.json({
      ok: true,
      authenticated: true,
    });

  } catch (error) {
    console.error(
      "[OWNER REDEEM]",
      error instanceof Error ? error.message : "unknown",
    );

    return res.status(503).json({
      ok: false,
      error: "OWNER_AUTH_UNAVAILABLE",
    });
  }
});

async function authenticatedOwner(
  req: Request,
): Promise<OwnerSession | null> {
  const token = req.cookies?.[COOKIE_NAME];

  if (typeof token !== "string" || token.length < 32) {
    return null;
  }

  const sessions = await supabaseRequest<OwnerSession[]>({
    table: "crm_venue_owner_sessions",
    query:
      `?token_hash=eq.${hashToken(token)}`
      + "&revoked_at=is.null"
      + `&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`
      + "&select=company_id,provider_id"
      + "&limit=1",
  });

  const session = sessions[0];

  if (!session) return null;

  const provider = await findProvider(
    session.company_id,
    session.provider_id,
  );

  if (!provider || provider.status !== "active") {
    return null;
  }

  return session;
}

// PROPIETARIO: identidad.
ownerPortalRoutes.get("/me", async (req, res) => {
  try {
    const owner = await authenticatedOwner(req);

    if (!owner) {
      return res.status(401).json({
        ok: false,
        error: "OWNER_AUTH_REQUIRED",
      });
    }

    res.setHeader("Cache-Control", "no-store");

    return res.json({
      ok: true,
      providerId: owner.provider_id,
    });
  } catch (error) {
    console.error("[OWNER ME]", error);
    return res.status(503).json({
      ok: false,
      error: "OWNER_SESSION_UNAVAILABLE",
    });
  }
});

// PROPIETARIO: solamente sus chalets.
ownerPortalRoutes.get("/venues", async (req, res) => {
  try {
    const owner = await authenticatedOwner(req);

    if (!owner) {
      return res.status(401).json({
        ok: false,
        error: "OWNER_AUTH_REQUIRED",
      });
    }

    const venues = await supabaseRequest({
      table: "crm_venues",
      query:
        `?company_id=eq.${encodeURIComponent(owner.company_id)}`
        + `&provider_id=eq.${owner.provider_id}`
        + "&select=id,name,slug,status,province,city,"
        + "capacity_min,capacity_max"
        + "&order=name.asc",
    });

    res.setHeader("Cache-Control", "no-store");

    return res.json({
      ok: true,
      venues,
    });
  } catch (error) {
    console.error("[OWNER VENUES]", error);
    return res.status(503).json({
      ok: false,
      error: "OWNER_VENUES_UNAVAILABLE",
    });
  }
});


// OWNER_PORTAL_EXTRA_V1

// Cerrar la sesión privada del propietario.
ownerPortalRoutes.post("/auth/logout", async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];

  try {
    if (typeof token === "string" && token.length >= 32) {
      await supabaseRequest({
        table: "crm_venue_owner_sessions",
        method: "PATCH",
        query:
          `?token_hash=eq.${hashToken(token)}`
          + "&revoked_at=is.null",
        body: {
          revoked_at: new Date().toISOString(),
        },
      });
    }

    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });

    res.setHeader("Cache-Control", "no-store");

    return res.json({
      ok: true,
      authenticated: false,
    });
  } catch (error) {
    console.error("[OWNER LOGOUT]", error);

    return res.status(503).json({
      ok: false,
      error: "LOGOUT_UNAVAILABLE",
    });
  }
});

// Calendario privado, limitado a los chalets del propietario.
ownerPortalRoutes.get(
  "/venues/:venueId/calendar",
  async (req, res) => {
    try {
      const owner = await authenticatedOwner(req);

      if (!owner) {
        return res.status(401).json({
          ok: false,
          error: "OWNER_AUTH_REQUIRED",
        });
      }

      const venueId = String(req.params.venueId ?? "");
      const from = String(req.query.from ?? "");
      const to = String(req.query.to ?? "");

      const validDate = (value: string) =>
        /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)
        && Number.isFinite(Date.parse(value));

      const duration = Date.parse(to) - Date.parse(from);

      if (
        !uuidPattern.test(venueId) ||
        !validDate(from) ||
        !validDate(to) ||
        duration <= 0 ||
        duration > 120 * DAY
      ) {
        return res.status(400).json({
          ok: false,
          error: "INVALID_CALENDAR_QUERY",
        });
      }

      const venues = await supabaseRequest<
        Array<{ id: string }>
      >({
        table: "crm_venues",
        query:
          `?id=eq.${venueId}`
          + `&company_id=eq.${encodeURIComponent(owner.company_id)}`
          + `&provider_id=eq.${owner.provider_id}`
          + "&select=id&limit=1",
      });

      if (!venues.length) {
        return res.status(404).json({
          ok: false,
          error: "VENUE_NOT_FOUND",
        });
      }

      const blocks = await supabaseRequest<
        Array<{
          starts_at: string;
          ends_at: string;
          status: string;
        }>
      >({
        table: "crm_venue_calendar_blocks",
        query:
          `?company_id=eq.${encodeURIComponent(owner.company_id)}`
          + `&venue_id=eq.${venueId}`
          + "&status=in.(blocked,held,reserved)"
          + `&starts_at=lt.${encodeURIComponent(to)}`
          + `&ends_at=gt.${encodeURIComponent(from)}`
          + "&select=starts_at,ends_at,status"
          + "&order=starts_at.asc",
      });

      res.setHeader("Cache-Control", "no-store");

      return res.json({
        ok: true,
        venueId,
        unavailable: blocks.map((block) => ({
          startsAt: block.starts_at,
          endsAt: block.ends_at,
          status: block.status,
        })),
      });
    } catch (error) {
      console.error("[OWNER CALENDAR]", error);

      return res.status(503).json({
        ok: false,
        error: "OWNER_CALENDAR_UNAVAILABLE",
      });
    }
  },
);
