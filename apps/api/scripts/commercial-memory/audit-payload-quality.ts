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

type Group = {
  total: number;
  validJson: number;
  invalidJson: number;
  other: number;
  minimumLength: number;
  maximumLength: number;
  averageLength: number;
  startsObject: number;
  startsArray: number;
  endsObject: number;
  endsArray: number;
};

async function main() {
  const cfg = loadConfig();

  const db = new Supabase({
    ...cfg,
    writeEnabled: false,
  });

  const groups =
    new Map<string, Group>();

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

      if (type === "text") continue;

      const body = message.body || "";
      const value = body.trim();

      const group = groups.get(type) || {
        total: 0,
        validJson: 0,
        invalidJson: 0,
        other: 0,
        minimumLength: Infinity,
        maximumLength: 0,
        averageLength: 0,
        startsObject: 0,
        startsArray: 0,
        endsObject: 0,
        endsArray: 0,
      };

      group.total++;

      group.minimumLength = Math.min(
        group.minimumLength,
        body.length,
      );

      group.maximumLength = Math.max(
        group.maximumLength,
        body.length,
      );

      group.averageLength += body.length;

      if (value.startsWith("{")) {
        group.startsObject++;
      }

      if (value.startsWith("[")) {
        group.startsArray++;
      }

      if (value.endsWith("}")) {
        group.endsObject++;
      }

      if (value.endsWith("]")) {
        group.endsArray++;
      }

      if (
        value.startsWith("{") ||
        value.startsWith("[")
      ) {
        try {
          JSON.parse(value);
          group.validJson++;
        } catch {
          group.invalidJson++;
        }
      } else {
        group.other++;
      }

      groups.set(type, group);
    }

    if (messages.length < 500) break;
  }

  const report: Record<
    string,
    Record<string, number>
  > = {};

  for (const [type, group] of groups) {
    report[type] = {
      ...group,

      minimumLength:
        Number.isFinite(group.minimumLength)
          ? group.minimumLength
          : 0,

      averageLength:
        group.total
          ? Math.round(
              group.averageLength / group.total,
            )
          : 0,
    };
  }

  console.log(
    "CM_PAYLOAD_QUALITY",
    JSON.stringify({
      company: cfg.companyId,
      groups: report,
      note:
        "El informe no muestra el contenido de los mensajes.",
    }, null, 2),
  );
}

main().catch(error => {
  console.error(
    "CM_PAYLOAD_AUDIT_FAILED",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
