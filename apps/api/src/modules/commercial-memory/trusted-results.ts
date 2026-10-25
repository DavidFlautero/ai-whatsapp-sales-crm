import { Supabase } from "./supabase.js";

import {
  extractCommercialText,
} from "./commercial-text.js";

export type EvidenceObservation = {
  id: string;
  message_id: string;
  evidence_quote?: string | null;
  observation?: {
    evidence_quote?: string | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type EvidenceTask = {
  id: string;
  source_message_id: string;
  evidence?: {
    origin?: string;
    exact_quote?: string | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

type SourceMessage = {
  id: string;
  body: string | null;
  message_type: string | null;
};

type Rejected = {
  id: string;
  reason: string;
};

function validUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    .test(value);
}

async function loadSourceMessages(
  db: Supabase,
  company: string,
  ids: string[],
): Promise<Map<string, SourceMessage>> {
  const result =
    new Map<string, SourceMessage>();

  const unique = [...new Set(ids)]
    .filter(validUUID);

  for (
    let offset = 0;
    offset < unique.length;
    offset += 75
  ) {
    const chunk = unique.slice(
      offset,
      offset + 75,
    );

    const rows = await db.get<SourceMessage[]>(
      "messages",
      [
        [
          "select",
          "id,body,message_type",
        ],
        ["company_id", `eq.${company}`],
        ["id", `in.(${chunk.join(",")})`],
        ["limit", "100"],
      ],
    );

    for (const row of rows) {
      result.set(row.id, row);
    }
  }

  return result;
}

function verifyQuote(
  source: SourceMessage | undefined,
  quote: unknown,
): string | null {
  if (!source) {
    return "SOURCE_MESSAGE_MISSING";
  }

  const text = extractCommercialText(
    source,
  );

  if (!text) {
    return "SOURCE_TEXT_NOT_EXTRACTABLE";
  }

  if (
    typeof quote !== "string" ||
    !quote.trim()
  ) {
    return "EVIDENCE_QUOTE_MISSING";
  }

  if (!text.includes(quote.trim())) {
    return "EVIDENCE_QUOTE_NOT_FOUND";
  }

  return null;
}

export async function splitTrustedObservations(
  db: Supabase,
  company: string,
  observations: EvidenceObservation[],
): Promise<{
  trusted: EvidenceObservation[];
  quarantined: Rejected[];
}> {
  const sources = await loadSourceMessages(
    db,
    company,
    observations.map(item => item.message_id),
  );

  const trusted: EvidenceObservation[] = [];
  const quarantined: Rejected[] = [];

  for (const item of observations) {
    const quote =
      item.evidence_quote ??
      item.observation?.evidence_quote;

    const reason = verifyQuote(
      sources.get(item.message_id),
      quote,
    );

    if (reason) {
      quarantined.push({
        id: item.id,
        reason,
      });
    } else {
      trusted.push(item);
    }
  }

  return {
    trusted,
    quarantined,
  };
}

export async function splitTrustedTasks(
  db: Supabase,
  company: string,
  tasks: EvidenceTask[],
): Promise<{
  trusted: EvidenceTask[];
  quarantined: Rejected[];
}> {
  const sources = await loadSourceMessages(
    db,
    company,
    tasks.map(item => item.source_message_id),
  );

  const trusted: EvidenceTask[] = [];
  const quarantined: Rejected[] = [];

  for (const task of tasks) {
    const origin =
      task.evidence?.origin;

    // Estas tareas fueron creadas para
    // revisar expedientes existentes.
    // No afirman acuerdos comerciales.
    if (
      origin ===
      "historical_case_reconciliation"
    ) {
      trusted.push(task);
      continue;
    }

    const reason = verifyQuote(
      sources.get(task.source_message_id),
      task.evidence?.exact_quote,
    );

    if (reason) {
      quarantined.push({
        id: task.id,
        reason,
      });
    } else {
      trusted.push(task);
    }
  }

  return {
    trusted,
    quarantined,
  };
}
