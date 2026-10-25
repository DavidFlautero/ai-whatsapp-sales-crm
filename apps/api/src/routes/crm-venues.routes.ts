import { crmVenueCalendarRoutes } from "./crm-venue-calendar.routes.js";
import {
  Router,
  type Request,
  type Response,
} from "express";

import multer from "multer";

import {
  z,
  ZodError,
} from "zod";

import {
  supabaseRequest,
} from "../services/db/supabase-rest.client.js";

import {
  deleteVenueImageFile,
  uploadVenueImage,
} from "../services/crm/venue-image.service.js";

import {
  deleteVenueMediaFile,
  uploadVenueVideo,
} from "../services/crm/venue-media.service.js";

import {
  rankVenueImages,
} from "../services/crm/venue-image-ranking.service.js";


export const crmVenuesRoutes =
  Router();


type DbRow =
  Record<string, unknown>;


const adminRoles =
  new Set([
    "superadmin",
    "owner",
    "admin",
    "supervisor",
  ]);


const venueImageUpload =
  multer({
    storage:
      multer.memoryStorage(),

    limits: {
      fileSize:
        40 * 1024 * 1024,

      files:
        12,
    },
  });


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


function isAdmin(
  request: Request,
) {
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
) {
  if (!isAdmin(request)) {
    response
      .status(403)
      .json({
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
) {
  return encodeURIComponent(
    value,
  );
}


function slugify(
  input: string,
) {
  return input
    .trim()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    )
    .slice(
      0,
      160,
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
    "[CRM VENUES]",
    error,
  );

  return response
    .status(500)
    .json({
      ok: false,
      error:
        "CRM_VENUE_INTERNAL_ERROR",
    });
}


const venueSchema =
  z.object({
    providerId:
      z.string()
        .uuid(),

    name:
      z.string()
        .trim()
        .min(2)
        .max(220),

    slug:
      z.string()
        .trim()
        .max(180)
        .optional()
        .nullable(),

    description:
      z.string()
        .trim()
        .max(12000)
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
        .max(500)
        .optional()
        .nullable(),

    publicLocation:
      z.string()
        .trim()
        .max(300)
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

    costFrom:
      z.number()
        .min(0)
        .optional(),

    clientPriceFrom:
      z.number()
        .min(0)
        .optional(),

    currency:
      z.string()
        .trim()
        .min(3)
        .max(3)
        .optional(),

    features:
      z.array(
        z.string()
          .trim()
          .min(1)
          .max(120),
      )
        .max(80)
        .optional(),

    includedServices:
      z.array(
        z.string()
          .trim()
          .min(1)
          .max(160),
      )
        .max(80)
        .optional(),

    suitableFor:
      z.array(
        z.string()
          .trim()
          .min(1)
          .max(120),
      )
        .max(50)
        .optional(),

    rentalModes:
      z.array(
        z.enum([
          "day",
          "multi_day",
          "week",
          "fortnight",
          "accommodation",
        ]),
      )
        .max(10)
        .optional(),

    eventTypesAllowed:
      z.array(
        z.string()
          .trim()
          .min(1)
          .max(80),
      )
        .max(30)
        .optional(),

    eventsAllowed:
      z.boolean()
        .optional(),

    partiesAllowed:
      z.boolean()
        .optional(),

    maxEventGuests:
      z.number()
        .int()
        .min(0)
        .optional()
        .nullable(),

    maxSleepingGuests:
      z.number()
        .int()
        .min(0)
        .optional()
        .nullable(),

    defaultStartTime:
      z.string()
        .regex(
          /^([01]\d|2[0-3]):[0-5]\d$/,
        )
        .optional()
        .nullable(),

    defaultEndTime:
      z.string()
        .regex(
          /^([01]\d|2[0-3]):[0-5]\d$/,
        )
        .optional()
        .nullable(),

    musicEndTime:
      z.string()
        .regex(
          /^([01]\d|2[0-3]):[0-5]\d$/,
        )
        .optional()
        .nullable(),

    latitude:
      z.number()
        .min(-90)
        .max(90)
        .optional()
        .nullable(),

    longitude:
      z.number()
        .min(-180)
        .max(180)
        .optional()
        .nullable(),

    deposit:
      z.number()
        .min(0)
        .optional(),

    cleaningFee:
      z.number()
        .min(0)
        .optional(),

    venueRules:
      z.record(
        z.string(),
        z.union([
          z.string(),
          z.number(),
          z.boolean(),
          z.null(),
        ]),
      )
        .optional(),

    publicNotes:
      z.string()
        .trim()
        .max(8000)
        .optional()
        .nullable(),

    internalNotes:
      z.string()
        .trim()
        .max(8000)
        .optional()
        .nullable(),

    status:
      z.enum([
        "draft",
        "published",
        "archived",
      ])
        .optional(),
  });


const venuePatchSchema =
  venueSchema
    .partial();


async function ensureProvider(
  tenant: string,
  providerId: string,
) {
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
        + `&id=eq.${eq(
          providerId,
        )}`
        + "&select=id,name"
        + "&limit=1",
    });

  return rows[0]
    ?? null;
}


crmVenuesRoutes.get(
  "/venues",
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
            "crm_venues",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + "&order=created_at.desc",
        });

      return response.json({
        ok: true,
        venues:
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


crmVenuesRoutes.get(
  "/venues/:venueId",
  async (
    request,
    response,
  ) => {
    try {
      const venueId =
        z.string()
          .uuid()
          .parse(
            request.params
              .venueId,
          );

      const tenant =
        companyId(request);

      const [
        venues,
        images,
      ] =
        await Promise.all([
          supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_venues",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`
              + `&id=eq.${eq(
                venueId,
              )}`
              + "&limit=1",
          }),

          supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_venue_images",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`
              + `&venue_id=eq.${eq(
                venueId,
              )}`
              + "&order=sort_order.asc,created_at.asc",
          }),
        ]);

      if (!venues[0]) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "VENUE_NOT_FOUND",
          });
      }

      
      // EVENTOS_SHARED_OWNER_MEDIA_V1
      const [ownerAssets, crmVideos] = await Promise.all([
        supabaseRequest<DbRow[]>({
          table: "crm_venue_owner_assets",
          query:
            `?company_id=eq.${eq(tenant)}`
            + `&venue_id=eq.${eq(venueId)}`
            + "&order=created_at.asc",
        }),
        supabaseRequest<DbRow[]>({
          table: "crm_venue_videos",
          query:
            `?company_id=eq.${eq(tenant)}`
            + `&venue_id=eq.${eq(venueId)}`,
        }),
      ]);

      const nativeUrls = new Set(
        images.map(image => String(image.url ?? ""))
      );

      const unifiedImages = [
        ...images,
        ...ownerAssets
          .filter(asset =>
            asset.kind === "image"
            && typeof asset.url === "string"
            && !nativeUrls.has(asset.url)
          )
          .map((asset, index) => ({
            ...asset,
            role: asset.is_cover === true ? "cover" : "gallery",
            is_visible: true,
            sort_order: 10000 + index,
            source: "owner",
          })),
      ];

      const unifiedVideos = [
        ...crmVideos,
        ...ownerAssets.filter(asset => asset.kind === "video"),
      ];

return response.json({
        ok: true,
        venue:
          venues[0],
        images: unifiedImages,
        videos: unifiedVideos,
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


crmVenuesRoutes.post(
  "/venues",
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
        venueSchema.parse(
          request.body,
        );

      const tenant =
        companyId(request);

      const provider =
        await ensureProvider(
          tenant,
          body.providerId,
        );

      if (!provider) {
        return response
          .status(400)
          .json({
            ok: false,
            error:
              "PROVIDER_NOT_FOUND",
          });
      }


      let slug =
        slugify(
          body.slug
          || body.name,
        );

      if (!slug) {
        slug =
          `espacio-${Date.now()}`;
      }


      const existing =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_venues",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&slug=eq.${eq(
              slug,
            )}`
            + "&select=id"
            + "&limit=1",
        });

      if (existing[0]) {
        slug =
          `${slug}-${Date.now()
            .toString()
            .slice(-6)}`;
      }


      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_venues",

          method:
            "POST",

          body: {
            company_id:
              tenant,

            provider_id:
              body.providerId,

            name:
              body.name,

            slug,

            status:
              body.status
              ?? "draft",

            description:
              body.description
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

            public_location:
              body.publicLocation
              ?? null,

            capacity_min:
              body.capacityMin
              ?? null,

            capacity_max:
              body.capacityMax
              ?? null,

            cost_from:
              body.costFrom
              ?? 0,

            client_price_from:
              body.clientPriceFrom
              ?? 0,

            currency:
              body.currency
              ?? "EUR",

            features:
              body.features
              ?? [],

            included_services:
              body.includedServices
              ?? [],

            suitable_for:
              body.suitableFor
              ?? [],

            rental_modes:
              body.rentalModes
              ?? [],

            event_types_allowed:
              body.eventTypesAllowed
              ?? [],

            events_allowed:
              body.eventsAllowed
              ?? true,

            parties_allowed:
              body.partiesAllowed
              ?? true,

            max_event_guests:
              body.maxEventGuests
              ?? body.capacityMax
              ?? null,

            max_sleeping_guests:
              body.maxSleepingGuests
              ?? null,

            default_start_time:
              body.defaultStartTime
              || null,

            default_end_time:
              body.defaultEndTime
              || null,

            music_end_time:
              body.musicEndTime
              || null,

            latitude:
              body.latitude
              ?? null,

            longitude:
              body.longitude
              ?? null,

            deposit:
              body.deposit
              ?? 0,

            cleaning_fee:
              body.cleaningFee
              ?? 0,

            venue_rules:
              body.venueRules
              ?? {},

            public_notes:
              body.publicNotes
              ?? null,

            internal_notes:
              body.internalNotes
              ?? null,

            published_at:
              body.status
              === "published"
                ? new Date()
                  .toISOString()
                : null,
          },
        });


      return response
        .status(201)
        .json({
          ok: true,
          venue:
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


crmVenuesRoutes.patch(
  "/venues/:venueId",
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
      const venueId =
        z.string()
          .uuid()
          .parse(
            request.params
              .venueId,
          );

      const body =
        venuePatchSchema
          .parse(
            request.body,
          );

      const tenant =
        companyId(request);


      if (
        body.providerId
      ) {
        const provider =
          await ensureProvider(
            tenant,
            body.providerId,
          );

        if (!provider) {
          return response
            .status(400)
            .json({
              ok: false,
              error:
                "PROVIDER_NOT_FOUND",
            });
        }
      }


      const patch:
        Record<
          string,
          unknown
        > = {};


      if (
        body.providerId
        !== undefined
      ) {
        patch.provider_id =
          body.providerId;
      }

      if (
        body.name
        !== undefined
      ) {
        patch.name =
          body.name;
      }

      if (
        body.slug
        !== undefined
        && body.slug
      ) {
        patch.slug =
          slugify(
            body.slug,
          );
      }

      if (
        body.description
        !== undefined
      ) {
        patch.description =
          body.description;
      }

      if (
        body.province
        !== undefined
      ) {
        patch.province =
          body.province;
      }

      if (
        body.city
        !== undefined
      ) {
        patch.city =
          body.city;
      }

      if (
        body.address
        !== undefined
      ) {
        patch.address =
          body.address;
      }

      if (
        body.publicLocation
        !== undefined
      ) {
        patch.public_location =
          body.publicLocation;
      }

      if (
        body.capacityMin
        !== undefined
      ) {
        patch.capacity_min =
          body.capacityMin;
      }

      if (
        body.capacityMax
        !== undefined
      ) {
        patch.capacity_max =
          body.capacityMax;
      }

      if (
        body.costFrom
        !== undefined
      ) {
        patch.cost_from =
          body.costFrom;
      }

      if (
        body.clientPriceFrom
        !== undefined
      ) {
        patch.client_price_from =
          body.clientPriceFrom;
      }

      if (
        body.currency
        !== undefined
      ) {
        patch.currency =
          body.currency;
      }

      if (
        body.features
        !== undefined
      ) {
        patch.features =
          body.features;
      }

      if (
        body.includedServices
        !== undefined
      ) {
        patch.included_services =
          body.includedServices;
      }

      if (
        body.suitableFor
        !== undefined
      ) {
        patch.suitable_for =
          body.suitableFor;
      }
        if (
          body.rentalModes
          !== undefined
        ) {
          patch.rental_modes =
            body.rentalModes;
        }

        if (
          body.eventTypesAllowed
          !== undefined
        ) {
          patch.event_types_allowed =
            body.eventTypesAllowed;
        }

        if (
          body.eventsAllowed
          !== undefined
        ) {
          patch.events_allowed =
            body.eventsAllowed;
        }

        if (
          body.partiesAllowed
          !== undefined
        ) {
          patch.parties_allowed =
            body.partiesAllowed;
        }

        if (
          body.maxEventGuests
          !== undefined
        ) {
          patch.max_event_guests =
            body.maxEventGuests;
        }

        if (
          body.maxSleepingGuests
          !== undefined
        ) {
          patch.max_sleeping_guests =
            body.maxSleepingGuests;
        }

        if (
          body.defaultStartTime
          !== undefined
        ) {
          patch.default_start_time =
            body.defaultStartTime;
        }

        if (
          body.defaultEndTime
          !== undefined
        ) {
          patch.default_end_time =
            body.defaultEndTime;
        }

        if (
          body.musicEndTime
          !== undefined
        ) {
          patch.music_end_time =
            body.musicEndTime;
        }

        if (
          body.latitude
          !== undefined
        ) {
          patch.latitude =
            body.latitude;
        }

        if (
          body.longitude
          !== undefined
        ) {
          patch.longitude =
            body.longitude;
        }

        if (
          body.deposit
          !== undefined
        ) {
          patch.deposit =
            body.deposit;
        }

        if (
          body.cleaningFee
          !== undefined
        ) {
          patch.cleaning_fee =
            body.cleaningFee;
        }

        if (
          body.venueRules
          !== undefined
        ) {
          patch.venue_rules =
            body.venueRules;
        }



      if (
        body.publicNotes
        !== undefined
      ) {
        patch.public_notes =
          body.publicNotes;
      }

      if (
        body.internalNotes
        !== undefined
      ) {
        patch.internal_notes =
          body.internalNotes;
      }

      if (
        body.status
        !== undefined
      ) {
        patch.status =
          body.status;

        patch.published_at =
          body.status
          === "published"
            ? new Date()
              .toISOString()
            : null;
      }


      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_venues",

          method:
            "PATCH",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&id=eq.${eq(
              venueId,
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
              "VENUE_NOT_FOUND",
          });
      }


      return response.json({
        ok: true,
        venue:
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


crmVenuesRoutes.post(
  "/venues/:venueId/images",
  (
      request,
      response,
      next,
    ) => {
      console.log(
        "[VENUE IMAGE REQUEST ENTER]",
        {
          venueId:
            request.params.venueId,
          contentType:
            request.headers[
              "content-type"
            ],
          contentLength:
            request.headers[
              "content-length"
            ],
        },
      );

      next();
    },

    venueImageUpload.array(
    "files",
    12,
  ),
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
      const venueId =
        z.string()
          .uuid()
          .parse(
            request.params
              .venueId,
          );

      const role =
        z.enum([
          "cover",
          "gallery",
        ])
          .parse(
            request.body
              ?.role
            ?? "gallery",
          );

      const tenant =
        companyId(request);


      const venueRows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_venues",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&id=eq.${eq(
              venueId,
            )}`
            + "&select=id"
            + "&limit=1",
        });

      if (
        !venueRows[0]
      ) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "VENUE_NOT_FOUND",
          });
      }


      const files =
        Array.isArray(
          request.files,
        )
          ? request.files
          : [];


      if (!files.length) {
        return response
          .status(400)
          .json({
            ok: false,
            error:
              "VENUE_IMAGE_REQUIRED",
          });
      }


      if (
        role === "cover"
      ) {
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_venue_images",

          method:
            "PATCH",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&venue_id=eq.${eq(
              venueId,
            )}`
            + "&role=eq.cover",

          body: {
            role:
              "gallery",
          },
        });
      }


      const created:
        DbRow[] = [];


      for (
        let index = 0;
        index < files.length;
        index += 1
      ) {
        const file =
          files[index];

        const uploadRole =
          role === "cover"
          && index === 0
            ? "cover"
            : "gallery";


        const uploaded =
          await uploadVenueImage({
            companyId:
              tenant,

            venueId,

            role:
              uploadRole,

            file: {
              buffer:
                file.buffer,

              mimetype:
                file.mimetype,

              size:
                file.size,
            },
          });


        const rows =
          await supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_venue_images",

            method:
              "POST",

            body: {
              company_id:
                tenant,

              venue_id:
                venueId,

              bucket:
                uploaded.bucket,

              path:
                uploaded.path,

              url:
                uploaded.url,

              role:
                uploadRole,

              sort_order:
                index,
            },
          });


        if (
          rows[0]
        ) {
          created.push(
            rows[0],
          );
        }
      }


      return response
        .status(201)
        .json({
          ok: true,
          images:
            created,
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


const venueVideoUpload =
  multer({
    storage:
      multer.memoryStorage(),

    limits: {
      fileSize:
        200 * 1024 * 1024,

      files:
        1,
    },
  });


crmVenuesRoutes.get(
  "/venues/rules/catalog",
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
            "crm_venue_rule_definitions",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + "&active=eq.true"
            + "&order=sort_order.asc,label.asc",
        });

      return response.json({
        ok:
          true,

        rules:
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


crmVenuesRoutes.post(
  "/venues/:venueId/video",
  venueVideoUpload.single(
    "file",
  ),
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
      const venueId =
        z.string()
          .uuid()
          .parse(
            request.params
              .venueId,
          );

      const tenant =
        companyId(request);

      if (!request.file) {
        return response
          .status(400)
          .json({
            ok:
              false,

            error:
              "VENUE_VIDEO_REQUIRED",
          });
      }

      const existing =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_venue_videos",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&venue_id=eq.${eq(
              venueId,
            )}`
            + "&limit=1",
        });

      if (existing[0]) {
        return response
          .status(409)
          .json({
            ok:
              false,

            error:
              "VENUE_VIDEO_ALREADY_EXISTS",
          });
      }

      const uploaded =
        await uploadVenueVideo({
          companyId:
            tenant,

          venueId,

          file: {
            buffer:
              request.file.buffer,

            mimetype:
              request.file.mimetype,

            size:
              request.file.size,
          },
        });

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_venue_videos",

          method:
            "POST",

          body: {
            company_id:
              tenant,

            venue_id:
              venueId,

            bucket:
              uploaded.bucket,

            path:
              uploaded.path,

            url:
              uploaded.url,

            mime_type:
              request.file.mimetype,

            size_bytes:
              request.file.size,
          },
        });

      return response
        .status(201)
        .json({
          ok:
            true,

          video:
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


crmVenuesRoutes.delete(
  "/venues/:venueId/video",
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
      const venueId =
        z.string()
          .uuid()
          .parse(
            request.params
              .venueId,
          );

      const tenant =
        companyId(request);

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_venue_videos",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&venue_id=eq.${eq(
              venueId,
            )}`
            + "&limit=1",
        });

      const video =
        rows[0];

      if (!video) {
        return response
          .status(404)
          .json({
            ok:
              false,

            error:
              "VENUE_VIDEO_NOT_FOUND",
          });
      }

      await deleteVenueMediaFile({
        bucket:
          String(
            video.bucket,
          ),

        path:
          String(
            video.path,
          ),
      });

      await supabaseRequest({
        table:
          "crm_venue_videos",

        method:
          "DELETE",

        query:
          `?company_id=eq.${eq(
            tenant,
          )}`
          + `&venue_id=eq.${eq(
            venueId,
          )}`,
      });

      return response.json({
        ok:
          true,
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


crmVenuesRoutes.post(
  "/venues/:venueId/images/ai-order",
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
      const venueId =
        z.string()
          .uuid()
          .parse(
            request.params
              .venueId,
          );

      const tenant =
        companyId(request);

      const venues =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_venues",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&id=eq.${eq(
              venueId,
            )}`
            + "&limit=1",
        });

      if (!venues[0]) {
        return response
          .status(404)
          .json({
            ok:
              false,

            error:
              "VENUE_NOT_FOUND",
          });
      }

      const images =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_venue_images",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&venue_id=eq.${eq(
              venueId,
            )}`
            + "&order=sort_order.asc,created_at.asc",
        });

      if (!images.length) {
        return response
          .status(400)
          .json({
            ok:
              false,

            error:
              "VENUE_IMAGES_REQUIRED",
          });
      }

      const ranked =
        await rankVenueImages({
          venueName:
            String(
              venues[0].name
              ?? "",
            ),

          description:
            venues[0]
              .description
              == null
              ? null
              : String(
                  venues[0]
                    .description,
                ),

          images:
            images.map(
              (
                image,
              ) => ({
                id:
                  String(
                    image.id,
                  ),

                url:
                  image.url
                  == null
                    ? null
                    : String(
                        image.url,
                      ),

                public_url:
                  image.public_url
                  == null
                    ? null
                    : String(
                        image.public_url,
                      ),
              }),
            ),
        });

      if (!ranked.length) {
        throw new Error(
          "VENUE_AI_EMPTY_RANKING",
        );
      }

      for (
        let index = 0;
        index < ranked.length;
        index += 1
      ) {
        const item =
          ranked[index];

        await supabaseRequest({
          table:
            "crm_venue_images",

          method:
            "PATCH",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&venue_id=eq.${eq(
              venueId,
            )}`
            + `&id=eq.${eq(
              item.id,
            )}`,

          body: {
            sort_order:
              index,

            role:
              index === 0
                ? "cover"
                : "gallery",

            ai_score:
              item.score,

            ai_category:
              item.category,

            ai_reason:
              item.reason,

              is_visible:
                item.isVisible,
          },
        });
      }

      /*
       * Cualquier imagen que por error no haya analizado el modelo
       * queda después de las analizadas.
       */
      const rankedIds =
        new Set(
          ranked.map(
            (
              item,
            ) =>
              item.id,
          ),
        );

      let tailIndex =
        ranked.length;

      for (
        const image of images
      ) {
        const id =
          String(
            image.id,
          );

        if (
          rankedIds.has(
            id,
          )
        ) {
          continue;
        }

        await supabaseRequest({
          table:
            "crm_venue_images",

          method:
            "PATCH",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&venue_id=eq.${eq(
              venueId,
            )}`
            + `&id=eq.${eq(
              id,
            )}`,

          body: {
            sort_order:
              tailIndex,

            role:
              "gallery",
          },
        });

        tailIndex += 1;
      }

      const finalImages =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_venue_images",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&venue_id=eq.${eq(
              venueId,
            )}`
            + "&order=sort_order.asc,created_at.asc",
        });

      return response.json({
        ok:
          true,

        images:
          finalImages,
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



crmVenuesRoutes.patch(
  "/venues/:venueId/images/:imageId/cover",
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
      const venueId =
        z.string()
          .uuid()
          .parse(
            request.params
              .venueId,
          );

      const imageId =
        z.string()
          .uuid()
          .parse(
            request.params
              .imageId,
          );

      const tenant =
        companyId(request);


      await supabaseRequest<
        DbRow[]
      >({
        table:
          "crm_venue_images",

        method:
          "PATCH",

        query:
          `?company_id=eq.${eq(
            tenant,
          )}`
          + `&venue_id=eq.${eq(
            venueId,
          )}`
          + "&role=eq.cover",

        body: {
          role:
            "gallery",
        },
      });


      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_venue_images",

          method:
            "PATCH",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&venue_id=eq.${eq(
              venueId,
            )}`
            + `&id=eq.${eq(
              imageId,
            )}`,

          body: {
            role:
              "cover",

              is_visible:
                true,
            },
        });


      if (!rows[0]) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "VENUE_IMAGE_NOT_FOUND",
          });
      }


      return response.json({
        ok: true,
        image:
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


crmVenuesRoutes.delete(
  "/venues/:venueId/images/:imageId",
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
      const venueId =
        z.string()
          .uuid()
          .parse(
            request.params
              .venueId,
          );

      const imageId =
        z.string()
          .uuid()
          .parse(
            request.params
              .imageId,
          );

      const tenant =
        companyId(request);


      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_venue_images",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&venue_id=eq.${eq(
              venueId,
            )}`
            + `&id=eq.${eq(
              imageId,
            )}`
            + "&limit=1",
        });


      const image =
        rows[0];

      if (!image) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "VENUE_IMAGE_NOT_FOUND",
          });
      }


      await deleteVenueImageFile({
        bucket:
          String(
            image.bucket,
          ),

        path:
          String(
            image.path,
          ),
      });


      await supabaseRequest<
        DbRow[]
      >({
        table:
          "crm_venue_images",

        method:
          "DELETE",

        query:
          `?company_id=eq.${eq(
            tenant,
          )}`
          + `&id=eq.${eq(
            imageId,
          )}`,
      });


      return response.json({
        ok: true,
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
 * VENUE_DATA_VERIFICATION_ENDPOINTS
 * Confirmación periódica de datos con el propietario.
 * ============================================================ */

crmVenuesRoutes.post(
  "/venues/:venueId/request-verification",
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
      const venueId =
        z.string()
          .uuid()
          .parse(
            request.params
              .venueId,
          );

      const tenant =
        companyId(request);

      const venues =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_venues",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&id=eq.${eq(
              venueId,
            )}`
            + "&select=id,name,provider_id,verification_status,last_verified_at,verification_requested_at,next_verification_at,verification_interval_days"
            + "&limit=1",
        });

      const venue =
        venues[0];

      if (!venue) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "VENUE_NOT_FOUND",
          });
      }

      const providerId =
        typeof venue.provider_id
        === "string"
          ? venue.provider_id
          : "";

      if (!providerId) {
        return response
          .status(400)
          .json({
            ok: false,
            error:
              "VENUE_PROVIDER_REQUIRED",
          });
      }

      const providers =
        await supabaseRequest<
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
            + "&status=eq.active"
            + "&select=id,name,contact_name,phone,whatsapp"
            + "&limit=1",
        });

      const provider =
        providers[0];

      if (!provider) {
        return response
          .status(400)
          .json({
            ok: false,
            error:
              "VENUE_PROVIDER_NOT_FOUND",
          });
      }

      const rawPhone =
        String(
          provider.whatsapp
          ?? provider.phone
          ?? "",
        );

      const to =
        rawPhone
          .replace(
            /[^\d]/g,
            "",
          );

      if (
        !to
        || to.length < 8
      ) {
        return response
          .status(400)
          .json({
            ok: false,
            error:
              "PROVIDER_WHATSAPP_REQUIRED",
          });
      }

      const templateName =
        (
          process.env
            .WHATSAPP_VENUE_VERIFICATION_TEMPLATE
          ?? "actualizacion_datos_espacio"
        )
          .trim();

      const templateLanguage =
        (
          process.env
            .WHATSAPP_VENUE_VERIFICATION_LANGUAGE
          ?? "es"
        )
          .trim();

      const contactName =
        String(
          provider.contact_name
          ?? provider.name
          ?? "propietario",
        )
          .trim()
          .slice(
            0,
            100,
          );

      const venueName =
        String(
          venue.name
          ?? "el espacio",
        )
          .trim()
          .slice(
            0,
            180,
          );

      const {
        postWhatsappMessage,
      } =
        await import(
          "../services/whatsapp/whatsapp.client.js"
        );

      const sent =
        await postWhatsappMessage({
          messaging_product:
            "whatsapp",

          to,

          type:
            "template",

          template: {
            name:
              templateName,

            language: {
              code:
                templateLanguage,
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
                      contactName,
                  },
                  {
                    type:
                      "text",

                    text:
                      venueName,
                  },
                ],
              },
            ],
          },
        });

      const messageId =
        sent.messages?.[0]?.id
        ?? null;

      const now =
        new Date()
          .toISOString();

      const updated =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_venues",

          method:
            "PATCH",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&id=eq.${eq(
              venueId,
            )}`,

          body: {
            verification_status:
              "pending",

            verification_requested_at:
              now,

            verification_message_id:
              messageId,

            verification_template_name:
              templateName,
          },
        });

      return response.json({
        ok:
          true,

        verification:
          updated[0]
          ?? {
            verification_status:
              "pending",

            verification_requested_at:
              now,

            verification_message_id:
              messageId,
          },

        provider: {
          id:
            provider.id,

          name:
            provider.name,

          contactName:
            provider.contact_name
            ?? null,
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


crmVenuesRoutes.post(
  "/venues/:venueId/confirm-verification",
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
      const venueId =
        z.string()
          .uuid()
          .parse(
            request.params
              .venueId,
          );

      const tenant =
        companyId(request);

      const venues =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_venues",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&id=eq.${eq(
              venueId,
            )}`
            + "&select=id,verification_interval_days"
            + "&limit=1",
        });

      const venue =
        venues[0];

      if (!venue) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "VENUE_NOT_FOUND",
          });
      }

      const rawInterval =
        Number(
          venue
            .verification_interval_days
          ?? 90,
        );

      const intervalDays =
        Number.isFinite(
          rawInterval,
        )
          ? Math.max(
              1,
              Math.min(
                365,
                Math.trunc(
                  rawInterval,
                ),
              ),
            )
          : 90;

      const nowDate =
        new Date();

      const nextDate =
        new Date(
          nowDate.getTime()
          + (
            intervalDays
            * 24
            * 60
            * 60
            * 1000
          ),
        );

      const updated =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_venues",

          method:
            "PATCH",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&id=eq.${eq(
              venueId,
            )}`,

          body: {
            verification_status:
              "verified",

            last_verified_at:
              nowDate
                .toISOString(),

            next_verification_at:
              nextDate
                .toISOString(),
          },
        });

      return response.json({
        ok:
          true,

        venue:
          updated[0]
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

crmVenuesRoutes.use(crmVenueCalendarRoutes);
