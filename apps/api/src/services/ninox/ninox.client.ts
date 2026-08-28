import {
  readIntegrationSecrets,
} from "../integrations/integration-secrets.repository.js";


const DEFAULT_NINOX_BASE_URL =
  "https://api.ninox.com.ar";

const GET_DATA_CURVA_PATH =
  "/integraciones/terceros/GetDataCurva";

const REQUEST_TIMEOUT_MS =
  45_000;


export type NinoxCatalogRow = {
  articuloId: number;
  codigo: string;
  descripcion: string;
  descripcionWeb?: string | null;

  precio1?: number | null;
  precio2?: number | null;
  precio3?: number | null;
  precio4?: number | null;
  precio5?: number | null;

  talleColor?: number | null;

  colorId?: number | null;
  colorNombre?: string | null;
  colorCodigo?: string | null;
  colorHex?: string | null;

  talleId?: number | null;
  talleNombre?: string | null;
  talleCodigo?: string | null;

  unidades?: number | null;
  codigoBarras?: string | null;

  categoriasIds?: unknown;
  categoriasNombres?: unknown;

  etiquetasIds?: unknown;
  etiquetasNombres?: unknown;

  nombre?: string | null;

  [key: string]:
    unknown;
};


export class NinoxApiError
extends Error {
  readonly status:
    number;

  readonly responseBody:
    unknown;

  constructor(
    input: {
      status: number;
      message: string;
      responseBody?: unknown;
    },
  ) {
    super(
      input.message,
    );

    this.name =
      "NinoxApiError";

    this.status =
      input.status;

    this.responseBody =
      input.responseBody
      ?? null;
  }
}


function normalizedBaseUrl(
  value:
    string,
) {
  return (
    value.trim()
    || DEFAULT_NINOX_BASE_URL
  )
    .replace(
      /\/+$/,
      "",
    );
}


function parseJson(
  value:
    string,
): unknown {
  if (!value.trim()) {
    return null;
  }

  try {
    return JSON.parse(
      value,
    );
  } catch {
    throw new Error(
      "NINOX_INVALID_JSON",
    );
  }
}


function catalogRows(
  payload:
    unknown,
): NinoxCatalogRow[] {
  if (
    Array.isArray(
      payload,
    )
  ) {
    return payload as
      NinoxCatalogRow[];
  }

  if (
    payload
    && typeof payload
      === "object"
  ) {
    const record =
      payload as
        Record<
          string,
          unknown
        >;

    const possibleRows = [
      record.data,
      record.result,
      record.rows,
      record.articulos,
      record.items,
    ];

    for (
      const candidate
      of possibleRows
    ) {
      if (
        Array.isArray(
          candidate,
        )
      ) {
        return candidate as
          NinoxCatalogRow[];
      }
    }
  }

  throw new Error(
    "NINOX_UNEXPECTED_CATALOG_RESPONSE",
  );
}


export async function fetchNinoxCatalog():
Promise<NinoxCatalogRow[]> {
  const integrations =
    await readIntegrationSecrets();

  const config =
    integrations.ninox;

  if (
    !config.enabled
    || !config.apiKey.trim()
  ) {
    throw new Error(
      "NINOX_NOT_CONFIGURED",
    );
  }

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => {
        controller.abort();
      },
      REQUEST_TIMEOUT_MS,
    );

  try {
    const response =
      await fetch(
        normalizedBaseUrl(
          config.baseUrl?.includes("api.ninox.com.ar")
            ? config.baseUrl
            : DEFAULT_NINOX_BASE_URL,
        )
        + GET_DATA_CURVA_PATH,
        {
          method:
            "GET",

          signal:
            controller.signal,

          headers: {
            "X-NX-TOKEN":
              config.apiKey.trim(),

            Accept:
              "application/json",
          },
        },
      );

    const raw =
      await response.text();

    let payload:
      unknown;

    try {
      payload =
        parseJson(
          raw,
        );
    } catch (
      error
    ) {
      console.error(
        "[NINOX INVALID JSON]",
        {
          status:
            response.status,

          preview:
            raw.slice(
              0,
              500,
            ),
        },
      );

      throw error;
    }

    if (
      !response.ok
    ) {
      const message =
        payload
        && typeof payload
          === "object"
        && typeof (
          payload as
            Record<
              string,
              unknown
            >
        ).message
          === "string"
          ? String(
              (
                payload as
                  Record<
                    string,
                    unknown
                  >
              ).message,
            )
          : `NINOX_HTTP_${response.status}`;

      throw new NinoxApiError({
        status:
          response.status,

        message,

        responseBody:
          payload,
      });
    }

    return catalogRows(
      payload,
    );
  } catch (
    error
  ) {
    if (
      error instanceof Error
      && error.name
        === "AbortError"
    ) {
      throw new Error(
        "NINOX_REQUEST_TIMEOUT",
      );
    }

    throw error;
  } finally {
    clearTimeout(
      timeout,
    );
  }
}
