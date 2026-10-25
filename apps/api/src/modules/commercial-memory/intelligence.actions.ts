import { Supabase } from "./supabase.js";
import { digest } from "./keys.js";

import type { Message } from "./types.js";
import type {
  AIObservation,
} from "./intelligence.types.js";

import {
  requestReview,
} from "./review.repository.js";

type TaskType =
  | "follow_up"
  | "check_availability"
  | "review_price"
  | "review_agreement"
  | "verify_payment"
  | "review_relationship";

export async function proposeCommercialAction(
  db: Supabase,
  message: Message,
  identityId: string,
  caseId: string | null,
  observation: AIObservation,
): Promise<void> {
  if (observation.confidence < 0.75) {
    return;
  }

  let type: TaskType | null = null;
  let title = "";
  let priority: "normal" | "high" | "critical" =
    "normal";

  switch (observation.commercial_move) {
    case "payment_claim":
      type = "verify_payment";
      title = "Verificar comprobante y recepción del pago";
      priority = "critical";
      break;

    case "acceptance_claim":
      type = "review_agreement";
      title = "Comprobar condiciones antes de cerrar";
      priority = "high";
      break;

    case "quote_request":
      if (message.direction === "inbound") {
        type = "follow_up";
        title = "Preparar presupuesto solicitado";
      }
      break;

    case "availability":
      if (message.direction === "inbound") {
        type = "check_availability";
        title = "Revisar disponibilidad del espacio";
      }
      break;

    case "counteroffer":
      type = "review_price";
      title = "Revisar contraoferta y margen";
      priority = "high";
      break;

    default:
      break;
  }

  if (!type) return;

  const taskKey = digest(
    message.company_id,
    message.id,
    type,
    caseId || "",
  );

  await db.insertIgnore(
    "cm_intel_tasks",
    {
      company_id: message.company_id,
      task_key: taskKey,
      case_id: caseId,
      identity_id: identityId,
      source_message_id: message.id,
      task_type: type,
      title,
      status: "proposed",
      priority,
      due_at: null,
      evidence: {
        exact_quote: observation.evidence_quote,
        suggested_action:
          observation.recommended_action,
        actor_role: observation.actor_role,
      },
    },
    "company_id,task_key",
  );

  if (
    type === "verify_payment" ||
    type === "review_agreement"
  ) {
    await requestReview(
      db,
      message,
      type === "verify_payment"
        ? "sensitive_action_required"
        : "possible_booking_confirmation",
      {
        identityId,
        caseId,
        reason: type,
        metadata: {
          task_key: taskKey,
        },
      },
      "high",
    );
  }
}
