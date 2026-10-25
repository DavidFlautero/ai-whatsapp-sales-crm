import {
  randomBytes,
} from "node:crypto";

import {
  Router,
} from "express";

import {
  z,
} from "zod";

import {
  requireRoles,
} from "../../middlewares/auth.middleware.js";

import {
  readIntegrationSecrets,
  saveIntegrationConfig,
} from "../../services/integrations/integration-secrets.repository.js";

import {
  deleteGoogleCalendarEvent,
  exchangeGoogleAuthorizationCode,
  listGoogleCalendarEvents,
  listGoogleCalendars,
  syncCrmEventToGoogle,
} from "../../services/integrations/google-calendar.service.js";

import {
  supabaseRequest,
} from "../../services/db/supabase-rest.client.js";


export const adminGoogleCalendarRoutes =
  Router();


const oauthStates =
  new Map<
    string,
    {
      userId: string;
      expiresAt: number;
      redirectUri: string;
    }
  >();


function actor(
  req: Parameters<
    typeof adminGoogleCalendarRoutes.get
  >[1] extends never
    ? never
    : any,
) {
  if (!req.authUser) {
    throw new Error(
      "AUTHENTICATED_USER_REQUIRED",
    );
  }

  return {
    id:
      req.authUser.id,

    email:
      req.authUser.email,
  };
}


function tenantId(
  req: any,
) {
  const tenant =
    req.authUser
      ?.companyId
      ?.trim()
    || req
      .header(
        "x-company-id",
      )
      ?.trim();

  if (!tenant) {
    throw new Error(
      "COMPANY_ID_REQUIRED",
    );
  }

  return tenant;
}


function externalOrigin(
  req: any,
) {
  const proto =
    String(
      req.headers[
        "x-forwarded-proto"
      ]
      || req.protocol
      || "https",
    )
      .split(",")[0]
      .trim();

  const host =
    String(
      req.headers[
        "x-forwarded-host"
      ]
      || req.headers.host
      || "",
    )
      .split(",")[0]
      .trim();

  if (!host) {
    throw new Error(
      "PUBLIC_HOST_REQUIRED",
    );
  }

  return `${proto}://${host}`;
}


adminGoogleCalendarRoutes.get(
  "/connect-url",

  requireRoles(
    "superadmin",
    "owner",
    "admin",
  ),

  async (req, res) => {
    try {
      const integrations =
        await readIntegrationSecrets();

      const current =
        integrations
          .google_calendar;

      if (
        !current.clientId
        || !current.clientSecret
      ) {
        return res
          .status(400)
          .json({
            ok: false,
            error:
              "GOOGLE_CALENDAR_NOT_CONFIGURED",
          });
      }

      const origin =
        externalOrigin(req);

      const redirectUri =
        `${origin}/api/admin/google-calendar/callback`;

      const state =
        randomBytes(24)
          .toString("hex");

      oauthStates.set(
        state,
        {
          userId:
            req.authUser!.id,

          expiresAt:
            Date.now()
            + 10 * 60 * 1000,

          redirectUri,
        },
      );

      const params =
        new URLSearchParams({
          client_id:
            current.clientId,

          redirect_uri:
            redirectUri,

          response_type:
            "code",

          access_type:
            "offline",

          prompt:
            "consent",

          include_granted_scopes:
            "true",

          scope: [
            "https://www.googleapis.com/auth/calendar.events",
            "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
          ].join(" "),

          state,
        });

      return res.json({
        ok: true,

        url:
          `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      });
    } catch (error) {
      console.error(
        "[GOOGLE CALENDAR CONNECT]",
        error,
      );

      return res
        .status(500)
        .json({
          ok: false,
          error:
            "GOOGLE_CALENDAR_CONNECT_ERROR",
        });
    }
  },
);


adminGoogleCalendarRoutes.get(
  "/callback",

  requireRoles(
    "superadmin",
    "owner",
    "admin",
  ),

  async (req, res) => {
    try {
      const code =
        z.string()
          .min(1)
          .parse(
            req.query.code,
          );

      const state =
        z.string()
          .min(1)
          .parse(
            req.query.state,
          );

      const stored =
        oauthStates.get(
          state,
        );

      oauthStates.delete(
        state,
      );

      if (
        !stored
        || stored.expiresAt
          < Date.now()
        || stored.userId
          !== req.authUser!.id
      ) {
        return res
          .status(400)
          .send(
            "Estado OAuth inválido o vencido.",
          );
      }

      const token =
        await exchangeGoogleAuthorizationCode(
          code,
          stored.redirectUri,
        );

      const existing =
        await readIntegrationSecrets();

      const refreshToken =
        token.refresh_token
        || existing
          .google_calendar
          .refreshToken;

      if (!refreshToken) {
        throw new Error(
          "GOOGLE_REFRESH_TOKEN_NOT_RETURNED",
        );
      }

      await saveIntegrationConfig(
        "google_calendar",
        {
          refreshToken,
        },
        actor(req),
      );

      const calendars =
        await listGoogleCalendars();

      const primary =
        calendars.find(
          (calendar) =>
            calendar.primary,
        )
        || calendars[0];

      if (primary) {
        await saveIntegrationConfig(
          "google_calendar",
          {
            calendarId:
              primary.id,

            calendarName:
              primary.summary
              || primary.id,

            timeZone:
              primary.timeZone
              || existing
                .google_calendar
                .timeZone
              || "Europe/Madrid",

            connectedEmail:
              primary.primary
                ? primary.id
                : "",
          },
          actor(req),
        );
      }

      const origin =
        externalOrigin(req);

      return res.redirect(
        `${origin}/integrations?googleCalendar=connected`,
      );
    } catch (error) {
      console.error(
        "[GOOGLE CALENDAR CALLBACK]",
        error,
      );

      return res
        .status(500)
        .send(
          "No se pudo conectar Google Calendar.",
        );
    }
  },
);


adminGoogleCalendarRoutes.get(
  "/calendars",

  requireRoles(
    "superadmin",
    "owner",
    "admin",
  ),

  async (_req, res) => {
    try {
      const calendars =
        await listGoogleCalendars();

      return res.json({
        ok: true,
        calendars,
      });
    } catch (error) {
      console.error(
        "[GOOGLE CALENDAR LIST]",
        error,
      );

      return res
        .status(500)
        .json({
          ok: false,
          error:
            "GOOGLE_CALENDAR_LIST_ERROR",
        });
    }
  },
);


adminGoogleCalendarRoutes.post(
  "/calendar",

  requireRoles(
    "superadmin",
    "owner",
    "admin",
  ),

  async (req, res) => {
    try {
      const input =
        z.object({
          calendarId:
            z.string()
              .trim()
              .min(1),

          calendarName:
            z.string()
              .trim()
              .optional(),

          timeZone:
            z.string()
              .trim()
              .optional(),
        })
          .parse(
            req.body,
          );

      const data =
        await saveIntegrationConfig(
          "google_calendar",
          input,
          actor(req),
        );

      return res.json({
        ok: true,
        data,
      });
    } catch (error) {
      console.error(
        "[GOOGLE CALENDAR SELECT]",
        error,
      );

      return res
        .status(400)
        .json({
          ok: false,
          error:
            "GOOGLE_CALENDAR_SELECT_ERROR",
        });
    }
  },
);


adminGoogleCalendarRoutes.get(
  "/events",

  requireRoles(
    "superadmin",
    "owner",
    "admin",
  ),

  async (req, res) => {
    try {
      const timeMin =
        typeof req.query.timeMin
          === "string"
        && req.query.timeMin
          ? req.query.timeMin
          : new Date()
              .toISOString();

      const timeMax =
        typeof req.query.timeMax
          === "string"
        && req.query.timeMax
          ? req.query.timeMax
          : undefined;

      const result =
        await listGoogleCalendarEvents({
          timeMin,
          timeMax,
          maxResults: 100,
        });

      return res.json({
        ok: true,
        events:
          result.items ?? [],
      });
    } catch (error) {
      console.error(
        "[GOOGLE CALENDAR EVENTS]",
        error,
      );

      return res
        .status(500)
        .json({
          ok: false,
          error:
            "GOOGLE_CALENDAR_EVENTS_ERROR",
        });
    }
  },
);


adminGoogleCalendarRoutes.post(
  "/events/:eventId/sync",

  requireRoles(
    "superadmin",
    "owner",
    "admin",
  ),

  async (req, res) => {
    const tenant =
      tenantId(req);

    const eventId =
      String(
        req.params.eventId
        ?? "",
      );

    try {
      const events =
        await supabaseRequest<
          Array<
            Record<
              string,
              unknown
            >
          >
        >({
          table:
            "crm_events",

          query:
            `?company_id=eq.${encodeURIComponent(tenant)}`
            + `&id=eq.${encodeURIComponent(eventId)}`
            + "&limit=1",
        });

      const event =
        events[0];

      if (!event) {
        return res
          .status(404)
          .json({
            ok: false,
            error:
              "EVENT_NOT_FOUND",
          });
      }

      let customerName:
        string | null =
        null;

      if (event.customer_id) {
        const customers =
          await supabaseRequest<
            Array<
              Record<
                string,
                unknown
              >
            >
          >({
            table:
              "commerce_customers",

            query:
              `?company_id=eq.${encodeURIComponent(tenant)}`
              + `&id=eq.${encodeURIComponent(String(event.customer_id))}`
              + "&limit=1",
          });

        customerName =
          customers[0]?.name
            ? String(
                customers[0].name,
              )
            : null;
      }

      const googleEvent =
        await syncCrmEventToGoogle({
          event,
          customerName,
        });

      const googleId =
        String(
          googleEvent.id
          ?? "",
        );

      const htmlLink =
        googleEvent.htmlLink
          ? String(
              googleEvent.htmlLink,
            )
          : null;

      const integrations =
        await readIntegrationSecrets();

      const updated =
        await supabaseRequest<
          Array<
            Record<
              string,
              unknown
            >
          >
        >({
          table:
            "crm_events",

          method:
            "PATCH",

          query:
            `?company_id=eq.${encodeURIComponent(tenant)}`
            + `&id=eq.${encodeURIComponent(eventId)}`,

          body: {
            google_calendar_event_id:
              googleId,

            google_calendar_id:
              integrations
                .google_calendar
                .calendarId
              || "primary",

            google_calendar_html_link:
              htmlLink,

            google_calendar_synced_at:
              new Date()
                .toISOString(),

            google_calendar_sync_status:
              "synced",

            google_calendar_sync_error:
              null,
          },
        });

      return res.json({
        ok: true,
        event:
          updated[0]
          ?? event,

        googleEvent,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "GOOGLE_CALENDAR_SYNC_ERROR";

      console.error(
        "[GOOGLE CALENDAR SYNC]",
        error,
      );

      await supabaseRequest({
        table:
          "crm_events",

        method:
          "PATCH",

        query:
          `?company_id=eq.${encodeURIComponent(tenant)}`
          + `&id=eq.${encodeURIComponent(eventId)}`,

        body: {
          google_calendar_sync_status:
            "error",

          google_calendar_sync_error:
            message.slice(
              0,
              1000,
            ),
        },
      }).catch(
        () => undefined,
      );

      return res
        .status(502)
        .json({
          ok: false,
          error:
            "GOOGLE_CALENDAR_SYNC_ERROR",

          message,
        });
    }
  },
);


adminGoogleCalendarRoutes.delete(
  "/events/:eventId/sync",

  requireRoles(
    "superadmin",
    "owner",
    "admin",
  ),

  async (req, res) => {
    const tenant =
      tenantId(req);

    const eventId =
      String(
        req.params.eventId
        ?? "",
      );

    try {
      const events =
        await supabaseRequest<
          Array<
            Record<
              string,
              unknown
            >
          >
        >({
          table:
            "crm_events",

          query:
            `?company_id=eq.${encodeURIComponent(tenant)}`
            + `&id=eq.${encodeURIComponent(eventId)}`
            + "&limit=1",
        });

      const event =
        events[0];

      if (!event) {
        return res
          .status(404)
          .json({
            ok: false,
            error:
              "EVENT_NOT_FOUND",
          });
      }

      if (
        event
          .google_calendar_event_id
      ) {
        await deleteGoogleCalendarEvent(
          String(
            event
              .google_calendar_event_id,
          ),

          event
            .google_calendar_id
            ? String(
                event
                  .google_calendar_id,
              )
            : null,
        );
      }

      const updated =
        await supabaseRequest<
          Array<
            Record<
              string,
              unknown
            >
          >
        >({
          table:
            "crm_events",

          method:
            "PATCH",

          query:
            `?company_id=eq.${encodeURIComponent(tenant)}`
            + `&id=eq.${encodeURIComponent(eventId)}`,

          body: {
            google_calendar_event_id:
              null,

            google_calendar_id:
              null,

            google_calendar_html_link:
              null,

            google_calendar_synced_at:
              null,

            google_calendar_sync_status:
              "not_synced",

            google_calendar_sync_error:
              null,
          },
        });

      return res.json({
        ok: true,
        event:
          updated[0]
          ?? event,
      });
    } catch (error) {
      console.error(
        "[GOOGLE CALENDAR UNLINK]",
        error,
      );

      return res
        .status(502)
        .json({
          ok: false,
          error:
            "GOOGLE_CALENDAR_UNLINK_ERROR",
        });
    }
  },
);
