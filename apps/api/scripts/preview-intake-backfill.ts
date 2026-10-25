import {
  supabaseRequest,
} from "../src/services/db/supabase-rest.client.js";

import {
  prepareIncomingEventCapture,
} from "../src/services/intake/event-intake-capture.service.js";

type Message = {
  contact_phone: string;
  external_message_id: string | null;
  body: string | null;
  direction: string;
  message_type: string;
  occurred_at: string;
};

const company =
  process.env.DEFAULT_COMPANY_ID
  || "eventos-mediterraneo";

const start = "2026-10-12T22:00:00Z";
const end = "2026-10-14T22:00:00Z";

const query =
  "?select=contact_phone,external_message_id,body,direction,message_type,occurred_at"
  + "&company_id=eq." + encodeURIComponent(company)
  + "&occurred_at=gte." + encodeURIComponent(start)
  + "&occurred_at=lt." + encodeURIComponent(end)
  + "&message_type=eq.text"
  + "&order=occurred_at.asc"
  + "&limit=1000";

async function main() {
  const messages = await supabaseRequest<Message[]>({
    table: "messages",
    query,
  });

  const contacts = new Set<string>();
  const fields = new Map<string, number>();

  let inbound = 0;
  let outbound = 0;
  let prepared = 0;
  let skipped = 0;
  let errors = 0;

  for (const message of messages) {
    if (message.contact_phone) {
      contacts.add(message.contact_phone);
    }

    if (message.direction === "outbound") {
      outbound++;
      continue;
    }

    if (message.direction !== "inbound") {
      skipped++;
      continue;
    }

    inbound++;

    if (
      !message.body?.trim()
      || !message.external_message_id
      || !message.contact_phone
    ) {
      skipped++;
      continue;
    }

    try {
      const payload = prepareIncomingEventCapture({
        companyId: company,
        phone: message.contact_phone,
        sourceMessageId: message.external_message_id,
        text: message.body,
      });

      prepared++;

      const draft = payload.p_draft as unknown as
        Record<string, unknown>;

      for (const [key, value] of Object.entries(draft)) {
        if (
          value === null
          || value === undefined
          || value === ""
        ) {
          continue;
        }

        if (
          Array.isArray(value)
          && value.length === 0
        ) {
          continue;
        }

        fields.set(key, (fields.get(key) || 0) + 1);
      }
    } catch {
      errors++;
    }
  }

  console.log("=== RECUPERACION COMERCIAL: VISTA PREVIA ===");
  console.log("Empresa:", company);
  console.log("Mensajes encontrados:", messages.length);
  console.log("Contactos distintos:", contacts.size);
  console.log("Mensajes entrantes:", inbound);
  console.log("Mensajes salientes:", outbound);
  console.log("Mensajes preparados:", prepared);
  console.log("Mensajes omitidos:", skipped);
  console.log("Errores de preparacion:", errors);

  console.log("=== CAMPOS DETECTADOS POR EL EXTRACTOR ===");

  for (const [key, count] of [...fields.entries()]
    .sort((a, b) => b[1] - a[1])) {
    console.log(`${key}: ${count}`);
  }

  console.log("=== RESULTADO ===");
  console.log("MODO LECTURA: NO SE MODIFICO SUPABASE");
}

main().catch((error: unknown) => {
  console.error(
    "ERROR:",
    error instanceof Error ? error.message : String(error)
  );
  process.exitCode = 1;
});
