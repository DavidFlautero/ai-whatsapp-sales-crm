import {
  z,
} from "zod";

import {
  VOICE_CALL_STATUSES,
} from "./voice.types.js";

import {
  voiceJsonSchema,
} from "./voice-profile.schema.js";

const nullableText =
  z.string()
    .trim()
    .max(2000)
    .nullable();

const phoneSchema =
  z.string()
    .trim()
    .min(3)
    .max(40);

export const createVoiceCallSchema =
  z.object({
    direction:
      z.enum([
        "inbound",
        "outbound",
      ]),

    contact_phone:
      phoneSchema,

    from_number:
      nullableText
        .optional()
        .default(null),

    to_number:
      nullableText
        .optional()
        .default(null),

    route_id:
      z.string()
        .uuid()
        .nullable()
        .optional()
        .default(null),

    external_call_id:
      nullableText
        .optional()
        .default(null),

    metadata:
      voiceJsonSchema
        .default({}),
  })
  .strict();

export const transitionVoiceCallSchema =
  z.object({
    status:
      z.enum(
        VOICE_CALL_STATUSES,
      ),

    external_event_id:
      nullableText
        .optional()
        .default(null),

    actor_type:
      z.enum([
        "customer",
        "assistant",
        "operator",
        "provider",
        "system",
      ]).default("system"),

    reason:
      nullableText
        .optional()
        .default(null),

    disposition:
      nullableText.optional(),

    summary:
      nullableText.optional(),

    transferred_to:
      nullableText.optional(),

    recording_consent:
      z.boolean()
        .nullable()
        .optional(),

    recording_url:
      z.string()
        .url()
        .max(2000)
        .nullable()
        .optional(),

    metadata:
      voiceJsonSchema
        .default({}),
  })
  .strict();

export const voiceTakeoverSchema =
  z.object({
    reason:
      z.string()
        .trim()
        .min(2)
        .max(500)
        .default(
          "Llamada tomada por operador.",
        ),

    destination:
      z.string()
        .trim()
        .max(120)
        .nullable()
        .optional()
        .default(null),
  })
  .strict();

export const voiceEventInputSchema =
  z.object({
    external_event_id:
      nullableText
        .optional()
        .default(null),

    event_type:
      z.string()
        .trim()
        .min(2)
        .max(120),

    actor_type:
      z.enum([
        "customer",
        "assistant",
        "operator",
        "provider",
        "system",
      ]).default("system"),

    occurred_at:
      z.string()
        .datetime()
        .optional(),

    payload:
      voiceJsonSchema
        .default({}),
  })
  .strict();

export const voiceTranscriptInputSchema =
  z.object({
    sequence_number:
      z.number()
        .int()
        .min(0),

    speaker:
      z.enum([
        "customer",
        "assistant",
        "operator",
        "system",
      ]),

    text:
      z.string()
        .trim()
        .min(1)
        .max(20000),

    is_final:
      z.boolean()
        .default(true),

    confidence:
      z.number()
        .min(0)
        .max(1)
        .nullable()
        .optional(),

    starts_at_ms:
      z.number()
        .int()
        .min(0)
        .nullable()
        .optional(),

    ends_at_ms:
      z.number()
        .int()
        .min(0)
        .nullable()
        .optional(),

    metadata:
      voiceJsonSchema
        .default({}),
  })
  .strict()
  .superRefine(
    (input, context) => {
      if (
        input.starts_at_ms != null
        && input.ends_at_ms != null
        && input.ends_at_ms
          < input.starts_at_ms
      ) {
        context.addIssue({
          code:
            "custom",
          path:
            ["ends_at_ms"],
          message:
            "El final no puede ser anterior al inicio.",
        });
      }
    },
  );

export type CreateVoiceCallInput =
  z.infer<
    typeof createVoiceCallSchema
  >;

export type TransitionVoiceCallInput =
  z.infer<
    typeof transitionVoiceCallSchema
  >;

export type VoiceTakeoverInput =
  z.infer<
    typeof voiceTakeoverSchema
  >;

export type VoiceEventInput =
  z.infer<
    typeof voiceEventInputSchema
  >;

export type VoiceTranscriptInput =
  z.infer<
    typeof voiceTranscriptInputSchema
  >;
