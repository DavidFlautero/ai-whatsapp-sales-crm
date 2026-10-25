import {
  Router,
  type Response,
} from "express";

import {
  supabaseRequest,
} from "../../services/db/supabase-rest.client.js";

export const publicVenueRoutes =
  Router();

type DbRow =
  Record<string, unknown>;

const COMPANY_ID =
  process.env.PUBLIC_EVENTS_COMPANY_ID
    ?.trim()
  || "eventos-mediterraneo";

function eq(
  value: string,
) {
  return encodeURIComponent(
    value,
  );
}

function imageUrl(
  row: DbRow,
) {
  const candidates = [
    row.public_url,
    row.url,
    row.image_url,
    row.file_url,
  ];

  for (
    const candidate
    of candidates
  ) {
    if (
      typeof candidate
        === "string"
      && candidate.trim()
    ) {
      return candidate;
    }
  }

  return null;
}

function safeImage(
  row: DbRow,
) {
  return {
    id:
      row.id,
    venue_id:
      row.venue_id,
    role:
      row.role
      ?? "gallery",
    sort_order:
      row.sort_order
      ?? 0,
    url:
      imageUrl(
        row,
      ),
  };
}

async function getImages(
  venueIds: string[],
) {
  if (
    venueIds.length
    === 0
  ) {
    return [];
  }

  const values =
    venueIds
      .map(
        (id) =>
          id,
      )
      .join(",");

  const originalImages = await supabaseRequest<DbRow[]>({
    table:
      "crm_venue_images",

    query:
      `?company_id=eq.${eq(
        COMPANY_ID,
      )}`
      + `&venue_id=in.(${values})`
      + "&is_visible=eq.true"
        + "&order=sort_order.asc,created_at.asc",
  });
  // EVENTOS_SHARED_OWNER_MEDIA_V1
  const ownerImages = await supabaseRequest<DbRow[]>({
    table: "crm_venue_owner_assets",
    query:
      `?company_id=eq.${eq(COMPANY_ID)}`
      + `&venue_id=in.(${values})`
      + "&kind=eq.image"
      + "&order=created_at.asc",
  });

  const existing = new Set(
    originalImages.map(image => String(image.url ?? ""))
  );

  const normalized: DbRow[] = ownerImages
    .filter(asset =>
      typeof asset.url === "string"
      && asset.url.length > 0
      && !existing.has(asset.url)
    )
    .map((asset, index) => ({
      ...asset,
      role: asset.is_cover === true ? "cover" : "gallery",
      is_visible: true,
      sort_order: 10000 + index,
      source: "owner",
    }));

  return [...originalImages, ...normalized];

}


async function getSharedVideos(venueIds: string[]) {
  if (!venueIds.length) return [];

  const values = venueIds.join(",");

  const [original, owner] = await Promise.all([
    supabaseRequest<DbRow[]>({
      table: "crm_venue_videos",
      query:
        `?company_id=eq.${eq(COMPANY_ID)}`
        + `&venue_id=in.(${values})`,
    }),
    supabaseRequest<DbRow[]>({
      table: "crm_venue_owner_assets",
      query:
        `?company_id=eq.${eq(COMPANY_ID)}`
        + `&venue_id=in.(${values})`
        + "&kind=eq.video"
        + "&order=created_at.asc",
    }),
  ]);

  const urls = new Set(
    original.map(video => String(video.url ?? ""))
  );

  return [
    ...original,
    ...owner.filter(video =>
      typeof video.url === "string"
      && video.url.length > 0
      && !urls.has(video.url)
    ),
  ];
}

async function getServices() {
  return supabaseRequest<
    DbRow[]
  >({
    table:
      "crm_service_categories",

    query:
      `?company_id=eq.${eq(
        COMPANY_ID,
      )}`
      + "&active=eq.true"
      + "&code=neq.venue"
      + "&select=id,code,name,description,icon,sort_order"
      + "&order=sort_order.asc,name.asc",
  });
}

function handleError(
  error: unknown,
  response: Response,
) {
  console.error(
    "[PUBLIC VENUES]",
    error,
  );

  return response
    .status(500)
    .json({
      ok: false,
      error:
        "PUBLIC_VENUES_ERROR",
    });
}

publicVenueRoutes.get(
  "/",
  async (
    _request,
    response,
  ) => {
    try {
      const venues =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_venues",

          query:
            `?company_id=eq.${eq(
              COMPANY_ID,
            )}`
            + "&status=eq.published"
            + "&select=id,name,slug,description,province,city,public_location,capacity_min,capacity_max,client_price_from,currency,features,included_services,suitable_for,public_notes,published_at"
            + "&order=published_at.desc,name.asc",
        });

      const venueIds =
        venues
          .map(
            (venue) =>
              typeof venue.id
                === "string"
                ? venue.id
                : null,
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(
                value,
              ),
          );

      const [
        images,
        services,
      ] =
        await Promise.all([
          getImages(
            venueIds,
          ),
          getServices(),
        ]);

      const imageMap =
        new Map<
          string,
          ReturnType<
            typeof safeImage
          >[]
        >();

      for (
        const image
        of images
      ) {
        const venueId =
          typeof image
            .venue_id
            === "string"
            ? image
              .venue_id
            : null;

        if (
          !venueId
        ) {
          continue;
        }

        const current =
          imageMap.get(
            venueId,
          )
          ?? [];

        current.push(
          safeImage(
            image,
          ),
        );

        imageMap.set(
          venueId,
          current,
        );
      }

      response.setHeader(
        "Cache-Control",
        "public, max-age=30, stale-while-revalidate=120",
      );

      return response.json({
        ok: true,

        venues:
          venues.map(
            (venue) => ({
              ...venue,

              images:
                imageMap.get(
                  String(
                    venue.id,
                  ),
                )
                ?? [],
            }),
          ),

        services,
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

publicVenueRoutes.get(
  "/:slug",
  async (
    request,
    response,
  ) => {
    try {
      const slug =
        String(
          request.params
            .slug
          ?? "",
        ).trim();

      if (
        !slug
      ) {
        return response
          .status(400)
          .json({
            ok: false,
            error:
              "INVALID_SLUG",
          });
      }

      const venues =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_venues",

          query:
            `?company_id=eq.${eq(
              COMPANY_ID,
            )}`
            + "&status=eq.published"
            + `&slug=eq.${eq(
              slug,
            )}`
            + "&select=id,name,slug,description,province,city,public_location,capacity_min,capacity_max,client_price_from,currency,features,included_services,suitable_for,public_notes,published_at"
            + "&limit=1",
        });

      const venue =
        venues[0];

      if (
        !venue
      ) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "VENUE_NOT_FOUND",
          });
      }

      const venueId =
        String(
          venue.id,
        );

      const [
        images,
        services,
      ] =
        await Promise.all([
          getImages([
            venueId,
          ]),
          getServices(),
        ]);

      response.setHeader(
        "Cache-Control",
        "public, max-age=30, stale-while-revalidate=120",
      );

      return response.json({
        ok: true,

        venue: {
          ...venue,

          videos: await getSharedVideos([
            venueId,
          ]),
          images:
            images.map(
              safeImage,
            ),
        },

        services,
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


// PUBLIC_VENUE_AVAILABILITY_V1
// Consulta pública de intervalos no disponibles.
// No expone datos administrativos ni información de reservas.

publicVenueRoutes.get(
  "/:slug/availability",
  async (req, res) => {
    try {
      const slug = String(req.params.slug ?? "").trim();
      const from = String(req.query.from ?? "").trim();
      const to = String(req.query.to ?? "").trim();

      const validDate = (value: string) =>
        /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)
        && Number.isFinite(Date.parse(value));

      if (
        !slug ||
        !validDate(from) ||
        !validDate(to)
      ) {
        return res.status(400).json({
          ok: false,
          error: "INVALID_AVAILABILITY_QUERY",
        });
      }

      const duration = Date.parse(to) - Date.parse(from);

      if (
        duration <= 0 ||
        duration > 370 * 86400000
      ) {
        return res.status(400).json({
          ok: false,
          error: "INVALID_DATE_RANGE",
        });
      }

      const venues = await supabaseRequest<
        Array<{ id: string }>
      >({
        table: "crm_venues",
        query:
          `?company_id=eq.${eq(COMPANY_ID)}`
          + `&slug=eq.${eq(slug)}`
          + "&status=eq.published"
          + "&select=id&limit=1",
      });

      const venue = venues[0];

      if (!venue) {
        return res.status(404).json({
          ok: false,
          error: "VENUE_NOT_FOUND",
        });
      }

      const blocks = await supabaseRequest<
        Array<{
          starts_at: string;
          ends_at: string;
        }>
      >({
        table: "crm_venue_calendar_blocks",
        query:
          `?company_id=eq.${eq(COMPANY_ID)}`
          + `&venue_id=eq.${eq(venue.id)}`
          + "&status=in.(blocked,held,reserved)"
          + `&starts_at=lt.${encodeURIComponent(to)}`
          + `&ends_at=gt.${encodeURIComponent(from)}`
          + "&select=starts_at,ends_at"
          + "&order=starts_at.asc",
      });

      res.setHeader("Cache-Control", "no-store");

      return res.json({
        ok: true,
        venueId: venue.id,
        unavailable: blocks.map((block) => ({
          startsAt: block.starts_at,
          endsAt: block.ends_at,
        })),
      });

    } catch (error) {
      console.error(
        "[PUBLIC VENUE AVAILABILITY ERROR]",
        error instanceof Error ? error.message : "unknown",
      );

      return res.status(503).json({
        ok: false,
        error: "AVAILABILITY_UNAVAILABLE",
      });
    }
  },
);
