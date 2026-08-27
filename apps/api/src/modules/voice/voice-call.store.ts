import type {
  VoiceCallSession,
  VoiceCallStatus,
} from "./voice.types.js";

export const memoryVoiceCalls =
  new Map<string, VoiceCallSession>();

export const activeVoiceStatuses:
  readonly VoiceCallStatus[] = [
  "queued",
  "ringing",
  "connecting",
  "in_progress",
  "on_hold",
  "transferring",
];

export function voiceNow(): string {
  return new Date().toISOString();
}

export function voiceCallKey(
  companyId: string,
  callId: string,
): string {
  return `${companyId}:${callId}`;
}
