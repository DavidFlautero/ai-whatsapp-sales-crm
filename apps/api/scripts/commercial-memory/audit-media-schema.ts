import {
  loadConfig,
} from "../../src/modules/commercial-memory/config.js";

import {
  Supabase,
} from "../../src/modules/commercial-memory/supabase.js";

type MessageRow = {
  id: string;
  message_type: string | null;
  body: string | null;
};

const TYPES = new Set([
  "unknown",
  "image",
  "audio",
  "video",
  "document",
  "location",
  "interactive",
]);

function object(
  value: unknown,
): Record<string, unknown> | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as Record<string, unknown>;
}

function structure(
  value: unknown,
  prefix = "",
  depth = 0,
): string[] {
  if (depth > 3) return [];

  const current = object(value);

  if (!current) return [];

  const result: string[] = [];

  for (const [key, nested] of Object.entries(current)) {
    const full = prefix
      ? `${prefix}.${key}`
      : key;

    result.push(full);

    if (object(nested)) {
      result.push(
        ...structure(
          nested,
          full,
          depth + 1,
        ),
      );
    }
  }

  return result;
}

async function main() {
  const cfg = loadConfig();

  const db = new Supabase({
    ...cfg,
    writeEnabled: false,
  });

  const result: Record<
    string,
    {
      messages: number;
      jsonMessages: number;
      fields: Record<string, number>;
    }
  > = {};

  for (
    let offset = 0;
    offset < 100000;
    offset += 500
  ) {
    const messages = await db.get<MessageRow[]>(
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
        ["order", "id.asc"],
        ["limit", "500"],
        ["offset", String(offset)],
      ],
    );

    for (const message of messages) {
      const type =
        message.message_type || "unknown";

      if (!TYPES.has(type)) continue;

      const group = result[type] || {
        messages: 0,
        jsonMessages: 0,
        fields: {},
      };

      group.messages++;

      try {
        const parsed = JSON.parse(
          message.body || "",
        );

        group.jsonMessages++;

        const keys = [
          ...new Set(
            structure(parsed),
          ),
        ];

        for (const key of keys) {
          group.fields[key] =
            (group.fields[key] || 0) + 1;
        }
      } catch {
        // Contenido no JSON.
      }

      result[type] = group;
    }

    if (messages.length < 500) break;
  }

  console.log(
    "CM_MEDIA_SCHEMA",
    JSON.stringify({
      company: cfg.companyId,
      types: result,
    }, null, 2),
  );
}

main().catch(error => {
  console.error(
    "CM_MEDIA_SCHEMA_FAILED",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
