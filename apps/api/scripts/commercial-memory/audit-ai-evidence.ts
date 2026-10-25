import {
  loadConfig,
} from "../../src/modules/commercial-memory/config.js";

import {
  Supabase,
} from "../../src/modules/commercial-memory/supabase.js";

import {
  extractCommercialText,
} from "../../src/modules/commercial-memory/commercial-text.js";

type Observation = {
  id: string;
  message_id: string;
  processor_version: string;
  evidence_quote: string | null;
};

type MessageRow = {
  id: string;
  message_type: string | null;
  body: string | null;
};

async function main() {
  const cfg = loadConfig();

  const db = new Supabase({
    ...cfg,
    writeEnabled: false,
  });

  const observations: Observation[] = [];

  for (
    let offset = 0;
    offset < 100000;
    offset += 500
  ) {
    const rows = await db.get<Observation[]>(
      "cm_intel_observations",
      [
        [
          "select",
          "id,message_id,processor_version,evidence_quote",
        ],
        [
          "company_id",
          `eq.${cfg.companyId}`,
        ],
        [
          "order",
          "id.asc",
        ],
        ["limit", "500"],
        ["offset", String(offset)],
      ],
    );

    observations.push(...rows);

    if (rows.length < 500) break;
  }

  const types: Record<string, number> = {};

  let missingOriginal = 0;
  let withoutExtractableText = 0;
  let unsupportedQuote = 0;
  let verifiedQuote = 0;

  for (const observation of observations) {
    const rows = await db.get<MessageRow[]>(
      "messages",
      [
        [
          "select",
          "id,message_type,body",
        ],
        [
          "company_id",
          `eq.${cfg.companyId}`,
        ],
        [
          "id",
          `eq.${observation.message_id}`,
        ],
        ["limit", "1"],
      ],
    );

    const message = rows[0];

    if (!message) {
      missingOriginal++;
      continue;
    }

    const type =
      message.message_type || "unknown";

    types[type] = (types[type] || 0) + 1;

    const text =
      extractCommercialText(message);

    if (!text) {
      withoutExtractableText++;
      continue;
    }

    const quote =
      observation.evidence_quote?.trim();

    if (!quote || !text.includes(quote)) {
      unsupportedQuote++;
    } else {
      verifiedQuote++;
    }
  }

  console.log(
    "CM_AI_EVIDENCE_AUDIT",
    JSON.stringify({
      company: cfg.companyId,
      observations: observations.length,
      bySourceMessageType: types,
      missingOriginal,
      withoutExtractableText,
      unsupportedQuote,
      verifiedQuote,
      warning:
        "Este informe detecta evidencia textual inconsistente. No valida por si solo la exactitud comercial de las afirmaciones.",
    }, null, 2),
  );
}

main().catch(error => {
  console.error(
    "CM_AI_EVIDENCE_AUDIT_FAILED",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
