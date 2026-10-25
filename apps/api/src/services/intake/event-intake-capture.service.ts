import {
  extractEventIntake,
  type EventIntakeDraft,
} from "./event-intake.service.js";

import {
  supabaseRpc,
} from "../db/supabase-rest.client.js";

/**
 * Captación comercial de Eventos Mediterráneo.
 *
 * No envía WhatsApp.
 * No confirma reservas.
 * No selecciona automáticamente entre
 * varias solicitudes del mismo cliente.
 *
 * La persistencia se realizará a través
 * de una función transaccional PostgreSQL.
 */

export type IncomingEventInput = {
  companyId: string;
  phone: string;
  sourceMessageId: string;
  text: string;
  customerName?: string | null;
};

export type PreparedIntakeCapture = {
  p_company_id: string;
  p_whatsapp: string;
  p_message_id: string;
  p_draft: EventIntakeDraft;
  p_message_body: string;
  p_customer_name: string | null;
};

export type IntakeCaptureResult = {
  status:
    | "created"
    | "updated"
    | "duplicate"
    | "ignored"
    | "disabled"
    | "needs_review";

  threadId?: string;
  leadRequestId?: string;
  nextAction?: string;
  reason?: string;
  version?: string;
};

/**
 * Normaliza los teléfonos de Whapi.
 * No acepta identificadores de grupos.
 */
function normalizePhone(
  value: string,
): string {
  const sender = value
    .trim()
    .split("@")[0];

  const digits = sender.replace(
    /\D/g,
    "",
  );

  if (
    !/^\d{6,20}$/.test(digits)
  ) {
    throw new Error(
      "INVALID_INTAKE_PHONE",
    );
  }

  return digits;
}

/**
 * Preparación pura:
 * ninguna conexión a Supabase.
 */
export function prepareIncomingEventCapture(
  input: IncomingEventInput,
): PreparedIntakeCapture {

  const companyId =
    input.companyId.trim();

  const messageId =
    input.sourceMessageId.trim();

  const text =
    input.text.trim();

  if (
    !companyId ||
    companyId.length > 160
  ) {
    throw new Error(
      "INVALID_INTAKE_COMPANY",
    );
  }

  if (
    !messageId ||
    messageId.length > 255
  ) {
    throw new Error(
      "INVALID_INTAKE_MESSAGE_ID",
    );
  }

  if (!text) {
    throw new Error(
      "EMPTY_INTAKE_MESSAGE",
    );
  }

  const draft =
    extractEventIntake(text);

  return {
    p_company_id: companyId,

    p_whatsapp: normalizePhone(
      input.phone,
    ),

    p_message_id: messageId,

    p_draft: draft,

    p_message_body:
      text.slice(0, 8000),

    p_customer_name:
      input.customerName
        ?.trim()
        .slice(0, 160)
      || null,
  };
}

/**
 * Persistencia real.
 *
 * No llamar desde el webhook hasta:
 * - Aplicar las migraciones revisadas.
 * - Superar pruebas transaccionales.
 * - Integrar controles administrativos.
 */
export async function captureIncomingEvent(
  input: IncomingEventInput,
): Promise<IntakeCaptureResult> {

  const payload =
    prepareIncomingEventCapture(
      input,
    );

  return supabaseRpc<
    IntakeCaptureResult
  >(
    "crm_intake_capture_message",
    payload,
  );
}
