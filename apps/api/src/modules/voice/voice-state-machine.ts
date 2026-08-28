import type {
  VoiceCallStatus,
} from "./voice.types.js";

export class VoiceDomainError
  extends Error {
  readonly code: string;

  constructor(
    code: string,
    message: string,
  ) {
    super(message);
    this.name = "VoiceDomainError";
    this.code = code;
  }
}

const transitions:
  Readonly<
    Record<
      VoiceCallStatus,
      readonly VoiceCallStatus[]
    >
  > = {
  queued: [
    "ringing",
    "connecting",
    "cancelled",
    "failed",
  ],

  ringing: [
    "connecting",
    "in_progress",
    "busy",
    "no_answer",
    "cancelled",
    "failed",
  ],

  connecting: [
    "ringing",
    "in_progress",
    "busy",
    "no_answer",
    "cancelled",
    "failed",
  ],

  in_progress: [
    "on_hold",
    "transferring",
    "completed",
    "failed",
  ],

  on_hold: [
    "in_progress",
    "transferring",
    "completed",
    "cancelled",
    "failed",
  ],

  transferring: [
    "transferred",
    "in_progress",
    "completed",
    "failed",
  ],

  transferred: [
    "completed",
    "failed",
  ],

  completed: [],
  failed: [],
  busy: [],
  no_answer: [],
  cancelled: [],
};

const terminalStatuses =
  new Set<VoiceCallStatus>([
    "completed",
    "failed",
    "busy",
    "no_answer",
    "cancelled",
  ]);

export function isTerminalVoiceStatus(
  status: VoiceCallStatus,
): boolean {
  return terminalStatuses.has(status);
}

export function canTransitionVoiceCall(
  from: VoiceCallStatus,
  to: VoiceCallStatus,
): boolean {
  if (from === to) {
    return true;
  }

  return transitions[from].includes(to);
}

export function assertVoiceTransition(
  from: VoiceCallStatus,
  to: VoiceCallStatus,
): void {
  if (canTransitionVoiceCall(from, to)) {
    return;
  }

  throw new VoiceDomainError(
    "INVALID_CALL_TRANSITION",
    `No se puede pasar una llamada de ${from} a ${to}.`,
  );
}
