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

type MediaGroup = {
  total: number;
  empty: number;
  urlOnly: number;
  jsonLike: number;
  withUrl: number;
  otherContent: number;
};

function classify(body: string | null) {
  const value = (body || "").trim();

  if (!value) return "empty";

  if (
    /^https?:\/\/\S+$/i.test(value)
  ) {
    return "urlOnly";
  }

  if (
    (value.startsWith("{") && value.endsWith("}")) ||
    (value.startsWith("[") && value.endsWith("]"))
  ) {
    return "jsonLike";
  }

  if (
    /https?:\/\/\S+/i.test(value)
  ) {
    return "withUrl";
  }

  return "otherContent";
}

function emptyGroup(): MediaGroup {
  return {
    total: 0,
    empty: 0,
    urlOnly: 0,
    jsonLike: 0,
    withUrl: 0,
    otherContent: 0,
  };
}

async function main() {
  const cfg = loadConfig();

  const db = new Supabase({
    ...cfg,
    writeEnabled: false,
  });

  const groups: Record<string, MediaGroup> = {};

  const pageSize = 500;
  const maximum = 100000;

  let processed = 0;

  for (
    let offset = 0;
    offset < maximum;
    offset += pageSize
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
        ["limit", String(pageSize)],
        ["offset", String(offset)],
      ],
    );

    for (const message of messages) {
      const type =
        message.message_type || "unknown";

      const group =
        groups[type] || emptyGroup();

      group.total++;

      const classification =
        classify(message.body);

      group[classification as keyof Omit<
        MediaGroup,
        "total"
      >]++;

      groups[type] = group;

      processed++;
    }

    if (messages.length < pageSize) {
      break;
    }
  }

  const mediaTypes = [
    "image",
    "video",
    "audio",
    "document",
    "location",
    "interactive",
  ];

  let multimedia = 0;

  for (const type of mediaTypes) {
    multimedia += groups[type]?.total || 0;
  }

  console.log(
    "CM_MEDIA_INVENTORY",
    JSON.stringify({
      company: cfg.companyId,
      totalMessages: processed,
      multimediaMessages: multimedia,
      groups,
      warning:
        "La presencia de un enlace o un cuerpo no demuestra que el archivo multimedia haya sido interpretado.",
    }, null, 2),
  );
}

main().catch(error => {
  console.error(
    "CM_MEDIA_INVENTORY_FAILED",
    error instanceof Error
      ? error.message
      : "UNKNOWN",
  );

  process.exitCode = 1;
});
