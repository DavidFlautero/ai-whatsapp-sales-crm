import type {
  EventIntakeDraft,
  ExtractedFact,
  IntakeDate,
} from "./event-intake.service.js";

/**
 * Estado estructurado de una solicitud.
 *
 * Este módulo:
 * - Consolida mensajes.
 * - Conserva evidencia.
 * - Detecta cambios.
 * - Ignora mensajes repetidos.
 *
 * No decide qué solicitud corresponde al cliente.
 * Esa decisión pertenece al orquestador y al CRM.
 */

export type CapturedFact<T> = {
  value: T;
  evidence: string;
  messageId: string;
  certainty: "explicit";
};

export type IntakeState = {
  version: number;

  processedMessageIds: string[];

  eventType:
    CapturedFact<string> | null;

  venueType:
    CapturedFact<string> | null;

  location:
    CapturedFact<string> | null;

  attendees:
    CapturedFact<number> | null;

  sleepers:
    CapturedFact<number> | null;

  budgetMaxEur:
    CapturedFact<number> | null;

  dateOptions:
    CapturedFact<IntakeDate>[];

  dateRange:
    CapturedFact<{
      start: IntakeDate;
      end: IntakeDate;
    }> | null;

  amenities:
    CapturedFact<string>[];
};

export type IntakeMergeResult = {
  state: IntakeState | null;
  applied: boolean;
  changedFields: string[];
};

export function emptyIntakeState(): IntakeState {
  return {
    version: 0,
    processedMessageIds: [],
    eventType: null,
    venueType: null,
    location: null,
    attendees: null,
    sleepers: null,
    budgetMaxEur: null,
    dateOptions: [],
    dateRange: null,
    amenities: [],
  };
}

function capture<T>(
  fact: ExtractedFact<T>,
  messageId: string,
): CapturedFact<T> {
  return {
    value: fact.value,
    evidence: fact.evidence,
    certainty: "explicit",
    messageId,
  };
}

function sameValue(
  a: unknown,
  b: unknown,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function mergeEventIntake(
  previous: IntakeState | null,
  incoming: EventIntakeDraft,
  messageId: string,
): IntakeMergeResult {

  if (!messageId.trim()) {
    throw new Error("MESSAGE_ID_REQUIRED");
  }

  if (
    previous?.processedMessageIds.includes(
      messageId,
    )
  ) {
    return {
      state: previous,
      applied: false,
      changedFields: [],
    };
  }

  // No iniciar un expediente por un simple saludo.

  if (
    !previous &&
    !incoming.eventIntent
  ) {
    return {
      state: null,
      applied: false,
      changedFields: [],
    };
  }

  const state: IntakeState = previous
    ? structuredClone(previous)
    : emptyIntakeState();

  const changedFields: string[] = [];

  function updateField<
    T extends string | number
  >(
    key:
      | "eventType"
      | "venueType"
      | "location"
      | "attendees"
      | "sleepers"
      | "budgetMaxEur",
    current: CapturedFact<T> | null,
    next: ExtractedFact<T> | null,
  ): CapturedFact<T> | null {

    if (!next) {
      return current;
    }

    if (
      !current ||
      !sameValue(
        current.value,
        next.value,
      )
    ) {
      changedFields.push(key);
      return capture(next, messageId);
    }

    return current;
  }

  state.eventType = updateField(
    "eventType",
    state.eventType,
    incoming.eventType,
  );

  state.venueType = updateField(
    "venueType",
    state.venueType,
    incoming.venueType,
  );

  state.location = updateField(
    "location",
    state.location,
    incoming.location,
  );

  state.attendees = updateField(
    "attendees",
    state.attendees,
    incoming.attendees,
  );

  state.sleepers = updateField(
    "sleepers",
    state.sleepers,
    incoming.sleepers,
  );

  state.budgetMaxEur = updateField(
    "budgetMaxEur",
    state.budgetMaxEur,
    incoming.budgetMaxEur,
  );

  // Una nueva fecha explícita sustituye las fechas
  // anteriores de este expediente.
  // El orquestador deberá verificar que realmente
  // se está hablando del mismo evento.

  if (incoming.dateOptions.length > 0) {

    const nextDates =
      incoming.dateOptions.map(
        item => capture(item, messageId),
      );

    if (
      !sameValue(
        state.dateOptions.map(
          item => item.value,
        ),
        nextDates.map(
          item => item.value,
        ),
      )
    ) {
      state.dateOptions = nextDates;
      state.dateRange = null;
      changedFields.push("dateOptions");
    }
  }

  if (incoming.dateRange) {

    const nextRange = capture(
      incoming.dateRange,
      messageId,
    );

    if (
      !sameValue(
        state.dateRange?.value,
        nextRange.value,
      )
    ) {
      state.dateRange = nextRange;
      state.dateOptions = [];
      changedFields.push("dateRange");
    }
  }

  // Las instalaciones se conservan sin duplicados.

  for (const amenity of incoming.amenities) {

    const alreadyExists =
      state.amenities.some(
        item =>
          item.value === amenity.value,
      );

    if (!alreadyExists) {
      state.amenities.push(
        capture(amenity, messageId),
      );

      changedFields.push("amenities");
    }
  }

  state.processedMessageIds.push(
    messageId,
  );

  state.version += 1;

  return {
    state,
    applied: true,
    changedFields: [
      ...new Set(changedFields),
    ],
  };
}
