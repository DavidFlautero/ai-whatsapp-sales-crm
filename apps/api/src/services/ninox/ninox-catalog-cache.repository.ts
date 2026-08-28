import fs from "node:fs/promises";
import path from "node:path";
import {
  fileURLToPath,
} from "node:url";

import type {
  NinoxCatalogRow,
} from "./ninox.client.js";


const dataDirectory =
  process.env.NINOX_CACHE_DIRECTORY?.trim()
  || fileURLToPath(
    new URL(
      "../../../../../data",
      import.meta.url,
    ),
  );

const catalogPath =
  path.join(
    dataDirectory,
    "ninox-catalog-cache.json",
  );

const statePath =
  path.join(
    dataDirectory,
    "ninox-sync-state.json",
  );


export type CachedNinoxCatalogItem = {
  technicalKey: string;

  externalArticleId: number;
  externalCode: string;

  externalColorId:
    number | null;

  externalSizeId:
    number | null;

  description: string;

  webDescription:
    string | null;

  name: string;

  colorName:
    string | null;

  colorCode:
    string | null;

  colorHex:
    string | null;

  sizeName:
    string | null;

  sizeCode:
    string | null;

  barcode:
    string | null;

  prices: {
    price1: number;
    price2: number;
    price3: number;
    price4: number;
    price5: number;
  };

  externalUnits: number;

  locallyReserved: number;

  availableToBot: number;

  active: boolean;

  lastSyncedAt: string;

  metadata:
    Record<string, unknown>;
};


export type NinoxSyncState = {
  running: boolean;

  lastStartedAt:
    string | null;

  lastCompletedAt:
    string | null;

  lastSuccessAt:
    string | null;

  lastError:
    string | null;

  rowsReceived: number;

  rowsStored: number;
};


const emptyState:
NinoxSyncState = {
  running:
    false,

  lastStartedAt:
    null,

  lastCompletedAt:
    null,

  lastSuccessAt:
    null,

  lastError:
    null,

  rowsReceived:
    0,

  rowsStored:
    0,
};


function stringValue(
  value:
    unknown,
) {
  return value === null
    || value === undefined
    ? ""
    : String(value).trim();
}


function nullableString(
  value:
    unknown,
) {
  return stringValue(value)
    || null;
}


function numberValue(
  value:
    unknown,
) {
  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? Math.max(0, parsed)
    : 0;
}


function integerValue(
  value:
    unknown,
) {
  return Math.trunc(
    numberValue(value),
  );
}


function nullableInteger(
  value:
    unknown,
) {
  if (
    value === null
    || value === undefined
    || value === ""
  ) {
    return null;
  }

  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? Math.trunc(parsed)
    : null;
}


function technicalKey(
  row:
    NinoxCatalogRow,
) {
  return [
    "NINOX",
    integerValue(row.articuloId),
    nullableInteger(row.colorId) ?? 0,
    nullableInteger(row.talleId) ?? 0,
  ].join("-");
}


async function ensureDataDirectory() {
  await fs.mkdir(
    dataDirectory,
    {
      recursive:
        true,
    },
  );
}


async function atomicWrite(
  targetPath:
    string,

  value:
    unknown,
) {
  await ensureDataDirectory();

  const temporaryPath =
    `${targetPath}.${process.pid}.tmp`;

  await fs.writeFile(
    temporaryPath,
    JSON.stringify(
      value,
      null,
      2,
    ),
    "utf8",
  );

  await fs.rename(
    temporaryPath,
    targetPath,
  );
}


async function readJson<T>(
  targetPath:
    string,

  fallback:
    T,
): Promise<T> {
  try {
    const raw =
      await fs.readFile(
        targetPath,
        "utf8",
      );

    return JSON.parse(raw) as T;
  } catch (
    error
  ) {
    if (
      error instanceof Error
      && "code" in error
      && error.code === "ENOENT"
    ) {
      return fallback;
    }

    throw error;
  }
}


export function normalizeNinoxCatalog(
  rows:
    NinoxCatalogRow[],

  previous:
    CachedNinoxCatalogItem[],

  synchronizedAt:
    string,
) {
  const reservedByKey =
    new Map(
      previous.map(
        (item) => [
          item.technicalKey,
          item.locallyReserved,
        ],
      ),
    );

  return rows
    .map(
      (
        row,
      ): CachedNinoxCatalogItem | null => {
        const externalArticleId =
          integerValue(
            row.articuloId,
          );

        const externalCode =
          stringValue(
            row.codigo,
          );

        if (
          externalArticleId <= 0
          || !externalCode
        ) {
          return null;
        }

        const key =
          technicalKey(row);

        const externalUnits =
          integerValue(
            row.unidades,
          );

        const locallyReserved =
          Math.max(
            0,
            reservedByKey.get(key)
            ?? 0,
          );

        return {
          technicalKey:
            key,

          externalArticleId,

          externalCode,

          externalColorId:
            nullableInteger(
              row.colorId,
            ),

          externalSizeId:
            nullableInteger(
              row.talleId,
            ),

          description:
            stringValue(
              row.descripcion,
            ),

          webDescription:
            nullableString(
              row.descripcionWeb,
            ),

          name:
            stringValue(
              row.nombre,
            )
            || [
              externalCode,
              stringValue(
                row.descripcion,
              ),
            ]
              .filter(Boolean)
              .join(" - "),

          colorName:
            nullableString(
              row.colorNombre,
            ),

          colorCode:
            nullableString(
              row.colorCodigo,
            ),

          colorHex:
            nullableString(
              row.colorHex,
            ),

          sizeName:
            nullableString(
              row.talleNombre,
            ),

          sizeCode:
            nullableString(
              row.talleCodigo,
            ),

          barcode:
            nullableString(
              row.codigoBarras,
            ),

          prices: {
            price1:
              numberValue(
                row.precio1,
              ),

            price2:
              numberValue(
                row.precio2,
              ),

            price3:
              numberValue(
                row.precio3,
              ),

            price4:
              numberValue(
                row.precio4,
              ),

            price5:
              numberValue(
                row.precio5,
              ),
          },

          externalUnits,

          locallyReserved,

          availableToBot:
            Math.max(
              externalUnits
              - locallyReserved,
              0,
            ),

          active:
            true,

          lastSyncedAt:
            synchronizedAt,

          metadata: {
            talleColor:
              row.talleColor
              ?? null,

            categoriasIds:
              row.categoriasIds
              ?? null,

            categoriasNombres:
              row.categoriasNombres
              ?? null,

            etiquetasIds:
              row.etiquetasIds
              ?? null,

            etiquetasNombres:
              row.etiquetasNombres
              ?? null,
          },
        };
      },
    )
    .filter(
      (
        item,
      ): item is CachedNinoxCatalogItem =>
        item !== null,
    );
}


export async function readNinoxCatalogCache() {
  return readJson<
    CachedNinoxCatalogItem[]
  >(
    catalogPath,
    [],
  );
}


export async function writeNinoxCatalogCache(
  catalog:
    CachedNinoxCatalogItem[],
) {
  await atomicWrite(
    catalogPath,
    catalog,
  );
}


export async function readNinoxSyncState() {
  return readJson<NinoxSyncState>(
    statePath,
    emptyState,
  );
}


export async function writeNinoxSyncState(
  state:
    NinoxSyncState,
) {
  await atomicWrite(
    statePath,
    state,
  );
}


export function ninoxCachePaths() {
  return {
    catalogPath,
    statePath,
  };
}
