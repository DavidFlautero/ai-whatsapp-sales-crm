export type Venue = {
  id: string;
  name: string;
  slug?: string | null;
  city?: string | null;
  province?: string | null;
  address?: string | null;
  public_location?: string | null;

  provider_id?: string | null;

  cost_from?: number | string | null;
  client_price_from?: number | string | null;

  max_event_guests?: number | null;
  capacity_max?: number | null;

  status?: string | null;
};

type AnyRow = Record<string, unknown>;

export type VenueAudit = {
  venue: Venue;

  photos: number | null;
  videos: number | null;
  docs: number | null;
  history: number | null;

  pending: string[];
  unknown: string[];
};

function record(
  value: unknown,
): AnyRow | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as AnyRow;
}

function unwrapList(
  value: unknown,
  keys: string[],
  depth = 0,
): AnyRow[] | null {
  if (depth > 5) return null;

  if (Array.isArray(value)) {
    return value.filter(
      item => record(item) !== null,
    ) as AnyRow[];
  }

  const obj = record(value);

  if (!obj) return null;

  for (const key of keys) {
    if (!(key in obj)) continue;

    const nested = obj[key];

    if (nested === null) return [];

    const list = unwrapList(
      nested,
      keys,
      depth + 1,
    );

    if (list !== null) return list;
  }

  return null;
}

function mediaCount(
  payload: unknown,
  kind: "images" | "videos",
): number | null {
  if (payload === null) return 0;

  const keys =
    kind === "images"
      ? [
          "images",
          "photos",
          "gallery",
          "items",
          "rows",
          "results",
          "data",
        ]
      : [
          "videos",
          "video",
          "items",
          "rows",
          "results",
          "data",
        ];

  const list = unwrapList(
    payload,
    keys,
  );

  if (list !== null) {
    const ids = new Set<string>();

    let anonymous = 0;

    for (const item of list) {
      const id =
        typeof item.id === "string"
          ? item.id
          : null;

      if (id) ids.add(id);
      else anonymous++;
    }

    return ids.size + anonymous;
  }

  const obj = record(payload);

  if (!obj) return null;

  if (kind === "videos") {
    if (
      obj.url ||
      obj.public_url ||
      obj.video_url
    ) {
      return 1;
    }

    if (
      "video" in obj &&
      obj.video === null
    ) {
      return 0;
    }

    if (
      "video" in obj &&
      record(obj.video)
    ) {
      return 1;
    }
  }

  return null;
}

async function json(
  url: string,
): Promise<unknown> {
  const response = await fetch(
    url,
    {
      credentials: "include",
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `HTTP_${response.status}`,
    );
  }

  return response.json();
}

async function optionalJson(
  url: string,
): Promise<unknown | undefined> {
  try {
    return await json(url);
  } catch {
    return undefined;
  }
}

function countRelated(
  rows: AnyRow[] | null,
  venueId: string,
): number | null {
  if (rows === null) return null;

  return rows.filter(item => {
    const relation =
      item.venue_id ??
      item.venueId ??
      item.entity_id;

    return relation === venueId;
  }).length;
}

function positivePrice(
  value: unknown,
): boolean {
  const number = Number(value);

  return Number.isFinite(number) &&
    number > 0;
}

function makeAudit(
  venue: Venue,
  photos: number | null,
  videos: number | null,
  docs: number | null,
  history: number | null,
): VenueAudit {
  const pending: string[] = [];
  const unknown: string[] = [];

  if (photos === null) {
    unknown.push("Fotos no verificadas");
  } else if (photos < 5) {
    pending.push(
      `Fotos insuficientes (${photos}/5)`,
    );
  }

  if (videos === null) {
    unknown.push("Vídeos no verificados");
  } else if (videos === 0) {
    pending.push("Sin vídeo registrado");
  }

  if (
    !positivePrice(venue.cost_from) &&
    !positivePrice(venue.client_price_from)
  ) {
    pending.push("Precio pendiente");
  }

  const capacity =
    venue.max_event_guests ??
    venue.capacity_max;

  if (
    !capacity ||
    Number(capacity) <= 0
  ) {
    pending.push("Capacidad pendiente");
  }

  if (!venue.provider_id) {
    pending.push("Propietario sin asociar");
  }

  if (
    !venue.city &&
    !venue.address &&
    !venue.public_location
  ) {
    pending.push("Ubicación pendiente");
  }

  if (docs === null) {
    unknown.push("Documentación no verificada");
  } else if (docs === 0) {
    pending.push("Sin documentos registrados");
  }

  if (history === null) {
    unknown.push("Historial no verificado");
  }

  return {
    venue,
    photos,
    videos,
    docs,
    history,
    pending,
    unknown,
  };
}

export async function loadVenuePendingData(
  onProgress?: (
    loaded: number,
    total: number,
  ) => void,
): Promise<VenueAudit[]> {
  // Misma colección principal del editor.
  const venuePayload = await json(
    "/api/crm/venues?limit=500",
  );

  const venueRows = unwrapList(
    venuePayload,
    [
      "venues",
      "items",
      "data",
      "rows",
      "results",
    ],
  );

  if (venueRows === null) {
    throw new Error(
      "VENUE_LIST_UNRECOGNIZED",
    );
  }

  const venues = venueRows.filter(
    row =>
      typeof row.id === "string" &&
      typeof row.name === "string",
  ) as Venue[];

  // Datos complementarios.
  // Si la consulta falla, el estado es
  // "no verificado", nunca cero inventado.
  const [
    filePayload,
    historyPayload,
  ] = await Promise.all([
    optionalJson(
      "/api/crm/files?limit=2000",
    ),

    optionalJson(
      "/api/crm/entity-history?limit=2000",
    ),
  ]);

  const fileRows =
    filePayload === undefined
      ? null
      : unwrapList(
          filePayload,
          [
            "files",
            "items",
            "data",
            "rows",
            "results",
          ],
        );

  const historyRows =
    historyPayload === undefined
      ? null
      : unwrapList(
          historyPayload,
          [
            "history",
            "items",
            "data",
            "rows",
            "results",
          ],
        );

  const results: VenueAudit[] =
    new Array(venues.length);

  let index = 0;
  let completed = 0;

  async function worker() {
    while (index < venues.length) {
      const current = index++;
      const venue = venues[current];

      // Rutas canónicas usadas por Espacios.
      const [
        imagePayload,
        videoPayload,
      ] = await Promise.all([
        optionalJson(
          `/api/crm/venues/${encodeURIComponent(venue.id)}/images`,
        ),

        optionalJson(
          `/api/crm/venues/${encodeURIComponent(venue.id)}/video`,
        ),
      ]);

      const photos =
        imagePayload === undefined
          ? null
          : mediaCount(
              imagePayload,
              "images",
            );

      const videos =
        videoPayload === undefined
          ? null
          : mediaCount(
              videoPayload,
              "videos",
            );

      const relatedFiles =
        fileRows === null
          ? null
          : fileRows.filter(file =>
              (
                file.venue_id ??
                file.venueId
              ) === venue.id,
            );

      const docs =
        relatedFiles === null
          ? null
          : relatedFiles.filter(file => {
              const mime = String(
                file.mime_type ??
                file.source_mime_type ??
                "",
              ).toLowerCase();

              return (
                mime.includes("pdf") ||
                mime.includes("document") ||
                mime.includes("word")
              );
            }).length;

      const history = countRelated(
        historyRows,
        venue.id,
      );

      results[current] = makeAudit(
        venue,
        photos,
        videos,
        docs,
        history,
      );

      completed++;

      onProgress?.(
        completed,
        venues.length,
      );
    }
  }

  const workers = Math.min(
    5,
    venues.length,
  );

  await Promise.all(
    Array.from(
      { length: workers },
      () => worker(),
    ),
  );

  return results.sort(
    (a, b) =>
      b.pending.length -
      a.pending.length,
  );
}
