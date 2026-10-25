import { z as intakeConfigZ } from "zod";
import { supabaseRequest as intakeConfigDb } from "../services/db/supabase-rest.client.js";
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
  supabaseRpc,
} from "../services/db/supabase-rest.client.js";



import {
  crmTeamUsersRoutes,
} from "./crm-team-users.routes.js";

import {
  crmFinanceRoutes,
} from "./crm-finance.routes.js";

import {
  crmVenuesRoutes,
} from "./crm-venues.routes.js";


import {
  crmFilesRoutes,
} from "./crm-files.routes.js";

import {
  crmLeadRequestRoutes,
} from "./crm-lead-requests.routes.js";

export const crmRoutes = Router();

/* ============================================================
 * MANAGED TEAM USERS
 * ============================================================ */

crmRoutes.use(
  "/team-users",
  crmTeamUsersRoutes,
);


crmRoutes.use(
  "/",
  crmFinanceRoutes,
);


crmRoutes.use(
  "/",
  crmVenuesRoutes,
);


crmRoutes.use(
  "/",
  crmFilesRoutes,
);



// CRM_INTAKE_SETTINGS_WRITE_V1
// Sólo administradores. Respuestas automáticas bloqueadas.
crmRoutes.patch("/intake-settings", async (request, response) => {
  if (!requireAdmin(request, response)) {
    return;
  }

  const companyId = request.tenantContext?.effectiveCompanyId;

  if (!companyId) {
    return response.status(403).json({
      ok: false,
      error: "COMPANY_CONTEXT_REQUIRED",
    });
  }

  const schema = intakeConfigZ.object({
    enabled: intakeConfigZ.boolean().optional(),
    responseMode: intakeConfigZ.enum(["observe", "assist"]).optional(),
    pauseOnHumanOperator: intakeConfigZ.boolean().optional(),
    confidenceThreshold: intakeConfigZ.number().min(0).max(1).optional(),
    maxQuestionsPerReply: intakeConfigZ.number().int().min(0).max(2).optional(),
    generateFormLink: intakeConfigZ.boolean().optional(),
  }).strict();

  const parsed = schema.safeParse(request.body);

  if (!parsed.success) {
    return response.status(400).json({
      ok: false,
      error: "INVALID_INTAKE_SETTINGS",
      issues: parsed.error.issues,
    });
  }

  if (Object.keys(parsed.data).length === 0) {
    return response.status(400).json({
      ok: false,
      error: "EMPTY_INTAKE_SETTINGS",
    });
  }

  const input = parsed.data;

  const body: Record<string, unknown> = {
    company_id: companyId,
    automatic_replies: false,
    updated_at: new Date().toISOString(),
  };

  if (input.enabled !== undefined) {
    body.enabled = input.enabled;
  }
  if (input.responseMode !== undefined) {
    body.response_mode = input.responseMode;
  }
  if (input.pauseOnHumanOperator !== undefined) {
    body.pause_on_human_operator = input.pauseOnHumanOperator;
  }
  if (input.confidenceThreshold !== undefined) {
    body.confidence_threshold = input.confidenceThreshold;
  }
  if (input.maxQuestionsPerReply !== undefined) {
    body.max_questions_per_reply = input.maxQuestionsPerReply;
  }
  if (input.generateFormLink !== undefined) {
    body.generate_form_link = input.generateFormLink;
  }

  try {
    const rows = await intakeConfigDb<Array<Record<string, unknown>>>({
      table: "crm_intake_settings",
      method: "POST",
      query: "?on_conflict=company_id&select=*",
      body,
      prefer: "resolution=merge-duplicates,return=representation",
    });

    return response.json({
      ok: true,
      settings: rows[0],
      runtimeCaptureEnabled:
        process.env.CRM_INTAKE_CAPTURE_ENABLED === "true",
    });
  } catch (error) {
    console.error("[INTAKE SETTINGS WRITE]", error);

    return response.status(503).json({
      ok: false,
      error: "INTAKE_SETTINGS_SAVE_FAILED",
    });
  }
});

crmRoutes.use(
  "/",
  crmLeadRequestRoutes,
);




type DbRow =
  Record<string, unknown>;


const adminRoles =
  new Set([
    "superadmin",
    "owner",
    "admin",
    "supervisor",
  ]);


const defaultCategories = [
  ["venue", "Espacios / Chalets", "🏡"],
  ["catering", "Catering", "🍽️"],
  ["dj", "DJ", "🎧"],
  ["sound", "Sonido", "🔊"],
  ["lighting", "Iluminación", "💡"],
  ["decoration", "Decoración", "✨"],
  ["photo", "Fotografía", "📷"],
  ["video", "Vídeo", "🎥"],
  ["vehicle", "Vehículos", "🚘"],
  ["staff", "Camareros / Personal", "👥"],
  ["security", "Seguridad", "🛡️"],
  ["entertainment", "Animación", "🎭"],
  ["other", "Otros", "➕"],
] as const;


function companyId(
  request: Request,
): string {
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


function isAdmin(
  request: Request,
): boolean {
  return Boolean(
    request.authUser
    && adminRoles.has(
      request.authUser.role,
    ),
  );
}


function requireAdmin(
  request: Request,
  response: Response,
): boolean {
  if (!isAdmin(request)) {
    response.status(403).json({
      ok: false,
      error:
        "ADMIN_PERMISSION_REQUIRED",
    });

    return false;
  }

  return true;
}


function eq(
  value: string,
): string {
  return encodeURIComponent(value);
}


function inList(
  values: string[],
): string {
  return values
    .map((value) =>
      encodeURIComponent(value))
    .join(",");
}


function first<T>(
  rows: T[],
): T | null {
  return rows[0] ?? null;
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
    "[CRM]",
    error,
  );

  return response
    .status(500)
    .json({
      ok: false,
      error:
        "CRM_INTERNAL_ERROR",
    });
}


async function getOrCreateTeamMember(
  request: Request,
): Promise<DbRow> {
  if (!request.authUser) {
    throw new Error(
      "AUTHENTICATED_USER_NOT_FOUND",
    );
  }

  const tenant =
    companyId(request);

  const existing =
    await supabaseRequest<DbRow[]>({
      table:
        "crm_team_members",

      query:
        `?company_id=eq.${eq(tenant)}`
        + `&auth_user_id=eq.${eq(
          request.authUser.id,
        )}`
        + "&limit=1",
    });

  if (existing[0]) {
    return existing[0];
  }

  const accessRole =
    isAdmin(request)
      ? "admin"
      : "seller";

  const created =
    await supabaseRequest<DbRow[]>({
      table:
        "crm_team_members",

      method:
        "POST",

        query:
          "?on_conflict=company_id,auth_user_id",

        prefer:
          "resolution=merge-duplicates,return=representation",

      body: {
        company_id:
          tenant,

        auth_user_id:
          request.authUser.id,

        name:
          request.authUser.name,

        email:
          request.authUser.email,

        phone:
          request.authUser.phone
          ?? null,

        access_role:
          accessRole,

        active:
          true,
      },
    });

  const member =
    first(created);

  if (!member) {
    throw new Error(
      "CRM_TEAM_MEMBER_NOT_CREATED",
    );
  }

  return member;
}


async function ensureSettings(
  request: Request,
): Promise<DbRow> {
  const tenant =
    companyId(request);

  const rows =
    await supabaseRequest<DbRow[]>({
      table:
        "crm_company_settings",

      query:
        `?company_id=eq.${eq(tenant)}`
        + "&limit=1",
    });

  if (rows[0]) {
    return rows[0];
  }

  const created =
    await supabaseRequest<DbRow[]>({
      table:
        "crm_company_settings",

      method:
        "POST",

      body: {
        company_id:
          tenant,

        currency:
          "EUR",

        commission_pool_limit_percent:
          35,

        require_admin_quote_approval:
          false,

        allow_seller_view_costs:
          false,

        allow_seller_view_margin:
          false,
      },
    });

  if (!created[0]) {
    throw new Error(
      "CRM_SETTINGS_NOT_CREATED",
    );
  }

  return created[0];
}


async function ensureDefaultCategories(
  request: Request,
) {
  const tenant =
    companyId(request);

  const existing =
    await supabaseRequest<DbRow[]>({
      table:
        "crm_service_categories",

      query:
        `?company_id=eq.${eq(tenant)}`
        + "&select=code",
    });

  const existingCodes =
    new Set(
      existing
        .map((row) =>
          typeof row.code
            === "string"
            ? row.code
            : null)
        .filter(
          (
            value,
          ): value is string =>
            Boolean(value),
        ),
    );

  const missing =
    defaultCategories
      .filter(
        ([code]) =>
          !existingCodes.has(code),
      )
      .map(
        (
          [code, name, icon],
          index,
        ) => ({
          company_id:
            tenant,

          code,
          name,
          icon,

          sort_order:
            index * 10,

          active:
            true,
        }),
      );

  if (missing.length > 0) {
    await supabaseRequest<DbRow[]>({
      table:
        "crm_service_categories",

      method:
        "POST",

      body:
        missing,
    });
  }
}


async function createdEventsForSeller(
  request: Request,
  memberId: string,
): Promise<DbRow[]> {
  const tenant =
    companyId(request);

  return supabaseRequest<DbRow[]>({
    table:
      "crm_events",

    query:
      `?company_id=eq.${eq(tenant)}`
      + `&created_by_team_member_id=eq.${eq(
        memberId,
      )}`
      + "&order=created_at.desc",
  });
}


async function assignedEventIds(
  request: Request,
  memberId: string,
): Promise<string[]> {
  const tenant =
    companyId(request);

  const assignments =
    await supabaseRequest<DbRow[]>({
      table:
        "crm_event_assignments",

      query:
        `?company_id=eq.${eq(tenant)}`
        + `&team_member_id=eq.${eq(
          memberId,
        )}`
        + "&status=neq.cancelled"
        + "&select=event_id",
    });

  return [
    ...new Set(
      assignments
        .map((row) =>
          typeof row.event_id
            === "string"
            ? row.event_id
            : null)
        .filter(
          (
            value,
          ): value is string =>
            Boolean(value),
        ),
    ),
  ];
}


async function listAccessibleEvents(
  request: Request,
): Promise<DbRow[]> {
  const tenant =
    companyId(request);

  if (isAdmin(request)) {
    return supabaseRequest<DbRow[]>({
      table:
        "crm_events",

      query:
        `?company_id=eq.${eq(tenant)}`
        + "&order=created_at.desc",
    });
  }

  const member =
    await getOrCreateTeamMember(
      request,
    );

  const memberId =
    String(member.id);

  const created =
    await createdEventsForSeller(
      request,
      memberId,
    );

  const assignedIds =
    await assignedEventIds(
      request,
      memberId,
    );

  const already =
    new Set(
      created.map(
        (row) =>
          String(row.id),
      ),
    );

  const extraIds =
    assignedIds.filter(
      (id) =>
        !already.has(id),
    );

  if (extraIds.length === 0) {
    return created;
  }

  const assigned =
    await supabaseRequest<DbRow[]>({
      table:
        "crm_events",

      query:
        `?company_id=eq.${eq(tenant)}`
        + `&id=in.(${inList(
          extraIds,
        )})`
        + "&order=created_at.desc",
    });

  return [
    ...created,
    ...assigned,
  ].sort(
    (a, b) =>
      String(b.created_at ?? "")
        .localeCompare(
          String(
            a.created_at
            ?? "",
          ),
        ),
  );
}


async function canAccessEvent(
  request: Request,
  eventId: string,
): Promise<boolean> {
  const tenant =
    companyId(request);

  const eventRows =
    await supabaseRequest<DbRow[]>({
      table:
        "crm_events",

      query:
        `?company_id=eq.${eq(tenant)}`
        + `&id=eq.${eq(eventId)}`
        + "&limit=1",
    });

  const event =
    eventRows[0];

  if (!event) {
    return false;
  }

  if (isAdmin(request)) {
    return true;
  }

  const member =
    await getOrCreateTeamMember(
      request,
    );

  if (
    event.created_by_team_member_id
    === member.id
  ) {
    return true;
  }

  const assignment =
    await supabaseRequest<DbRow[]>({
      table:
        "crm_event_assignments",

      query:
        `?company_id=eq.${eq(tenant)}`
        + `&event_id=eq.${eq(eventId)}`
        + `&team_member_id=eq.${eq(
          String(member.id),
        )}`
        + "&status=neq.cancelled"
        + "&limit=1",
    });

  return assignment.length > 0;
}


function sellerProviderService(
  row: DbRow,
): DbRow {
  const {
    cost_from: _costFrom,
    cost_to: _costTo,
    ...safe
  } = row;

  return safe;
}


function sellerProvider(
  row: DbRow,
): DbRow {
  const {
    tax_id: _taxId,
    legal_name: _legalName,
    notes: _notes,
    ...safe
  } = row;

  return safe;
}


/* ============================================================
 * BOOTSTRAP
 * ============================================================ */

crmRoutes.post(
  "/bootstrap",
  async (
    request,
    response,
  ) => {
    try {
      const member =
        await getOrCreateTeamMember(
          request,
        );

      const settings =
        await ensureSettings(
          request,
        );

      await ensureDefaultCategories(
        request,
      );

      return response.json({
        ok: true,
        member,
        settings,
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


/* ============================================================
 * CURRENT USER / CRM ACCESS
 * ============================================================ */

crmRoutes.get(
  "/me",
  async (
    request,
    response,
  ) => {
    try {
      const member =
        await getOrCreateTeamMember(
          request,
        );

      const settings =
        await ensureSettings(
          request,
        );

      return response.json({
        ok: true,

        role:
          request.authUser?.role,

        crmRole:
          member.access_role,

        admin:
          isAdmin(request),

        views:
          request.authUser
            ?.views
          ?? [],

        actions:
          request.authUser
            ?.actions
          ?? [],

        member,
        settings,
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


/* ============================================================
 * CUSTOMERS
 * ============================================================ */

const customerCreateSchema =
  z.object({
    name:
      z.string()
        .trim()
        .min(2)
        .max(160),

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

    province:
      z.string()
        .trim()
        .max(120)
        .optional()
        .nullable(),

    city:
      z.string()
        .trim()
        .max(120)
        .optional()
        .nullable(),

    address:
      z.string()
        .trim()
        .max(300)
        .optional()
        .nullable(),

    notes:
      z.string()
        .trim()
        .max(5000)
        .optional()
        .nullable(),
  });


crmRoutes.get(
  "/customers",
  async (
    request,
    response,
  ) => {
    try {
      const tenant =
        companyId(request);

      if (isAdmin(request)) {
        const customers =
          await supabaseRequest<
            DbRow[]
          >({
            table:
              "commerce_customers",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`
              + "&order=created_at.desc",
          });

        return response.json({
          ok: true,
          customers,
        });
      }

      const events =
        await listAccessibleEvents(
          request,
        );

      const customerIds =
        [
          ...new Set(
            events
              .map((event) =>
                typeof event
                  .customer_id
                  === "string"
                  ? event.customer_id
                  : null)
              .filter(
                (
                  value,
                ): value is string =>
                  Boolean(value),
              ),
          ),
        ];

      if (
        customerIds.length === 0
      ) {
        return response.json({
          ok: true,
          customers: [],
        });
      }

      const customers =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "commerce_customers",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&id=in.(${inList(
              customerIds,
            )})`
            + "&order=created_at.desc",
        });

      return response.json({
        ok: true,
        customers,
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


crmRoutes.post(
  "/customers",
  async (
    request,
    response,
  ) => {
    try {
      const body =
        customerCreateSchema.parse(
          request.body,
        );

      const tenant =
        companyId(request);

      if (body.whatsapp) {
        const existing =
          await supabaseRequest<
            DbRow[]
          >({
            table:
              "commerce_customers",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`
              + `&whatsapp=eq.${eq(
                body.whatsapp,
              )}`
              + "&limit=1",
          });

        if (existing[0]) {
          return response
            .status(409)
            .json({
              ok: false,
              error:
                "CUSTOMER_ALREADY_EXISTS",
              customer:
                existing[0],
            });
        }
      }

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "commerce_customers",

          method:
            "POST",

          body: {
            company_id:
              tenant,

            name:
              body.name,

            whatsapp:
              body.whatsapp
              ?? null,

            email:
              body.email
              ?? null,

            province:
              body.province
              ?? null,

            city:
              body.city
              ?? null,

            address:
              body.address
              ?? null,

            customer_type:
              "other",

            status:
              "active",

            notes:
              body.notes
              ?? null,

            metadata: {
              source:
                "eventos_crm",
            },
          },
        });

      return response
        .status(201)
        .json({
          ok: true,
          customer:
            rows[0],
        });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


/* ============================================================
 * SERVICE CATEGORIES
 * ============================================================ */

const categorySchema =
  z.object({
    code:
      z.string()
        .trim()
        .min(2)
        .max(80),

    name:
      z.string()
        .trim()
        .min(2)
        .max(160),

    description:
      z.string()
        .trim()
        .max(1000)
        .optional()
        .nullable(),

    icon:
      z.string()
        .trim()
        .max(50)
        .optional()
        .nullable(),

    sortOrder:
      z.number()
        .int()
        .min(0)
        .max(10000)
        .optional(),
  });


crmRoutes.get(
  "/service-categories",
  async (
    request,
    response,
  ) => {
    try {
      await ensureDefaultCategories(
        request,
      );

      const tenant =
        companyId(request);

      const categories =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_service_categories",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + "&active=eq.true"
            + "&order=sort_order.asc,name.asc",
        });

      return response.json({
        ok: true,
        categories,
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


crmRoutes.post(
  "/service-categories",
  async (
    request,
    response,
  ) => {
    if (
      !requireAdmin(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const body =
        categorySchema.parse(
          request.body,
        );

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_service_categories",

          method:
            "POST",

          body: {
            company_id:
              companyId(request),

            code:
              body.code,

            name:
              body.name,

            description:
              body.description
              ?? null,

            icon:
              body.icon
              ?? null,

            sort_order:
              body.sortOrder
              ?? 100,

            active:
              true,
          },
        });

      return response
        .status(201)
        .json({
          ok: true,
          category:
            rows[0],
        });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


/* ============================================================
 * PROVIDERS
 * ============================================================ */

const providerSchema =
  z.object({
    name:
      z.string()
        .trim()
        .min(2)
        .max(180),

    legalName:
      z.string()
        .trim()
        .max(180)
        .optional()
        .nullable(),

    contactName:
      z.string()
        .trim()
        .max(180)
        .optional()
        .nullable(),

    phone:
      z.string()
        .trim()
        .max(50)
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

    website:
      z.string()
        .trim()
        .max(500)
        .optional()
        .nullable(),

    taxId:
      z.string()
        .trim()
        .max(80)
        .optional()
        .nullable(),

    province:
      z.string()
        .trim()
        .max(120)
        .optional()
        .nullable(),

    city:
      z.string()
        .trim()
        .max(120)
        .optional()
        .nullable(),

    address:
      z.string()
        .trim()
        .max(300)
        .optional()
        .nullable(),

    serviceArea:
      z.string()
        .trim()
        .max(500)
        .optional()
        .nullable(),

    notes:
      z.string()
        .trim()
        .max(5000)
        .optional()
        .nullable(),

    internalRating:
      z.number()
        .min(0)
        .max(5)
        .optional()
        .nullable(),
  });


crmRoutes.get(
  "/providers",
  async (
    request,
    response,
  ) => {
    try {
      const tenant =
        companyId(request);

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_providers",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + "&status=eq.active"
            + "&order=times_used.desc,name.asc",
        });

      return response.json({
        ok: true,

        providers:
          isAdmin(request)
            ? rows
            : rows.map(
                sellerProvider,
              ),
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


crmRoutes.post(
  "/providers",
  async (
    request,
    response,
  ) => {
    if (
      !requireAdmin(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const body =
        providerSchema.parse(
          request.body,
        );

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_providers",

          method:
            "POST",

          body: {
            company_id:
              companyId(request),

            name:
              body.name,

            legal_name:
              body.legalName
              ?? null,

            contact_name:
              body.contactName
              ?? null,

            phone:
              body.phone
              ?? null,

            whatsapp:
              body.whatsapp
              ?? null,

            email:
              body.email
              ?? null,

            website:
              body.website
              ?? null,

            tax_id:
              body.taxId
              ?? null,

            province:
              body.province
              ?? null,

            city:
              body.city
              ?? null,

            address:
              body.address
              ?? null,

            service_area:
              body.serviceArea
              ?? null,

            internal_rating:
              body.internalRating
              ?? null,

            notes:
              body.notes
              ?? null,

            status:
              "active",
          },
        });

      return response
        .status(201)
        .json({
          ok: true,
          provider:
            rows[0],
        });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


const providerServiceSchema =
  z.object({
    categoryId:
      z.string().uuid(),

    name:
      z.string()
        .trim()
        .min(2)
        .max(180),

    description:
      z.string()
        .trim()
        .max(3000)
        .optional()
        .nullable(),

    pricingModel:
      z.enum([
        "fixed",
        "per_person",
        "per_hour",
        "from",
        "quote",
      ])
        .optional(),

    costFrom:
      z.number()
        .min(0)
        .optional()
        .nullable(),

    costTo:
      z.number()
        .min(0)
        .optional()
        .nullable(),

    suggestedClientPrice:
      z.number()
        .min(0)
        .optional()
        .nullable(),

    capacityMin:
      z.number()
        .int()
        .min(0)
        .optional()
        .nullable(),

    capacityMax:
      z.number()
        .int()
        .min(0)
        .optional()
        .nullable(),

    leadTimeDays:
      z.number()
        .int()
        .min(0)
        .optional()
        .nullable(),
  });


crmRoutes.get(
  "/providers/:providerId/services",
  async (
    request,
    response,
  ) => {
    try {
      const providerId =
        z.string()
          .uuid()
          .parse(
            request.params
              .providerId,
          );

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_provider_services",

          query:
            `?company_id=eq.${eq(
              companyId(request),
            )}`
            + `&provider_id=eq.${eq(
              providerId,
            )}`
            + "&active=eq.true"
            + "&order=name.asc",
        });

      return response.json({
        ok: true,

        services:
          isAdmin(request)
            ? rows
            : rows.map(
                sellerProviderService,
              ),
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


crmRoutes.post(
  "/providers/:providerId/services",
  async (
    request,
    response,
  ) => {
    if (
      !requireAdmin(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const providerId =
        z.string()
          .uuid()
          .parse(
            request.params
              .providerId,
          );

      const body =
        providerServiceSchema.parse(
          request.body,
        );

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_provider_services",

          method:
            "POST",

          body: {
            company_id:
              companyId(request),

            provider_id:
              providerId,

            category_id:
              body.categoryId,

            name:
              body.name,

            description:
              body.description
              ?? null,

            pricing_model:
              body.pricingModel
              ?? "quote",

            currency:
              "EUR",

            cost_from:
              body.costFrom
              ?? null,

            cost_to:
              body.costTo
              ?? null,

            suggested_client_price:
              body
                .suggestedClientPrice
              ?? null,

            capacity_min:
              body.capacityMin
              ?? null,

            capacity_max:
              body.capacityMax
              ?? null,

            lead_time_days:
              body.leadTimeDays
              ?? null,

            active:
              true,
          },
        });

      return response
        .status(201)
        .json({
          ok: true,
          service:
            rows[0],
        });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


/* ============================================================
 * EVENTS
 * ============================================================ */

const eventCreateSchema =
  z.object({
    customerId:
      z.string().uuid(),

    title:
      z.string()
        .trim()
        .min(2)
        .max(250),

    eventType:
      z.string()
        .trim()
        .min(2)
        .max(80)
        .optional(),

    eventDate:
      z.string()
        .regex(
          /^\d{4}-\d{2}-\d{2}$/,
        )
        .optional()
        .nullable(),

    guestCount:
      z.number()
        .int()
        .positive()
        .optional()
        .nullable(),

    province:
      z.string()
        .trim()
        .max(120)
        .optional()
        .nullable(),

    city:
      z.string()
        .trim()
        .max(120)
        .optional()
        .nullable(),

    venueName:
      z.string()
        .trim()
        .max(200)
        .optional()
        .nullable(),

    venueAddress:
      z.string()
        .trim()
        .max(300)
        .optional()
        .nullable(),

    targetBudget:
      z.number()
        .min(0)
        .optional()
        .nullable(),

    customerRequest:
      z.string()
        .trim()
        .max(10000)
        .optional()
        .nullable(),

    sourceChannel:
      z.string()
        .trim()
        .max(80)
        .optional()
        .nullable(),

    sourceDetail:
      z.string()
        .trim()
        .max(500)
        .optional()
        .nullable(),

    nextAction:
      z.string()
        .trim()
        .max(1000)
        .optional()
        .nullable(),

    nextActionAt:
      z.string()
        .datetime()
        .optional()
        .nullable(),

    notes:
      z.string()
        .trim()
        .max(5000)
        .optional()
        .nullable(),
  });


const eventUpdateSchema =
  z.object({
    title:
      z.string()
        .trim()
        .min(2)
        .max(250)
        .optional(),

    eventType:
      z.string()
        .trim()
        .min(2)
        .max(80)
        .optional(),

    status:
      z.enum([
        "lead",
        "qualifying",
        "sourcing",
        "quote_draft",
        "quote_sent",
        "negotiation",
        "confirmed",
        "planning",
        "ready",
        "completed",
        "lost",
        "cancelled",
      ])
        .optional(),

    eventDate:
      z.string()
        .regex(
          /^\d{4}-\d{2}-\d{2}$/,
        )
        .nullable()
        .optional(),

    guestCount:
      z.number()
        .int()
        .positive()
        .nullable()
        .optional(),

    province:
      z.string()
        .trim()
        .max(120)
        .nullable()
        .optional(),

    city:
      z.string()
        .trim()
        .max(120)
        .nullable()
        .optional(),

    venueName:
      z.string()
        .trim()
        .max(200)
        .nullable()
        .optional(),

    venueAddress:
      z.string()
        .trim()
        .max(300)
        .nullable()
        .optional(),

    targetBudget:
      z.number()
        .min(0)
        .nullable()
        .optional(),

    customerRequest:
      z.string()
        .trim()
        .max(10000)
        .nullable()
        .optional(),

    nextAction:
      z.string()
        .trim()
        .max(1000)
        .nullable()
        .optional(),

    nextActionAt:
      z.string()
        .datetime()
        .nullable()
        .optional(),

    notes:
      z.string()
        .trim()
        .max(5000)
        .nullable()
        .optional(),
  });


crmRoutes.get(
  "/events",
  async (
    request,
    response,
  ) => {
    try {
      const events =
        await listAccessibleEvents(
          request,
        );

      return response.json({
        ok: true,
        events,
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


crmRoutes.post(
  "/events",
  async (
    request,
    response,
  ) => {
    try {

      const extendedEventInput =
        z.object({
          eventEndDate:
            z.string()
              .nullable()
              .optional(),

          startTime:
            z.string()
              .nullable()
              .optional(),

          endTime:
            z.string()
              .nullable()
              .optional(),

          venueName:
            z.string()
              .trim()
              .max(200)
              .nullable()
              .optional(),

          venueAddress:
            z.string()
              .trim()
              .max(500)
              .nullable()
              .optional(),
        })
          .passthrough()
          .parse(
            request.body,
          );

      const body =
        eventCreateSchema.parse(
          request.body,
        );

      const tenant =
        companyId(request);

      const customer =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "commerce_customers",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&id=eq.${eq(
              body.customerId,
            )}`
            + "&limit=1",
        });

      if (!customer[0]) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "CUSTOMER_NOT_FOUND",
          });
      }

      const member =
        await getOrCreateTeamMember(
          request,
        );

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_events",

          method:
            "POST",

          body: {
            company_id:
              tenant,

            customer_id:
              body.customerId,

            title:
              body.title,

            event_type:
              body.eventType
              ?? "other",

            status:
              "lead",

            event_date:
              body.eventDate
              ?? null,



            event_end_date:


              extendedEventInput


                .eventEndDate


              ?? null,



            start_time:


              extendedEventInput


                .startTime


              ?? null,



            end_time:


              extendedEventInput


                .endTime


              ?? null,


            guest_count:
              body.guestCount
              ?? null,

            province:
              body.province
              ?? null,

            city:
              body.city
              ?? null,

            venue_name:
              body.venueName
              ?? null,

            venue_address:
              body.venueAddress
              ?? null,

            target_budget:
              body.targetBudget
              ?? null,

            currency:
              "EUR",

            customer_request:
              body.customerRequest
              ?? null,

            source_channel:
              body.sourceChannel
              ?? null,

            source_detail:
              body.sourceDetail
              ?? null,

            next_action:
              body.nextAction
              ?? null,

            next_action_at:
              body.nextActionAt
              ?? null,

            notes:
              body.notes
              ?? null,

            created_by_team_member_id:
              member.id,
          },
        });

      return response
        .status(201)
        .json({
          ok: true,
          event:
            rows[0],
        });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


crmRoutes.get(
  "/events/:eventId",
  async (
    request,
    response,
  ) => {
    try {
      const eventId =
        z.string()
          .uuid()
          .parse(
            request.params.eventId,
          );

      if (
        !await canAccessEvent(
          request,
          eventId,
        )
      ) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "EVENT_NOT_FOUND",
          });
      }

      const tenant =
        companyId(request);

      const eventRows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_events",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&id=eq.${eq(
              eventId,
            )}`
            + "&limit=1",
        });

      const requirements =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_event_requirements",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&event_id=eq.${eq(
              eventId,
            )}`
            + "&order=priority.desc,created_at.asc",
        });

      const assignments =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_event_assignments",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&event_id=eq.${eq(
              eventId,
            )}`
            + "&status=neq.cancelled",
        });

      return response.json({
        ok: true,
        event:
          eventRows[0],
        requirements,
        assignments,
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


crmRoutes.patch(
  "/events/:eventId",
  async (
    request,
    response,
  ) => {
    try {
      const eventId =
        z.string()
          .uuid()
          .parse(
            request.params.eventId,
          );

      if (
        !await canAccessEvent(
          request,
          eventId,
        )
      ) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "EVENT_NOT_FOUND",
          });
      }

      const body =
        eventUpdateSchema.parse(
          request.body,
        );

      const patch: DbRow = {};

      const map:
        Record<string, string> = {
          title:
            "title",
          eventType:
            "event_type",
          status:
            "status",
          eventDate:
            "event_date",
          guestCount:
            "guest_count",
          province:
            "province",
          city:
            "city",
          venueName:
            "venue_name",
          venueAddress:
            "venue_address",
          targetBudget:
            "target_budget",
          customerRequest:
            "customer_request",
          nextAction:
            "next_action",
          nextActionAt:
            "next_action_at",
          notes:
            "notes",
        };

      for (
        const [
          inputKey,
          dbKey,
        ]
        of Object.entries(map)
      ) {
        if (
          Object.prototype
            .hasOwnProperty
            .call(
              body,
              inputKey,
            )
        ) {
          patch[dbKey] =
            body[
              inputKey as
                keyof typeof body
            ];
        }
      }

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_events",

          method:
            "PATCH",

          query:
            `?company_id=eq.${eq(
              companyId(request),
            )}`
            + `&id=eq.${eq(
              eventId,
            )}`,

          body:
            patch,
        });

      return response.json({
        ok: true,
        event:
          rows[0],
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


/* ============================================================
 * EVENT REQUIREMENTS
 * ============================================================ */

const requirementSchema =
  z.object({
    categoryId:
      z.string().uuid(),

    requirementText:
      z.string()
        .trim()
        .max(3000)
        .optional()
        .nullable(),

    quantity:
      z.number()
        .positive()
        .optional(),

    budgetCap:
      z.number()
        .min(0)
        .optional()
        .nullable(),

    priority:
      z.number()
        .int()
        .min(0)
        .max(100)
        .optional(),
  });


const validRequirementContractStatusesV9 =
  new Set([
    "not_required",
    "pending",
    "generated",
    "sent",
    "signed",
    "cancelled",
  ]);


function normalizeRequirementContractStatusV9(
  value: unknown,
) {
  const status =
    typeof value === "string"
      ? value
      : "";

  return validRequirementContractStatusesV9
    .has(
      status,
    )
      ? status
      : "not_required";
}


crmRoutes.post(
  "/events/:eventId/requirements",
  async (
    request,
    response,
  ) => {
    try {
      const eventId =
        z.string()
          .uuid()
          .parse(
            request.params.eventId,
          );

      if (
        !await canAccessEvent(
          request,
          eventId,
        )
      ) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "EVENT_NOT_FOUND",
          });
      }

      const body =
        requirementSchema.parse(
          request.body,
        );

      const tenant =
        companyId(request);

      const existing =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_event_requirements",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&event_id=eq.${eq(
              eventId,
            )}`
            + `&category_id=eq.${eq(
              body.categoryId,
            )}`
            + "&limit=1",
        });

      if (existing[0]) {
        const rows =
          await supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_event_requirements",

            method:
              "PATCH",

            query:
              `?id=eq.${eq(
                String(
                  existing[0].id,
                ),
              )}`
              + `&company_id=eq.${eq(
                tenant,
              )}`,

            body: {
              status:
                "needed",

              contract_status:
                normalizeRequirementContractStatusV9(
                  existing[0]
                    .contract_status,
                ),

              requirement_text:
                body.requirementText
                ?? null,

              quantity:
                body.quantity
                ?? 1,

              budget_cap:
                body.budgetCap
                ?? null,

              priority:
                body.priority
                ?? 50,
            },
          });

        return response.json({
          ok: true,
          requirement:
            rows[0],
        });
      }

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_event_requirements",

          method:
            "POST",

          body: {
            company_id:
              tenant,

            event_id:
              eventId,

            category_id:
              body.categoryId,

            status:
              "needed",

            service_status:
              "pending",

            contract_status:
              "not_required",

            is_required:
              true,

            requirement_text:
              body.requirementText
              ?? null,

            quantity:
              body.quantity
              ?? 1,

            budget_cap:
              body.budgetCap
              ?? null,

            priority:
              body.priority
              ?? 50,
          },
        });

      return response
        .status(201)
        .json({
          ok: true,
          requirement:
            rows[0],
        });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


/* ============================================================
 * TEAM
 * ============================================================ */

crmRoutes.get(
  "/team",
  async (
    request,
    response,
  ) => {
    if (
      !requireAdmin(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_team_members",

          query:
            `?company_id=eq.${eq(
              companyId(request),
            )}`
            + "&active=eq.true"
            + "&order=name.asc",
        });

      return response.json({
        ok: true,
        members: rows,
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


/* ============================================================
 * EVENT ASSIGNMENTS
 *
 * capture       = consiguió el cliente
 * closing       = cerró la venta
 * coordination  = gestionó el evento
 * onsite        = responsable presencial
 * administration = apoyo administrativo
 * ============================================================ */

const assignmentSchema =
  z.object({
    teamMemberId:
      z.string().uuid(),

    participationType:
      z.enum([
        "capture",
        "closing",
        "coordination",
        "onsite",
        "administration",
      ]),

    notes:
      z.string()
        .trim()
        .max(3000)
        .optional()
        .nullable(),
  });

  crmRoutes.patch(
    "/events/:eventId/requirements/:requirementId",
    async (
      request,
      response,
    ) => {
      try {
        const eventId =
          z.string()
            .uuid()
            .parse(
              request.params.eventId,
            );

        const requirementId =
          z.string()
            .uuid()
            .parse(
              request.params.requirementId,
            );

        if (
          !await canAccessEvent(
            request,
            eventId,
          )
        ) {
          return response
            .status(404)
            .json({
              ok: false,
              error:
                "EVENT_NOT_FOUND",
            });
        }

        const tenant =
          companyId(request);

        const input =
          z.object({
            serviceName:
              z.string()
                .trim()
                .max(200)
                .nullable()
                .optional(),

            subcategory:
              z.string()
                .trim()
                .max(200)
                .nullable()
                .optional(),

            description:
              z.string()
                .trim()
                .max(4000)
                .nullable()
                .optional(),

            quantity:
              z.number()
                .int()
                .positive()
                .optional(),

            isRequired:
              z.boolean()
                .optional(),

            isCritical:
              z.boolean()
                .optional(),

            maxBudget:
              z.number()
                .nonnegative()
                .nullable()
                .optional(),

            serviceStatus:
              z.enum([
                "pending",
                "searching",
                "quoted",
                "approved",
                "confirmed",
                "completed",
                "cancelled",
              ])
                .optional(),

            responsibleTeamMemberId:
              z.string()
                .uuid()
                .nullable()
                .optional(),

            assignedProviderId:
              z.string()
                .uuid()
                .nullable()
                .optional(),

            providerCost:
              z.number()
                .nonnegative()
                .optional(),

            clientPrice:
              z.number()
                .nonnegative()
                .optional(),

            commercialTerms:
              z.string()
                .trim()
                .max(5000)
                .nullable()
                .optional(),

            depositRequired:
              z.number()
                .nonnegative()
                .optional(),

            depositPaid:
              z.number()
                .nonnegative()
                .optional(),

            providerPaymentDueDate:
              z.string()
                .nullable()
                .optional(),

            contractStatus:
              z.enum([
                "not_required",
                "pending",
                "generated",
                "sent",
                "signed",
                "cancelled",
              ])
                .optional(),

            arrivalTime:
              z.string()
                .nullable()
                .optional(),

            setupTime:
              z.string()
                .nullable()
                .optional(),

            technicalNeeds:
              z.string()
                .trim()
                .max(5000)
                .nullable()
                .optional(),

            operationalNotes:
              z.string()
                .trim()
                .max(5000)
                .nullable()
                .optional(),
          })
            .parse(
              request.body,
            );

        const patch:
          Record<string, unknown> = {};

        const put = (
          key: string,
          value: unknown,
        ) => {
          if (
            value !== undefined
          ) {
            patch[key] =
              value;
          }
        };

        put(
          "service_name",
          input.serviceName,
        );

        put(
          "subcategory",
          input.subcategory,
        );

        put(
          "description",
          input.description,
        );

        put(
          "quantity",
          input.quantity,
        );

        put(
          "is_required",
          input.isRequired,
        );

        put(
          "is_critical",
          input.isCritical,
        );

        put(
          "max_budget",
          input.maxBudget,
        );

        put(
          "service_status",
          input.serviceStatus,
        );

        put(
          "responsible_team_member_id",
          input.responsibleTeamMemberId,
        );

        put(
          "assigned_provider_id",
          input.assignedProviderId,
        );

        put(
          "provider_cost",
          input.providerCost,
        );

        put(
          "client_price",
          input.clientPrice,
        );

        put(
          "commercial_terms",
          input.commercialTerms,
        );

        put(
          "deposit_required",
          input.depositRequired,
        );

        put(
          "deposit_paid",
          input.depositPaid,
        );

        put(
          "provider_payment_due_date",
          input.providerPaymentDueDate,
        );

        put(
          "contract_status",
          input.contractStatus,
        );

        put(
          "arrival_time",
          input.arrivalTime,
        );

        put(
          "setup_time",
          input.setupTime,
        );

        put(
          "technical_needs",
          input.technicalNeeds,
        );

        put(
          "operational_notes",
          input.operationalNotes,
        );

        if (
          !Object.keys(
            patch,
          ).length
        ) {
          return response
            .status(400)
            .json({
              ok: false,
              error:
                "EMPTY_REQUIREMENT_PATCH",
            });
        }

        const rows =
          await supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_event_requirements",

            method:
              "PATCH",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`
              + `&event_id=eq.${eq(
                eventId,
              )}`
              + `&id=eq.${eq(
                requirementId,
              )}`,

            body:
              patch,

            prefer:
              "return=representation",
          });

        const requirement =
          rows?.[0];

        if (
          !requirement
        ) {
          return response
            .status(404)
            .json({
              ok: false,
              error:
                "REQUIREMENT_NOT_FOUND",
            });
        }

        return response.json({
          ok: true,
          requirement,
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

  crmRoutes.post(
    "/events/:eventId/mark-ready",
    async (
      request,
      response,
    ) => {
      try {
        const eventId =
          z.string()
            .uuid()
            .parse(
              request.params.eventId,
            );

        if (
          !await canAccessEvent(
            request,
            eventId,
          )
        ) {
          return response
            .status(404)
            .json({
              ok: false,
              error:
                "EVENT_NOT_FOUND",
            });
        }

        const tenant =
          companyId(request);

        const readinessRows =
          await supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_event_readiness",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`
              + `&event_id=eq.${eq(
                eventId,
              )}`
              + "&limit=1",
          });

        const readiness =
          readinessRows?.[0];

        const totalServices =
          Number(
            readiness
              ?.total_services
            ?? 0,
          );

        const criticalPending =
          Number(
            readiness
              ?.critical_pending
            ?? 0,
          );

        const withoutProvider =
          Number(
            readiness
              ?.without_provider
            ?? 0,
          );


        if (
          totalServices === 0
        ) {
          return response
            .status(409)
            .json({
              ok: false,

              error:
                "EVENT_NOT_READY",

              reason:
                "NO_SERVICES",

              readiness,
            });
        }


        if (
          criticalPending > 0
        ) {
          return response
            .status(409)
            .json({
              ok: false,

              error:
                "EVENT_NOT_READY",

              reason:
                "CRITICAL_SERVICES_PENDING",

              readiness,
            });
        }


        if (
          withoutProvider > 0
        ) {
          return response
            .status(409)
            .json({
              ok: false,

              error:
                "EVENT_NOT_READY",

              reason:
                "SERVICES_WITHOUT_PROVIDER",

              readiness,
            });
        }


        const rows =
          await supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_events",

            method:
              "PATCH",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`
              + `&id=eq.${eq(
                eventId,
              )}`,

            body: {
              status:
                "ready",
            },

            prefer:
              "return=representation",
          });


        return response.json({
          ok: true,

          event:
            rows?.[0]
            ?? null,

          readiness,
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



  crmRoutes.get(
    "/events/:eventId/readiness",
    async (
      request,
      response,
    ) => {
      try {
        const eventId =
          z.string()
            .uuid()
            .parse(
              request.params.eventId,
            );

        if (
          !await canAccessEvent(
            request,
            eventId,
          )
        ) {
          return response
            .status(404)
            .json({
              ok: false,
              error:
                "EVENT_NOT_FOUND",
            });
        }

        const tenant =
          companyId(request);

        const rows =
          await supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_event_readiness",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`
              + `&event_id=eq.${eq(
                eventId,
              )}`
              + "&limit=1",
          });

        return response.json({
          ok: true,

          readiness:
            rows?.[0]
            ?? {
              event_id:
                eventId,

              total_services:
                0,

              closed_services:
                0,

              open_services:
                0,

              critical_pending:
                0,

              without_provider:
                0,

              payments_pending:
                0,

              readiness_percent:
                0,

              critical_ready:
                true,
            },
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






crmRoutes.post(
  "/events/:eventId/assignments",
  async (
    request,
    response,
  ) => {
    if (
      !requireAdmin(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const eventId =
        z.string()
          .uuid()
          .parse(
            request.params.eventId,
          );

      const body =
        assignmentSchema.parse(
          request.body,
        );

      const tenant =
        companyId(request);

      const event =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_events",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&id=eq.${eq(
              eventId,
            )}`
            + "&limit=1",
        });

      if (!event[0]) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "EVENT_NOT_FOUND",
          });
      }

      const member =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_team_members",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&id=eq.${eq(
              body.teamMemberId,
            )}`
            + "&active=eq.true"
            + "&limit=1",
        });

      if (!member[0]) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "TEAM_MEMBER_NOT_FOUND",
          });
      }

      const existing =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_event_assignments",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&event_id=eq.${eq(
              eventId,
            )}`
            + `&team_member_id=eq.${eq(
              body.teamMemberId,
            )}`
            + `&participation_type=eq.${eq(
              body.participationType,
            )}`
            + "&limit=1",
        });

      if (existing[0]) {
        const rows =
          await supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_event_assignments",

            method:
              "PATCH",

            query:
              `?id=eq.${eq(
                String(existing[0].id),
              )}`
              + `&company_id=eq.${eq(
                tenant,
              )}`,

            body: {
              status:
                "assigned",

              notes:
                body.notes
                ?? null,
            },
          });

        return response.json({
          ok: true,
          assignment:
            rows[0],
        });
      }

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_event_assignments",

          method:
            "POST",

          body: {
            company_id:
              tenant,

            event_id:
              eventId,

            team_member_id:
              body.teamMemberId,

            participation_type:
              body.participationType,

            status:
              "assigned",

            notes:
              body.notes
              ?? null,
          },
        });

      return response
        .status(201)
        .json({
          ok: true,
          assignment:
            rows[0],
        });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


/* ============================================================
 * COMMISSION RULES
 * ============================================================ */

const commissionRuleSchema =
  z.object({
    name:
      z.string()
        .trim()
        .min(2)
        .max(180),

    participationType:
      z.enum([
        "capture",
        "closing",
        "coordination",
        "onsite",
        "administration",
      ]),

    calculationType:
      z.enum([
        "percent_margin",
        "fixed_amount",
      ]),

    percentValue:
      z.number()
        .min(0)
        .max(100)
        .optional()
        .nullable(),

    fixedAmount:
      z.number()
        .min(0)
        .optional()
        .nullable(),

    maxAmount:
      z.number()
        .min(0)
        .optional()
        .nullable(),

    priority:
      z.number()
        .int()
        .min(0)
        .max(10000)
        .optional(),
  });


crmRoutes.get(
  "/commission-rules",
  async (
    request,
    response,
  ) => {
    if (
      !requireAdmin(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_commission_rules",

          query:
            `?company_id=eq.${eq(
              companyId(request),
            )}`
            + "&active=eq.true"
            + "&order=priority.asc,created_at.desc",
        });

      return response.json({
        ok: true,
        rules: rows,
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


crmRoutes.post(
  "/commission-rules",
  async (
    request,
    response,
  ) => {
    if (
      !requireAdmin(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const body =
        commissionRuleSchema.parse(
          request.body,
        );

      if (
        body.calculationType
          === "percent_margin"
        && body.percentValue == null
      ) {
        return response
          .status(400)
          .json({
            ok: false,
            error:
              "PERCENT_VALUE_REQUIRED",
          });
      }

      if (
        body.calculationType
          === "fixed_amount"
        && body.fixedAmount == null
      ) {
        return response
          .status(400)
          .json({
            ok: false,
            error:
              "FIXED_AMOUNT_REQUIRED",
          });
      }

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_commission_rules",

          method:
            "POST",

          body: {
            company_id:
              companyId(request),

            name:
              body.name,

            participation_type:
              body.participationType,

            calculation_type:
              body.calculationType,

            percent_value:
              body.percentValue
              ?? null,

            fixed_amount:
              body.fixedAmount
              ?? null,

            max_amount:
              body.maxAmount
              ?? null,

            priority:
              body.priority
              ?? 100,

            active:
              true,
          },
        });

      return response
        .status(201)
        .json({
          ok: true,
          rule:
            rows[0],
        });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


/* ============================================================
 * QUOTES
 * ============================================================ */

const quoteItemSchema =
  z.object({
    categoryId:
      z.string()
        .uuid()
        .optional()
        .nullable(),

    providerId:
      z.string()
        .uuid()
        .optional()
        .nullable(),

    providerServiceId:
      z.string()
        .uuid()
        .optional()
        .nullable(),

    description:
      z.string()
        .trim()
        .min(2)
        .max(1000),

    quantity:
      z.number()
        .positive()
        .default(1),

    unitCost:
      z.number()
        .min(0)
        .optional(),

    unitPrice:
      z.number()
        .min(0),

    sortOrder:
      z.number()
        .int()
        .min(0)
        .optional(),
  });


const createQuoteSchema =
  z.object({
    eventId:
      z.string().uuid(),

    items:
      z.array(
        quoteItemSchema,
      )
        .min(1)
        .max(200),

    discountAmount:
      z.number()
        .min(0)
        .optional(),

    directExpenses:
      z.number()
        .min(0)
        .optional(),

    validUntil:
      z.string()
        .regex(
          /^\d{4}-\d{2}-\d{2}$/,
        )
        .optional()
        .nullable(),

    publicNotes:
      z.string()
        .trim()
        .max(5000)
        .optional()
        .nullable(),

    internalNotes:
      z.string()
        .trim()
        .max(5000)
        .optional()
        .nullable(),

    terms:
      z.string()
        .trim()
        .max(10000)
        .optional()
        .nullable(),
  });


function sellerQuote(
  row: DbRow,
): DbRow {
  const {
    provider_cost_total:
      _providerCost,

    commissionable_margin:
      _margin,

    internal_notes:
      _internalNotes,

    ...safe
  } = row;

  return safe;
}


function sellerQuoteItem(
  row: DbRow,
): DbRow {
  const {
    unit_cost:
      _unitCost,

    line_cost:
      _lineCost,

    ...safe
  } = row;

  return safe;
}


crmRoutes.post(
  "/quotes",
  async (
    request,
    response,
  ) => {
    try {
      const body =
        createQuoteSchema.parse(
          request.body,
        );

      if (
        !await canAccessEvent(
          request,
          body.eventId,
        )
      ) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "EVENT_NOT_FOUND",
          });
      }

      const tenant =
        companyId(request);

      const member =
        await getOrCreateTeamMember(
          request,
        );

      const normalizedItems:
        Array<Record<string, unknown>>
        = [];

      for (
        const item
        of body.items
      ) {
        let unitCost =
          isAdmin(request)
            ? item.unitCost ?? 0
            : 0;

        if (
          item.providerServiceId
        ) {
          const services =
            await supabaseRequest<
              DbRow[]
            >({
              table:
                "crm_provider_services",

              query:
                `?company_id=eq.${eq(
                  tenant,
                )}`
                + `&id=eq.${eq(
                  item.providerServiceId,
                )}`
                + "&active=eq.true"
                + "&limit=1",
            });

          const service =
            services[0];

          if (!service) {
            return response
              .status(400)
              .json({
                ok: false,
                error:
                  "PROVIDER_SERVICE_NOT_FOUND",
              });
          }

          if (!isAdmin(request)) {
            unitCost =
              Number(
                service.cost_from
                ?? 0,
              );
          }
        }

        normalizedItems.push({
          categoryId:
            item.categoryId
            ?? null,

          providerId:
            item.providerId
            ?? null,

          providerServiceId:
            item.providerServiceId
            ?? null,

          description:
            item.description,

          quantity:
            item.quantity,

          unitCost,

          unitPrice:
            item.unitPrice,

          sortOrder:
            item.sortOrder
            ?? normalizedItems.length,
        });
      }

      /*
       * El vendedor nunca decide gastos internos.
       * Solo admin puede enviarlos.
       */
      const directExpenses =
        isAdmin(request)
          ? body.directExpenses ?? 0
          : 0;

      const result =
        await supabaseRpc<
          Record<string, unknown>
        >(
          "crm_create_quote",
          {
            p_company_id:
              tenant,

            p_event_id:
              body.eventId,

            p_created_by_team_member_id:
              member.id,

            p_items:
              normalizedItems,

            p_discount_amount:
              body.discountAmount
              ?? 0,

            p_direct_expenses:
              directExpenses,

            p_valid_until:
              body.validUntil
              ?? null,

            p_public_notes:
              body.publicNotes
              ?? null,

            p_internal_notes:
              isAdmin(request)
                ? body.internalNotes
                  ?? null
                : null,

            p_terms:
              body.terms
              ?? null,
          },
        );

      if (isAdmin(request)) {
        return response
          .status(201)
          .json({
            ok: true,
            ...result,
          });
      }

 if (isAdmin(request)) {
        return response
          .status(201)
          .json({
            ok: true,
            ...result,
          });
      }

      const quote =
        result.quote &&
        typeof result.quote === "object"
          ? sellerQuote(
              result.quote as DbRow,
            )
          : result.quote;

      const items =
        Array.isArray(result.items)
          ? result.items.map(
              (item) =>
                sellerQuoteItem(
                  item as DbRow,
                ),
            )
          : [];

      return response
        .status(201)
        .json({
          ok: true,
          quote,
          items,
        });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


crmRoutes.get(
  "/events/:eventId/quotes",
  async (
    request,
    response,
  ) => {
    try {
      const eventId =
        z.string()
          .uuid()
          .parse(
            request.params.eventId,
          );

      if (
        !await canAccessEvent(
          request,
          eventId,
        )
      ) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "EVENT_NOT_FOUND",
          });
      }

      const tenant =
        companyId(request);

      const quotes =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_quotes",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&event_id=eq.${eq(
              eventId,
            )}`
            + "&order=version.desc",
        });

      if (isAdmin(request)) {
        return response.json({
          ok: true,
          quotes,
        });
      }

      return response.json({
        ok: true,

        quotes:
          quotes.map(
            sellerQuote,
          ),
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


crmRoutes.get(
  "/quotes/:quoteId/items",
  async (
    request,
    response,
  ) => {
    try {
      const quoteId =
        z.string()
          .uuid()
          .parse(
            request.params.quoteId,
          );

      const tenant =
        companyId(request);

      const quote =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_quotes",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&id=eq.${eq(
              quoteId,
            )}`
            + "&limit=1",
        });

      if (!quote[0]) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "QUOTE_NOT_FOUND",
          });
      }

      const eventId =
        String(
          quote[0].event_id,
        );

      if (
        !await canAccessEvent(
          request,
          eventId,
        )
      ) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "QUOTE_NOT_FOUND",
          });
      }

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_quote_items",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&quote_id=eq.${eq(
              quoteId,
            )}`
            + "&order=sort_order.asc,created_at.asc",
        });

      return response.json({
        ok: true,

        items:
          isAdmin(request)
            ? rows
            : rows.map(
                sellerQuoteItem,
              ),
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


/* ============================================================
 * ACCEPT QUOTE
 *
 * Solo ADMIN.
 * Al aceptar:
 * - fija importes
 * - confirma evento
 * - calcula margen
 * - genera comisiones
 * ============================================================ */

crmRoutes.post(
  "/quotes/:quoteId/accept",
  async (
    request,
    response,
  ) => {
    if (
      !requireAdmin(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const quoteId =
        z.string()
          .uuid()
          .parse(
            request.params.quoteId,
          );

      const member =
        await getOrCreateTeamMember(
          request,
        );

      const result =
        await supabaseRpc<
          Record<string, unknown>
        >(
          "crm_accept_quote",
          {
            p_company_id:
              companyId(request),

            p_quote_id:
              quoteId,

            p_approved_by_team_member_id:
              member.id,
          },
        );

      return response.json({
        ok: true,
        ...result,
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


/* ============================================================
 * COMMISSIONS
 * ============================================================ */

crmRoutes.get(
  "/events/:eventId/commissions",
  async (
    request,
    response,
  ) => {
    try {
      const eventId =
        z.string()
          .uuid()
          .parse(
            request.params.eventId,
          );

      if (
        !await canAccessEvent(
          request,
          eventId,
        )
      ) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "EVENT_NOT_FOUND",
          });
      }

      const tenant =
        companyId(request);

      if (isAdmin(request)) {
        const rows =
          await supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_event_commissions",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`
              + `&event_id=eq.${eq(
                eventId,
              )}`
              + "&order=created_at.asc",
          });

        return response.json({
          ok: true,
          commissions: rows,
        });
      }

      const member =
        await getOrCreateTeamMember(
          request,
        );

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_event_commissions",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&event_id=eq.${eq(
              eventId,
            )}`
            + `&team_member_id=eq.${eq(
              String(member.id),
            )}`
            + "&order=created_at.asc",
        });

      const safe =
        rows.map(
          (row) => ({
            id:
              row.id,

            event_id:
              row.event_id,

            participation_type:
              row.participation_type,

            commission_amount:
              row.commission_amount,

            status:
              row.status,

            payable_at:
              row.payable_at,

            paid_at:
              row.paid_at,
          }),
        );

      return response.json({
        ok: true,
        commissions: safe,
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


/* ============================================================
 * COMPLETE EVENT
 *
 * Solo admin.
 * locked commissions -> payable
 * ============================================================ */

crmRoutes.post(
  "/events/:eventId/complete",
  async (
    request,
    response,
  ) => {
    if (
      !requireAdmin(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const eventId =
        z.string()
          .uuid()
          .parse(
            request.params.eventId,
          );

      const result =
        await supabaseRpc<
          Record<string, unknown>
        >(
          "crm_complete_event",
          {
            p_company_id:
              companyId(request),

            p_event_id:
              eventId,
          },
        );

      return response.json({
        ok: true,
        ...result,
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);

/* ============================================================
 * OPERATIONAL ADMIN V2
 *
 * Administración desde frontend:
 * - categorías
 * - proveedores
 * - servicios de proveedores
 * - responsables/equipo
 *
 * No borrar registros físicamente:
 * se desactivan para preservar historial.
 * ============================================================ */


/* ============================================================
 * CATEGORIES
 * ============================================================ */

crmRoutes.patch(
  "/service-categories/:categoryId",
  async (
    request,
    response,
  ) => {
    if (
      !requireAdmin(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const categoryId =
        z.string()
          .uuid()
          .parse(
            request.params.categoryId,
          );

      const input =
        z.object({
          name:
            z.string()
              .trim()
              .min(2)
              .max(160)
              .optional(),
        })
          .parse(
            request.body,
          );

      const patch:
        Record<string, unknown> = {};

      if (
        input.name
        !== undefined
      ) {
        patch.name =
          input.name;
      }

      if (
        Object.keys(patch)
          .length === 0
      ) {
        return response
          .status(400)
          .json({
            ok: false,
            error:
              "NOTHING_TO_UPDATE",
          });
      }

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_service_categories",

          method:
            "PATCH",

          query:
            `?company_id=eq.${eq(
              companyId(request),
            )}`
            + `&id=eq.${eq(
              categoryId,
            )}`,

          body:
            patch,
        });

      if (!rows[0]) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "CATEGORY_NOT_FOUND",
          });
      }

      return response.json({
        ok: true,
        category:
          rows[0],
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


crmRoutes.delete(
  "/service-categories/:categoryId",
  async (
    request,
    response,
  ) => {
    if (
      !requireAdmin(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const categoryId =
        z.string()
          .uuid()
          .parse(
            request.params.categoryId,
          );

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_service_categories",

          method:
            "PATCH",

          query:
            `?company_id=eq.${eq(
              companyId(request),
            )}`
            + `&id=eq.${eq(
              categoryId,
            )}`,

          body: {
            active:
              false,
          },
        });

      if (!rows[0]) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "CATEGORY_NOT_FOUND",
          });
      }

      return response.json({
        ok: true,
        category:
          rows[0],
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


/* ============================================================
 * PROVIDERS
 * ============================================================ */

crmRoutes.patch(
  "/providers/:providerId",
  async (
    request,
    response,
  ) => {
    if (
      !requireAdmin(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const providerId =
        z.string()
          .uuid()
          .parse(
            request.params.providerId,
          );

      const input =
        providerSchema
          .partial()
          .parse(
            request.body,
          );

      const patch:
        Record<string, unknown> = {};

      if (
        input.name
        !== undefined
      ) {
        patch.name =
          input.name;
      }

      if (
        input.legalName
        !== undefined
      ) {
        patch.legal_name =
          input.legalName;
      }

      if (
        input.contactName
        !== undefined
      ) {
        patch.contact_name =
          input.contactName;
      }

      if (
        input.phone
        !== undefined
      ) {
        patch.phone =
          input.phone;
      }

      if (
        input.whatsapp
        !== undefined
      ) {
        patch.whatsapp =
          input.whatsapp;
      }

      if (
        input.email
        !== undefined
      ) {
        patch.email =
          input.email;
      }

      if (
        input.website
        !== undefined
      ) {
        patch.website =
          input.website;
      }

      if (
        input.taxId
        !== undefined
      ) {
        patch.tax_id =
          input.taxId;
      }

      if (
        input.province
        !== undefined
      ) {
        patch.province =
          input.province;
      }

      if (
        input.city
        !== undefined
      ) {
        patch.city =
          input.city;
      }

      if (
        input.address
        !== undefined
      ) {
        patch.address =
          input.address;
      }

      if (
        input.serviceArea
        !== undefined
      ) {
        patch.service_area =
          input.serviceArea;
      }

      if (
        input.internalRating
        !== undefined
      ) {
        patch.internal_rating =
          input.internalRating;
      }

      if (
        input.notes
        !== undefined
      ) {
        patch.notes =
          input.notes;
      }

      if (
        Object.keys(patch)
          .length === 0
      ) {
        return response
          .status(400)
          .json({
            ok: false,
            error:
              "NOTHING_TO_UPDATE",
          });
      }

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_providers",

          method:
            "PATCH",

          query:
            `?company_id=eq.${eq(
              companyId(request),
            )}`
            + `&id=eq.${eq(
              providerId,
            )}`,

          body:
            patch,
        });

      if (!rows[0]) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "PROVIDER_NOT_FOUND",
          });
      }

      return response.json({
        ok: true,
        provider:
          rows[0],
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


crmRoutes.delete(
  "/providers/:providerId",
  async (
    request,
    response,
  ) => {
    if (
      !requireAdmin(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const providerId =
        z.string()
          .uuid()
          .parse(
            request.params.providerId,
          );

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_providers",

          method:
            "PATCH",

          query:
            `?company_id=eq.${eq(
              companyId(request),
            )}`
            + `&id=eq.${eq(
              providerId,
            )}`,

          body: {
            status:
              "inactive",
          },
        });

      if (!rows[0]) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "PROVIDER_NOT_FOUND",
          });
      }

      return response.json({
        ok: true,
        provider:
          rows[0],
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


/* ============================================================
 * PROVIDER SERVICES
 * ============================================================ */

crmRoutes.patch(
  "/providers/:providerId/services/:serviceId",
  async (
    request,
    response,
  ) => {
    if (
      !requireAdmin(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const providerId =
        z.string()
          .uuid()
          .parse(
            request.params.providerId,
          );

      const serviceId =
        z.string()
          .uuid()
          .parse(
            request.params.serviceId,
          );

      const input =
        providerServiceSchema
          .partial()
          .parse(
            request.body,
          );

      const patch:
        Record<string, unknown> = {};

      if (
        input.categoryId
        !== undefined
      ) {
        patch.category_id =
          input.categoryId;
      }

      if (
        input.name
        !== undefined
      ) {
        patch.name =
          input.name;
      }

      if (
        input.description
        !== undefined
      ) {
        patch.description =
          input.description;
      }

      if (
        input.pricingModel
        !== undefined
      ) {
        patch.pricing_model =
          input.pricingModel;
      }

      if (
        input.costFrom
        !== undefined
      ) {
        patch.cost_from =
          input.costFrom;
      }

      if (
        input.costTo
        !== undefined
      ) {
        patch.cost_to =
          input.costTo;
      }

      if (
        input.suggestedClientPrice
        !== undefined
      ) {
        patch.suggested_client_price =
          input.suggestedClientPrice;
      }

      if (
        input.capacityMin
        !== undefined
      ) {
        patch.capacity_min =
          input.capacityMin;
      }

      if (
        input.capacityMax
        !== undefined
      ) {
        patch.capacity_max =
          input.capacityMax;
      }

      if (
        input.leadTimeDays
        !== undefined
      ) {
        patch.lead_time_days =
          input.leadTimeDays;
      }

      if (
        Object.keys(patch)
          .length === 0
      ) {
        return response
          .status(400)
          .json({
            ok: false,
            error:
              "NOTHING_TO_UPDATE",
          });
      }

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_provider_services",

          method:
            "PATCH",

          query:
            `?company_id=eq.${eq(
              companyId(request),
            )}`
            + `&provider_id=eq.${eq(
              providerId,
            )}`
            + `&id=eq.${eq(
              serviceId,
            )}`,

          body:
            patch,
        });

      if (!rows[0]) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "PROVIDER_SERVICE_NOT_FOUND",
          });
      }

      return response.json({
        ok: true,
        service:
          rows[0],
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


crmRoutes.delete(
  "/providers/:providerId/services/:serviceId",
  async (
    request,
    response,
  ) => {
    if (
      !requireAdmin(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const providerId =
        z.string()
          .uuid()
          .parse(
            request.params.providerId,
          );

      const serviceId =
        z.string()
          .uuid()
          .parse(
            request.params.serviceId,
          );

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_provider_services",

          method:
            "PATCH",

          query:
            `?company_id=eq.${eq(
              companyId(request),
            )}`
            + `&provider_id=eq.${eq(
              providerId,
            )}`
            + `&id=eq.${eq(
              serviceId,
            )}`,

          body: {
            active:
              false,
          },
        });

      if (!rows[0]) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "PROVIDER_SERVICE_NOT_FOUND",
          });
      }

      return response.json({
        ok: true,
        service:
          rows[0],
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


/* ============================================================
 * TEAM / RESPONSABLES
 * ============================================================ */

const operationalTeamMemberSchema =
  z.object({
    name:
      z.string()
        .trim()
        .min(2)
        .max(160),

    email:
      z.string()
        .trim()
        .email()
        .max(200)
        .optional()
        .nullable(),

    phone:
      z.string()
        .trim()
        .max(50)
        .optional()
        .nullable(),

    accessRole:
      z.enum([
        "admin",
        "seller",
      ])
        .optional(),
  });


crmRoutes.post(
  "/team",
  async (
    request,
    response,
  ) => {
    if (
      !requireAdmin(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const input =
        operationalTeamMemberSchema
          .parse(
            request.body,
          );

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_team_members",

          method:
            "POST",

          body: {
            company_id:
              companyId(request),

            name:
              input.name,

            email:
              input.email
              ?? null,

            phone:
              input.phone
              ?? null,

            access_role:
              input.accessRole
              ?? "seller",

            active:
              true,
          },
        });

      return response
        .status(201)
        .json({
          ok: true,
          member:
            rows[0],
        });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


crmRoutes.patch(
  "/team/:memberId",
  async (
    request,
    response,
  ) => {
    if (
      !requireAdmin(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const memberId =
        z.string()
          .uuid()
          .parse(
            request.params.memberId,
          );

      const input =
        operationalTeamMemberSchema
          .partial()
          .parse(
            request.body,
          );

      const patch:
        Record<string, unknown> = {};

      if (
        input.name
        !== undefined
      ) {
        patch.name =
          input.name;
      }

      if (
        input.email
        !== undefined
      ) {
        patch.email =
          input.email;
      }

      if (
        input.phone
        !== undefined
      ) {
        patch.phone =
          input.phone;
      }

      if (
        input.accessRole
        !== undefined
      ) {
        patch.access_role =
          input.accessRole;
      }

      if (
        Object.keys(patch)
          .length === 0
      ) {
        return response
          .status(400)
          .json({
            ok: false,
            error:
              "NOTHING_TO_UPDATE",
          });
      }

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_team_members",

          method:
            "PATCH",

          query:
            `?company_id=eq.${eq(
              companyId(request),
            )}`
            + `&id=eq.${eq(
              memberId,
            )}`,

          body:
            patch,
        });

      if (!rows[0]) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "TEAM_MEMBER_NOT_FOUND",
          });
      }

      return response.json({
        ok: true,
        member:
          rows[0],
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


crmRoutes.delete(
  "/team/:memberId",
  async (
    request,
    response,
  ) => {
    if (
      !requireAdmin(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const memberId =
        z.string()
          .uuid()
          .parse(
            request.params.memberId,
          );

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_team_members",

          method:
            "PATCH",

          query:
            `?company_id=eq.${eq(
              companyId(request),
            )}`
            + `&id=eq.${eq(
              memberId,
            )}`,

          body: {
            active:
              false,
          },
        });

      if (!rows[0]) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "TEAM_MEMBER_NOT_FOUND",
          });
      }

      return response.json({
        ok: true,
        member:
          rows[0],
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);

/* ============================================================
 * CUSTOMER ADMIN CRUD V1
 * ============================================================ */

crmRoutes.patch(
  "/customers/:customerId",
  async (
    request,
    response,
  ) => {
    if (
      !requireAdmin(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const customerId =
        z.string()
          .uuid()
          .parse(
            request.params.customerId,
          );

      const input =
        customerCreateSchema
          .partial()
          .parse(
            request.body,
          );

      const patch:
        Record<string, unknown> = {};

      if (input.name !== undefined) {
        patch.name =
          input.name;
      }

      if (input.whatsapp !== undefined) {
        patch.whatsapp =
          input.whatsapp;
      }

      if (input.email !== undefined) {
        patch.email =
          input.email;
      }

      if (input.province !== undefined) {
        patch.province =
          input.province;
      }

      if (input.city !== undefined) {
        patch.city =
          input.city;
      }

      if (input.address !== undefined) {
        patch.address =
          input.address;
      }

      if (input.notes !== undefined) {
        patch.notes =
          input.notes;
      }

      if (
        Object.keys(patch)
          .length === 0
      ) {
        return response
          .status(400)
          .json({
            ok: false,
            error:
              "NOTHING_TO_UPDATE",
          });
      }

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "commerce_customers",

          method:
            "PATCH",

          query:
            `?company_id=eq.${eq(
              companyId(request),
            )}`
            + `&id=eq.${eq(
              customerId,
            )}`,

          body:
            patch,
        });

      if (!rows[0]) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "CUSTOMER_NOT_FOUND",
          });
      }

      return response.json({
        ok: true,
        customer:
          rows[0],
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);


crmRoutes.delete(
  "/customers/:customerId",
  async (
    request,
    response,
  ) => {
    if (
      !requireAdmin(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const customerId =
        z.string()
          .uuid()
          .parse(
            request.params.customerId,
          );

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "commerce_customers",

          method:
            "PATCH",

          query:
            `?company_id=eq.${eq(
              companyId(request),
            )}`
            + `&id=eq.${eq(
              customerId,
            )}`,

          body: {
            status:
              "inactive",
          },
        });

      if (!rows[0]) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "CUSTOMER_NOT_FOUND",
          });
      }

      return response.json({
        ok: true,
        customer:
          rows[0],
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);





/* PROVIDER AVAILABILITY V1 */

const providerAvailabilityStatusSchema =
  z.enum([
    "unknown",
    "requested",
    "available",
    "tentative",
    "unavailable",
    "reserved",
  ]);


const providerAvailabilityPatchSchema =
  z.object({
    status:
      providerAvailabilityStatusSchema,

    notes:
      z.string()
        .trim()
        .max(3000)
        .nullable()
        .optional(),
  });


crmRoutes.get(
  "/events/:eventId/requirements/:requirementId/availability",
  async (
    request,
    response,
  ) => {
    try {
      const eventId =
        z.string()
          .uuid()
          .parse(
            request.params.eventId,
          );

      const requirementId =
        z.string()
          .uuid()
          .parse(
            request.params.requirementId,
          );


      if (
        !await canAccessEvent(
          request,
          eventId,
        )
      ) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "EVENT_NOT_FOUND",
          });
      }


      const tenant =
        companyId(
          request,
        );


      const requirementRows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_event_requirements",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&event_id=eq.${eq(
              eventId,
            )}`
            + `&id=eq.${eq(
              requirementId,
            )}`
            + "&limit=1",
        });


      if (
        !requirementRows[0]
      ) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "REQUIREMENT_NOT_FOUND",
          });
      }


      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_provider_availability",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&event_id=eq.${eq(
              eventId,
            )}`
            + `&requirement_id=eq.${eq(
              requirementId,
            )}`
            + "&order=updated_at.desc",
        });


      return response.json({
        ok: true,
        availability:
          rows ?? [],
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


crmRoutes.put(
  "/events/:eventId/requirements/:requirementId/availability/:providerId",
  async (
    request,
    response,
  ) => {
    try {
      const eventId =
        z.string()
          .uuid()
          .parse(
            request.params.eventId,
          );

      const requirementId =
        z.string()
          .uuid()
          .parse(
            request.params.requirementId,
          );

      const providerId =
        z.string()
          .uuid()
          .parse(
            request.params.providerId,
          );


      const input =
        providerAvailabilityPatchSchema
          .parse(
            request.body,
          );


      if (
        !await canAccessEvent(
          request,
          eventId,
        )
      ) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "EVENT_NOT_FOUND",
          });
      }


      const tenant =
        companyId(
          request,
        );


      const [
        eventRows,
        requirementRows,
        providerRows,
      ] =
        await Promise.all([
          supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_events",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`
              + `&id=eq.${eq(
                eventId,
              )}`
              + "&limit=1",
          }),

          supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_event_requirements",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`
              + `&event_id=eq.${eq(
                eventId,
              )}`
              + `&id=eq.${eq(
                requirementId,
              )}`
              + "&limit=1",
          }),

          supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_providers",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`
              + `&id=eq.${eq(
                providerId,
              )}`
              + "&limit=1",
          }),
        ]);


      const event =
        eventRows[0];

      const requirement =
        requirementRows[0];

      const provider =
        providerRows[0];


      if (!event) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "EVENT_NOT_FOUND",
          });
      }


      if (!requirement) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "REQUIREMENT_NOT_FOUND",
          });
      }


      if (!provider) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "PROVIDER_NOT_FOUND",
          });
      }


      const now =
        new Date()
          .toISOString();


      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_provider_availability",

          method:
            "POST",

          query:
            "?on_conflict="
            + "company_id,event_id,"
            + "requirement_id,provider_id",

          prefer:
            "resolution=merge-duplicates,"
            + "return=representation",

          body: {
            company_id:
              tenant,

            event_id:
              eventId,

            requirement_id:
              requirementId,

            provider_id:
              providerId,

            status:
              input.status,

            event_date:
              event.event_date
              ?? null,

            start_time:
              event.start_time
              ?? null,

            end_time:
              event.end_time
              ?? null,

            notes:
              input.notes
              ?? null,

            checked_at:
              input.status
              === "unknown"
                ? null
                : now,
          },
        });


      return response.json({
        ok: true,

        availability:
          rows?.[0]
          ?? null,
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


/* ============================================================
 * OPERATIONS_DASHBOARD_V1
 * Dashboard operativo real de Eventos Mediterráneo.
 * ============================================================ */

crmRoutes.get(
  "/operations/dashboard",
  async (
    request,
    response,
  ) => {
    try {
      const tenant =
        companyId(request);

      const today =
        new Date();

      today.setHours(
        0,
        0,
        0,
        0,
      );

      const horizon =
        new Date(
          today.getTime()
          + (
            30
            * 24
            * 60
            * 60
            * 1000
          ),
        );

      const [
        events,
        readinessRows,
        operations,
      ] =
        await Promise.all([
          supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_events",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`
              + "&order=event_date.asc,created_at.desc",
          }),

          supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_event_readiness",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`,
          }),

          supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_event_service_operations",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`,
          }),
        ]);

      const readinessByEvent =
        new Map<
          string,
          DbRow
        >();

      for (
        const row
        of readinessRows
      ) {
        const eventId =
          String(
            row.event_id
            ?? "",
          );

        if (eventId) {
          readinessByEvent.set(
            eventId,
            row,
          );
        }
      }

      const eventMap =
        new Map<
          string,
          DbRow
        >();

      for (
        const event
        of events
      ) {
        const id =
          String(
            event.id
            ?? "",
          );

        if (id) {
          eventMap.set(
            id,
            event,
          );
        }
      }

      const openStatuses =
        new Set([
          "new",
          "lead",
          "pending",
          "planning",
          "confirmed",
          "active",
          "in_progress",
          "pending_approval",
        ]);

      const activeEvents =
        events.filter(
          event => {
            const status =
              String(
                event.status
                ?? "",
              )
                .toLowerCase();

            return (
              !status
              || openStatuses.has(
                status,
              )
            );
          },
        );

      const upcomingEvents =
        activeEvents
          .filter(
            event => {
              const raw =
                String(
                  event.event_date
                  ?? "",
                );

              if (!raw) {
                return false;
              }

              const date =
                new Date(
                  `${raw.slice(
                    0,
                    10,
                  )}T12:00:00`,
                );

              return (
                !Number.isNaN(
                  date.getTime(),
                )
                && date >= today
                && date <= horizon
              );
            },
          )
          .slice(
            0,
            12,
          )
          .map(
            event => {
              const id =
                String(
                  event.id
                  ?? "",
                );

              const readiness =
                readinessByEvent
                  .get(
                    id,
                  );

              return {
                ...event,

                readiness:
                  readiness
                  ?? null,
              };
            },
          );

      const criticalServices =
        operations
          .filter(
            row =>
              Boolean(
                row.is_critical,
              )
              && ![
                "confirmed",
                "completed",
                "cancelled",
              ].includes(
                String(
                  row.service_status
                  ?? "",
                ),
              ),
          );

      const withoutProvider =
        operations
          .filter(
            row =>
              !row.assigned_provider_id
              && String(
                row.service_status
                ?? "",
              )
                !== "cancelled",
          );

      const paymentsPending =
        operations
          .filter(
            row => {
              const required =
                Number(
                  row.deposit_required
                  ?? 0,
                );

              const paid =
                Number(
                  row.deposit_paid
                  ?? 0,
                );

              return (
                required > paid
                && String(
                  row.service_status
                  ?? "",
                )
                  !== "cancelled"
              );
            },
          );

      const attentionEvents =
        activeEvents
          .map(
            event => {
              const id =
                String(
                  event.id
                  ?? "",
                );

              const readiness =
                readinessByEvent
                  .get(
                    id,
                  );

              const critical =
                Number(
                  readiness
                    ?.critical_pending
                  ?? 0,
                );

              const providers =
                Number(
                  readiness
                    ?.without_provider
                  ?? 0,
                );

              const payments =
                Number(
                  readiness
                    ?.payments_pending
                  ?? 0,
                );

              const readinessPercent =
                Number(
                  readiness
                    ?.readiness_percent
                  ?? 0,
                );

              const score =
                (
                  critical
                  * 100
                )
                + (
                  providers
                  * 20
                )
                + (
                  payments
                  * 10
                )
                + (
                  readinessPercent
                  < 100
                    ? 5
                    : 0
                );

              const rawEventDate =
                String(
                  event.event_date
                  ?? "",
                );

              const eventDate =
                rawEventDate
                  ? new Date(
                      `${rawEventDate.slice(
                        0,
                        10,
                      )}T12:00:00`,
                    )
                  : null;

              const daysUntilEvent =
                eventDate
                && !Number.isNaN(
                  eventDate.getTime(),
                )
                  ? Math.ceil(
                      (
                        eventDate.getTime()
                        - today.getTime()
                      )
                      / (
                        24
                        * 60
                        * 60
                        * 1000
                      ),
                    )
                  : null;

              let severity:
                | "critical"
                | "high"
                | "medium"
                | "low" =
                  "low";

              if (
                (
                  critical > 0
                  && daysUntilEvent !== null
                  && daysUntilEvent <= 3
                )
                || (
                  providers > 0
                  && daysUntilEvent !== null
                  && daysUntilEvent <= 7
                )
              ) {
                severity =
                  "critical";
              } else if (
                critical > 0
                || (
                  daysUntilEvent !== null
                  && daysUntilEvent <= 7
                  && (
                    providers > 0
                    || payments > 0
                  )
                )
              ) {
                severity =
                  "high";
              } else if (
                providers > 0
                || payments > 0
                || readinessPercent < 80
              ) {
                severity =
                  "medium";
              }

              const actions:
                Array<{
                  type: string;
                  priority:
                    | "high"
                    | "medium"
                    | "low";
                  title: string;
                  description: string;
                }> = [];

              if (
                critical > 0
              ) {
                actions.push({
                  type:
                    "critical_service",

                  priority:
                    "high",

                  title:
                    `${critical} servicio${critical === 1 ? "" : "s"} crítico${critical === 1 ? "" : "s"} pendiente${critical === 1 ? "" : "s"}`,

                  description:
                    "Debe confirmarse antes del evento.",
                });
              }

              if (
                providers > 0
              ) {
                actions.push({
                  type:
                    "provider_missing",

                  priority:
                    critical > 0
                      ? "high"
                      : "medium",

                  title:
                    `${providers} servicio${providers === 1 ? "" : "s"} sin proveedor`,

                  description:
                    "Buscar, contactar o asignar proveedor.",
                });
              }

              if (
                payments > 0
              ) {
                actions.push({
                  type:
                    "payment_pending",

                  priority:
                    "medium",

                  title:
                    `${payments} pago${payments === 1 ? "" : "s"} pendiente${payments === 1 ? "" : "s"}`,

                  description:
                    "Revisar anticipos de proveedores.",
                });
              }

              if (
                readinessPercent
                < 100
              ) {
                actions.push({
                  type:
                    "readiness",

                  priority:
                    readinessPercent
                    < 50
                      ? "high"
                      : "low",

                  title:
                    `Preparación ${readinessPercent}%`,

                  description:
                    "El evento todavía no está operativo al 100%.",
                });
              }

              return {
                ...event,

                readiness:
                  readiness
                  ?? null,

                attention: {
                  critical,
                  providers,
                  payments,
                  readinessPercent,
                  score,
                  daysUntilEvent,
                  severity,
                },

                actions,
              };
            },
          )
          .filter(
            event =>
              Number(
                event
                  .attention
                  .score,
              ) > 0,
          )
          .sort(
            (
              left,
              right,
            ) =>
              Number(
                right
                  .attention
                  .score,
              )
              - Number(
                left
                  .attention
                  .score,
              ),
          )
          .slice(
            0,
            20,
          );

      return response.json({
        ok:
          true,

        generatedAt:
          new Date()
            .toISOString(),

        counters: {
          activeEvents:
            activeEvents.length,

          upcomingEvents:
            upcomingEvents.length,

          attentionEvents:
            attentionEvents.length,

          criticalServices:
            criticalServices.length,

          withoutProvider:
            withoutProvider.length,

          paymentsPending:
            paymentsPending.length,
        },

        urgency: {
          critical:
            attentionEvents.filter(
              event =>
                event.attention
                  ?.severity
                === "critical",
            ).length,

          high:
            attentionEvents.filter(
              event =>
                event.attention
                  ?.severity
                === "high",
            ).length,

          medium:
            attentionEvents.filter(
              event =>
                event.attention
                  ?.severity
                === "medium",
            ).length,

          low:
            attentionEvents.filter(
              event =>
                event.attention
                  ?.severity
                === "low",
            ).length,
        },

        upcomingEvents,

        attentionEvents,

        criticalServices:
          criticalServices
            .slice(
              0,
              25,
            ),

        withoutProvider:
          withoutProvider
            .slice(
              0,
              25,
            ),

        paymentsPending:
          paymentsPending
            .slice(
              0,
              25,
            ),
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


/* ============================================================
 * PROVIDER_OPERATIONS_DASHBOARD_V1
 * Estado operativo de disponibilidad de proveedores.
 * ============================================================ */

crmRoutes.get(
  "/operations/providers",
  async (
    request,
    response,
  ) => {
    try {
      const tenant =
        companyId(request);

      const [
        availability,
        requirements,
        providers,
      ] =
        await Promise.all([
          supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_provider_availability",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`
              + "&order=checked_at.desc",
          }),

          supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_event_requirements",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`
              + "&service_status=neq.cancelled",
          }),

          supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_providers",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`
              + "&status=eq.active",
          }),
        ]);

      const providerById =
        new Map(
          providers.map(
            provider => [
              String(
                provider.id
                ?? "",
              ),
              provider,
            ],
          ),
        );

      const requirementById =
        new Map(
          requirements.map(
            requirement => [
              String(
                requirement.id
                ?? "",
              ),
              requirement,
            ],
          ),
        );

      const rows:
        Array<
          DbRow
          & {
            id?: string | null;
            event_id?: string | null;
            requirement_id?: string | null;
            provider_id?: string | null;
            status?: string | null;
            checked_at?: string | null;
            event_date?: string | null;
            start_time?: string | null;
            end_time?: string | null;
            notes?: string | null;
            provider:
              DbRow
              | null;
            requirement:
              DbRow
              | null;
          }
        > =
        availability.map(
          row => {
            const providerId =
              String(
                row.provider_id
                ?? "",
              );

            const requirementId =
              String(
                row.requirement_id
                ?? "",
              );

            return {
              ...row,

              provider:
                providerById
                  .get(
                    providerId,
                  )
                ?? null,

              requirement:
                requirementById
                  .get(
                    requirementId,
                  )
                ?? null,
            };
          },
        );

      const now =
        Date.now();

      const responseDeadlineMs =
        24
        * 60
        * 60
        * 1000;

      const overdue =
        rows.filter(
          row => {
            if (
              row.status
              !== "requested"
            ) {
              return false;
            }

            const checked =
              row.checked_at
              ? new Date(
                  String(
                    row.checked_at,
                  ),
                ).getTime()
              : NaN;

            if (
              Number.isNaN(
                checked,
              )
            ) {
              return true;
            }

            return (
              now
              - checked
              >= responseDeadlineMs
            );
          },
        );

      const statuses = {
        requested:
          rows.filter(
            row =>
              row.status
              === "requested",
          ),

        available:
          rows.filter(
            row =>
              row.status
              === "available",
          ),

        tentative:
          rows.filter(
            row =>
              row.status
              === "tentative",
          ),

        unavailable:
          rows.filter(
            row =>
              row.status
              === "unavailable",
          ),

        reserved:
          rows.filter(
            row =>
              row.status
              === "reserved",
          ),

        unknown:
          rows.filter(
            row =>
              !row.status
              || row.status
              === "unknown",
          ),
      };

      return response.json({
        ok:
          true,

        generatedAt:
          new Date()
            .toISOString(),

        counters: {
          total:
            rows.length,

          requested:
            statuses.requested.length,

          available:
            statuses.available.length,

          tentative:
            statuses.tentative.length,

          unavailable:
            statuses.unavailable.length,

          reserved:
            statuses.reserved.length,

          unknown:
            statuses.unknown.length,

          overdue:
            overdue.length,
        },

        overdue,

        ...statuses,
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


/* ============================================================
 * PROVIDER_MATCHING_SCORE_V1
 * Ranking explicable de proveedores para un requisito.
 * ============================================================ */

crmRoutes.get(
  "/events/:eventId/requirements/:requirementId/provider-candidates",
  async (
    request,
    response,
  ) => {
    try {
      const tenant =
        companyId(request);

      const {
        eventId,
        requirementId,
      } =
        request.params;

      const [
        events,
        requirements,
        providers,
        services,
        availability,
      ] =
        await Promise.all([
          supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_events",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`
              + `&id=eq.${eq(
                eventId,
              )}`
              + "&limit=1",
          }),

          supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_event_requirements",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`
              + `&id=eq.${eq(
                requirementId,
              )}`
              + "&limit=1",
          }),

          supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_providers",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`
              + "&status=eq.active",
          }),

          supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_provider_services",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`,
          }),

          supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_provider_availability",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`
              + `&event_id=eq.${eq(
                eventId,
              )}`
              + `&requirement_id=eq.${eq(
                requirementId,
              )}`,
          }),
        ]);

      const event =
        events?.[0];

      const requirement =
        requirements?.[0];

      if (
        !event
        || !requirement
      ) {
        return response
          .status(404)
          .json({
            error:
              "EVENT_OR_REQUIREMENT_NOT_FOUND",
          });
      }

      const availabilityByProvider =
        new Map(
          availability.map(
            item => [
              String(
                item.provider_id
                ?? "",
              ),
              item,
            ],
          ),
        );

      const candidates =
        providers
          .map(
            provider => {
              const providerId =
                String(
                  provider.id
                  ?? "",
                );

              const providerServices =
                services.filter(
                  service =>
                    String(
                      service.provider_id
                      ?? "",
                    )
                    === providerId,
                );

              const requiredCategory =
                String(
                  requirement.category_id
                  ?? "",
                );

              const categoryMatch =
                !requiredCategory
                || providerServices.some(
                  service =>
                    String(
                      service.category_id
                      ?? "",
                    )
                    === requiredCategory,
                );

              if (
                !categoryMatch
              ) {
                return null;
              }

              let score =
                50;

              const reasons:
                string[] = [];

              const providerCity =
                String(
                  provider.city
                  ?? "",
                )
                  .trim()
                  .toLowerCase();

              const eventCity =
                String(
                  event.city
                  ?? "",
                )
                  .trim()
                  .toLowerCase();

              if (
                providerCity
                && eventCity
                && providerCity
                === eventCity
              ) {
                score +=
                  15;

                reasons.push(
                  "Misma ciudad",
                );
              }

              const guestCount =
                Number(
                  event.guest_count
                  ?? 0,
                );

              const matchingServices =
                providerServices.filter(
                  service =>
                    !requiredCategory
                    || String(
                      service.category_id
                      ?? "",
                    )
                    === requiredCategory,
                );

              const capacityCompatible =
                matchingServices.some(
                  service => {
                    const minimum =
                      Number(
                        service.capacity_min
                        ?? 0,
                      );

                    const maximum =
                      Number(
                        service.capacity_max
                        ?? 0,
                      );

                    return (
                      (
                        !minimum
                        || guestCount >= minimum
                      )
                      && (
                        !maximum
                        || guestCount <= maximum
                      )
                    );
                  },
                );

              if (
                guestCount > 0
                && capacityCompatible
              ) {
                score += 10;

                reasons.push(
                  "Capacidad compatible",
                );
              }

              const maxBudget =
                Number(
                  requirement.max_budget
                  ?? 0,
                );

              const budgetCompatible =
                matchingServices.some(
                  service => {
                    const costFrom =
                      Number(
                        service.cost_from
                        ?? 0,
                      );

                    return (
                      maxBudget <= 0
                      || costFrom <= 0
                      || costFrom <= maxBudget
                    );
                  },
                );

              if (
                maxBudget > 0
                && budgetCompatible
              ) {
                score += 10;

                reasons.push(
                  "Compatible con presupuesto",
                );
              }

              const rating =
                Number(
                  provider.internal_rating
                  ?? 0,
                );

              if (
                Number.isFinite(
                  rating,
                )
                && rating > 0
              ) {
                score +=
                  Math.min(
                    15,
                    rating * 3,
                  );

                reasons.push(
                  `Rating ${rating}`,
                );
              }

              const availabilityRow =
                availabilityByProvider
                  .get(
                    providerId,
                  );

              const availabilityStatus =
                String(
                  availabilityRow
                    ?.status
                  ?? "unknown",
                );

              if (
                availabilityStatus
                === "available"
              ) {
                score +=
                  25;

                reasons.push(
                  "Disponible",
                );
              }

              if (
                availabilityStatus
                === "reserved"
              ) {
                score +=
                  30;

                reasons.push(
                  "Reservado",
                );
              }

              if (
                availabilityStatus
                === "tentative"
              ) {
                score +=
                  10;

                reasons.push(
                  "Disponibilidad tentativa",
                );
              }

              if (
                availabilityStatus
                === "unavailable"
              ) {
                score -=
                  100;

                reasons.push(
                  "No disponible",
                );
              }

              return {
                provider,

                services:
                  providerServices,

                availability:
                  availabilityRow
                  ?? null,

                score,

                reasons,
              };
            },
          )
          .filter(
            (
              item,
            ): item is NonNullable<
              typeof item
            > =>
              Boolean(item),
          )
          .sort(
            (
              left,
              right,
            ) =>
              right.score
              - left.score,
          );

      const recommended =
        candidates.filter(
          item =>
            String(
              item.availability
                ?.status
              ?? "unknown",
            )
            !== "unavailable",
        );

      const rejected =
        candidates.filter(
          item =>
            String(
              item.availability
                ?.status
              ?? "",
            )
            === "unavailable",
        );

      return response.json({
        ok:
          true,

        event,

        requirement,

        recommended,

        rejected,

        counters: {
          recommended:
            recommended.length,

          unavailable:
            rejected.length,
        },
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


/* ============================================================
 * EVENT_PROVIDER_SUMMARY_V1
 * Estado consolidado de proveedores de un evento.
 * ============================================================ */

crmRoutes.get(
  "/events/:eventId/provider-summary",
  async (
    request,
    response,
  ) => {
    try {
      const tenant =
        companyId(request);

      const {
        eventId,
      } =
        request.params;

      const [
        requirements,
        availability,
      ] =
        await Promise.all([
          supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_event_requirements",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`
              + `&event_id=eq.${eq(
                eventId,
              )}`,
          }),

          supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_provider_availability",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`
              + `&event_id=eq.${eq(
                eventId,
              )}`,
          }),
        ]);

      const activeRequirements =
        requirements.filter(
          requirement =>
            String(
              requirement.service_status
              ?? "",
            )
            !== "cancelled",
        );

      const withoutProvider =
        activeRequirements.filter(
          requirement =>
            !requirement
              .assigned_provider_id,
        );

      const confirmed =
        activeRequirements.filter(
          requirement =>
            [
              "confirmed",
              "completed",
            ].includes(
              String(
                requirement
                  .service_status
                ?? "",
              ),
            ),
        );

      const criticalOpen =
        activeRequirements.filter(
          requirement =>
            Boolean(
              requirement.is_critical,
            )
            && ![
              "confirmed",
              "completed",
            ].includes(
              String(
                requirement
                  .service_status
                ?? "",
              ),
            ),
        );

      const requested =
        availability.filter(
          item =>
            item.status
            === "requested",
        );

      const available =
        availability.filter(
          item =>
            item.status
            === "available",
        );

      const reserved =
        availability.filter(
          item =>
            item.status
            === "reserved",
        );

      return response.json({
        ok:
          true,

        eventId,

        counters: {
          totalServices:
            activeRequirements.length,

          withoutProvider:
            withoutProvider.length,

          confirmed:
            confirmed.length,

          criticalOpen:
            criticalOpen.length,

          requestsPending:
            requested.length,

          providersAvailable:
            available.length,

          providersReserved:
            reserved.length,
        },

        withoutProvider,

        criticalOpen,

        requested,

        available,

        reserved,
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


/* ============================================================
 * PROVIDER_AVAILABILITY_REQUEST_V1
 * Solicita disponibilidad a un proveedor por WhatsApp.
 * ============================================================ */

crmRoutes.post(
  "/events/:eventId/requirements/:requirementId/providers/:providerId/request-availability",
  async (
    request,
    response,
  ) => {
    try {
      const tenant =
        companyId(request);

      const {
        eventId,
        requirementId,
        providerId,
      } =
        request.params;

      const [
        events,
        requirements,
        providers,
      ] =
        await Promise.all([
          supabaseRequest<DbRow[]>({
            table:
              "crm_events",

            query:
              `?company_id=eq.${eq(tenant)}`
              + `&id=eq.${eq(eventId)}`
              + "&limit=1",
          }),

          supabaseRequest<DbRow[]>({
            table:
              "crm_event_requirements",

            query:
              `?company_id=eq.${eq(tenant)}`
              + `&id=eq.${eq(requirementId)}`
              + `&event_id=eq.${eq(eventId)}`
              + "&limit=1",
          }),

          supabaseRequest<DbRow[]>({
            table:
              "crm_providers",

            query:
              `?company_id=eq.${eq(tenant)}`
              + `&id=eq.${eq(providerId)}`
              + "&status=eq.active"
              + "&limit=1",
          }),
        ]);

      const event =
        events?.[0];

      const requirement =
        requirements?.[0];

      const provider =
        providers?.[0];

      if (
        !event
        || !requirement
        || !provider
      ) {
        return response
          .status(404)
          .json({
            error:
              "EVENT_REQUIREMENT_OR_PROVIDER_NOT_FOUND",
          });
      }

      const destination =
        String(
          provider.whatsapp
          ?? provider.phone
          ?? "",
        )
          .replace(
            /\D/g,
            "",
          );

      if (
        destination.length
        < 8
      ) {
        return response
          .status(400)
          .json({
            error:
              "PROVIDER_HAS_NO_VALID_WHATSAPP",
          });
      }

      const templateName =
        process.env
          .WHATSAPP_PROVIDER_AVAILABILITY_TEMPLATE
        ?? "";

      const language =
        process.env
          .WHATSAPP_PROVIDER_AVAILABILITY_LANGUAGE
        ?? "es";

      if (
        !templateName
      ) {
        return response
          .status(409)
          .json({
            error:
              "PROVIDER_AVAILABILITY_TEMPLATE_NOT_CONFIGURED",
          });
      }

      const {
        postWhatsappMessage,
      } =
        await import(
          "../services/whatsapp/whatsapp.client.js"
        );

      const eventTitle =
        String(
          event.title
          ?? event.event_type
          ?? "Evento",
        );

      const serviceName =
        String(
          requirement.service_name
          ?? requirement.description
          ?? "Servicio",
        );

      const eventDate =
        String(
          event.event_date
          ?? "Fecha por confirmar",
        )
          .slice(
            0,
            10,
          );

      const sendResult =
        await postWhatsappMessage({
          messaging_product:
            "whatsapp",

          to:
            destination,

          type:
            "template",

          template: {
            name:
              templateName,

            language: {
              code:
                language,
            },

            components: [
              {
                type:
                  "body",

                parameters: [
                  {
                    type:
                      "text",

                    text:
                      String(
                        provider.contact_name
                        ?? provider.name
                        ?? "Proveedor",
                      ),
                  },

                  {
                    type:
                      "text",

                    text:
                      serviceName,
                  },

                  {
                    type:
                      "text",

                    text:
                      eventDate,
                  },

                  {
                    type:
                      "text",

                    text:
                      eventTitle,
                  },
                ],
              },
            ],
          },
        });

      const messageId =
        sendResult
          ?.messages
          ?.[0]
          ?.id
        ?? null;

      const existing =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_provider_availability",

          query:
            `?company_id=eq.${eq(tenant)}`
            + `&event_id=eq.${eq(eventId)}`
            + `&requirement_id=eq.${eq(requirementId)}`
            + `&provider_id=eq.${eq(providerId)}`
            + "&limit=1",
        });

      const payload = {
        company_id:
          tenant,

        event_id:
          eventId,

        requirement_id:
          requirementId,

        provider_id:
          providerId,

        status:
          "requested",

        checked_at:
          new Date()
            .toISOString(),

        notes:
          messageId
            ? `WhatsApp message ${messageId}`
            : "Solicitud enviada por WhatsApp",
      };

      let availability:

        DbRow
        | null =
          null;

      if (
        existing?.[0]?.id
      ) {
        const updated =
          await supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_provider_availability",

            method:
              "PATCH",

            query:
              `?company_id=eq.${eq(tenant)}`
              + `&id=eq.${eq(String(existing[0].id))}`,

            body:
              payload,

            prefer:
              "return=representation",
          });

        availability =
          updated?.[0]
          ?? null;
      } else {
        const inserted =
          await supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_provider_availability",

            method:
              "POST",

            body:
              payload,

            prefer:
              "return=representation",
          });

        availability =
          inserted?.[0]
          ?? null;
      }

      return response.json({
        ok:
          true,

        availability,

        whatsapp: {
          messageId,
          destination,
          templateName,
        },
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


/* ============================================================
 * PROVIDER_ASSIGNMENT_ACTION_V1
 * Asigna definitivamente un proveedor a un servicio.
 * ============================================================ */

crmRoutes.post(
  "/events/:eventId/requirements/:requirementId/providers/:providerId/assign",
  async (
    request,
    response,
  ) => {
    try {
      const tenant =
        companyId(request);

      const {
        eventId,
        requirementId,
        providerId,
      } =
        request.params;

      const providers =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_providers",

          query:
            `?company_id=eq.${eq(tenant)}`
            + `&id=eq.${eq(providerId)}`
            + "&status=eq.active"
            + "&limit=1",
        });

      if (
        !providers?.[0]
      ) {
        return response
          .status(404)
          .json({
            error:
              "PROVIDER_NOT_FOUND",
          });
      }

      const requirements =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_event_requirements",

          query:
            `?company_id=eq.${eq(tenant)}`
            + `&event_id=eq.${eq(eventId)}`
            + `&id=eq.${eq(requirementId)}`
            + "&limit=1",
        });

      if (
        !requirements?.[0]
      ) {
        return response
          .status(404)
          .json({
            error:
              "REQUIREMENT_NOT_FOUND",
          });
      }

      const updatedRequirements =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_event_requirements",

          method:
            "PATCH",

          query:
            `?company_id=eq.${eq(tenant)}`
            + `&event_id=eq.${eq(eventId)}`
            + `&id=eq.${eq(requirementId)}`,

          body: {
            assigned_provider_id:
              providerId,

            service_status:
              "confirmed",

            updated_at:
              new Date()
                .toISOString(),
          },

          prefer:
            "return=representation",
        });

      const existingAvailability =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_provider_availability",

          query:
            `?company_id=eq.${eq(tenant)}`
            + `&event_id=eq.${eq(eventId)}`
            + `&requirement_id=eq.${eq(requirementId)}`
            + `&provider_id=eq.${eq(providerId)}`
            + "&limit=1",
        });

      if (
        existingAvailability?.[0]?.id
      ) {
        await supabaseRequest({
          table:
            "crm_provider_availability",

          method:
            "PATCH",

          query:
            `?company_id=eq.${eq(tenant)}`
            + `&id=eq.${eq(String(existingAvailability[0].id))}`,

          body: {
            status:
              "reserved",

            checked_at:
              new Date()
                .toISOString(),
          },
        });
      }

      return response.json({
        ok:
          true,

        requirement:
          updatedRequirements?.[0]
          ?? null,

        provider:
          providers[0],
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


/* ============================================================
 * PROVIDER_REPLACEMENT_ACTION_V1
 * Sustituye proveedor conservando historial.
 * ============================================================ */

crmRoutes.post(
  "/events/:eventId/requirements/:requirementId/providers/:providerId/replace",
  async (
    request,
    response,
  ) => {
    try {
      const tenant =
        companyId(request);

      const {
        eventId,
        requirementId,
        providerId,
      } =
        request.params;

      const currentRows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_event_requirements",

          query:
            `?company_id=eq.${eq(tenant)}`
            + `&event_id=eq.${eq(eventId)}`
            + `&id=eq.${eq(requirementId)}`
            + "&limit=1",
        });

      const current =
        currentRows?.[0];

      if (
        !current
      ) {
        return response
          .status(404)
          .json({
            error:
              "REQUIREMENT_NOT_FOUND",
          });
      }

      const previousProviderId =
        current.assigned_provider_id
          ? String(
              current.assigned_provider_id,
            )
          : null;

      const providers =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_providers",

          query:
            `?company_id=eq.${eq(tenant)}`
            + `&id=eq.${eq(providerId)}`
            + "&status=eq.active"
            + "&limit=1",
        });

      if (
        !providers?.[0]
      ) {
        return response
          .status(404)
          .json({
            error:
              "NEW_PROVIDER_NOT_FOUND",
          });
      }

      if (
        previousProviderId
        && previousProviderId
        !== providerId
      ) {
        await supabaseRequest({
          table:
            "crm_provider_availability",

          method:
            "PATCH",

          query:
            `?company_id=eq.${eq(tenant)}`
            + `&event_id=eq.${eq(eventId)}`
            + `&requirement_id=eq.${eq(requirementId)}`
            + `&provider_id=eq.${eq(previousProviderId)}`,

          body: {
            status:
              "available",

            checked_at:
              new Date()
                .toISOString(),
          },
        });
      }

      const updated =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_event_requirements",

          method:
            "PATCH",

          query:
            `?company_id=eq.${eq(tenant)}`
            + `&event_id=eq.${eq(eventId)}`
            + `&id=eq.${eq(requirementId)}`,

          body: {
            assigned_provider_id:
              providerId,

            service_status:
              "confirmed",

            updated_at:
              new Date()
                .toISOString(),
          },

          prefer:
            "return=representation",
        });

      return response.json({
        ok:
          true,

        previousProviderId,

        provider:
          providers[0],

        requirement:
          updated?.[0]
          ?? null,
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


/* ============================================================
 * PROVIDER_RELEASE_ACTION_V1
 * Quita la asignación y devuelve el servicio a búsqueda.
 * ============================================================ */

crmRoutes.post(
  "/events/:eventId/requirements/:requirementId/release-provider",
  async (
    request,
    response,
  ) => {
    try {
      const tenant =
        companyId(request);

      const {
        eventId,
        requirementId,
      } =
        request.params;

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_event_requirements",

          query:
            `?company_id=eq.${eq(tenant)}`
            + `&event_id=eq.${eq(eventId)}`
            + `&id=eq.${eq(requirementId)}`
            + "&limit=1",
        });

      const requirement =
        rows?.[0];

      if (
        !requirement
      ) {
        return response
          .status(404)
          .json({
            error:
              "REQUIREMENT_NOT_FOUND",
          });
      }

      const providerId =
        requirement.assigned_provider_id
          ? String(
              requirement.assigned_provider_id,
            )
          : null;

      const updated =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_event_requirements",

          method:
            "PATCH",

          query:
            `?company_id=eq.${eq(tenant)}`
            + `&event_id=eq.${eq(eventId)}`
            + `&id=eq.${eq(requirementId)}`,

          body: {
            assigned_provider_id:
              null,

            service_status:
              "searching",

            updated_at:
              new Date()
                .toISOString(),
          },

          prefer:
            "return=representation",
        });

      if (
        providerId
      ) {
        await supabaseRequest({
          table:
            "crm_provider_availability",

          method:
            "PATCH",

          query:
            `?company_id=eq.${eq(tenant)}`
            + `&event_id=eq.${eq(eventId)}`
            + `&requirement_id=eq.${eq(requirementId)}`
            + `&provider_id=eq.${eq(providerId)}`,

          body: {
            status:
              "available",

            checked_at:
              new Date()
                .toISOString(),
          },
        });
      }

      return response.json({
        ok:
          true,

        previousProviderId:
          providerId,

        requirement:
          updated?.[0]
          ?? null,
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


/* ============================================================
 * CRM_OPERATIONS_HEALTH_V1
 * Health check de las piezas operativas principales.
 * ============================================================ */

crmRoutes.get(
  "/operations/health",
  async (
    request,
    response,
  ) => {
    try {
      const tenant =
        companyId(request);

      const checks:
        Record<
          string,
          {
            ok: boolean;
            count?: number;
            error?: string;
          }
        > =
          {};

      const tables = [
        "crm_events",
        "crm_event_requirements",
        "crm_providers",
        "crm_provider_services",
        "crm_provider_availability",
        "crm_event_readiness",
      ];

      for (
        const table
        of tables
      ) {
        try {
          const rows =
            await supabaseRequest<
              DbRow[]
            >({
              table,

              query:
                `?company_id=eq.${eq(tenant)}`
                + "&limit=5",
            });

          checks[table] = {
            ok:
              true,

            count:
              rows.length,
          };
        } catch (
          error
        ) {
          checks[table] = {
            ok:
              false,

            error:
              error
                instanceof Error
                ? error.message
                : "UNKNOWN_ERROR",
          };
        }
      }

      const healthy =
        Object.values(
          checks,
        )
          .every(
            check =>
              check.ok,
          );

      return response
        .status(
          healthy
            ? 200
            : 503,
        )
        .json({
          ok:
            healthy,

          generatedAt:
            new Date()
              .toISOString(),

          checks,
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


/* ============================================================
 * EVENT_360_SUMMARY_V2
 * Resumen consolidado del evento.
 *
 * TENANCY:
 * 1. validar primero crm_events por company_id + eventId
 * 2. sólo entonces leer tablas hijas por event_id
 * ============================================================ */

crmRoutes.get(
  "/events/:eventId/360",
  async (
    request,
    response,
  ) => {
    try {
      const tenant =
        companyId(request);

      const {
        eventId,
      } =
        request.params;

      /*
       * SECURITY BOUNDARY
       *
       * El evento es la raíz tenant-aware.
       * Ninguna tabla hija se consulta antes
       * de demostrar que el evento pertenece
       * a la empresa autenticada.
       */
      const events =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_events",

          query:
            `?company_id=eq.${eq(tenant)}`
            + `&id=eq.${eq(eventId)}`
            + "&limit=1",
        });

      const event =
        events?.[0];

      if (!event) {
        return response
          .status(404)
          .json({
            error:
              "EVENT_NOT_FOUND",
          });
      }

      /*
       * Después de validar ownership,
       * event_id funciona como frontera
       * de acceso para los recursos hijos.
       */
      const [
        requirements,
        readinessRows,
        availability,
        quotes,
      ] =
        await Promise.all([
          supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_event_requirements",

            query:
              `?event_id=eq.${eq(eventId)}`,
          }),

          supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_event_readiness",

            query:
              `?event_id=eq.${eq(eventId)}`
              + "&limit=1",
          }),

          supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_provider_availability",

            query:
              `?event_id=eq.${eq(eventId)}`
              + "&order=checked_at.desc.nullslast",
          }),

          supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_quotes",

            query:
              `?event_id=eq.${eq(eventId)}`
              + "&order=created_at.desc",
          }),
        ]);

      const activeRequirements =
        requirements.filter(
          item =>
            String(
              item.service_status
              ?? "",
            )
            !== "cancelled",
        );

      const confirmedServices =
        activeRequirements.filter(
          item =>
            [
              "confirmed",
              "completed",
            ].includes(
              String(
                item.service_status
                ?? "",
              ),
            ),
        );

      const criticalOpen =
        activeRequirements.filter(
          item =>
            Boolean(
              item.is_critical,
            )
            && ![
              "confirmed",
              "completed",
            ].includes(
              String(
                item.service_status
                  ?? "",
              ),
            ),
        );

      const withoutProvider =
        activeRequirements.filter(
          item =>
            !item
              .assigned_provider_id,
        );

      const providerRequests =
        availability.filter(
          item =>
            String(
              item.status
              ?? "",
            )
            === "requested",
        );

      const providersAvailable =
        availability.filter(
          item =>
            String(
              item.status
              ?? "",
            )
            === "available",
        );

      return response.json({
        ok:
          true,

        version:
          "EVENT_360_SUMMARY_V2",

        event,

        readiness:
          readinessRows?.[0]
          ?? null,

        requirements,

        availability,

        quotes,

        counters: {
          services:
            activeRequirements.length,

          confirmedServices:
            confirmedServices.length,

          criticalOpen:
            criticalOpen.length,

          withoutProvider:
            withoutProvider.length,

          providerRequests:
            providerRequests.length,

          providersAvailable:
            providersAvailable.length,

          quotes:
            quotes.length,
        },

        generatedAt:
          new Date()
            .toISOString(),
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


