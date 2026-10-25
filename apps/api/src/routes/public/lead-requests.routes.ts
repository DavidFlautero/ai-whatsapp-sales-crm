import {
  Router,
  type Response,
} from "express";

import {
  z,
  ZodError,
} from "zod";

import {
  supabaseRequest,
} from "../../services/db/supabase-rest.client.js";

export const publicLeadRequestRoutes =
  Router();

type DbRow =
  Record<string, unknown>;

const COMPANY_ID =
  process.env.PUBLIC_EVENTS_COMPANY_ID
    ?.trim()
  || "eventos-mediterraneo";

const requestSchema =
  z.object({
    customerName:
      z.string()
        .trim()
        .min(2)
        .max(160),

    whatsapp:
      z.string()
        .trim()
        .min(6)
        .max(50),

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
        .min(2)
        .max(80),

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

        eventStartTime:
      z.string()
        .regex(
          /^([01]\d|2[0-3]):[0-5]\d$/,
        )
        .optional()
        .nullable(),

    eventEndTime:
      z.string()
        .regex(
          /^([01]\d|2[0-3]):[0-5]\d$/,
        )
        .optional()
        .nullable(),

dateFlexible:
      z.boolean()
        .optional(),

    alternativeDate:
      z.string()
        .trim()
        .optional()
        .nullable(),

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
        z.string()
          .trim()
          .min(1)
          .max(100),
      )
        .max(30)
        .optional(),

    customerMessage:
      z.string()
        .trim()
        .max(8000)
        .optional()
        .nullable(),

    preferredMunicipalityId:
      z.string()
        .trim()
        .max(20)
        .optional()
        .nullable(),

    locationFlexibility:
      z.enum([
        "exact",
        "nearby",
        "province",
        "advice",
      ])
        .optional()
        .nullable(),

    searchRadiusKm:
      z.union([
        z.literal(10),
        z.literal(25),
        z.literal(50),
        z.literal(100),
      ])
        .optional()
        .nullable(),

    alternativeLocations:
      z.array(
        z.object({
          municipalityId:
            z.string()
              .trim()
              .max(20)
              .optional()
              .nullable(),

          name:
            z.string()
              .trim()
              .max(160),

          province:
            z.string()
              .trim()
              .max(120)
              .optional()
              .nullable(),
        }),
      )
        .max(10)
        .optional(),

    hasVenue:
      z.boolean()
        .optional()
        .nullable(),

    existingVenueName:
      z.string()
        .trim()
        .max(200)
        .optional()
        .nullable(),

    existingVenueAddress:
      z.string()
        .trim()
        .max(400)
        .optional()
        .nullable(),

    budgetScope:
      z.enum([
        "full_event",
        "selected_services",
        "unknown",
      ])
        .optional()
        .nullable(),

    source:
      z.string()
        .trim()
        .max(80)
        .optional(),
  });

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
    "[PUBLIC LEAD REQUEST]",
    error,
  );

  return response
    .status(500)
    .json({
      ok: false,
      error:
        "LEAD_REQUEST_INTERNAL_ERROR",
    });
}

publicLeadRequestRoutes.post(
  "/",
  async (
    request,
    response,
  ) => {
    try {
      const body =
        requestSchema.parse(
          request.body,
        );

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_lead_requests",

          method:
            "POST",

          body: {
            company_id:
              COMPANY_ID,

            status:
              "new",

            source:
              body.source
              ?? "web",

            customer_name:
              body.customerName,

            whatsapp:
              body.whatsapp,

            email:
              body.email
              ?? null,

            event_type:
              body.eventType,

            service_mode:
              body.serviceMode
              ?? null,

            event_date:
              body.eventDate
              || null,

           
              event_start_time:
                body.eventStartTime
                || null,

              event_end_time:
                body.eventEndTime
                || null,
 date_flexible:
              body.dateFlexible
              ?? false,

            alternative_date:
              body.alternativeDate
              || null,

            autonomous_community:
              body.autonomousCommunity
              ?? null,

            province:
              body.province
              ?? null,

            municipality:
              body.municipality
              ?? null,

            postal_code:
              body.postalCode
              ?? null,

            guest_count:
              body.guestCount
              ?? null,

            budget_initial:
              body.budgetInitial
              ?? null,

            budget_max:
              body.budgetMax
              ?? null,

            requested_services:
              body.requestedServices
              ?? [],

            customer_message:
              body.customerMessage
              ?? null,

            preferred_municipality_id:
              body.preferredMunicipalityId
              ?? null,

            location_flexibility:
              body.locationFlexibility
              ?? null,

            search_radius_km:
              body.searchRadiusKm
              ?? null,

            alternative_locations:
              body.alternativeLocations
              ?? [],

            has_venue:
              body.hasVenue
              ?? null,

            existing_venue_name:
              body.existingVenueName
              ?? null,

            existing_venue_address:
              body.existingVenueAddress
              ?? null,

            budget_scope:
              body.budgetScope
              ?? null,

            metadata: {
              captured_at:
                new Date()
                  .toISOString(),

              channel:
                "public_intake",
            },
          },
        });

      const created =
        rows[0];

      return response
        .status(201)
        .json({
          ok: true,

          request: {
            id:
              created?.id,

            publicToken:
              created
                ?.public_token,

            status:
              created
                ?.status,
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
