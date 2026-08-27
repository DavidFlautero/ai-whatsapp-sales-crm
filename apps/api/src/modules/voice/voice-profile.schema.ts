import {
  z,
} from "zod";

export const voiceJsonSchema =
  z.record(
    z.string(),
    z.unknown(),
  );

const nullableShortText =
  z.string()
    .trim()
    .max(2000)
    .nullable();

export const voiceProfileUpdateSchema =
  z.object({
    enabled:
      z.boolean().optional(),

    inbound_enabled:
      z.boolean().optional(),

    outbound_enabled:
      z.boolean().optional(),

    display_name:
      z.string()
        .trim()
        .min(2)
        .max(120)
        .optional(),

    language:
      z.string()
        .trim()
        .min(2)
        .max(20)
        .optional(),

    timezone:
      z.string()
        .trim()
        .min(2)
        .max(100)
        .optional(),

    greeting:
      z.string()
        .trim()
        .min(2)
        .max(1000)
        .optional(),

    telephony_driver:
      z.string()
        .trim()
        .min(2)
        .max(80)
        .optional(),

    stt_engine:
      z.string()
        .trim()
        .min(2)
        .max(80)
        .optional(),

    tts_engine:
      z.string()
        .trim()
        .min(2)
        .max(80)
        .optional(),

    vad_engine:
      z.string()
        .trim()
        .min(2)
        .max(80)
        .optional(),

    voice_model_id:
      nullableShortText.optional(),

    voice_sample_url:
      z.string()
        .url()
        .max(2000)
        .nullable()
        .optional(),

    voice_clone_consent_at:
      z.string()
        .datetime()
        .nullable()
        .optional(),

    voice_clone_consent_by:
      nullableShortText.optional(),

    interruption_enabled:
      z.boolean().optional(),

    recording_enabled:
      z.boolean().optional(),

    recording_consent_message:
      nullableShortText.optional(),

    max_concurrent_calls:
      z.number()
        .int()
        .min(1)
        .max(100)
        .optional(),

    max_call_seconds:
      z.number()
        .int()
        .min(30)
        .max(14400)
        .optional(),

    retention_days:
      z.number()
        .int()
        .min(1)
        .max(3650)
        .optional(),

    business_hours:
      voiceJsonSchema.optional(),

    transfer_rules:
      voiceJsonSchema.optional(),

    settings:
      voiceJsonSchema.optional(),
  })
  .strict()
  .refine(
    (input) =>
      Object.keys(input).length > 0,
    {
      message:
        "Debe enviarse al menos un cambio.",
    },
  );

export const voiceRouteInputSchema =
  z.object({
    name:
      z.string()
        .trim()
        .min(2)
        .max(120),

    direction:
      z.enum([
        "inbound",
        "outbound",
        "both",
      ]).default("both"),

    did_number:
      nullableShortText
        .optional()
        .default(null),

    destination_type:
      z.enum([
        "voice_agent",
        "human",
        "queue",
        "voicemail",
      ]).default("voice_agent"),

    destination:
      nullableShortText
        .optional()
        .default(null),

    priority:
      z.number()
        .int()
        .min(0)
        .max(10000)
        .default(100),

    active:
      z.boolean()
        .default(true),

    conditions:
      voiceJsonSchema
        .default({}),

    metadata:
      voiceJsonSchema
        .default({}),
  })
  .strict()
  .superRefine(
    (input, context) => {
      if (
        input.destination_type
          !== "voice_agent"
        && !input.destination
      ) {
        context.addIssue({
          code:
            "custom",
          path:
            ["destination"],
          message:
            "El destino es obligatorio para rutas humanas, colas o buzón.",
        });
      }
    },
  );

export type VoiceProfileUpdateInput =
  z.infer<
    typeof voiceProfileUpdateSchema
  >;

export type VoiceRouteInput =
  z.infer<
    typeof voiceRouteInputSchema
  >;
