import {
  Router,
  type Request,
  type Response,
} from "express";

import {
  z,
  ZodError,
} from "zod";

import {
  supabaseRequest,
} from "../services/db/supabase-rest.client.js";

export const crmLeadRequestRoutes =
  Router();

type DbRow =
  Record<string, unknown>;

function companyId(
  request: Request,
) {
  const value =
    request
      .tenantContext
      ?.effectiveCompanyId;

  if (!value) {
    throw new Error(
      "COMPANY_CONTEXT_NOT_RESOLVED",
    );
  }

  return value;
}

function eq(
  value: string,
) {
  return encodeURIComponent(
    value,
  );
}

function handleError(
  error: unknown,
  response: Response,
) {
  if (
    error instanceof ZodError
  ) {
    return response
      .status(400)
      .json({
        ok: false,
        error:
          "VALIDATION_ERROR",

        issues:
          error.issues,
      });
  }

  console.error(
    "[CRM LEAD REQUESTS]",
    error,
  );

  return response
    .status(500)
    .json({
      ok: false,
      error:
        "CRM_LEAD_REQUEST_ERROR",
    });
}

const patchSchema =
  z.object({
    status:
      z.enum([
        "new",
        "contacted",
        "qualified",
        "proposal",
        "converted",
        "lost",
      ])
        .optional(),

    customerName:
      z.string()
        .trim()
        .max(160)
        .optional()
        .nullable(),

    whatsapp:
      z.string()
        .trim()
        .max(50)
        .optional()
        .nullable(),

    email:
      z.string()
        .trim()
        .email()
        .max(200)
        .optional()
        .nullable(),

    eventType:
      z.string()
        .trim()
        .max(80)
        .optional()
        .nullable(),

    serviceMode:
      z.string()
        .trim()
        .max(80)
        .optional()
        .nullable(),

    eventDate:
      z.string()
        .trim()
        .optional()
        .nullable(),

    alternativeDate:
      z.string()
        .trim()
        .optional()
        .nullable(),

    dateFlexible:
      z.boolean()
        .optional(),

    autonomousCommunity:
      z.string()
        .trim()
        .max(120)
        .optional()
        .nullable(),

    province:
      z.string()
        .trim()
        .max(120)
        .optional()
        .nullable(),

    municipality:
      z.string()
        .trim()
        .max(160)
        .optional()
        .nullable(),

    postalCode:
      z.string()
        .trim()
        .max(12)
        .optional()
        .nullable(),

    guestCount:
      z.number()
        .int()
        .min(0)
        .optional()
        .nullable(),

    budgetInitial:
      z.number()
        .min(0)
        .optional()
        .nullable(),

    budgetMax:
      z.number()
        .min(0)
        .optional()
        .nullable(),

    requestedServices:
      z.array(
        z.string(),
      )
        .optional(),

    customerMessage:
      z.string()
        .max(8000)
        .optional()
        .nullable(),

    internalNotes:
      z.string()
        .max(8000)
        .optional()
        .nullable(),
  });

// CRM_INTAKE_SETTINGS_READ_V1
//
// Consulta de configuración empresarial.
// Solo lectura; reutiliza la autenticación
// y el contexto de empresa de las rutas CRM.

crmLeadRequestRoutes.get(
  "/intake-settings",
  async (request, response) => {
    try {
      const tenant = companyId(request);

      const rows = await supabaseRequest<
        DbRow[]
      >({
        table: "crm_intake_settings",

        query:
          `?company_id=eq.${eq(tenant)}`
          + "&select=company_id,enabled,response_mode,"
          + "automatic_replies,pause_on_human_operator,"
          + "confidence_threshold,max_questions_per_reply,"
          + "generate_form_link,timezone,updated_at"
          + "&limit=1",
      });

      const settings = rows[0] ?? {
        company_id: tenant,
        enabled: false,
        response_mode: "observe",
        automatic_replies: false,
        pause_on_human_operator: true,
        confidence_threshold: 0.9,
        max_questions_per_reply: 1,
        generate_form_link: true,
        timezone: "Europe/Madrid",
      };

      return response.json({
        ok: true,
        settings,
        configured: Boolean(rows[0]),
        runtimeCaptureEnabled:
          process.env.CRM_INTAKE_CAPTURE_ENABLED
            ?.trim()
            .toLowerCase() === "true",
      });

    } catch (error) {
      console.error(
        "[CRM INTAKE SETTINGS READ]",
        error,
      );

      return response.status(503).json({
        ok: false,
        error: "INTAKE_STORAGE_NOT_READY",
      });
    }
  },
);

crmLeadRequestRoutes.get(
  "/lead-requests",
  async (
    request,
    response,
  ) => {
    try {
      const tenant =
        companyId(
          request,
        );

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_lead_requests",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + "&order=created_at.desc",
        });

      return response.json({
        ok: true,
        requests:
          rows,
      });
    } catch (
      error
    ) {
      return handleError(
        error,
        response,
      );
    }
  },
);

crmLeadRequestRoutes.get(
  "/lead-requests/:requestId",
  async (
    request,
    response,
  ) => {
    try {
      const tenant =
        companyId(
          request,
        );

      const id =
        z.string()
          .uuid()
          .parse(
            request.params
              .requestId,
          );

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_lead_requests",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&id=eq.${eq(
              id,
            )}`
            + "&limit=1",
        });

      if (
        !rows[0]
      ) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "LEAD_REQUEST_NOT_FOUND",
          });
      }

      return response.json({
        ok: true,
        request:
          rows[0],
      });
    } catch (
      error
    ) {
      return handleError(
        error,
        response,
      );
    }
  },
);

crmLeadRequestRoutes.patch(
  "/lead-requests/:requestId",
  async (
    request,
    response,
  ) => {
    try {
      const tenant =
        companyId(
          request,
        );

      const id =
        z.string()
          .uuid()
          .parse(
            request.params
              .requestId,
          );

      const body =
        patchSchema.parse(
          request.body,
        );

      const patch:
        Record<
          string,
          unknown
        > = {};

      const mappings: [
        keyof typeof body,
        string,
      ][] = [
        ["status", "status"],
        ["customerName", "customer_name"],
        ["whatsapp", "whatsapp"],
        ["email", "email"],
        ["eventType", "event_type"],
        ["serviceMode", "service_mode"],
        ["eventDate", "event_date"],
        ["alternativeDate", "alternative_date"],
        ["dateFlexible", "date_flexible"],
        ["autonomousCommunity", "autonomous_community"],
        ["province", "province"],
        ["municipality", "municipality"],
        ["postalCode", "postal_code"],
        ["guestCount", "guest_count"],
        ["budgetInitial", "budget_initial"],
        ["budgetMax", "budget_max"],
        ["requestedServices", "requested_services"],
        ["customerMessage", "customer_message"],
        ["internalNotes", "internal_notes"],
      ];

      for (
        const [
          source,
          target,
        ]
        of mappings
      ) {
        if (
          body[source]
          !== undefined
        ) {
          patch[target] =
            body[source];
        }
      }

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_lead_requests",

          method:
            "PATCH",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&id=eq.${eq(
              id,
            )}`,

          body:
            patch,
        });

      if (
        !rows[0]
      ) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "LEAD_REQUEST_NOT_FOUND",
          });
      }

      return response.json({
        ok: true,
        request:
          rows[0],
      });
    } catch (
      error
    ) {
      return handleError(
        error,
        response,
      );
    }
  },
);

