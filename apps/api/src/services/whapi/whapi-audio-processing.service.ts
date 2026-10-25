import {
  resolveMessageMedia,
} from "../messages/message-media.service.js";

import {
  transcribeAudio,
} from "../audio/audio-transcription.service.js";

import {
  updateMessageBody,
} from "../conversations/conversation.repository.js";

type AudioJob = {
  messageId: string;
  companyId: string;
};

async function processAudio(job: AudioJob): Promise<void> {
  const media = await resolveMessageMedia({
    messageId: job.messageId,
    companyId: job.companyId,
  });

  if (!media.size || media.size > 20 * 1024 * 1024) {
    throw new Error("AUDIO_SIZE_NOT_SUPPORTED");
  }

  const supportedName =
    /\.(ogg|oga|mp3|mp4|m4a|wav|webm|flac)$/i.test(
      media.filename,
    );

  const filename = supportedName
    ? media.filename
    : `${job.messageId}.ogg`;

  const transcription = (
    await transcribeAudio({
      buffer: media.buffer,
      filename,
      mimeType: media.mimeType,
    })
  ).trim();

  if (!transcription) {
    throw new Error("EMPTY_AUDIO_TRANSCRIPTION");
  }

  await updateMessageBody(
    job.messageId,
    transcription,
    job.companyId,
  );

  console.log("[WHAPI AUDIO TRANSCRIBED]", {
    messageId: job.messageId,
    characters: transcription.length,
  });
}

export function queueWhapiAudioTranscription(
  job: AudioJob,
): void {
  void processAudio(job).catch((error: unknown) => {
    console.error("[WHAPI AUDIO ERROR]", {
      messageId: job.messageId,
      reason:
        error instanceof Error
          ? error.message
          : "UNKNOWN_ERROR",
    });
  });
}
