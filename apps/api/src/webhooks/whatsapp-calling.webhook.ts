import {
  createHash,
} from "node:crypto";

import {
  appendFile,
  mkdir,
} from "node:fs/promises";

import {
  dirname,
} from "node:path";

import {
  env,
} from "../config/env.js";

import {
  findCallByExternalId,
} from "../modules/voice/voice-call.repository.js";

import {
  startVoiceCall,
} from "../modules/voice/voice-call-start.service.js";

import {
  appendVoiceCallEvent,
} from "../modules/voice/voice-event.repository.js";

import {
  handleWhatsappCallingSignaling,
} from "./whatsapp-calling-signaling.service.js";

type JsonObject =
  Record<string, unknown>;

export type WhatsappCallingEvent = {
  eventKey: string;
  callId: string;
  event: string;
  direction: string | null;
  status: string | null;
  from: string | null;
  to: string | null;
  timestamp: string | null;
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  wabaId: string | null;
  sdpType: string | null;
  sdp: string | null;
  receivedAt: string;
};

const seenEventKeys =
  new Set<string>();

let persistenceQueue:
  Promise<void> =
    Promise.resolve();

function asObject(
  value: unknown,
): JsonObject | null {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
  ) {
    return null;
  }

  return value as JsonObject;
}

function asArray(
  value: unknown,
): unknown[] {
  return Array.isArray(value)
    ? value
    : [];
}

function asString(
  value: unknown,
): string | null {
  return typeof value === "string"
    && value.trim()
      ? value.trim()
      : null;
}

function createEventKey(
  callId: string,
  event: string,
  timestamp: string | null,
  sdp: string | null,
) {
  return createHash("sha256")
    .update(
      [
        callId,
        event,
        timestamp ?? "",
        sdp ?? "",
      ].join(":"),
    )
    .digest("hex");
}

function occurredAt(
  timestamp: string | null,
) {
  const seconds =
    Number(timestamp);

  if (
    timestamp
    && Number.isFinite(seconds)
  ) {
    return new Date(
      seconds * 1000,
    ).toISOString();
  }

  return new Date()
    .toISOString();
}

export function extractWhatsappCallingEvents(
  payload: unknown,
) {
  const root =
    asObject(payload);

  const events:
    WhatsappCallingEvent[] = [];

  if (!root) {
    return events;
  }

  for (
    const entryValue
    of asArray(root.entry)
  ) {
    const entry =
      asObject(entryValue);

    if (!entry) {
      continue;
    }

    const wabaId =
      asString(entry.id);

    for (
      const changeValue
      of asArray(entry.changes)
    ) {
      const change =
        asObject(changeValue);

      const value =
        asObject(change?.value);

      if (!value) {
        continue;
      }

      const metadata =
        asObject(value.metadata);

      for (
        const callValue
        of asArray(value.calls)
      ) {
        const call =
          asObject(callValue);

        const callId =
          asString(call?.id);

        if (
          !call
          || !callId
        ) {
          continue;
        }

        const event =
          asString(call.event)
          ?? asString(call.status)
          ?? "unknown";

        const timestamp =
          asString(call.timestamp);

        const session =
          asObject(call.session);

        const sdp =
          asString(session?.sdp);

        events.push({
          eventKey:
            createEventKey(
              callId,
              event,
              timestamp,
              sdp,
            ),
          callId,
          event,
          direction:
            asString(call.direction),
          status:
            asString(call.status),
          from:
            asString(call.from),
          to:
            asString(call.to),
          timestamp,
          phoneNumberId:
            asString(
              metadata
                ?.phone_number_id,
            ),
          displayPhoneNumber:
            asString(
              metadata
                ?.display_phone_number,
            ),
          wabaId,
          sdpType:
            asString(
              session?.sdp_type,
            ),
          sdp,
          receivedAt:
            new Date()
              .toISOString(),
        });
      }
    }
  }

  return events;
}

export function countWhatsappCallingEvents(
  payload: unknown,
) {
  return extractWhatsappCallingEvents(
    payload,
  ).length;
}

function inboxPath() {
  return process.env
    .VOICE_META_CALL_INBOX_PATH
    ?.trim()
    || (
      "/opt/ventas-ia-mayorista"
      + "/data/whatsapp-calling"
      + "/inbox.jsonl"
    );
}

async function persistEvent(
  event: WhatsappCallingEvent,
) {
  const path =
    inboxPath();

  await mkdir(
    dirname(path),
    {
      recursive:
        true,
      mode:
        0o700,
    },
  );

  await appendFile(
    path,
    `${JSON.stringify(event)}\n`,
    {
      encoding:
        "utf8",
      mode:
        0o600,
    },
  );
}

function enqueuePersistence(
  event: WhatsappCallingEvent,
) {
  const operation =
    persistenceQueue.then(
      () =>
        persistEvent(event),
    );

  persistenceQueue =
    operation.catch(
      () => undefined,
    );

  return operation;
}

async function registerCrmEvent(
  event: WhatsappCallingEvent,
) {
  const companyId =
    env.DEFAULT_COMPANY_ID;

  let call =
    await findCallByExternalId(
      companyId,
      event.callId,
    );

  if (
    !call
    && event.event === "connect"
    && event.from
  ) {
    call =
      await startVoiceCall(
        companyId,
        {
          direction:
            "inbound",
          contact_phone:
            event.from,
          from_number:
            event.from,
          to_number:
            event.to
            ?? event.displayPhoneNumber,
          route_id:
            null,
          external_call_id:
            event.callId,
          metadata: {
            provider:
              "whatsapp_cloud",
            wabaId:
              event.wabaId,
            phoneNumberId:
              event.phoneNumberId,
            sdpType:
              event.sdpType,
            hasSdp:
              Boolean(event.sdp),
          },
        },
      );
  }

  if (!call?.id) {
    return;
  }

  await appendVoiceCallEvent({
    company_id:
      companyId,
    call_session_id:
      call.id,
    external_event_id:
      event.eventKey,
    event_type:
      `meta.whatsapp.${event.event}`,
    actor_type:
      event.direction
        === "USER_INITIATED"
        ? "customer"
        : "system",
    payload: {
      direction:
        event.direction,
      status:
        event.status,
      from:
        event.from,
      to:
        event.to,
      phoneNumberId:
        event.phoneNumberId,
      wabaId:
        event.wabaId,
      sdpType:
        event.sdpType,
      hasSdp:
        Boolean(event.sdp),
    },
    occurred_at:
      occurredAt(
        event.timestamp,
      ),
  });
}

export async function handleWhatsappCallingWebhook(
  payload: unknown,
) {
  const events =
    extractWhatsappCallingEvents(
      payload,
    );

  let persisted =
    0;

  let duplicates =
    0;

  for (const event of events) {
    if (
      seenEventKeys.has(
        event.eventKey,
      )
    ) {
      duplicates += 1;
      continue;
    }

    seenEventKeys.add(
      event.eventKey,
    );

    try {
      await enqueuePersistence(
        event,
      );

      try {
        await registerCrmEvent(
          event,
        );
      } catch (error) {
        console.error(
          "[WHATSAPP CALLING CRM ERROR]",
          {
            callId:
              event.callId,
            event:
              event.event,
            error,
          },
        );
      }

      try {
        await handleWhatsappCallingSignaling(
          event,
          env.DEFAULT_COMPANY_ID,
        );
      } catch (error) {
        console.error(
          "[WHATSAPP CALLING SIGNALING ERROR]",
          {
            callId:
              event.callId,
            event:
              event.event,
            error,
          },
        );
      }

      persisted += 1;

      console.log(
        "[WHATSAPP CALLING EVENT]",
        {
          callId:
            event.callId,
          event:
            event.event,
          direction:
            event.direction,
          from:
            event.from,
          phoneNumberId:
            event.phoneNumberId,
          hasSdp:
            Boolean(event.sdp),
        },
      );
    } catch (error) {
      seenEventKeys.delete(
        event.eventKey,
      );

      throw error;
    }
  }

  return {
    received:
      events.length,
    persisted,
    duplicates,
  };
}
