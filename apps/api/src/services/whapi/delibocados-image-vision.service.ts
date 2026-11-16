import { resolveMessageMedia } from "../messages/message-media.service.js";
import { queueDelibocadosLiveReply } from "./delibocados-live-reply.service.js";

type ImageJob = {
  messageId: string;
  phone: string;
  sourceMessageId: string;
  occurredAt?: string;
  caption?: string;
};

function imageMime(buffer: Buffer): "image/jpeg" | "image/png" | "image/webp" | "image/gif" | null {
  if (buffer.length >= 3 && buffer.subarray(0, 3).toString("hex") === "ffd8ff") return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return "image/png";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buffer.length >= 6 && /^GIF8[79]a$/.test(buffer.toString("ascii", 0, 6))) return "image/gif";
  return null;
}

async function describeImage(job: ImageJob): Promise<void> {
  // Off unless explicitly enabled, and never inspect payments or other tenants.
  if (process.env.DELIBOCADOS_IMAGE_VISION_TEST !== "1") return;
  const media = await resolveMessageMedia({ messageId: job.messageId, companyId: "delibocados" });
  if (!media.size || media.size > 5 * 1024 * 1024) throw new Error("DELI_VISION_IMAGE_SIZE");
  const mime = imageMime(media.buffer);
  if (!mime) throw new Error("DELI_VISION_UNSUPPORTED_IMAGE");
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("DELI_VISION_API_KEY_MISSING");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.DELIBOCADOS_VISION_MODEL || "gpt-4.1-mini",
      store: false,
      max_output_tokens: 250,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: [
            "Describí brevemente y de forma objetiva la imagen que envió un cliente de un restaurante.",
            "Puede ser una comida, carta, referencia, dirección u otro objeto.",
            "No interpretes comprobantes como pagos confirmados. No identifiques personas.",
            "No inventes precios, ingredientes, disponibilidad ni datos no visibles.",
            "Si parece comprobante bancario, contestá exactamente: IMAGEN_DE_PAGO_REVISION_HUMANA.",
            job.caption ? `Contexto escrito por el cliente: ${job.caption.slice(0, 500)}` : ""
          ].filter(Boolean).join("\n") },
          { type: "input_image", image_url: `data:${mime};base64,${media.buffer.toString("base64")}` }
        ]
      }]
    }),
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`DELI_VISION_HTTP_${response.status}`);
  const data = await response.json() as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  const description = (data.output_text || data.output?.flatMap(o => o.content ?? [])
    .filter(c => c.type === "output_text").map(c => c.text ?? "").join("\n") || "").trim();
  if (!description) throw new Error("DELI_VISION_EMPTY");
  if (description.includes("IMAGEN_DE_PAGO_REVISION_HUMANA")) {
    console.log("[DELI VISION] Possible payment proof; not sent to agent", { messageId: job.messageId });
    return;
  }
  queueDelibocadosLiveReply({
    companyId: "delibocados",
    phone: job.phone,
    sourceMessageId: job.sourceMessageId,
    occurredAt: job.occurredAt,
    text: `El cliente compartió una imagen. Descripción visual (no verificada): ${description.slice(0, 800)}. ${job.caption ? "Mensaje adjunto: " + job.caption.slice(0, 500) : ""} No confirmes pedidos o pagos solamente por la imagen.`
  });
}

export function queueDelibocadosImageVision(job: ImageJob): void {
  if (process.env.DELIBOCADOS_IMAGE_VISION_TEST !== "1") return;
  void describeImage(job).catch((error: unknown) => {
    console.error("[DELI VISION ERROR]", {
      messageId: job.messageId,
      reason: error instanceof Error ? error.message : "UNKNOWN"
    });
  });
}
