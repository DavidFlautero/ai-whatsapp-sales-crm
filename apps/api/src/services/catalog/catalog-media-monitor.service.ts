import {
  resolveCompanyAdminContact,
} from "../notifications/company-admin-contact.service.js";

import {
  randomUUID,
} from "node:crypto";

import {
  promises as fs,
} from "node:fs";

import {
  fileURLToPath,
} from "node:url";

import path from "node:path";

import {
  readNinoxCatalogCache,
} from "../ninox/ninox-catalog-cache.repository.js";

import {
  buildCatalogMediaIndex,
} from "./catalog-media-index.service.js";

import {
  normalizeArticleCode,
  readCatalogMediaSettings,
} from "./catalog-media.repository.js";

import {
  sendWhatsappText,
} from "../whatsapp/whatsapp.service.js";


type GapStateItem = {
  articleCode: string;

  name: string;

  colors:
    string[];

  available:
    number;

  externalUnits:
    number;

  present:
    boolean;

  status:
    | "missing"
    | "resolved";

  firstSeenAt:
    string;

  lastSeenAt:
    string;

  missingSince:
    string | null;

  resolvedAt:
    string | null;

  generation:
    number;

  alertedGeneration:
    number;

  pendingAlert:
    boolean;

  baselineMissing:
    boolean;

  attempts:
    number;

  nextAttemptAt:
    string | null;

  leaseToken:
    string | null;

  leaseUntil:
    string | null;

  imageCount:
    number;
};


type MonitorState = {
  version: 1;

  companyId: string;

  initializedAt:
    string | null;

  lastScanAt:
    string | null;

  lastScanSource:
    string | null;

  degraded:
    boolean;

  degradedReason:
    string | null;

  items:
    Record<
      string,
      GapStateItem
    >;
};


export type CatalogMediaGap = {
  articleCode: string;

  name: string;

  colors:
    string[];

  available:
    number;

  externalUnits:
    number;

  missingSince:
    string | null;

  firstSeenAt:
    string;

  generation:
    number;

  pendingAlert:
    boolean;

  baselineMissing:
    boolean;

  attempts:
    number;

  imageCount:
    number;
};


const CATALOG_MEDIA_REQUIRED_IMAGES =
  3;


const currentDir =
  path.dirname(
    fileURLToPath(
      import.meta.url,
    ),
  );


const DATA_DIR =
  path.resolve(
    currentDir,
    "../../../data/catalog-media",
  );


function statePath(
  companyId: string,
) {
  return path.join(
    DATA_DIR,
    `${
      companyId
        .trim()
        .toLowerCase()
    }.monitor.json`,
  );
}


function lockPath(
  companyId: string,
) {
  return path.join(
    DATA_DIR,
    `${
      companyId
        .trim()
        .toLowerCase()
    }.monitor.lock`,
  );
}


function emptyState(
  companyId: string,
): MonitorState {
  return {
    version:
      1,

    companyId,

    initializedAt:
      null,

    lastScanAt:
      null,

    lastScanSource:
      null,

    degraded:
      false,

    degradedReason:
      null,

    items:
      {},
  };
}


async function sleep(
  ms: number,
) {
  await new Promise<void>(
    (resolve) =>
      setTimeout(
        resolve,
        ms,
      ),
  );
}


async function ensureDataDir() {
  await fs.mkdir(
    DATA_DIR,
    {
      recursive:
        true,
    },
  );
}


async function readState(
  companyId: string,
) {
  try {
    return JSON.parse(
      await fs.readFile(
        statePath(
          companyId,
        ),
        "utf8",
      ),
    ) as MonitorState;

  } catch (error) {
    if (
      error instanceof Error
      && "code" in error
      && error.code === "ENOENT"
    ) {
      return emptyState(
        companyId,
      );
    }

    throw error;
  }
}


async function writeState(
  companyId: string,

  state:
    MonitorState,
) {
  await ensureDataDir();

  const target =
    statePath(
      companyId,
    );

  const temporary =
    `${target}.${process.pid}.${randomUUID()}.tmp`;

  try {
    await fs.writeFile(
      temporary,
      JSON.stringify(
        state,
        null,
        2,
      ),
      {
        encoding:
          "utf8",

        mode:
          0o600,
      },
    );

    await fs.rename(
      temporary,
      target,
    );

  } finally {
    await fs.rm(
      temporary,
      {
        force:
          true,
      },
    )
      .catch(
        () => undefined,
      );
  }
}


async function withMonitorLock<T>(
  companyId: string,

  operation:
    () => Promise<T>,
): Promise<T> {
  await ensureDataDir();

  const target =
    lockPath(
      companyId,
    );

  const deadline =
    Date.now()
    + 12_000;

  while (true) {
    try {
      await fs.mkdir(
        target,
      );

      break;

    } catch (error) {
      if (
        !(
          error instanceof Error
          && "code" in error
          && error.code === "EEXIST"
        )
      ) {
        throw error;
      }

      try {
        const stat =
          await fs.stat(
            target,
          );

        if (
          Date.now()
          - stat.mtimeMs
          > 90_000
        ) {
          await fs.rm(
            target,
            {
              recursive:
                true,

              force:
                true,
            },
          );

          continue;
        }

      } catch {
        continue;
      }

      if (
        Date.now()
        >= deadline
      ) {
        throw new Error(
          "CATALOG_MEDIA_MONITOR_LOCK_TIMEOUT",
        );
      }

      await sleep(
        75
        + Math.floor(
          Math.random()
          * 100,
        ),
      );
    }
  }

  try {
    return await operation();

  } finally {
    await fs.rm(
      target,
      {
        recursive:
          true,

        force:
          true,
      },
    )
      .catch(
        () => undefined,
      );
  }
}


function stateGaps(
  state:
    MonitorState,
): CatalogMediaGap[] {
  return Object.values(
    state.items,
  )
    .filter(
      (item) =>
        item.present
        && item.status
          === "missing",
    )
    .sort(
      (a, b) =>
        (
          b.missingSince
          ?? b.firstSeenAt
        )
          .localeCompare(
            a.missingSince
            ?? a.firstSeenAt,
          ),
    )
    .map(
      (item) => ({
        articleCode:
          item.articleCode,

        name:
          item.name,

        colors:
          item.colors,

        available:
          item.available,

        externalUnits:
          item.externalUnits,

        missingSince:
          item.missingSince,

        firstSeenAt:
          item.firstSeenAt,

        generation:
          item.generation,

        pendingAlert:
          item.pendingAlert,

        baselineMissing:
          item.baselineMissing,

        attempts:
          item.attempts,

        imageCount:
          item.imageCount,
      }),
    );
}


function sumNumber(
  value:
    unknown,
) {
  const number =
    Number(
      value,
    );

  return Number.isFinite(
    number,
  )
    ? number
    : 0;
}


export async function reconcileCatalogMedia(
  companyId: string,

  source =
    "manual",
) {
  return withMonitorLock(
    companyId,

    async () => {
      const now =
        new Date()
          .toISOString();

      const state =
        await readState(
          companyId,
        );

      const cache =
        await readNinoxCatalogCache();

      const media =
        await buildCatalogMediaIndex(
          companyId,
        );

      /*
       * Si la capa histórica de imágenes
       * está temporalmente caída no declaramos
       * prendas como "sin foto".
       *
       * Es preferible omitir una alerta
       * antes que producir un falso positivo.
       */
      if (
        !media.internalCatalogOk
      ) {
        state.lastScanAt =
          now;

        state.lastScanSource =
          source;

        state.degraded =
          true;

        state.degradedReason =
          "internal-catalog-unavailable";

        await writeState(
          companyId,
          state,
        );

        return {
          ok:
            false,

          degraded:
            true,

          reason:
            state.degradedReason,

          initialized:
            Boolean(
              state.initializedAt,
            ),

          gaps:
            stateGaps(
              state,
            ),
        };
      }


      const articles =
        new Map<
          string,
          {
            articleCode: string;
            name: string;
            colors: Set<string>;
            available: number;
            externalUnits: number;
          }
        >();


      for (
        const row
        of cache
      ) {
        if (
          row.active
          === false
        ) {
          continue;
        }

        const articleCode =
          normalizeArticleCode(
            row.externalCode,
          );

        if (!articleCode) {
          continue;
        }

        const article =
          articles.get(
            articleCode,
          )
          ?? {
            articleCode,

            name:
              row.name
              || row.description
              || articleCode,

            colors:
              new Set<string>(),

            available:
              0,

            externalUnits:
              0,
          };

        if (
          row.colorName
          ?.trim()
        ) {
          article.colors.add(
            row.colorName
              .trim(),
          );
        }

        article.available +=
          Math.max(
            0,
            sumNumber(
              row.availableToBot,
            ),
          );

        article.externalUnits +=
          Math.max(
            0,
            sumNumber(
              row.externalUnits,
            ),
          );

        articles.set(
          articleCode,
          article,
        );
      }


      const firstInitialization =
        !state.initializedAt;




      /*
       * Snapshot ANTES de marcar el scan actual
       * como no visto.
       *
       * Sin esto todos los artículos parecían
       * "reaparecidos" en cada reconciliación.
       */
      const previouslyPresent =
        new Set(
          Object.values(
            state.items,
          )
            .filter(
              (item) =>
                item.present,
            )
            .map(
              (item) =>
                item.articleCode,
            ),
        );


for (
        const item
        of Object.values(
          state.items,
        )
      ) {
        item.present =
          false;
      }


      for (
        const article
        of articles.values()
      ) {
        const imageCount =
          media.byCode.get(
            article.articleCode,
          )
            ?.length
          ?? 0;

        const missing =
          imageCount
          < CATALOG_MEDIA_REQUIRED_IMAGES;

        const previous =
          state.items[
            article.articleCode
          ];

        const colors =
          Array.from(
            article.colors,
          )
            .sort();


        if (!previous) {
          const generation =
            missing
              ? 1
              : 0;

          state.items[
            article.articleCode
          ] = {
            articleCode:
              article.articleCode,

            name:
              article.name,

            colors,

            available:
              article.available,

            externalUnits:
              article.externalUnits,

            present:
              true,

            status:
              missing
                ? "missing"
                : "resolved",

            firstSeenAt:
              now,

            lastSeenAt:
              now,

            missingSince:
              missing
                ? now
                : null,

            resolvedAt:
              missing
                ? null
                : now,

            generation,

            /*
             * Baseline:
             * los productos que ya existían
             * antes de activar este módulo
             * aparecen en el panel,
             * pero NO generan una avalancha
             * de mensajes antiguos.
             */
            alertedGeneration:
              firstInitialization
              && missing
                ? generation
                : 0,

            pendingAlert:
              !firstInitialization
              && missing,

            baselineMissing:
              firstInitialization
              && missing,

            attempts:
              0,

            nextAttemptAt:
              null,

            leaseToken:
              null,

            leaseUntil:
              null,

            imageCount,
          };

          continue;
        }


        const wasAbsent =
          !previouslyPresent.has(
            article.articleCode,
          );

        const wasMissing =
          previous.status
          === "missing";


        previous.present =
          true;

        previous.name =
          article.name;

        previous.colors =
          colors;

        previous.available =
          article.available;

        previous.externalUnits =
          article.externalUnits;

        previous.lastSeenAt =
          now;

        previous.imageCount =
          imageCount;


        if (!missing) {
          if (wasMissing) {
            previous.resolvedAt =
              now;
          }

          previous.status =
            "resolved";

          previous.missingSince =
            null;

          previous.pendingAlert =
            false;

          previous.baselineMissing =
            false;

          previous.attempts =
            0;

          previous.nextAttemptAt =
            null;

          previous.leaseToken =
            null;

          previous.leaseUntil =
            null;

          continue;
        }


        if (
          !wasMissing
          || wasAbsent
        ) {
          previous.generation +=
            1;

          previous.status =
            "missing";

          previous.missingSince =
            now;

          previous.resolvedAt =
            null;

          previous.pendingAlert =
            true;

          previous.baselineMissing =
            false;

          previous.attempts =
            0;

          previous.nextAttemptAt =
            null;

          previous.leaseToken =
            null;

          previous.leaseUntil =
            null;
        }
      }


      if (firstInitialization) {
        state.initializedAt =
          now;
      }

      state.lastScanAt =
        now;

      state.lastScanSource =
        source;

      state.degraded =
        false;

      state.degradedReason =
        null;


      await writeState(
        companyId,
        state,
      );


      return {
        ok:
          true,

        degraded:
          false,

        initialized:
          true,

        articles:
          articles.size,

        images:
          Array.from(
            media.byCode.values(),
          )
            .reduce(
              (
                total,
                images,
              ) =>
                total
                + images.length,
              0,
            ),

        gaps:
          stateGaps(
            state,
          ),

        registryAssets:
          media.registryAssets,

        internalImages:
          media.internalImages,
      };
    },
  );
}


type ClaimedAlert = {
  token: string;

  items:
    GapStateItem[];

  overflow:
    number;
};


async function claimAlerts(
  companyId: string,

  maxItems =
    12,
): Promise<ClaimedAlert | null> {
  return withMonitorLock(
    companyId,

    async () => {
      const state =
        await readState(
          companyId,
        );

      const now =
        Date.now();

      const eligible =
        Object.values(
          state.items,
        )
          .filter(
            (item) => {
              if (
                !item.present
                || item.status
                  !== "missing"
                || !item.pendingAlert
                || item.alertedGeneration
                  >= item.generation
              ) {
                return false;
              }

              if (
                item.nextAttemptAt
                && new Date(
                  item.nextAttemptAt,
                ).getTime()
                  > now
              ) {
                return false;
              }

              if (
                item.leaseUntil
                && new Date(
                  item.leaseUntil,
                ).getTime()
                  > now
              ) {
                return false;
              }

              return true;
            },
          )
          .sort(
            (a, b) =>
              (
                a.missingSince
                ?? a.firstSeenAt
              )
                .localeCompare(
                  b.missingSince
                  ?? b.firstSeenAt,
                ),
          );

      if (
        eligible.length === 0
      ) {
        return null;
      }

      const selected =
        eligible.slice(
          0,
          maxItems,
        );

      const token =
        randomUUID();

      const leaseUntil =
        new Date(
          now
          + 90_000,
        )
          .toISOString();

      for (
        const item
        of selected
      ) {
        item.leaseToken =
          token;

        item.leaseUntil =
          leaseUntil;
      }

      await writeState(
        companyId,
        state,
      );

      return {
        token,

        items:
          selected.map(
            (item) => ({
              ...item,
            }),
          ),

        overflow:
          Math.max(
            0,
            eligible.length
            - selected.length,
          ),
      };
    },
  );
}


async function finishAlert(
  companyId: string,

  claim:
    ClaimedAlert,

  success:
    boolean,
) {
  await withMonitorLock(
    companyId,

    async () => {
      const state =
        await readState(
          companyId,
        );

      for (
        const claimed
        of claim.items
      ) {
        const item =
          state.items[
            claimed.articleCode
          ];

        if (
          !item
          || item.leaseToken
            !== claim.token
        ) {
          continue;
        }

        item.leaseToken =
          null;

        item.leaseUntil =
          null;

        if (success) {
          item.alertedGeneration =
            Math.max(
              item.alertedGeneration,
              claimed.generation,
            );

          item.pendingAlert =
            false;

          item.attempts =
            0;

          item.nextAttemptAt =
            null;

          continue;
        }

        item.attempts +=
          1;

        /*
         * Exponential backoff:
         * 5m, 10m, 20m...
         * con techo de 6 horas.
         */
        const delay =
          Math.min(
            6
            * 60
            * 60
            * 1000,

            5
            * 60
            * 1000
            * 2 ** Math.min(
              item.attempts
              - 1,
              8,
            ),
          );

        item.nextAttemptAt =
          new Date(
            Date.now()
            + delay,
          )
            .toISOString();
      }

      await writeState(
        companyId,
        state,
      );
    },
  );
}


export async function runCatalogMediaMonitor(
  input: {
    companyId: string;

    source?:
      string;
  },
) {
  const reconciliation =
    await reconcileCatalogMedia(
      input.companyId,
      input.source
      ?? "monitor",
    );

  if (
    reconciliation.degraded
  ) {
    return {
      ...reconciliation,

      alert:
        "skipped-degraded",
    };
  }


  const settings =
    await readCatalogMediaSettings(
      input.companyId,
    );


  /*
   * El interruptor de notificaciones
   * sigue existiendo, pero EL NÚMERO
   * ya no se configura acá.
   */
  if (
    !settings.notificationsEnabled
  ) {
    return {
      ...reconciliation,

      alert:
        "notifications-disabled",
    };
  }


  /*
   * FUENTE ÚNICA DEL DESTINATARIO
   *
   * empresa
   *   ↓
   * owner/admin activo
   *   ↓
   * phone del usuario
   *
   * No usamos:
   * - ownerWhatsapp del módulo
   * - OWNER_WHATSAPP
   * - teléfono hardcodeado
   * - último cliente
   */
  const adminContact =
    resolveCompanyAdminContact(
      input.companyId,
    );


  if (!adminContact) {
    console.error(
      "[CATALOG MEDIA ADMIN PHONE MISSING]",
      {
        companyId:
          input.companyId,
      },
    );

    return {
      ...reconciliation,

      alert:
        "admin-phone-missing",
    };
  }


  const ownerPhone =
    adminContact.phone;


  const claim =
    await claimAlerts(
      input.companyId,
    );


  if (!claim) {
    return {
      ...reconciliation,

      alert:
        "nothing-pending",
    };
  }


  const lines =
    claim.items.map(
      (
        item,
        index,
      ) => {
        const colors =
          item.colors.length
            ? ` · ${item.colors.join(", ")}`
            : "";

        return (
          `${index + 1}. `
          + `${item.articleCode}`
          + ` — ${item.name}`
          + colors
        );
      },
    );


  const overflow =
    claim.overflow > 0
      ? `\n\nY ${claim.overflow} artículo(s) más pendientes.`
      : "";


  const message =
    [
      "📸 Faltan imágenes en el catálogo",
      "",
      "Ninox informó artículos que todavía no tienen ninguna foto asociada:",
      "",
      ...lines,
      overflow,
      "",
      "Podés cargarlas desde:",
      "https://panel.fulanitasfabrica.site/catalog/media-missing",
    ]
      .filter(
        (line) =>
          line !== "",
      )
      .join(
        "\n",
      );


  try {
    await sendWhatsappText({
      to:
        ownerPhone,

      text:
        message,
    });

    await finishAlert(
      input.companyId,
      claim,
      true,
    );

    console.log(
      "[CATALOG MEDIA ALERT SENT]",
      {
        companyId:
          input.companyId,

        count:
          claim.items.length,

        overflow:
          claim.overflow,
      },
    );

    return {
      ...reconciliation,

      alert:
        "sent",

      alerted:
        claim.items.length,
    };

  } catch (error) {
    await finishAlert(
      input.companyId,
      claim,
      false,
    );

    console.error(
      "[CATALOG MEDIA ALERT ERROR]",
      {
        companyId:
          input.companyId,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
    );

    return {
      ...reconciliation,

      alert:
        "retry-scheduled",
    };
  }
}


const scheduled =
  new Map<
    string,
    NodeJS.Timeout
  >();


export function scheduleCatalogMediaMonitor(
  input: {
    companyId: string;

    source?:
      string;
  },
) {
  const existing =
    scheduled.get(
      input.companyId,
    );

  if (existing) {
    clearTimeout(
      existing,
    );
  }

  const timer =
    setTimeout(
      () => {
        scheduled.delete(
          input.companyId,
        );

        void runCatalogMediaMonitor(
          input,
        )
          .catch(
            (error) => {
              console.error(
                "[CATALOG MEDIA SCHEDULE ERROR]",
                {
                  companyId:
                    input.companyId,

                  error:
                    error instanceof Error
                      ? error.message
                      : String(error),
                },
              );
            },
          );
      },
      2_500,
    );

  timer.unref?.();

  scheduled.set(
    input.companyId,
    timer,
  );
}
