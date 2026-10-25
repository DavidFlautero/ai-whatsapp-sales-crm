import {
  captureIncomingEvent,
  type IncomingEventInput,
} from "../intake/event-intake-capture.service.js";

import {
  previewCommercialSearch,
} from "../commercial-orchestrator/commercial-catalog.v1.js";

/**
 * Captación comercial en segundo plano.
 *
 * Desactivada por defecto.
 * No envía mensajes.
 * No confirma reservas.
 *
 * El identificador de mensaje se verifica
 * definitivamente en PostgreSQL.
 */

const pending = new Set<string>();

export function queueWhapiEventIntake(
  input: IncomingEventInput,
): boolean {
  const enabled =
    process.env.CRM_INTAKE_CAPTURE_ENABLED
      ?.trim()
      .toLowerCase() === "true";

  if (!enabled) {
    return false;
  }

  const key = [
    input.companyId,
    input.sourceMessageId,
  ].join(":");

  if (pending.has(key)) {
    return false;
  }

  if (pending.size >= 100) {
    console.warn(
      "[CRM INTAKE] Cola temporal llena",
    );

    return false;
  }

  pending.add(key);

  queueMicrotask(() => {
    void captureIncomingEvent(input)
      .then(async result => {
        console.log("[CRM INTAKE]", {
          status: result.status,
          nextAction: result.nextAction ?? null,
          messageId: input.sourceMessageId,
        });

        // Orquestador comercial V1:
        // búsqueda automática en modo de prueba.
        // No envía WhatsApp ni modifica reservas.
        const testPhone = String(
          process.env.WHAPI_EVENTS_AI_TEST_PHONE ?? "",
        ).replace(/\D/g, "");

        const incomingPhone =
          input.phone.replace(/\D/g, "");

        const authorizedTest =
          input.companyId === "eventos-mediterraneo" &&
          testPhone.length >= 8 &&
          incomingPhone === testPhone;

        if (
          authorizedTest &&
          result.status !== "duplicate" &&
          result.status !== "disabled"
        ) {
          try {
            const preview = await previewCommercialSearch(
              input.companyId,
              input.text,
            );

            if (preview.plan.readyForCatalogSearch) {
              const counts: Record<string, number> = {};

              for (const match of preview.catalog.matches) {
                const service = match.matchingService;
                counts[service] =
                  (counts[service] ?? 0) + 1;
              }

              console.log(
                "[COMMERCIAL ORCHESTRATOR V1]",
                {
                  mode: "preview_only",
                  captureStatus: result.status,
                  services: preview.plan.services,
                  missing: preview.plan.missing,
                  candidates:
                    preview.catalog.matches.length,
                  matchesByService: counts,
                  sources: preview.catalog.sources,
                  needsCrmReview:
                    result.status !== "created" &&
                    result.status !== "updated",
                },
              );
            }
          } catch (error: unknown) {
            console.error(
              "[COMMERCIAL ORCHESTRATOR ERROR]",
              {
                type:
                  error instanceof Error
                    ? error.name
                    : "UNKNOWN",
              },
            );
          }
        }

      })
      .catch((error: unknown) => {
        console.error("[CRM INTAKE ERROR]", {
          phoneLast4: input.phone.slice(-4),
          messageId: input.sourceMessageId,
          error:
            error instanceof Error
              ? error.message
              : "UNKNOWN_ERROR",
        });
      })
      .finally(() => {
        pending.delete(key);
      });
  });

  return true;
}
