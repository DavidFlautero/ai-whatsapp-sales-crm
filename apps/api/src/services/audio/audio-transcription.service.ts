import fs from "fs";
import path from "path";
import { transcribeAudio as transcribeWithGroq } from "./groq-transcription.service.js";

type AudioInput =
  | string
  | Buffer
  | {
      buffer?: Buffer;
      filePath?: string;
      path?: string;
      filename?: string;
      mimeType?: string;
      url?: string;
      mediaUrl?: string;
    };

async function saveBufferToTempFile(buffer: Buffer, filename = "audio.ogg"): Promise<string> {
  await fs.promises.mkdir("./temp", { recursive: true });

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = path.join("./temp", `${Date.now()}-${safeFilename}`);

  await fs.promises.writeFile(filePath, buffer);

  console.log("[AUDIO SAVED]", filePath);

  return filePath;
}

async function downloadAudio(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed downloading audio: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();

  return saveBufferToTempFile(
    Buffer.from(arrayBuffer),
    "whatsapp-audio.ogg"
  );
}

export async function transcribeAudio(input: AudioInput): Promise<string> {
  let filePath: string | undefined;

  if (typeof input === "string") {
    filePath = input;
  } else if (Buffer.isBuffer(input)) {
    filePath = await saveBufferToTempFile(input);
  } else {
    if (input.buffer) {
      filePath = await saveBufferToTempFile(
        input.buffer,
        input.filename ?? "whatsapp-audio.ogg"
      );
    }

    if (!filePath) {
      filePath = input.filePath || input.path;
    }

    const url = input.url || input.mediaUrl;

    if (!filePath && url) {
      filePath = await downloadAudio(url);
    }
  }

  if (!filePath) {
    throw new Error("Invalid audio input: missing buffer/filePath/url");
  }

  const transcription = await transcribeWithGroq(filePath);

  console.log("[AUDIO TRANSCRIPTION]", transcription);

  return transcription;
}
