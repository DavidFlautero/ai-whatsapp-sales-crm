import { extractCommercialText } from "./commercial-text.js";
import { Supabase } from "./supabase.js";

type MessageRow = {
  id: string;
  message_type: string | null;
  body: string | null;
  direction: string | null;
};

type ReceiptRow = {
  message_id: string;
  result: string;
  processor_version: string;
};

type ObservationRow = {
  message_id: string;
};

type LinkRow = {
  message_id: string;
};

async function readAll<T>(
  db: Supabase,
  table: string,
  company: string,
  select: string,
  order: string,
): Promise<T[]> {
  const all: T[] = [];

  const pageSize = 500;
  const maxRows = 100000;

  for (
    let offset = 0;
    offset < maxRows;
    offset += pageSize
  ) {
    const page = await db.get<T[]>(
      table,
      [
        ["select", select],
        ["company_id", `eq.${company}`],
        ["order", `${order}.asc`],
        ["limit", String(pageSize)],
        ["offset", String(offset)],
      ],
    );

    all.push(...page);

    if (page.length < pageSize) {
      return all;
    }
  }

  throw new Error(
    `CM_COVERAGE_LIMIT_EXCEEDED:${table}`,
  );
}

export async function calculateMemoryCoverage(
  db: Supabase,
  company: string,
) {
  const [
    messages,
    receipts,
    observations,
    links,
  ] = await Promise.all([
    readAll<MessageRow>(
      db,
      "messages",
      company,
      "id,message_type,body,direction",
      "id",
    ),

    readAll<ReceiptRow>(
      db,
      "cm_intel_receipts",
      company,
      "message_id,result,processor_version",
      "message_id",
    ),

    readAll<ObservationRow>(
      db,
      "cm_intel_observations",
      company,
      "message_id",
      "message_id",
    ),

    readAll<LinkRow>(
      db,
      "crm_memory_case_messages",
      company,
      "message_id",
      "message_id",
    ),
  ]);

  const receiptMap = new Map(
    receipts
      .filter(
        r =>
          r.processor_version ===
          "commercial-intel-v2",
      )
      .map(r => [r.message_id, r.result]),
  );

  const observed = new Set(
    observations.map(r => r.message_id),
  );

  const linked = new Set(
    links.map(r => r.message_id),
  );

  const types: Record<string, number> = {};

  const results = {
    totalMessages: messages.length,
    withReadableText: 0,
    withoutReadableText: 0,

    eligibleForAI: 0,
    eligibleWithoutReceipt: 0,

    analyzedReceipts: 0,
    skippedReceipts: 0,
    unsupportedReceipts: 0,

    observations: observed.size,
    linkedToCases: linked.size,
    messagesWithoutCase: 0,

    unknownWithText: 0,
    inbound: 0,
    outbound: 0,

    analyzedWithoutObservation: 0,
    receiptMissingOriginalMessage: 0,
  };

  const messageIds = new Set(
    messages.map(m => m.id),
  );

  for (const message of messages) {
    const type = message.message_type || "null";

    types[type] = (types[type] || 0) + 1;

    const readable =
      extractCommercialText(message) !== null;

    if (readable) {
      results.withReadableText++;
    } else {
      results.withoutReadableText++;
    }

    if (message.direction === "inbound") {
      results.inbound++;
    }

    if (message.direction === "outbound") {
      results.outbound++;
    }

    if (
      type === "unknown" &&
      readable
    ) {
      results.unknownWithText++;
    }

    const eligible =
      readable &&
      (
        type === "text" ||
        type === "unknown"
      );

    if (eligible) {
      results.eligibleForAI++;
    }

    const receipt = receiptMap.get(message.id);

    if (eligible && !receipt) {
      results.eligibleWithoutReceipt++;
    }

    if (receipt === "analyzed") {
      results.analyzedReceipts++;

      if (!observed.has(message.id)) {
        results.analyzedWithoutObservation++;
      }
    }

    if (receipt === "skipped") {
      results.skippedReceipts++;
    }

    if (receipt === "unsupported") {
      results.unsupportedReceipts++;
    }

    if (!linked.has(message.id)) {
      results.messagesWithoutCase++;
    }
  }

  for (const receipt of receiptMap.keys()) {
    if (!messageIds.has(receipt)) {
      results.receiptMissingOriginalMessage++;
    }
  }

  return {
    company,
    generatedAt: new Date().toISOString(),
    coverage: results,
    messageTypes: types,

    interpretation: {
      historicalStorage:
        messages.length,

      aiProcessed:
        results.analyzedReceipts,

      pendingEligibleMessages:
        results.eligibleWithoutReceipt,

      note:
        "Un mensaje procesado por reglas no equivale a una interpretacion contextual con IA.",
    },
  };
}
