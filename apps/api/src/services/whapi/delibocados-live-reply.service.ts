import { updateConversationMetadata } from "../conversations/conversation.repository.js";
import { classifyRestaurantIntent } from "../agent/restaurant-ops-conversation.service.js";
import { handleRestaurantCheckoutMessage } from "../restaurant-ops/restaurant-whatsapp-checkout.service.js";
import { handleNaturalRestaurantTurn } from "../restaurant-ops/restaurant-natural-agent.service.js";
import { handleRestaurantWhatsAppPin } from "../restaurant-ops/restaurant-whatsapp-location.service.js";
import type { IncomingWhapiPoint } from "./whapi-location-parser.service.js";
import { findMessageByExternalId } from "../conversations/conversation.repository.js";
import { existsSync } from "node:fs";
import { getDelibocadosChannel, type DelibocadosChannel } from "./delibocados-channel.service.js";

import {
  executeCompanyAgent,
} from "../agent/company-agent-execution.service.js";

import {
  getOperatorMode,
  setOperatorMode,
} from "../operator/operator.service.js";

import {
  saveMessage,
} from "./whapi-durable-message.service.js";

type Incoming = {
  companyId: string;
  phone: string;
  sourceMessageId: string;
  text: string;
  location?: IncomingWhapiPoint;
  occurredAt?: string;
};

type ChannelConfig = DelibocadosChannel;

const STOP_FILE = "/root/delibocados-ai.stop";

const pending = new Map<string, Promise<void>>();

async function getConfig(): Promise<ChannelConfig | null> {
  if (existsSync(STOP_FILE)) return null;
  try {
    return await getDelibocadosChannel();
  } catch {
    return null;
  }
}

async function verifyChannel(
  config: ChannelConfig
): Promise<boolean> {
  const response = await fetch(
    "https://gate.whapi.cloud/health?wakeup=false",
    {
      headers: {
        Authorization: `Bearer ${config.token}`,
      },
      signal: AbortSignal.timeout(15000),
    }
  );

  if (!response.ok) {
    throw new Error(
      `DELI_WHAPI_HEALTH_HTTP_${response.status}`
    );
  }

  const health = await response.json() as {
    user?: {
      id?: string;
    };
  };

  const sender = String(
    health.user?.id ?? ""
  )
    .split("@")[0]
    .replace(/\D/g, "");

  return sender.length > 0 &&
    sender === config.phone;
}

async function processMessage(
  input: Incoming
): Promise<void> {
  if (input.companyId !== "delibocados") {
    return;
  }

  if (!/^[0-9]{8,15}$/.test(input.phone)) {
    return;
  }

  const config = await getConfig();

  if (!config) {
    return;
  }

  // Public rollout requires an explicit second opt-in; default is test-only.
  const liveMode = process.env.DELIBOCADOS_CHECKOUT_LIVE === "1";
  if (
    !liveMode &&
    (!config.testPhone || input.phone !== config.testPhone)
  ) {
    return;
  }

  // No responder mensajes antiguos recibidos por reintentos.
  const timestamp = Date.parse(
    input.occurredAt ?? ""
  );

  if (
    !Number.isFinite(timestamp) ||
    Math.abs(Date.now() - timestamp) > 600000
  ) {
    console.log("[DELI AI] Mensaje antiguo ignorado");
    return;
  }

  // Respetar conversaciones tomadas por un empleado.
  const mode = await getOperatorMode(
    input.phone,
    "delibocados"
  );

  if (mode.status !== "ai") {
    console.log("[DELI AI] Conversación en modo humano");
    return;
  }

  if (!(await verifyChannel(config))) {
    throw new Error("DELI_WHAPI_WRONG_SENDER");
  }

  // Motor existente: perfil, historial, memoria y catálogo.
  const stored = await findMessageByExternalId(
    input.sourceMessageId,
    "delibocados"
  );

  if (!stored?.id) {
    throw new Error("DELI_AI_MESSAGE_NOT_PERSISTED");
  }

  // Pruebas de derivación humana: no resolver reclamos graves con un modelo.
  if (process.env.DELIBOCADOS_OPERATIONS_AI_CONTEXT === "1" &&
      classifyRestaurantIntent(input.text) === "complaint") {
    await updateConversationMetadata(input.phone, {
      restaurant_attention: {
        type: "complaint",
        status: "needs_human",
        last_source_message_id: input.sourceMessageId,
        reported_at: new Date().toISOString()
      }
    }, "delibocados");
    await setOperatorMode({
      companyId: "delibocados", contactPhone: input.phone,
      status: "human", reason: "Reclamación gastronómica que requiere atención"
    });
    console.log("[DELI AI HANDOFF]", { last4: input.phone.slice(-4), reason: "complaint" });
    return;
  }

  // Restaurant checkout is deterministic and persists the confirmed order through
  // a transactional RPC. All other messages continue through the regular AI.
  const intelligentTest = !liveMode && config.testPhone === input.phone &&
    process.env.DELIBOCADOS_AGENT_V2_TEST === "1";
  // Do not feed a GPS object as the literal text "[location]" to the LLM.
  // Test-only pin handling is deterministic and never creates an order.
  if(input.location && !intelligentTest)return;
  const checkout = input.location
    ? await handleRestaurantWhatsAppPin({
        phone:input.phone,
        point:{lat:input.location.lat,lng:input.location.lng},
        live:input.location.live,
        sourceMessageId:input.sourceMessageId
      })
    : intelligentTest
    ? await handleNaturalRestaurantTurn({
        companyId:"delibocados",phone:input.phone,
        message:input.text,currentMessageId:stored.id
      })
    : (liveMode || process.env.DELIBOCADOS_CHECKOUT_TEST === "1")
      ? await handleRestaurantCheckoutMessage({
          companyId:"delibocados",phone:input.phone,message:input.text
        })
      : { handled:false,text:"",imageUrl:undefined as string|undefined };
  const result = checkout.handled ? checkout : await executeCompanyAgent({
    companyId: "delibocados",
    phone: input.phone,
    message: input.text,
    currentMessageId: stored.id,
  });

  const reply = String(
    result.text ?? ""
  ).trim().slice(0, 1800);

  if (!reply) {
    throw new Error("DELI_AI_EMPTY_REPLY");
  }

  // Protección adicional contra respuestas de otras empresas.
  if (/Fulanitas|Eventos Mediterráneo/i.test(reply)) {
    throw new Error("DELI_AI_WRONG_COMPANY");
  }

  // Volver a comprobar permisos y canal antes de enviar.
  const latest = await getConfig();

  if (
    !latest ||
    latest.phone !== config.phone ||
    latest.token !== config.token
  ) {
    return;
  }

  if (
    !liveMode &&
    (!latest.testPhone || latest.testPhone !== input.phone)
  ) {
    return;
  }

  const currentMode = await getOperatorMode(
    input.phone,
    "delibocados"
  );

  if (currentMode.status !== "ai") {
    return;
  }

  if (!(await verifyChannel(latest))) {
    throw new Error("DELI_WHAPI_WRONG_SENDER");
  }

  const imageUrl = "imageUrl" in result ? result.imageUrl : undefined;
  const response = await fetch(
    imageUrl ? "https://gate.whapi.cloud/messages/image" : "https://gate.whapi.cloud/messages/text",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${latest.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(imageUrl
        ? { to: input.phone, media: imageUrl, caption: reply }
        : { to: input.phone, body: reply }),

      signal: AbortSignal.timeout(20000),
    }
  );

  if (!response.ok) {
    throw new Error(
      `DELI_WHAPI_SEND_HTTP_${response.status}`
    );
  }

  const sent = await response.json() as {
    id?: string;
    message?: {
      id?: string;
    };
  };

  // Acknowledge allergy / food-safety issue BEFORE switching to human mode.
  if ("humanHandoff" in checkout && checkout.humanHandoff) {
    await setOperatorMode({
      companyId: "delibocados",
      contactPhone: input.phone,
      status: "human",
      reason: "Alergia o seguridad alimentaria: revisión de ingredientes"
    });
  }

  // Persistir la respuesta en el CRM del restaurante.
  await saveMessage({
    contact_phone: input.phone,
    external_message_id:
      sent.id ?? sent.message?.id,
    direction: "outbound",
    channel: "whatsapp",
    message_type: imageUrl ? "image" : "text",
    body: reply,
    media: {
      source: checkout.handled ? "restaurant_checkout" : "ai",
      provider: "whapi",
      ...(imageUrl ? {url: imageUrl}: {}),
      trigger_message_id: input.sourceMessageId,
    },
    raw_payload: {
      provider: "whapi",
      response: sent,
    },
    delivery_status: "queued",
    occurred_at: new Date().toISOString(),
  }, "delibocados", {
    trustedSource: "ai",
  });

  console.log("[DELI AI SENT]", {
    last4: input.phone.slice(-4),
    length: reply.length,
  });
}

export function queueDelibocadosLiveReply(
  input: Incoming
): void {
  if (
    input.companyId !== "delibocados" ||
    existsSync(STOP_FILE)
  ) {
    return;
  }

  const key = `${input.companyId}:${input.phone}`;

  if (!pending.has(key) && pending.size >= 100) {
    console.error("[DELI AI] Cola llena");
    return;
  }

  const previous =
    pending.get(key) ?? Promise.resolve();

  const current = previous
    .catch(() => undefined)
    .then(() => processMessage(input));

  pending.set(key, current);

  void current
    .catch((error: unknown) => {
      console.error(
        "[DELI AI ERROR]",
        error instanceof Error
          ? error.message
          : "UNKNOWN"
      );
    })
    .finally(() => {
      if (pending.get(key) === current) {
        pending.delete(key);
      }
    });
}
