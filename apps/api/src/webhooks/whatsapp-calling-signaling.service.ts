import {
  appendFile,
  mkdir,
} from "node:fs/promises";

import {
  dirname,
} from "node:path";

type JsonObject =
  Record<string, unknown>;

export type CallingSignalingEvent = {
  callId: string;
  event: string;
  direction: string | null;
  from: string | null;
  to: string | null;
  phoneNumberId: string | null;
  wabaId: string | null;
  sdpType: string | null;
  sdp: string | null;
};

type SignalingMode =
  | "disabled"
  | "dry_run"
  | "live";

type WorkerAnswer = {
  ok: boolean;
  call_id: string;
  session_id: string;
  sdp: string;
  sdp_type: string;
  reused: boolean;
};

type SignalingResult = {
  handled: boolean;
  callId: string;
  event: string;
  mode: SignalingMode;
  workerSessionId?: string;
  workerClosed?: boolean;
  preAccepted?: boolean;
  accepted?: boolean;
  reason?: string;
};

class CallingSignalingError
  extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name =
      "CallingSignalingError";
  }
}

const activeOperations =
  new Map<
    string,
    Promise<SignalingResult>
  >();

function signalingMode():
  SignalingMode {
  const raw =
    process.env
      .VOICE_META_SIGNALING_MODE
      ?.trim()
      .toLowerCase();

  if (
    raw === "live"
    || raw === "disabled"
  ) {
    return raw;
  }

  return "dry_run";
}

function voiceRuntimeUrl() {
  return (
    process.env
      .VOICE_PRO_HTTP_URL
      ?.trim()
    || "http://127.0.0.1:4200"
  ).replace(/\/+$/, "");
}

function voiceHeaders() {
  const token =
    process.env
      .VOICE_INTERNAL_API_TOKEN
      ?.trim();

  return {
    "content-type":
      "application/json",
    ...(token
      ? {
          "x-voice-internal-token":
            token,
        }
      : {}),
  };
}

function graphVersion() {
  const configured =
    process.env
      .WHATSAPP_GRAPH_VERSION
      ?.trim()
    || "v25.0";

  return /^v\d+\.\d+$/.test(
    configured,
  )
    ? configured
    : "v25.0";
}

function graphToken() {
  return (
    process.env
      .WHATSAPP_ACCESS_TOKEN
      ?.trim()
    || process.env
      .WHATSAPP_TOKEN
      ?.trim()
    || ""
  );
}

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

function errorDescription(
  payload: unknown,
) {
  const root =
    asObject(payload);

  const graphError =
    asObject(root?.error);

  const code =
    graphError?.code;

  const subcode =
    graphError?.error_subcode;

  const message =
    typeof graphError?.message
      === "string"
      ? graphError.message
      : null;

  return [
    code !== undefined
      ? `code=${String(code)}`
      : null,
    subcode !== undefined
      ? `subcode=${String(subcode)}`
      : null,
    message
      ? `message=${message.slice(0, 240)}`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

async function requestJson(
  url: string,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => controller.abort(),
      timeoutMs,
    );

  try {
    const response =
      await fetch(
        url,
        {
          ...init,
          signal:
            controller.signal,
        },
      );

    const text =
      await response.text();

    let body: unknown = {};

    if (text.trim()) {
      try {
        body =
          JSON.parse(text);
      } catch {
        body = {
          raw:
            text.slice(0, 300),
        };
      }
    }

    if (!response.ok) {
      throw new CallingSignalingError(
        "HTTP_ERROR",
        `HTTP ${response.status} ${errorDescription(body)}`.trim(),
        response.status,
      );
    }

    return body;
  } catch (error) {
    if (
      error instanceof
        CallingSignalingError
    ) {
      throw error;
    }

    if (
      error instanceof Error
      && error.name
        === "AbortError"
    ) {
      throw new CallingSignalingError(
        "REQUEST_TIMEOUT",
        `La solicitud superó ${timeoutMs} ms.`,
      );
    }

    throw new CallingSignalingError(
      "NETWORK_ERROR",
      error instanceof Error
        ? error.message.slice(0, 300)
        : "Falló la solicitud de señalización.",
    );
  } finally {
    clearTimeout(timer);
  }
}

function auditPath() {
  return (
    process.env
      .VOICE_META_SIGNALING_AUDIT_PATH
      ?.trim()
    || (
      "/opt/ventas-ia-mayorista"
      + "/data/whatsapp-calling"
      + "/signaling.jsonl"
    )
  );
}

async function audit(
  value: JsonObject,
) {
  const path =
    auditPath();

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
    `${JSON.stringify({
      timestamp:
        new Date()
          .toISOString(),
      ...value,
    })}\n`,
    {
      encoding:
        "utf8",
      mode:
        0o600,
    },
  );
}

async function safeAudit(
  value: JsonObject,
) {
  try {
    await audit(value);
  } catch (error) {
    console.error(
      "[WHATSAPP CALLING AUDIT ERROR]",
      error,
    );
  }
}

async function createWorkerAnswer(
  event: CallingSignalingEvent,
  companyId: string,
) {
  if (
    !event.sdp
    || event.sdpType
      !== "offer"
  ) {
    throw new CallingSignalingError(
      "INVALID_META_OFFER",
      "El evento connect no contiene una oferta SDP válida.",
    );
  }

  const response =
    await requestJson(
      `${voiceRuntimeUrl()}/internal/meta/webrtc/offer`,
      {
        method:
          "POST",
        headers:
          voiceHeaders(),
        body:
          JSON.stringify({
            call_id:
              event.callId,
            company_id:
              companyId,
            contact_phone:
              event.from,
            sdp:
              event.sdp,
            sdp_type:
              "offer",
            metadata: {
              provider:
                "whatsapp_cloud",
              direction:
                event.direction,
              phone_number_id:
                event.phoneNumberId,
              waba_id:
                event.wabaId,
            },
          }),
      },
      20_000,
    );

  const answer =
    asObject(response);

  if (
    answer?.ok !== true
    || typeof answer.sdp
      !== "string"
    || answer.sdp_type
      !== "answer"
    || typeof answer.session_id
      !== "string"
  ) {
    throw new CallingSignalingError(
      "INVALID_WORKER_ANSWER",
      "El runtime de voz devolvió una respuesta SDP inválida.",
    );
  }

  return answer as WorkerAnswer;
}

async function closeWorkerCall(
  callId: string,
) {
  const response =
    await requestJson(
      `${voiceRuntimeUrl()}/internal/meta/webrtc/${encodeURIComponent(callId)}`,
      {
        method:
          "DELETE",
        headers:
          voiceHeaders(),
      },
      8_000,
    );

  const value =
    asObject(response);

  return value?.closed === true;
}

async function sendGraphAction(
  event: CallingSignalingEvent,
  action:
    | "pre_accept"
    | "accept",
  answer: WorkerAnswer,
) {
  const token =
    graphToken();

  const phoneNumberId =
    event.phoneNumberId
    || process.env
      .WHATSAPP_PHONE_NUMBER_ID
      ?.trim()
    || "";

  if (!token) {
    throw new CallingSignalingError(
      "META_TOKEN_MISSING",
      "No hay token vigente de Meta configurado.",
    );
  }

  if (!phoneNumberId) {
    throw new CallingSignalingError(
      "META_PHONE_ID_MISSING",
      "No hay phone-number-id configurado.",
    );
  }

  const response =
    await requestJson(
      `https://graph.facebook.com/${graphVersion()}/${encodeURIComponent(phoneNumberId)}/calls`,
      {
        method:
          "POST",
        headers: {
          "authorization":
            `Bearer ${token}`,
          "content-type":
            "application/json",
        },
        body:
          JSON.stringify({
            messaging_product:
              "whatsapp",
            call_id:
              event.callId,
            action,
            session: {
              sdp_type:
                "answer",
              sdp:
                answer.sdp,
            },
            ...(action === "accept"
              ? {
                  biz_opaque_callback_data:
                    answer.session_id,
                }
              : {}),
          }),
      },
      12_000,
    );

  const value =
    asObject(response);

  if (
    value?.success !== true
    && value
      ?.messaging_product
      !== "whatsapp"
  ) {
    throw new CallingSignalingError(
      "META_ACTION_REJECTED",
      `Meta no confirmó ${action}.`,
    );
  }
}

async function waitForWorkerConnection(
  callId: string,
  timeoutMs = 3_500,
) {
  const deadline =
    Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const response =
      await requestJson(
        `${voiceRuntimeUrl()}/internal/meta/webrtc/active`,
        {
          method:
            "GET",
          headers:
            voiceHeaders(),
        },
        2_000,
      );

    const root =
      asObject(response);

    const calls =
      Array.isArray(root?.calls)
        ? root.calls
        : [];

    const current =
      calls
        .map(asObject)
        .find(
          (item) =>
            item?.call_id
              === callId,
        );

    const state =
      typeof current
        ?.connection_state
        === "string"
        ? current.connection_state
        : null;

    if (state === "connected") {
      return true;
    }

    if (
      state === "failed"
      || state === "closed"
    ) {
      return false;
    }

    await new Promise<void>(
      (resolve) => {
        setTimeout(resolve, 150);
      },
    );
  }

  return false;
}

async function processConnect(
  event: CallingSignalingEvent,
  companyId: string,
): Promise<SignalingResult> {
  const mode =
    signalingMode();

  if (mode === "disabled") {
    return {
      handled:
        false,
      callId:
        event.callId,
      event:
        event.event,
      mode,
      reason:
        "signaling_disabled",
    };
  }

  const answer =
    await createWorkerAnswer(
      event,
      companyId,
    );

  if (mode === "dry_run") {
    const workerClosed =
      await closeWorkerCall(
        event.callId,
      ).catch(
        () => false,
      );

    const result: SignalingResult = {
      handled:
        true,
      callId:
        event.callId,
      event:
        event.event,
      mode,
      workerSessionId:
        answer.session_id,
      preAccepted:
        false,
      accepted:
        false,
      workerClosed,
      reason:
        "meta_action_skipped",
    };

    await safeAudit({
      ...result,
      answerSdpBytes:
        answer.sdp.length,
      answerSdpType:
        answer.sdp_type,
    });

    return result;
  }

  try {
    await sendGraphAction(
      event,
      "pre_accept",
      answer,
    );

    const mediaConnected =
      await waitForWorkerConnection(
        event.callId,
      );

    await sendGraphAction(
      event,
      "accept",
      answer,
    );

    const result: SignalingResult = {
      handled:
        true,
      callId:
        event.callId,
      event:
        event.event,
      mode,
      workerSessionId:
        answer.session_id,
      preAccepted:
        true,
      accepted:
        true,
      reason:
        mediaConnected
          ? "media_connected_before_accept"
          : "accept_after_connection_timeout",
    };

    await safeAudit({
      ...result,
    });

    return result;
  } catch (error) {
    await closeWorkerCall(
      event.callId,
    ).catch(
      () => false,
    );

    throw error;
  }
}

async function processEvent(
  event: CallingSignalingEvent,
  companyId: string,
): Promise<SignalingResult> {
  const normalizedEvent =
    event.event
      .trim()
      .toLowerCase();

  if (
    normalizedEvent
      === "connect"
  ) {
    return processConnect(
      event,
      companyId,
    );
  }

  if (
    normalizedEvent
      .endsWith("terminate")
  ) {
    const closed =
      await closeWorkerCall(
        event.callId,
      ).catch(
        () => false,
      );

    const result: SignalingResult = {
      handled:
        true,
      callId:
        event.callId,
      event:
        event.event,
      mode:
        signalingMode(),
      workerClosed:
        closed,
    };

    await safeAudit({
      ...result,
    });

    return result;
  }

  return {
    handled:
      false,
    callId:
      event.callId,
    event:
      event.event,
    mode:
      signalingMode(),
    reason:
      "event_not_actionable",
  };
}

export function handleWhatsappCallingSignaling(
  event: CallingSignalingEvent,
  companyId: string,
) {
  const operationKey =
    `${event.callId}:${event.event.trim().toLowerCase()}`;

  const existing =
    activeOperations.get(
      operationKey,
    );

  if (existing) {
    return existing;
  }

  const operation =
    processEvent(
      event,
      companyId,
    )
      .then(
        async (result) => {
          console.log(
            "[WHATSAPP CALLING SIGNALING]",
            {
              callId:
                result.callId,
              event:
                result.event,
              mode:
                result.mode,
              handled:
                result.handled,
              preAccepted:
                result.preAccepted,
              accepted:
                result.accepted,
              workerClosed:
                result.workerClosed,
              reason:
                result.reason,
            },
          );

          return result;
        },
      )
      .finally(
        () => {
          activeOperations.delete(
            operationKey,
          );
        },
      );

  activeOperations.set(
    operationKey,
    operation,
  );

  return operation;
}
