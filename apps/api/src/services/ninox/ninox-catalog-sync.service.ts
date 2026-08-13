import {
  fetchNinoxCatalog,
  NinoxApiError,
} from "./ninox.client.js";

import {
  ninoxCachePaths,
  normalizeNinoxCatalog,
  readNinoxCatalogCache,
  readNinoxSyncState,
  writeNinoxCatalogCache,
  writeNinoxSyncState,
  type NinoxSyncState,
} from "./ninox-catalog-cache.repository.js";


const MINIMUM_SYNC_INTERVAL_MS =
  600_000;


export type NinoxCatalogSyncResult = {
  ok: boolean;
  skipped: boolean;

  reason?:
    string;

  rowsReceived: number;
  rowsStored: number;

  startedAt?:
    string;

  completedAt?:
    string;
};


let activeSync:
  Promise<NinoxCatalogSyncResult>
  | null =
  null;


function errorMessage(
  error:
    unknown,
) {
  if (
    error instanceof
      NinoxApiError
  ) {
    return [
      `NINOX_HTTP_${error.status}`,
      error.message,
    ].join(": ");
  }

  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return "UNKNOWN_NINOX_SYNC_ERROR";
}


async function executeSync(
  force:
    boolean,
): Promise<NinoxCatalogSyncResult> {
  const previousState =
    await readNinoxSyncState();

  if (
    !force
    && previousState.lastSuccessAt
  ) {
    const elapsed =
      Date.now()
      - new Date(
          previousState.lastSuccessAt,
        ).getTime();

    if (
      Number.isFinite(
        elapsed,
      )
      && elapsed
        < MINIMUM_SYNC_INTERVAL_MS
    ) {
      return {
        ok:
          true,

        skipped:
          true,

        reason:
          "MINIMUM_INTERVAL_NOT_REACHED",

        rowsReceived:
          0,

        rowsStored:
          previousState.rowsStored,
      };
    }
  }

  const startedAt =
    new Date()
      .toISOString();

  const runningState:
  NinoxSyncState = {
    ...previousState,

    running:
      true,

    lastStartedAt:
      startedAt,

    lastError:
      null,
  };

  await writeNinoxSyncState(
    runningState,
  );

  try {
    const catalog =
      await fetchNinoxCatalog();

    if (
      !catalog.length
    ) {
      throw new Error(
        "NINOX_EMPTY_CATALOG",
      );
    }

    const previousCatalog =
      await readNinoxCatalogCache();

    const synchronizedAt =
      new Date()
        .toISOString();

    const normalized =
      normalizeNinoxCatalog(
        catalog,
        previousCatalog,
        synchronizedAt,
      );

    if (
      !normalized.length
    ) {
      throw new Error(
        "NINOX_NO_VALID_CATALOG_ROWS",
      );
    }

    await writeNinoxCatalogCache(
      normalized,
    );

    const completedAt =
      new Date()
        .toISOString();

    const successState:
    NinoxSyncState = {
      running:
        false,

      lastStartedAt:
        startedAt,

      lastCompletedAt:
        completedAt,

      lastSuccessAt:
        completedAt,

      lastError:
        null,

      rowsReceived:
        catalog.length,

      rowsStored:
        normalized.length,
    };

    await writeNinoxSyncState(
      successState,
    );

    console.log(
      "[NINOX CATALOG SYNC OK]",
      {
        rowsReceived:
          catalog.length,

        rowsStored:
          normalized.length,

        paths:
          ninoxCachePaths(),
      },
    );

    return {
      ok:
        true,

      skipped:
        false,

      rowsReceived:
        catalog.length,

      rowsStored:
        normalized.length,

      startedAt,

      completedAt,
    };
  } catch (
    error
  ) {
    const completedAt =
      new Date()
        .toISOString();

    const failedState:
    NinoxSyncState = {
      ...previousState,

      running:
        false,

      lastStartedAt:
        startedAt,

      lastCompletedAt:
        completedAt,

      lastError:
        errorMessage(
          error,
        ),
    };

    await writeNinoxSyncState(
      failedState,
    );

    console.error(
      "[NINOX CATALOG SYNC ERROR]",
      {
        error:
          failedState.lastError,

        paths:
          ninoxCachePaths(),
      },
    );

    throw error;
  }
}


export function syncNinoxCatalog(
  options: {
    force?: boolean;
  } = {},
): Promise<NinoxCatalogSyncResult> {
  if (
    activeSync
  ) {
    return activeSync;
  }

  activeSync =
    executeSync(
      options.force
      ?? false,
    )
      .finally(
        () => {
          activeSync =
            null;
        },
      );

  return activeSync;
}
