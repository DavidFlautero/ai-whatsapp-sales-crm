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
  occurred_at: string;
};

type Lead = {
  whatsapp?: string | null;
  status?: string | null;
};

type Thread = {
  phone: string;
  inbound: number;
  outbound: number;
  signals: Set<string>;
  closeMentions: number;
  lastActivity: string;
};

const company =
  process.env.DEFAULT_COMPANY_ID ||
  "eventos-mediterraneo";

const normalize = (value: string) =>
  value.replace(/\D/g, "");

async function main() {
  const query =
    "?select=contact_phone,external_message_id,body,direction,occurred_at" +
    "&company_id=eq." + encodeURIComponent(company) +
    "&occurred_at=gte.2026-10-12T22:00:00Z" +
    "&occurred_at=lt.2026-10-14T22:00:00Z" +
    "&message_type=eq.text" +
    "&order=occurred_at.asc" +
    "&limit=1000";

  const messages = await supabaseRequest<Message[]>({
    table: "messages",
    query,
  });

  const threads = new Map<string, Thread>();
  const intents = new Map<string, number>();

  const closePattern =
    /reservad|confirmad|señal|seña|anticipo|transferencia|abonad|cerrad|pago recibido/i;

  for (const message of messages) {
    const phone = normalize(message.contact_phone || "");
    if (!phone) continue;

    let thread = threads.get(phone);

    if (!thread) {
      thread = {
        phone,
        inbound: 0,
        outbound: 0,
        signals: new Set(),
        closeMentions: 0,
        lastActivity: "",
      };

      threads.set(phone, thread);
    }

    thread.lastActivity = message.occurred_at;

    if (message.direction === "outbound") {
      thread.outbound++;
    } else if (message.direction === "inbound") {
      thread.inbound++;
    }

    if (closePattern.test(message.body || "")) {
      thread.closeMentions++;
    }

    if (
      message.direction !== "inbound" ||
      !message.external_message_id ||
      !message.body?.trim()
    ) {
      continue;
    }

    try {
      const prepared = prepareIncomingEventCapture({
        companyId: company,
        phone,
        sourceMessageId: message.external_message_id,
        text: message.body,
      });

      const draft = prepared.p_draft as unknown as
        Record<string, unknown>;

      const intent = draft.eventIntent;

      const label =
        typeof intent === "string" ||
        typeof intent === "boolean"
          ? String(intent)
          : "sin_valor";

      intents.set(label, (intents.get(label) || 0) + 1);

      for (const key of [
        "venueType",
        "attendees",
        "amenities",
        "dateRange",
        "eventType",
        "budgetMaxEur",
        "dateOptions",
      ]) {
        const value = draft[key];

        if (
          value !== null &&
          value !== undefined &&
          value !== false &&
          value !== "" &&
          (!Array.isArray(value) || value.length > 0)
        ) {
          thread.signals.add(key);
        }
      }
    } catch {
      thread.signals.add("error_extraccion");
    }
  }

  let existing = new Set<string>();
  let leadsAvailable = false;

  try {
    const leads = await supabaseRequest<Lead[]>({
      table: "crm_lead_requests",
      query:
        "?select=whatsapp,status" +
        "&company_id=eq." + encodeURIComponent(company) +
        "&limit=1000",
    });

    existing = new Set(
      leads
        .map(row => normalize(row.whatsapp || ""))
        .filter(Boolean)
    );

    leadsAvailable = true;
  } catch {
    console.log(
      "AVISO: No se pudo consultar solicitudes existentes."
    );
  }

  console.log("=== INTENCIONES REALES ===");

  for (const [intent, count] of intents) {
    console.log(`${intent}: ${count}`);
  }

  console.log("\n=== CONVERSACIONES ===");

  const ordered = [...threads.values()].sort(
    (a, b) =>
      b.signals.size - a.signals.size ||
      b.closeMentions - a.closeMentions
  );

  ordered.forEach((thread, index) => {
    const matched = leadsAvailable
      ? existing.has(thread.phone) ? "SI" : "NO"
      : "SIN_VERIFICAR";

    console.log(
      `C${String(index + 1).padStart(2, "0")}`,
      `telefono=***${thread.phone.slice(-4)}`,
      `entrantes=${thread.inbound}`,
      `salientes=${thread.outbound}`,
      `datos=${[...thread.signals].join(",") || "ninguno"}`,
      `menciones_cierre=${thread.closeMentions}`,
      `solicitud_existente=${matched}`
    );
  });

  console.log("\n=== RESUMEN ===");
  console.log("Mensajes:", messages.length);
  console.log("Conversaciones:", threads.size);
  console.log(
    "Conversaciones con datos comerciales:",
    ordered.filter(t => t.signals.size > 0).length
  );
  console.log(
    "Conversaciones con posibles menciones de cierre:",
    ordered.filter(t => t.closeMentions > 0).length
  );

  console.log("MODO LECTURA: SIN MODIFICACIONES");
}

main().catch(error => {
  console.error("ERROR:", error.message);
  process.exitCode = 1;
});
